"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring } from "framer-motion";
import type { IndexerAssetSlot } from "@/lib/indexerApi";
import { upProbabilityFromSupplies, formatPriceWad, formatEth } from "@/lib/format";
import { assetDisplayName, assetColor } from "@/lib/assets";
import { COLLATERAL_SYMBOL } from "@/lib/contracts";
import { useNow } from "@/lib/useNow";
import { HoloCard } from "@/components/HoloCard";
import { AssetIcon } from "@/components/AssetIcon";

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Pointer-tracked tilt for a "picking up a trading card" hover feel — a small
 * rotation range driven by cursor position within the card's own bounds,
 * springing back to flat on leave. Flat until the first pointer move, so it
 * never fights the card's mount-in animation. */
function useCardTilt() {
  const ref = useRef<HTMLDivElement>(null);
  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);
  const rotateX = useSpring(rawRotateX, { stiffness: 300, damping: 25 });
  const rotateY = useSpring(rawRotateY, { stiffness: 300, damping: 25 });

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rawRotateY.set(px * 10);
    rawRotateX.set(py * -10);
  }

  function onPointerLeave() {
    rawRotateX.set(0);
    rawRotateY.set(0);
  }

  return { ref, rotateX, rotateY, onPointerMove, onPointerLeave };
}

export function MarketCard({ slot, index = 0 }: { slot: IndexerAssetSlot; index?: number }) {
  const { asset, market } = slot;
  // Lifetime volume for the asset (across every market it's ever had), not
  // just this current 5-minute window's own market.volume — a fresh window
  // otherwise reads as near-zero every ~5 minutes regardless of how active
  // the asset actually is.
  const volume = market ? asset.totalVolume : null;
  const now = useNow(1000);
  const tilt = useCardTilt();
  const color = assetColor(asset.symbol);

  const card = (
    <motion.div
      ref={tilt.ref}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4), ease: [0.16, 1, 0.3, 1] }}
      whileHover={market ? { y: -6, scale: 1.015 } : undefined}
      onPointerMove={market ? tilt.onPointerMove : undefined}
      onPointerLeave={market ? tilt.onPointerLeave : undefined}
      style={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY, transformPerspective: 800 }}
      className="min-w-0"
    >
      <HoloCard active={!!market} radius={28} innerClassName={`flex flex-col overflow-hidden ${market ? "" : "opacity-60"}`}>
          {/* Art zone — big colored badge area like an NFT card's image slot. */}
          <div
            className="relative h-36 shrink-0 flex items-center justify-center overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${color}33 0%, ${color}bb 55%, ${color}55 100%)` }}
          >
            <div
              className="absolute inset-0 opacity-20"
              style={{ backgroundImage: "repeating-linear-gradient(45deg, #000 0 2px, transparent 2px 10px)" }}
            />
            <AssetIcon
              asset={asset}
              className="relative h-20 w-20 rounded-full bg-gray-950/10 shadow-lg ring-2 ring-white/20"
              textClassName="text-3xl drop-shadow-[0_2px_0_rgba(255,255,255,0.25)]"
            />
            <span className="absolute top-2.5 -right-7 rotate-45 bg-gray-950/90 text-accent text-[10px] font-bold uppercase tracking-widest px-8 py-1">
              5m
            </span>
            {market?.state === "Trading" && (
              <span className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-gray-950/70 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                Live
              </span>
            )}
          </div>

          <div className="flex flex-1 flex-col p-4">
            <p className="font-bold text-sm text-gray-100 uppercase tracking-wide">{assetDisplayName(asset.symbol)}</p>
            <p className="text-[11px] text-gray-500 -mt-0.5">5m window · ape or gd</p>

            {!market ? (
              <p className="mt-6 flex-1 text-sm text-gray-500 py-6 text-center">Opening soon, ser...</p>
            ) : (
              (() => {
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
                    <div className="mt-3 flex flex-1 flex-col items-center justify-center py-2">
                      <span
                        className={`text-5xl font-extrabold leading-none ${upPct >= 50 ? "text-emerald-400 text-glow-up" : "text-rose-400 text-glow-down"}`}
                      >
                        {upPct}%
                      </span>
                      <span className="mt-1 text-[11px] text-gray-500 uppercase tracking-widest">chance Up</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-800 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${upPct}%` }} />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <span className="text-center text-sm font-bold rounded-lg py-2 bg-emerald-950 text-emerald-400 border border-emerald-900 uppercase tracking-wide">
                        Ape Up · {upPct}¢
                      </span>
                      <span className="text-center text-sm font-bold rounded-lg py-2 bg-rose-950 text-rose-400 border border-rose-900 uppercase tracking-wide">
                        Ape Dn · {100 - upPct}¢
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                      <span>Strike ${formatPriceWad(market.startPriceWad)}</span>
                      {market.state === "Finalized" ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-900 whitespace-nowrap uppercase">
                          {market.outcome ? "Up won 🟢" : "Down won 🔴"}
                        </span>
                      ) : market.state === "Cancelled" ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 whitespace-nowrap">
                          Push · rekt
                        </span>
                      ) : closesIn === null ? null : isTrading ? (
                        <span>Closes in {formatCountdown(closesIn)}</span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 whitespace-nowrap">
                          Settling...
                        </span>
                      )}
                    </div>
                    {volume != null && (
                      <p className="mt-1 text-[11px] text-gray-500">
                        Vol {formatEth(volume)} {COLLATERAL_SYMBOL} · {volume > 0n ? "live action" : "gbow"}
                      </p>
                    )}
                  </>
                );
              })()
            )}
          </div>
      </HoloCard>
    </motion.div>
  );

  if (!market) return card;
  return (
    <Link href={`/markets/${market.id}`} className="block">
      {card}
    </Link>
  );
}
