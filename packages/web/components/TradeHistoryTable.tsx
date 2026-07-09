"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchMarketTrades, type IndexedTradeRow } from "@/lib/indexerApi";
import { formatEth, shortenAddress } from "@/lib/format";
import { COLLATERAL_SYMBOL } from "@/lib/contracts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ui/responsive-table";

const columns: ResponsiveTableColumn<IndexedTradeRow>[] = [
  {
    key: "trader",
    header: "Trader",
    primary: true,
    render: (t) => (
      <div className="flex items-center gap-2 font-mono">
        <span style={{ color: t.side === "buy" ? "var(--up)" : "var(--down)" }} className="font-medium">
          {t.side === "buy" ? "Buy" : "Sell"}
        </span>
        {shortenAddress(t.trader)}
      </div>
    ),
  },
  { key: "outcome", header: "Side", render: (t) => (t.isUp ? "Up" : "Down") },
  { key: "amount", header: COLLATERAL_SYMBOL, render: (t) => formatEth(t.collateralAmount) },
  { key: "shares", header: "Shares", render: (t) => formatEth(t.sharesAmount) },
];

export function TradeHistoryTable({ marketId }: { marketId: bigint }) {
  // Indexer-backed (see lib/indexerApi.ts's fetchMarketTrades) — every trade
  // is already indexed, so the tape is one GraphQL read per poll instead of
  // the lifetime-spanning SharesBought/SharesSold log scan the old direct
  // chain read did. Newest-first straight from the query, so no reverse here.
  const { data: trades, isLoading } = useQuery({
    queryKey: ["marketTrades", marketId.toString()],
    queryFn: () => fetchMarketTrades(marketId),
    refetchInterval: 10_000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trade history</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveTable columns={columns} rows={trades} getRowKey={(t) => t.id} loading={isLoading} emptyMessage="No trades yet." />
      </CardContent>
    </Card>
  );
}
