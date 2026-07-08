"use client";

import { useQuery } from "@tanstack/react-query";

import { getTradeHistory } from "@/lib/chainReads";
import { formatEth, shortenAddress } from "@/lib/format";
import { COLLATERAL_SYMBOL } from "@/lib/contracts";

export function TradeHistoryTable({ marketId, startTime }: { marketId: bigint; startTime: bigint }) {
  const { data: trades, isLoading } = useQuery({
    queryKey: ["tradeHistory", marketId.toString()],
    queryFn: () => getTradeHistory(marketId, startTime),
    refetchInterval: 10_000,
  });

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <h2 className="font-bold text-gray-100 mb-4 uppercase tracking-wide">Tape</h2>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading action...</p>
      ) : !trades || trades.length === 0 ? (
        <p className="text-sm text-gray-500">No action yet, ser.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-800">
                <th className="pb-2 pr-4 font-bold">Degen</th>
                <th className="pb-2 pr-4 font-bold">Side</th>
                <th className="pb-2 pr-4 font-bold">Outcome</th>
                <th className="pb-2 pr-4 font-bold">{COLLATERAL_SYMBOL}</th>
                <th className="pb-2 font-bold">Shares</th>
              </tr>
            </thead>
            <tbody>
              {[...trades]
                .reverse()
                .map((trade) => (
                  <tr
                    key={`${trade.txHash}-${trade.logIndex}`}
                    className="border-b border-gray-800/60 last:border-0"
                  >
                    <td className="py-2 pr-4 text-gray-300">{shortenAddress(trade.trader)}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`font-bold ${trade.side === "buy" ? "text-emerald-400" : "text-rose-400"}`}
                      >
                        {trade.side === "buy" ? "Ape" : "Exit"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-300">{trade.isUp ? "UP" : "DOWN"}</td>
                    <td className="py-2 pr-4 text-gray-300">{formatEth(trade.collateralAmount)}</td>
                    <td className="py-2 text-gray-300">{formatEth(trade.sharesAmount)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
