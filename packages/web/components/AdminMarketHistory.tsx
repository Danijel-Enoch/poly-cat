"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchAllMarkets, type IndexedMarketRow } from "@/lib/indexerApi";
import { formatEth, formatDate, formatPriceWad } from "@/lib/format";
import { assetDisplayName } from "@/lib/assets";
import { COLLATERAL_SYMBOL } from "@/lib/contracts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ui/responsive-table";

const PAGE_SIZE = 25;

const columns: ResponsiveTableColumn<IndexedMarketRow>[] = [
  {
    key: "asset",
    header: "Asset",
    primary: true,
    render: (row) => (
      <span className="font-display">
        #{row.id.toString()} · {assetDisplayName(row.assetSymbol ?? `Asset ${row.assetId}`)}
      </span>
    ),
  },
  {
    key: "state",
    header: "State",
    render: (row) => (
      <span className="text-muted-foreground">
        {row.state}
        {row.state === "Finalized" ? ` · ${row.outcome ? "Up" : "Down"}` : ""}
        {row.state === "Cancelled" && row.cancelReason ? ` · ${row.cancelReason}` : ""}
      </span>
    ),
  },
  { key: "strike", header: "Strike", render: (row) => `$${formatPriceWad(row.startPriceWad)}` },
  {
    key: "closePrice",
    header: "Close price",
    render: (row) => (row.closePriceWad === null ? "—" : `$${formatPriceWad(row.closePriceWad)}`),
  },
  {
    key: "volume",
    header: "Volume",
    render: (row) => (
      <span className="whitespace-nowrap">
        {formatEth(row.volume)} {COLLATERAL_SYMBOL}
      </span>
    ),
  },
  { key: "trades", header: "Trades", render: (row) => row.tradeCount },
  { key: "created", header: "Created", render: (row) => <span className="whitespace-nowrap">{formatDate(row.createdAt)}</span> },
];

/** Every market the factory has ever created, not just each asset's current
 * one — the admin dashboard's live markets table only ever shows one row per
 * asset (its current market), so a finalized or cancelled market rolls off
 * that view the moment the next window opens for the same asset. This reads
 * packages/indexer instead, which keeps every market ever created. */
export function AdminMarketHistory() {
  const [page, setPage] = useState(0);

  const { data: rows, status } = useQuery({
    queryKey: ["indexerAllMarkets", page],
    queryFn: () => fetchAllMarkets(PAGE_SIZE, page * PAGE_SIZE),
    refetchInterval: 10_000,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>All markets ever created</CardTitle>
        <p className="text-xs text-muted-foreground">via packages/indexer</p>
      </CardHeader>
      <CardContent>
        {status === "error" ? (
          <p className="text-sm text-destructive">
            Couldn&apos;t reach the indexer — is <code className="text-foreground">packages/indexer</code> running (
            <code className="text-foreground">pnpm indexer:dev</code>)?
          </p>
        ) : (
          <>
            <ResponsiveTable columns={columns} rows={rows} getRowKey={(row) => row.id.toString()} loading={status === "pending"} emptyMessage="No markets yet." />

            <div className="flex items-center justify-between mt-3">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Newer
              </Button>
              <span className="text-xs text-muted-foreground">Page {page + 1}</span>
              <Button size="sm" variant="outline" disabled={!rows || rows.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>
                Older
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
