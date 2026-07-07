"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { wagmiConfig } from "@/lib/wagmi";
import { marketFactoryContract, COLLATERAL_SYMBOL } from "@/lib/contracts";
import { getMarketsList, type AssetSlot } from "@/lib/chainReads";
import { formatEth, formatDate, formatPriceWad } from "@/lib/format";
import { assetDisplayName } from "@/lib/assets";
import { AddMarketPanel } from "@/components/AddMarketPanel";

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const { data: owner } = useReadContract({ ...marketFactoryContract, functionName: "owner" });
  const isAdmin = !!address && !!owner && address.toLowerCase() === owner.toLowerCase();

  const { data: slots, refetch } = useQuery({
    queryKey: ["adminMarkets"],
    queryFn: getMarketsList,
    refetchInterval: 10_000,
    enabled: isAdmin,
  });

  const openCount = (slots ?? []).filter((s) => s.market?.state === "Trading").length;
  const totalUnclaimedFees = (slots ?? []).reduce((sum, s) => sum + (s.market?.collectedFees ?? 0n), 0n);

  async function handleExtend(marketId: bigint, newCloseDate: string) {
    const key = marketId.toString();
    setPendingId(key);
    setStatus(`Extending close time for market #${key}...`);
    try {
      const newCloseTime = BigInt(Math.floor(new Date(newCloseDate).getTime() / 1000));
      const hash = await writeContractAsync({
        ...marketFactoryContract,
        functionName: "extendCloseTime",
        args: [marketId, newCloseTime],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setStatus(`Market #${key} close time extended.`);
      await refetch();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setPendingId(null);
    }
  }

  async function handleCancel(marketId: bigint) {
    const key = marketId.toString();
    setPendingId(key);
    setStatus(`Cancelling market #${key}...`);
    try {
      const hash = await writeContractAsync({
        ...marketFactoryContract,
        functionName: "cancelMarket",
        args: [marketId],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setStatus(`Market #${key} cancelled — traders can now claim a pro-rata refund.`);
      await refetch();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setPendingId(null);
    }
  }

  async function handleClaim(marketId: bigint) {
    const key = marketId.toString();
    setPendingId(key);
    setStatus(`Claiming fees for market #${key}...`);
    try {
      const hash = await writeContractAsync({
        ...marketFactoryContract,
        functionName: "withdrawFees",
        args: [marketId],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setStatus(`Fees claimed for market #${key}.`);
      await refetch();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Transaction failed");
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
        <p className="text-gray-400 text-sm">This page is restricted to the platform owner.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-100">Admin</h1>
        <p className="text-sm text-gray-400 mt-1">
          Markets are opened and settled automatically by the cron script (see packages/cron). Extend/cancel below
          are a safety valve for when it can&apos;t run — the only thing you actually need to do here day-to-day is
          add new markets.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Markets" value={`${openCount} open / ${(slots ?? []).length} total`} />
        <StatCard label="Unclaimed fees" value={`${formatEth(totalUnclaimedFees)} ${COLLATERAL_SYMBOL}`} />
        <StatCard label="Protocol fee" value="1%" />
      </div>

      <AddMarketPanel onRegistered={() => queryClient.invalidateQueries({ queryKey: ["adminMarkets"] })} />

      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="font-bold text-gray-100 mb-3">Markets</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-800">
                <th className="pb-2 pr-4 font-medium">Asset</th>
                <th className="pb-2 pr-4 font-medium">Market</th>
                <th className="pb-2 pr-4 font-medium">State</th>
                <th className="pb-2 pr-4 font-medium">Strike</th>
                <th className="pb-2 pr-4 font-medium">Closes</th>
                <th className="pb-2 pr-4 font-medium">Fees</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {(slots ?? []).map((slot) => (
                <SlotRow
                  key={slot.asset.id.toString()}
                  slot={slot}
                  pending={!!slot.market && pendingId === slot.market.id.toString()}
                  onExtend={(date) => slot.market && handleExtend(slot.market.id, date)}
                  onCancel={() => slot.market && handleCancel(slot.market.id)}
                  onClaim={() => slot.market && handleClaim(slot.market.id)}
                />
              ))}
              {(slots ?? []).length === 0 && (
                <tr>
                  <td className="py-4 text-gray-500" colSpan={7}>
                    No markets registered yet — add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {status && <p className="text-sm text-gray-400">{status}</p>}
    </div>
  );
}

function SlotRow({
  slot,
  pending,
  onExtend,
  onCancel,
  onClaim,
}: {
  slot: AssetSlot;
  pending: boolean;
  onExtend: (newCloseDate: string) => void;
  onCancel: () => void;
  onClaim: () => void;
}) {
  const [newCloseDate, setNewCloseDate] = useState("");
  const { asset, market } = slot;

  return (
    <tr className="border-b border-gray-800/60 last:border-0 align-top">
      <td className="py-2 pr-4 text-gray-100 font-semibold whitespace-nowrap">{assetDisplayName(asset.symbol)}</td>
      {!market ? (
        <td className="py-2 text-gray-500" colSpan={6}>
          No market yet
        </td>
      ) : (
        <>
          <td className="py-2 pr-4 text-gray-400">#{market.id.toString()}</td>
          <td className="py-2 pr-4 text-gray-400">
            {market.state}
            {market.state === "Finalized" ? ` · ${market.outcome ? "Up" : "Down"}` : ""}
          </td>
          <td className="py-2 pr-4 text-gray-300">${formatPriceWad(market.startPriceWad)}</td>
          <td className="py-2 pr-4 text-gray-300 whitespace-nowrap">{formatDate(market.closeTime)}</td>
          <td className="py-2 pr-4 text-gray-300">
            {formatEth(market.collectedFees)} {COLLATERAL_SYMBOL}
          </td>
          <td className="py-2">
            <div className="flex flex-wrap items-center gap-1.5 justify-end">
              <button
                disabled={pending || market.collectedFees === 0n}
                onClick={onClaim}
                className="rounded-lg bg-accent hover:bg-accent-dark text-gray-950 text-xs font-semibold px-2.5 py-1 disabled:opacity-50 disabled:bg-gray-800 disabled:text-gray-500"
              >
                Claim
              </button>
              {market.state === "Trading" && (
                <>
                  <input
                    type="datetime-local"
                    value={newCloseDate}
                    onChange={(e) => setNewCloseDate(e.target.value)}
                    className="rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                  <button
                    disabled={pending || !newCloseDate}
                    onClick={() => onExtend(newCloseDate)}
                    className="rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800 text-xs font-semibold px-2.5 py-1 disabled:opacity-50 whitespace-nowrap"
                  >
                    Extend
                  </button>
                  <button
                    disabled={pending}
                    onClick={onCancel}
                    className="rounded-lg border border-rose-900 text-rose-400 hover:bg-rose-950 text-xs font-semibold px-2.5 py-1 disabled:opacity-50 whitespace-nowrap"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </td>
        </>
      )}
    </tr>
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
