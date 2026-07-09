"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { wagmiConfig } from "@/lib/wagmi";
import { marketFactoryContract, COLLATERAL_SYMBOL } from "@/lib/contracts";
import { fetchIndexerMarketsList, fetchProtocolStats, type IndexerAssetSlot } from "@/lib/indexerApi";
import { formatEth, formatEthFull, formatDate, formatPriceWad } from "@/lib/format";
import { assetDisplayName } from "@/lib/assets";
import { AddMarketPanel } from "@/components/AddMarketPanel";
import { AdminMarketHistory } from "@/components/AdminMarketHistory";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ui/responsive-table";

type SlotRowData = {
  slot: IndexerAssetSlot;
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
};

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const { data: owner } = useReadContract({
    ...marketFactoryContract,
    functionName: "owner",
    query: { enabled: !!address },
  });
  const isAdmin = !!address && !!owner && address.toLowerCase() === owner.toLowerCase();

  const { data: slots, refetch } = useQuery({
    queryKey: ["adminMarkets"],
    queryFn: fetchIndexerMarketsList,
    refetchInterval: 10_000,
    enabled: isAdmin,
  });

  // Project-wide, all-time totals from the indexer's singleton stats row (see
  // lib/indexerApi.ts's fetchProtocolStats) — volume and fees summed across
  // every market ever, which the per-market rows below can't add up to (they
  // only carry the current market per asset, and collectedFees is reset on
  // withdrawal).
  const { data: protocolStats } = useQuery({
    queryKey: ["protocolStats"],
    queryFn: fetchProtocolStats,
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
  // Purely a discoverability/ordering concern on the public markets page,
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
      <Card className="max-w-lg">
        <CardContent className="text-center py-4">
          <p className="text-muted-foreground text-sm">Connect your wallet to access the admin dashboard.</p>
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="max-w-lg">
        <CardContent className="text-center py-4">
          <p className="text-muted-foreground text-sm">This page is restricted to the platform owner.</p>
        </CardContent>
      </Card>
    );
  }

  const rows: SlotRowData[] = orderedSlots.map((slot, index) => ({
    slot,
    pending: !!slot.market && pendingId === slot.market.id.toString(),
    paused: inactiveAssetIds.has(slot.asset.id.toString()),
    togglePending: pendingId === `asset-${slot.asset.id.toString()}`,
    delisted: delistedAssetIds.has(slot.asset.id.toString()),
    delistTogglePending: pendingId === `delist-${slot.asset.id.toString()}`,
    movePending: pendingId === `move-${slot.asset.id.toString()}`,
    isFirst: index === 0,
    isLast: index === orderedSlots.length - 1,
    onExtend: (date) => slot.market && handleExtend(slot.market.id, date),
    onCancel: () => slot.market && handleCancel(slot.market.id),
    onClaim: () => slot.market && handleClaim(slot.market.id),
    onTogglePause: (active) => handleTogglePause(slot.asset.id, active),
    onToggleDelist: (delisted) => handleToggleDelist(slot.asset.id, delisted),
    onMoveUp: () => handleMove(slot.asset.id, "up"),
    onMoveDown: () => handleMove(slot.asset.id, "down"),
  }));

  const columns: ResponsiveTableColumn<SlotRowData>[] = [
    {
      key: "order",
      header: "Order",
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            disabled={r.movePending || r.isFirst}
            onClick={r.onMoveUp}
            title="Move up (shows earlier on the public grid)"
            className="rounded border border-border text-muted-foreground hover:bg-accent disabled:opacity-30 w-5 h-5 flex items-center justify-center text-xs"
          >
            ↑
          </button>
          <button
            disabled={r.movePending || r.isLast}
            onClick={r.onMoveDown}
            title="Move down (shows later on the public grid)"
            className="rounded border border-border text-muted-foreground hover:bg-accent disabled:opacity-30 w-5 h-5 flex items-center justify-center text-xs"
          >
            ↓
          </button>
        </div>
      ),
    },
    {
      key: "asset",
      header: "Asset",
      primary: true,
      render: (r) => <span className="font-display text-lg">{assetDisplayName(r.slot.asset.symbol)}</span>,
    },
    {
      key: "cycle",
      header: "Cycle",
      render: (r) => (
        <button disabled={r.togglePending} onClick={() => r.onTogglePause(r.paused)} className="disabled:opacity-50">
          <Badge variant={r.paused ? "secondary" : "up"}>{r.paused ? "Paused" : "Active"}</Badge>
        </button>
      ),
    },
    {
      key: "listing",
      header: "Listing",
      render: (r) => (
        <button disabled={r.delistTogglePending} onClick={() => r.onToggleDelist(!r.delisted)} className="disabled:opacity-50">
          <Badge variant={r.delisted ? "secondary" : "up"}>{r.delisted ? "Delisted" : "Listed"}</Badge>
        </button>
      ),
    },
    {
      key: "lifetimeVol",
      header: "Lifetime Vol",
      render: (r) => (
        <span className="whitespace-nowrap">
          {formatEth(r.slot.asset.totalVolume)} {COLLATERAL_SYMBOL}
        </span>
      ),
    },
    {
      key: "market",
      header: "Market",
      render: (r) => (r.slot.market ? <span className="text-muted-foreground">#{r.slot.market.id.toString()}</span> : <span className="text-muted-foreground">—</span>),
    },
    {
      key: "state",
      header: "State",
      render: (r) =>
        r.slot.market ? (
          <span className="text-muted-foreground">
            {r.slot.market.state}
            {r.slot.market.state === "Finalized" ? ` · ${r.slot.market.outcome ? "Up" : "Down"}` : ""}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "strike",
      header: "Strike",
      render: (r) => (r.slot.market ? `$${formatPriceWad(r.slot.market.startPriceWad)}` : "—"),
    },
    {
      key: "volume",
      header: "Volume",
      render: (r) =>
        r.slot.market ? (
          <span className="whitespace-nowrap">
            {formatEth(r.slot.market.volume)} {COLLATERAL_SYMBOL}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "closes",
      header: "Closes",
      render: (r) => (r.slot.market ? <span className="whitespace-nowrap">{formatDate(r.slot.market.closeTime)}</span> : "—"),
    },
    {
      key: "fees",
      header: "Fees",
      render: (r) =>
        r.slot.market ? (
          <span className="whitespace-nowrap">
            {formatEth(r.slot.market.collectedFees)} {COLLATERAL_SYMBOL}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "actions",
      header: "",
      fullWidth: true,
      render: (r) => (r.slot.market ? <SlotActions row={r} /> : null),
    },
  ];

  return (
    <div className="flex flex-col gap-10">
      <PageHeader eyebrow="Owner only" title="Mission control" description="Markets open and settle automatically via packages/cron — the controls below are a manual safety valve." />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* All-time, project-wide — full precision (formatEthFull) so even a
            fraction-of-a-cent total shows a real figure instead of "0.00". */}
        <StatTile label="Total volume" value={protocolStats ? formatEthFull(protocolStats.totalVolume) : "—"} description={`${COLLATERAL_SYMBOL}, all-time`} />
        <StatTile label="Total fees earned" value={protocolStats ? formatEthFull(protocolStats.totalFees) : "—"} description={`${COLLATERAL_SYMBOL}, all-time`} />
        <StatTile label="Total trades" value={protocolStats ? protocolStats.totalTrades.toLocaleString() : "—"} />
        <StatTile label="Markets" value={`${openCount}/${(slots ?? []).length}`} description="open / total" />
        <StatTile label="Unclaimed fees" value={formatEth(totalUnclaimedFees)} description={COLLATERAL_SYMBOL} />
        <StatTile label="Protocol fee" value="1%" />
      </div>

      <AddMarketPanel onRegistered={() => queryClient.invalidateQueries({ queryKey: ["adminMarkets"] })} />

      <Card>
        <CardHeader>
          <CardTitle>Markets</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveTable columns={columns} rows={rows} getRowKey={(r) => r.slot.asset.id.toString()} emptyMessage="No markets registered yet — add one above." />
        </CardContent>
      </Card>

      <AdminMarketHistory />

      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </div>
  );
}

function SlotActions({ row }: { row: SlotRowData }) {
  const [newCloseDate, setNewCloseDate] = useState("");
  const market = row.slot.market!;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button size="sm" disabled={row.pending || market.collectedFees === 0n} onClick={row.onClaim}>
        Claim
      </Button>
      {market.state === "Trading" && (
        <>
          <input
            type="datetime-local"
            value={newCloseDate}
            onChange={(e) => setNewCloseDate(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button size="sm" variant="outline" disabled={row.pending || !newCloseDate} onClick={() => row.onExtend(newCloseDate)}>
            Extend
          </Button>
          <Button size="sm" variant="destructive" disabled={row.pending} onClick={row.onCancel}>
            Cancel
          </Button>
        </>
      )}
    </div>
  );
}
