"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring } from "framer-motion";
import type { IndexerAssetSlot } from "@/lib/indexerApi";
import { upProbabilityFromSupplies, formatPriceWad, formatEth } from "@/lib/format";
import { assetDisplayName } from "@/lib/assets";
import { COLLATERAL_SYMBOL } from "@/lib/contracts";
import { useNow } from "@/lib/useNow";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssetIcon } from "@/components/AssetIcon";

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Pointer-tracked tilt for a "picking up a card" hover feel — a small
 * rotation range driven by cursor position within the card's own bounds,
 * springing back to flat on leave. Flat until the first pointer move, so it
 * never fights the card's mount-in animation. Kept from the previous design
 * as a Polycat-specific delight; nothing in the reference dictates removing
 * it. */
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

  const card = (
    <motion.div
      ref={tilt.ref}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4), ease: [0.16, 1, 0.3, 1] }}
      whileHover={market ? { y: -4 } : undefined}
      onPointerMove={market ? tilt.onPointerMove : undefined}
      onPointerLeave={market ? tilt.onPointerLeave : undefined}
      style={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY, transformPerspective: 800 }}
      className="min-w-0 h-full"
    >
      <Card className={`h-full py-4 ${market ? "" : "opacity-60"}`}>
        <CardContent className="flex flex-col h-full px-4">
          <div className="flex items-center gap-2.5">
            <AssetIcon asset={asset} className="h-8 w-8 shrink-0 rounded-full" textClassName="text-xs" />
            <p className="flex-1 min-w-0 font-display text-lg truncate">{assetDisplayName(asset.symbol)}</p>
            <Badge variant="outline" className="font-mono">
              5m
            </Badge>
          </div>

          {!market ? (
            <p className="mt-8 flex-1 text-sm text-muted-foreground py-6 text-center">Opening soon.</p>
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
                  <div className="mt-4 flex flex-1 flex-col items-center justify-center py-2">
                    <span
                      className="text-5xl font-display leading-none"
                      style={{ color: upPct >= 50 ? "var(--up)" : "var(--down)" }}
                    >
                      {upPct}%
                    </span>
                    <span className="mt-1.5 text-xs font-mono uppercase tracking-wide text-muted-foreground">chance Up</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${upPct}%`, background: "var(--up)" }} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Badge variant="up" className="justify-center py-1.5">
                      Up · {upPct}¢
                    </Badge>
                    <Badge variant="down" className="justify-center py-1.5">
                      Down · {100 - upPct}¢
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Strike ${formatPriceWad(market.startPriceWad)}</span>
                    {market.state === "Finalized" ? (
                      <Badge variant={market.outcome ? "up" : "down"}>{market.outcome ? "Up won" : "Down won"}</Badge>
                    ) : market.state === "Cancelled" ? (
                      <Badge variant="secondary">Push</Badge>
                    ) : closesIn === null ? null : isTrading ? (
                      closesIn <= 60 ? (
                        <Badge variant="destructive">Closing · {formatCountdown(closesIn)}</Badge>
                      ) : (
                        <span>Closes in {formatCountdown(closesIn)}</span>
                      )
                    ) : (
                      <Badge variant="secondary">Settling</Badge>
                    )}
                  </div>
                  {volume != null && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Vol {formatEth(volume)} {COLLATERAL_SYMBOL}
                    </p>
                  )}
                </>
              );
            })()
          )}
        </CardContent>
      </Card>
    </motion.div>
  );

  if (!market) return card;
  return (
    <Link href={`/markets/${market.id}`} className="block h-full">
      {card}
    </Link>
  );
}
