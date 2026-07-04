"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useReadContract, useReadContracts, useSignMessage, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { wagmiConfig } from "@/lib/wagmi";
import { marketFactoryContract } from "@/lib/contracts";
import { getMarkets, type MarketRow } from "@/lib/ponder";
import { formatUsdc, formatDate, shortenAddress } from "@/lib/format";
import { parseMetadataURI } from "@/lib/category";
import { verificationMessage, currentTimestamp } from "@/lib/adminVerifyMessage";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { PolymarketImportPanel } from "@/components/PolymarketImportPanel";
import { useNow } from "@/lib/useNow";

async function fetchVerifiedMarketIds(): Promise<Set<string>> {
  const res = await fetch("/api/verified-markets");
  const data = await res.json();
  return new Set<string>(data.verified ?? []);
}

const CLOSING_SOON_WINDOW_SECONDS = 24 * 60 * 60; // markets closing within the next 24h

function titleFor(m: MarketRow): string {
  const { title } = parseMetadataURI(m.metadataURI);
  return title || m.questionHash;
}

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { signMessageAsync } = useSignMessage();
  const queryClient = useQueryClient();
  const now = useNow(15_000);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [extendDates, setExtendDates] = useState<Record<string, string>>({});

  const { data: owner } = useReadContract({ ...marketFactoryContract, functionName: "owner" });
  const isAdmin = !!address && !!owner && address.toLowerCase() === owner.toLowerCase();

  const { data: markets, refetch: refetchMarkets } = useQuery({
    queryKey: ["adminMarkets"],
    queryFn: getMarkets,
    refetchInterval: 10_000,
    enabled: isAdmin,
  });

  const { data: verifiedIds } = useQuery({
    queryKey: ["verifiedMarkets"],
    queryFn: fetchVerifiedMarketIds,
    enabled: isAdmin,
  });

  const { data: onChainMarkets, refetch: refetchOnChain } = useReadContracts({
    contracts: (markets ?? []).map((m) => ({
      ...marketFactoryContract,
      functionName: "getMarket" as const,
      args: [BigInt(m.id)] as const,
    })),
    query: { enabled: isAdmin && !!markets && markets.length > 0 },
  });

  const collectedFeesById = useMemo(() => {
    const map = new Map<string, bigint>();
    (markets ?? []).forEach((m, i) => {
      const result = onChainMarkets?.[i];
      if (result && result.status === "success") {
        map.set(m.id, result.result.collectedFees);
      }
    });
    return map;
  }, [markets, onChainMarkets]);

  const nowSeconds = Math.floor(now / 1000);

  const totalVolume = useMemo(() => (markets ?? []).reduce((sum, m) => sum + BigInt(m.volume), 0n), [markets]);

  const totalUnclaimedFees = useMemo(() => {
    let sum = 0n;
    collectedFeesById.forEach((v) => (sum += v));
    return sum;
  }, [collectedFeesById]);

  const readyToSettle = useMemo(
    () => (markets ?? []).filter((m) => m.state === "Trading" && nowSeconds >= Number(m.closeTime)),
    [markets, nowSeconds],
  );

  const closingSoon = useMemo(
    () =>
      (markets ?? [])
        .filter(
          (m) =>
            m.state === "Trading" &&
            nowSeconds < Number(m.closeTime) &&
            Number(m.closeTime) - nowSeconds <= CLOSING_SOON_WINDOW_SECONDS,
        )
        .sort((a, b) => Number(a.closeTime) - Number(b.closeTime)),
    [markets, nowSeconds],
  );

  async function handleSettle(marketId: string, outcome: boolean) {
    setPendingId(marketId);
    setStatus(`Settling market #${marketId} ${outcome ? "YES" : "NO"}...`);
    try {
      const hash = await writeContractAsync({
        ...marketFactoryContract,
        functionName: "settleMarket",
        args: [BigInt(marketId), outcome],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setStatus(`Market #${marketId} settled.`);
      await refetchMarkets();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setPendingId(null);
    }
  }

  async function handleExtend(marketId: string) {
    const newCloseDate = extendDates[marketId];
    if (!newCloseDate) return;
    setPendingId(marketId);
    setStatus(`Extending close time for market #${marketId}...`);
    try {
      const newCloseTime = BigInt(Math.floor(new Date(newCloseDate).getTime() / 1000));
      const hash = await writeContractAsync({
        ...marketFactoryContract,
        functionName: "extendCloseTime",
        args: [BigInt(marketId), newCloseTime],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setStatus(`Market #${marketId} close time extended.`);
      setExtendDates((prev) => ({ ...prev, [marketId]: "" }));
      await refetchMarkets();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setPendingId(null);
    }
  }

  async function handleCancel(marketId: string) {
    setPendingId(marketId);
    setStatus(`Cancelling market #${marketId}...`);
    try {
      const hash = await writeContractAsync({
        ...marketFactoryContract,
        functionName: "cancelMarket",
        args: [BigInt(marketId)],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setStatus(`Market #${marketId} cancelled — traders can now claim a pro-rata refund.`);
      await refetchMarkets();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setPendingId(null);
    }
  }

  async function handleClaim(marketId: string) {
    setPendingId(marketId);
    setStatus(`Claiming fees for market #${marketId}...`);
    try {
      const hash = await writeContractAsync({
        ...marketFactoryContract,
        functionName: "withdrawFees",
        args: [BigInt(marketId)],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setStatus(`Fees claimed for market #${marketId}.`);
      await refetchOnChain();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setPendingId(null);
    }
  }

  async function handleToggleVerify(marketId: string, verified: boolean) {
    setPendingId(marketId);
    setStatus(`${verified ? "Verifying" : "Unverifying"} market #${marketId}...`);
    try {
      const timestamp = currentTimestamp();
      const message = verificationMessage(marketId, verified, timestamp);
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/admin/verify-market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId, verified, timestamp, signature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update verification");
      setStatus(`Market #${marketId} ${verified ? "verified" : "unverified"}.`);
      await queryClient.invalidateQueries({ queryKey: ["verifiedMarkets"] });
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to update verification");
    } finally {
      setPendingId(null);
    }
  }

  if (!isConnected) {
    return (
      <div className="max-w-lg rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
        <p className="text-gray-400 text-sm">Connect your wallet to access the admin dashboard.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-lg rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
        <p className="text-gray-400 text-sm">This page is restricted to the platform admin.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-100">Admin</h1>
        <p className="text-sm text-gray-400 mt-1">
          Manage markets, claim protocol fees, and track platform activity.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total volume" value={`$${formatUsdc(totalVolume)}`} />
        <StatCard label="Unclaimed fees" value={`$${formatUsdc(totalUnclaimedFees)}`} />
        <StatCard label="Markets" value={String((markets ?? []).length)} />
        <StatCard label="Ready to settle" value={String(readyToSettle.length)} />
      </div>

      <Section title="Import from Polymarket" isEmpty={false} empty="">
        <PolymarketImportPanel />
      </Section>

      <Section title="Ready to settle" isEmpty={readyToSettle.length === 0} empty="No markets are waiting on settlement.">
        <div className="flex flex-col gap-2">
          {readyToSettle.map((m) => (
            <div key={m.id} className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/markets/${m.id}`}
                    className="text-sm font-semibold text-gray-100 hover:underline truncate block"
                  >
                    {titleFor(m)}
                  </Link>
                  <p className="text-xs text-gray-500">Closed {formatDate(m.closeTime)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    disabled={pendingId === m.id}
                    onClick={() => handleSettle(m.id, true)}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-50"
                  >
                    Settle YES
                  </button>
                  <button
                    disabled={pendingId === m.id}
                    onClick={() => handleSettle(m.id, false)}
                    className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-50"
                  >
                    Settle NO
                  </button>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-800 flex flex-col sm:flex-row gap-2">
                <input
                  type="datetime-local"
                  value={extendDates[m.id] ?? ""}
                  onChange={(e) => setExtendDates((prev) => ({ ...prev, [m.id]: e.target.value }))}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
                <button
                  type="button"
                  disabled={pendingId === m.id || !extendDates[m.id]}
                  onClick={() => handleExtend(m.id)}
                  className="rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800 text-xs font-semibold px-3 py-1.5 disabled:opacity-50 whitespace-nowrap"
                >
                  Extend deadline
                </button>
                <button
                  type="button"
                  disabled={pendingId === m.id}
                  onClick={() => handleCancel(m.id)}
                  className="rounded-lg border border-rose-900 text-rose-400 hover:bg-rose-950 text-xs font-semibold px-3 py-1.5 disabled:opacity-50 whitespace-nowrap"
                >
                  Cancel &amp; enable refunds
                </button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Closing soon" isEmpty={closingSoon.length === 0} empty="No markets closing in the next 24 hours.">
        <div className="flex flex-col gap-2">
          {closingSoon.map((m) => (
            <Link
              key={m.id}
              href={`/markets/${m.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-950/40 p-3 hover:border-gray-600"
            >
              <span className="text-sm font-semibold text-gray-100 truncate">{titleFor(m)}</span>
              <span className="text-xs text-amber-400 shrink-0">Closes {formatDate(m.closeTime)}</span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="All markets" isEmpty={(markets ?? []).length === 0} empty="No markets created yet.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-800">
                <th className="pb-2 pr-4 font-medium">Market</th>
                <th className="pb-2 pr-4 font-medium">Creator</th>
                <th className="pb-2 pr-4 font-medium">State</th>
                <th className="pb-2 pr-4 font-medium">Volume</th>
                <th className="pb-2 pr-4 font-medium">Fees</th>
                <th className="pb-2 pr-4 font-medium">Verified</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {(markets ?? []).map((m) => {
                const fees = collectedFeesById.get(m.id) ?? 0n;
                const isVerified = verifiedIds?.has(m.id) ?? false;
                return (
                  <tr key={m.id} className="border-b border-gray-800/60 last:border-0">
                    <td className="py-2 pr-4">
                      <Link href={`/markets/${m.id}`} className="text-gray-100 hover:underline flex items-center gap-1">
                        {titleFor(m)}
                        {isVerified && <VerifiedBadge />}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-gray-400">{shortenAddress(m.creator)}</td>
                    <td className="py-2 pr-4 text-gray-400">{m.state}</td>
                    <td className="py-2 pr-4 text-gray-300">${formatUsdc(m.volume)}</td>
                    <td className="py-2 pr-4 text-gray-300">${formatUsdc(fees)}</td>
                    <td className="py-2 pr-4">
                      <button
                        disabled={pendingId === m.id}
                        onClick={() => handleToggleVerify(m.id, !isVerified)}
                        className={`rounded-lg text-xs font-semibold px-3 py-1.5 disabled:opacity-50 ${
                          isVerified
                            ? "border border-gray-700 text-gray-300 hover:bg-gray-800"
                            : "bg-accent hover:bg-accent-dark text-gray-900"
                        }`}
                      >
                        {isVerified ? "Unverify" : "Verify"}
                      </button>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        disabled={fees === 0n || pendingId === m.id}
                        onClick={() => handleClaim(m.id)}
                        className="rounded-lg bg-accent hover:bg-accent-dark text-gray-900 text-xs font-semibold px-3 py-1.5 disabled:opacity-50 disabled:bg-gray-800 disabled:text-gray-500"
                      >
                        Claim
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {status && <p className="text-sm text-gray-400">{status}</p>}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-extrabold text-gray-100 mt-1">{value}</p>
    </div>
  );
}

function Section({
  title,
  isEmpty,
  empty,
  children,
}: {
  title: string;
  isEmpty: boolean;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <h2 className="font-bold text-gray-100 mb-3">{title}</h2>
      {isEmpty ? <p className="text-sm text-gray-500">{empty}</p> : children}
    </div>
  );
}
