"use client";

import { useState } from "react";
import { usePonderQuery } from "@ponder/react";

import { allMarketsQuery } from "@/lib/ponderQueries";
import { formatEth, formatDate, formatPriceWad } from "@/lib/format";
import { assetDisplayName } from "@/lib/assets";
import { COLLATERAL_SYMBOL } from "@/lib/contracts";

const PAGE_SIZE = 25;

/** Every market the factory has ever created, not just each asset's current
 * one — the admin dashboard's live `getMarketsList` (see lib/chainReads.ts)
 * only ever shows one row per asset (its `currentMarketId`), so a finalized
 * or cancelled market rolls off that view the moment the next window opens
 * for the same asset. This reads packages/indexer instead, which keeps every
 * market ever created. */
export function AdminMarketHistory() {
  const [page, setPage] = useState(0);

  const { data: rows, status } = usePonderQuery({
    queryFn: (db) => allMarketsQuery(db, PAGE_SIZE, page * PAGE_SIZE),
  });

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-gray-100">All markets ever created</h2>
        <p className="text-xs text-gray-500">Full history, via packages/indexer</p>
      </div>

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
                <th className="pb-2 pr-4 font-medium">ID</th>
                <th className="pb-2 pr-4 font-medium">Asset</th>
                <th className="pb-2 pr-4 font-medium">State</th>
                <th className="pb-2 pr-4 font-medium">Strike</th>
                <th className="pb-2 pr-4 font-medium">Close price</th>
                <th className="pb-2 pr-4 font-medium">Volume</th>
                <th className="pb-2 pr-4 font-medium">Trades</th>
                <th className="pb-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {status === "pending" ? (
                <tr>
                  <td className="py-4 text-gray-500" colSpan={8}>
                    Loading...
                  </td>
                </tr>
              ) : rows && rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={row.id.toString()} className="border-b border-gray-800/60 last:border-0">
                    <td className="py-2 pr-4 text-gray-400">#{row.id.toString()}</td>
                    <td className="py-2 pr-4 text-gray-100 font-semibold whitespace-nowrap">
                      {assetDisplayName(row.assetSymbol ?? `Asset ${row.assetId}`)}
                    </td>
                    <td className="py-2 pr-4 text-gray-400">
                      {row.state}
                      {row.state === "Finalized" ? ` · ${row.outcome ? "Up" : "Down"}` : ""}
                      {row.state === "Cancelled" && row.cancelReason ? ` · ${row.cancelReason}` : ""}
                    </td>
                    <td className="py-2 pr-4 text-gray-300">${formatPriceWad(row.startPriceWad)}</td>
                    <td className="py-2 pr-4 text-gray-300">
                      {row.closePriceWad === null ? "—" : `$${formatPriceWad(row.closePriceWad)}`}
                    </td>
                    <td className="py-2 pr-4 text-gray-300">
                      {formatEth(row.volume)} {COLLATERAL_SYMBOL}
                    </td>
                    <td className="py-2 pr-4 text-gray-300">{row.tradeCount}</td>
                    <td className="py-2 text-gray-300 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-4 text-gray-500" colSpan={8}>
                    No markets yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800 text-xs font-semibold px-2.5 py-1 disabled:opacity-40"
        >
          Newer
        </button>
        <span className="text-xs text-gray-500">Page {page + 1}</span>
        <button
          type="button"
          disabled={!rows || rows.length < PAGE_SIZE}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800 text-xs font-semibold px-2.5 py-1 disabled:opacity-40"
        >
          Older
        </button>
      </div>
    </div>
  );
}
