"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { AssetSlot } from "@/lib/chainReads";
import { upProbabilityFromSupplies, formatPriceWad, formatEth } from "@/lib/format";
import { assetDisplayName, assetColor } from "@/lib/assets";
import { COLLATERAL_SYMBOL } from "@/lib/contracts";
import { useNow } from "@/lib/useNow";

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MarketCard({ slot, index = 0 }: { slot: AssetSlot; index?: number }) {
  const { asset, market, volume } = slot;
  const now = useNow(1000);

  const card = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4), ease: [0.16, 1, 0.3, 1] }}
      whileHover={market ? { y: -3 } : undefined}
      className="min-w-0"
    >
      <div
        className={`rounded-2xl border border-gray-800 bg-[#160404] p-4 transition-[box-shadow,border-color] ${
          market ? "hover:shadow-md hover:border-gray-600" : "opacity-60"
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-white font-bold text-xs"
            style={{ backgroundColor: assetColor(asset.symbol) }}
          >
            {asset.symbol.slice(0, 4)}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-100">{assetDisplayName(asset.symbol)}</p>
            <p className="text-[11px] text-gray-500">5m window</p>
          </div>
        </div>

        {!market ? (
          <p className="mt-4 text-sm text-gray-500 py-6 text-center">Opening soon...</p>
        ) : (
          <>
            {(() => {
              const upPct = Math.round(upProbabilityFromSupplies(market.upSupply, market.downSupply) * 100);
              // `now` is null until mounted (see lib/useNow.ts) — the countdown/
              // "closed, awaiting settlement" distinction below only renders once
              // it's known, so the server-rendered HTML and the client's first
              // paint always agree (both show nothing here) and it fills in a
              // moment after hydration instead of mismatching.
              const closesIn = now === null ? null : Number(market.closeTime) - Math.floor(now / 1000);
              const isTrading = market.state === "Trading" && closesIn !== null && closesIn > 0;

              return (
                <>
                  <div className="mt-3 flex items-end justify-between">
                    <span className={`text-2xl font-extrabold ${upPct >= 50 ? "text-emerald-400" : "text-rose-400"}`}>
                      {upPct}%
                    </span>
                    <span className="text-[11px] text-gray-500">Up</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${upPct}%` }} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <span className="text-center text-sm font-semibold rounded-lg py-2 bg-emerald-950 text-emerald-400 border border-emerald-900">
                      Up · {upPct}¢
                    </span>
                    <span className="text-center text-sm font-semibold rounded-lg py-2 bg-rose-950 text-rose-400 border border-rose-900">
                      Down · {100 - upPct}¢
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                    <span>Strike ${formatPriceWad(market.startPriceWad)}</span>
                    {market.state === "Finalized" ? (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-900 whitespace-nowrap">
                        {market.outcome ? "UP won" : "DOWN won"}
                      </span>
                    ) : market.state === "Cancelled" ? (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 whitespace-nowrap">
                        Push
                      </span>
                    ) : closesIn === null ? null : isTrading ? (
                      <span>Closes in {formatCountdown(closesIn)}</span>
                    ) : (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 whitespace-nowrap">
                        Settling...
                      </span>
                    )}
                  </div>
                  {volume != null && (
                    <p className="mt-1 text-[11px] text-gray-500">
                      Vol {formatEth(volume)} {COLLATERAL_SYMBOL}
                    </p>
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>
    </motion.div>
  );

  if (!market) return card;
  return (
    <Link href={`/markets/${market.id}`} className="block">
      {card}
    </Link>
  );
}
