"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchPnlLeaderboard } from "@/lib/indexerApi";
import { formatEth, shortenAddress } from "@/lib/format";
import { COLLATERAL_SYMBOL } from "@/lib/contracts";

const LIMIT = 100;

/** Top traders by all-time realized PnL — sourced from the indexer's
 * `trader` table (packages/indexer/ponder.schema.ts), sorted server-side on
 * its stored `pnl` column since Ponder's GraphQL API can't sort by a
 * computed value. Same "public, on-chain, recomputable data" posture as
 * app/api/pnl-card/route.tsx: an address here is exactly as exposed as it
 * already is on a block explorer, just aggregated. */
export function PnlLeaderboard() {
  const { data: rows, status } = useQuery({
    queryKey: ["pnlLeaderboard"],
    queryFn: () => fetchPnlLeaderboard(LIMIT),
    refetchInterval: 10_000,
  });

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      {status === "error" ? (
        <p className="text-sm text-rose-400">
          Couldn&apos;t reach the indexer — is <code className="text-gray-300">packages/indexer</code> running
          (<code className="text-gray-300">pnpm indexer:dev</code>)?
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-800">
                <th className="pb-2 pr-4 font-medium">Rank</th>
                <th className="pb-2 pr-4 font-medium">Trader</th>
                <th className="pb-2 pr-4 font-medium">PnL</th>
                <th className="pb-2 pr-4 font-medium">Volume</th>
                <th className="pb-2 font-medium">Trades</th>
              </tr>
            </thead>
            <tbody>
              {status === "pending" ? (
                <tr>
                  <td className="py-4 text-gray-500" colSpan={5}>
                    Loading...
                  </td>
                </tr>
              ) : rows && rows.length > 0 ? (
                rows.map((row, index) => {
                  const isProfit = row.pnl >= 0n;
                  return (
                    <tr key={row.address} className="border-b border-gray-800/60 last:border-0">
                      <td className="py-2 pr-4 text-gray-400 font-semibold">#{index + 1}</td>
                      <td className="py-2 pr-4 text-gray-100 font-mono">{shortenAddress(row.address)}</td>
                      <td className={`py-2 pr-4 font-bold whitespace-nowrap ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
                        {isProfit ? "+" : "-"}
                        {formatEth(isProfit ? row.pnl : -row.pnl)} {COLLATERAL_SYMBOL}
                      </td>
                      <td className="py-2 pr-4 text-gray-300 whitespace-nowrap">
                        {formatEth(row.totalBought + row.totalSold)} {COLLATERAL_SYMBOL}
                      </td>
                      <td className="py-2 text-gray-300">{row.buyCount + row.sellCount}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="py-4 text-gray-500" colSpan={5}>
                    No trades yet — be the first to ape.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
