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
import { AdminMarketHistory } from "@/components/AdminMarketHistory";
import { HoloCard } from "@/components/HoloCard";

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

  // Off-chain per-asset pause list — see lib/assetStatusStore.ts. No contract
  // flag for this; a paused asset just stops packages/cron from opening its
  // *next* 5-minute window (an already-open market keeps trading normally).
  const { data: assetStatus, refetch: refetchAssetStatus } = useQuery({
    queryKey: ["assetStatus"],
    queryFn: async () => {
      const res = await fetch("/api/admin/asset-status");
      return (await res.json()) as { inactiveAssetIds: string[] };
    },
    refetchInterval: 10_000,
    enabled: isAdmin,
  });
  const inactiveAssetIds = new Set(assetStatus?.inactiveAssetIds ?? []);

  // Off-chain delist + display-order state — see lib/assetDisplayStore.ts.
  // Purely a discoverability/ordering concern on the public markets page;
  // never touches on-chain state or packages/cron's pause list above.
  const { data: assetDisplay, refetch: refetchAssetDisplay } = useQuery({
    queryKey: ["assetDisplay"],
    queryFn: async () => {
      const res = await fetch("/api/admin/asset-display");
      return (await res.json()) as { delistedAssetIds: string[]; order: string[] };
    },
    refetchInterval: 10_000,
    enabled: isAdmin,
  });
  const delistedAssetIds = new Set(assetDisplay?.delistedAssetIds ?? []);
  const displayOrder = assetDisplay?.order ?? [];

  // Rows follow the same order as the public page, so "move up/down" here
  // matches what a visitor actually sees.
  const orderedSlots = displayOrder.length
    ? displayOrder
        .map((id) => (slots ?? []).find((s) => s.asset.id.toString() === id))
        .filter((s): s is NonNullable<typeof s> => !!s)
    : (slots ?? []);

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

  async function handleTogglePause(assetId: bigint, active: boolean) {
    const key = `asset-${assetId.toString()}`;
    setPendingId(key);
    setStatus(active ? `Resuming cycles for asset #${assetId}...` : `Pausing cycles for asset #${assetId}...`);
    try {
      await fetch("/api/admin/asset-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: assetId.toString(), active }),
      });
      setStatus(active ? `Asset #${assetId} resumed.` : `Asset #${assetId} paused — no new windows will open for it.`);
      await refetchAssetStatus();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Toggle failed");
    } finally {
      setPendingId(null);
    }
  }

  async function handleToggleDelist(assetId: bigint, delisted: boolean) {
    const key = `delist-${assetId.toString()}`;
    setPendingId(key);
    setStatus(delisted ? `Delisting asset #${assetId}...` : `Relisting asset #${assetId}...`);
    try {
      await fetch("/api/admin/asset-display", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delist", assetId: assetId.toString(), delisted }),
      });
      setStatus(
        delisted
          ? `Asset #${assetId} delisted — still tradeable via a direct link, just hidden from the public grid.`
          : `Asset #${assetId} relisted.`,
      );
      await refetchAssetDisplay();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Toggle failed");
    } finally {
      setPendingId(null);
    }
  }

  async function handleMove(assetId: bigint, direction: "up" | "down") {
    const key = `move-${assetId.toString()}`;
    setPendingId(key);
    try {
      await fetch("/api/admin/asset-display", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "move", assetId: assetId.toString(), direction }),
      });
      await refetchAssetDisplay();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Reorder failed");
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
        <h1 className="text-2xl font-extrabold text-gray-100 uppercase tracking-tight">Mission Control</h1>
        <p className="text-sm text-gray-400 mt-1">
          Markets are opened and settled automatically by the cron script (see packages/cron). Extend/cancel/pause
          below are a safety valve for when it can&apos;t run — the only thing you actually need to do here
          day-to-day is add new markets. Delist/reorder control the public markets grid only — a delisted market
          keeps trading and settling normally for anyone with a direct link.
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
                <th className="pb-2 pr-4 font-medium">Order</th>
                <th className="pb-2 pr-4 font-medium">Asset</th>
                <th className="pb-2 pr-4 font-medium">Cycle</th>
                <th className="pb-2 pr-4 font-medium">Listing</th>
                <th className="pb-2 pr-4 font-medium">Market</th>
                <th className="pb-2 pr-4 font-medium">State</th>
                <th className="pb-2 pr-4 font-medium">Strike</th>
                <th className="pb-2 pr-4 font-medium">Volume</th>
                <th className="pb-2 pr-4 font-medium">Closes</th>
                <th className="pb-2 pr-4 font-medium">Fees</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {orderedSlots.map((slot, index) => (
                <SlotRow
                  key={slot.asset.id.toString()}
                  slot={slot}
                  pending={!!slot.market && pendingId === slot.market.id.toString()}
                  paused={inactiveAssetIds.has(slot.asset.id.toString())}
                  togglePending={pendingId === `asset-${slot.asset.id.toString()}`}
                  delisted={delistedAssetIds.has(slot.asset.id.toString())}
                  delistTogglePending={pendingId === `delist-${slot.asset.id.toString()}`}
                  movePending={pendingId === `move-${slot.asset.id.toString()}`}
                  isFirst={index === 0}
                  isLast={index === orderedSlots.length - 1}
                  onExtend={(date) => slot.market && handleExtend(slot.market.id, date)}
                  onCancel={() => slot.market && handleCancel(slot.market.id)}
                  onClaim={() => slot.market && handleClaim(slot.market.id)}
                  onTogglePause={(active) => handleTogglePause(slot.asset.id, active)}
                  onToggleDelist={(delisted) => handleToggleDelist(slot.asset.id, delisted)}
                  onMoveUp={() => handleMove(slot.asset.id, "up")}
                  onMoveDown={() => handleMove(slot.asset.id, "down")}
                />
              ))}
              {orderedSlots.length === 0 && (
                <tr>
                  <td className="py-4 text-gray-500" colSpan={11}>
                    No markets registered yet — add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AdminMarketHistory />

      {status && <p className="text-sm text-gray-400">{status}</p>}
    </div>
  );
}

function SlotRow({
  slot,
  pending,
  paused,
  togglePending,
  delisted,
  delistTogglePending,
  movePending,
  isFirst,
  isLast,
  onExtend,
  onCancel,
  onClaim,
  onTogglePause,
  onToggleDelist,
  onMoveUp,
  onMoveDown,
}: {
  slot: AssetSlot;
  pending: boolean;
  paused: boolean;
  togglePending: boolean;
  delisted: boolean;
  delistTogglePending: boolean;
  movePending: boolean;
  isFirst: boolean;
  isLast: boolean;
  onExtend: (newCloseDate: string) => void;
  onCancel: () => void;
  onClaim: () => void;
  onTogglePause: (active: boolean) => void;
  onToggleDelist: (delisted: boolean) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [newCloseDate, setNewCloseDate] = useState("");
  const { asset, market } = slot;

  return (
    <tr className={`border-b border-gray-800/60 last:border-0 align-top ${delisted ? "opacity-50" : ""}`}>
      <td className="py-2 pr-4">
        <div className="flex items-center gap-1">
          <button
            disabled={movePending || isFirst}
            onClick={onMoveUp}
            title="Move up (shows earlier on the public grid)"
            className="rounded border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-30 w-5 h-5 flex items-center justify-center text-xs"
          >
            ↑
          </button>
          <button
            disabled={movePending || isLast}
            onClick={onMoveDown}
            title="Move down (shows later on the public grid)"
            className="rounded border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-30 w-5 h-5 flex items-center justify-center text-xs"
          >
            ↓
          </button>
        </div>
      </td>
      <td className="py-2 pr-4 text-gray-100 font-semibold whitespace-nowrap">{assetDisplayName(asset.symbol)}</td>
      <td className="py-2 pr-4">
        <button
          disabled={togglePending}
          onClick={() => onTogglePause(paused)}
          title={
            paused
              ? "Paused — packages/cron will not open a new window for this asset. Click to resume."
              : "Active — click to pause future windows (an already-open market keeps trading until it settles)."
          }
          className={`rounded-full text-xs font-bold px-2.5 py-1 whitespace-nowrap disabled:opacity-50 ${
            paused
              ? "bg-amber-950 text-amber-400 border border-amber-900 hover:bg-amber-900"
              : "bg-emerald-950 text-emerald-400 border border-emerald-900 hover:bg-emerald-900"
          }`}
        >
          {paused ? "Paused ⏸" : "Active"}
        </button>
      </td>
      <td className="py-2 pr-4">
        <button
          disabled={delistTogglePending}
          onClick={() => onToggleDelist(!delisted)}
          title={
            delisted
              ? "Delisted — hidden from the public markets grid, but still tradeable via a direct link. Click to relist."
              : "Listed — click to hide from the public markets grid (still tradeable via a direct link)."
          }
          className={`rounded-full text-xs font-bold px-2.5 py-1 whitespace-nowrap disabled:opacity-50 ${
            delisted
              ? "bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700"
              : "bg-emerald-950 text-emerald-400 border border-emerald-900 hover:bg-emerald-900"
          }`}
        >
          {delisted ? "Delisted 🚫" : "Listed"}
        </button>
      </td>
      {!market ? (
        <td className="py-2 text-gray-500" colSpan={7}>
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
          <td className="py-2 pr-4 text-gray-300">
            {slot.volume == null ? "—" : `${formatEth(slot.volume)} ${COLLATERAL_SYMBOL}`}
          </td>
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
    <HoloCard radius={18} glow={false} innerClassName="p-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-extrabold text-gray-100 mt-1">{value}</p>
    </HoloCard>
  );
}
