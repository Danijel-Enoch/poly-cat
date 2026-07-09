"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchPnlLeaderboard, type LeaderboardRow } from "@/lib/indexerApi";
import { formatEth, shortenAddress } from "@/lib/format";
import { COLLATERAL_SYMBOL } from "@/lib/contracts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ui/responsive-table";

const LIMIT = 100;

type Row = { rank: number; entry: LeaderboardRow };

/** Top traders by all-time realized PnL — sourced from the indexer's
 * `trader` table (packages/indexer/ponder.schema.ts), sorted server-side on
 * its stored `pnl` column since Ponder's GraphQL API can't sort by a
 * computed value. Same "public, on-chain, recomputable data" posture as
 * app/api/pnl-card/route.tsx: an address here is exactly as exposed as it
 * already is on a block explorer, just aggregated. */
export function PnlLeaderboard() {
  const { data, status } = useQuery({
    queryKey: ["pnlLeaderboard"],
    queryFn: () => fetchPnlLeaderboard(LIMIT),
    refetchInterval: 10_000,
  });

  const rows: Row[] | undefined = data?.map((entry, index) => ({ rank: index + 1, entry }));

  const columns: ResponsiveTableColumn<Row>[] = [
    {
      key: "trader",
      header: "Trader",
      primary: true,
      render: ({ rank, entry }) => (
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-sm text-muted-foreground w-6">#{rank}</span>
          <span className="font-mono">{shortenAddress(entry.address)}</span>
        </div>
      ),
    },
    {
      key: "pnl",
      header: "PnL",
      render: ({ entry }) => {
        const isProfit = entry.pnl >= 0n;
        return (
          <Badge variant={isProfit ? "up" : "down"}>
            {isProfit ? "+" : "-"}
            {formatEth(isProfit ? entry.pnl : -entry.pnl)} {COLLATERAL_SYMBOL}
          </Badge>
        );
      },
    },
    {
      key: "volume",
      header: "Volume",
      render: ({ entry }) => (
        <span className="whitespace-nowrap">
          {formatEth(entry.totalBought + entry.totalSold)} {COLLATERAL_SYMBOL}
        </span>
      ),
    },
    {
      key: "trades",
      header: "Trades",
      render: ({ entry }) => entry.buyCount + entry.sellCount,
    },
  ];

  if (status === "error") {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-destructive">
            Couldn&apos;t reach the indexer — is <code className="text-foreground">packages/indexer</code> running (
            <code className="text-foreground">pnpm indexer:dev</code>)?
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <ResponsiveTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.entry.address}
          loading={status === "pending"}
          emptyMessage="No trades yet."
        />
      </CardContent>
    </Card>
  );
}
