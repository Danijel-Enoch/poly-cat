"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

import { fetchAssetPrice, type PricePoint } from "@/lib/priceApi";
import { useNow } from "@/lib/useNow";
import type { PriceSourceName } from "@/lib/chainReads";
import { DexScreenerEmbed } from "@/components/DexScreenerEmbed";
import { Card, CardContent } from "@/components/ui/card";

const colors = {
  up: "var(--up)",
  down: "var(--down)",
  strike: "#a39d8f",
  axisText: "#a39d8f",
  valueText: "#1f1a10",
  markerRing: "#fcfbf8", // matches the card background
  hoverLine: "#a39d8f",
  tooltipBg: "#fcfbf8",
  tooltipBorder: "#e7e2d6",
  tooltipText: "#635d4f",
};

const WIDTH = 640;
// Tall enough that the chart reads as the page's focal point rather than a
// thin line in a mostly-empty card — matches how much visual weight a
// reference trading UI (e.g. a TradingView panel) gives its own chart.
const HEIGHT = 440;
const MARGIN = { top: 20, right: 60, bottom: 28, left: 8 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

function shortTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function linePath(points: PricePoint[], x: (t: number) => number, y: (v: number) => number): string {
  if (points.length === 0) return "";
  let d = `M ${x(points[0].t)} ${y(points[0].price)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${x(points[i].t)} ${y(points[i].price)}`;
  }
  return d;
}

/** Custom SVG chart fed by Gate.com candlesticks (via the app's own
 * `/api/price/[assetId]` proxy) — used for Gate-sourced ("blue chip")
 * markets. DexScreener-sourced ones render `DexScreenerEmbed` instead; see
 * `PriceHistoryChart` below. */
function GateChart({
  assetId,
  startTime,
  closeTime,
  startPriceWad,
  isTrading,
}: {
  assetId: bigint;
  startTime: bigint;
  closeTime: bigint;
  startPriceWad: bigint;
  isTrading: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  // `now` is null pre-mount (see lib/useNow.ts). Rendering a `Date.now()`
  // fallback during render would trip this repo's purity lint rule (render
  // must be a pure function of props/state); falling back to `closeTime`
  // instead keeps every value below a deterministic function of props until
  // the real clock is available, and the query stays `enabled: false` for
  // that same brief window so it never fetches against the placeholder.
  const now = useNow(isTrading ? 5_000 : 60_000);
  const nowMs = now ?? Number(closeTime) * 1000;

  const strike = Number(startPriceWad) / 1e18;
  const from = Number(startTime);
  const to = Math.min(Math.floor(nowMs / 1000), Number(closeTime)) + 60;

  const { data, isLoading } = useQuery({
    queryKey: ["assetPrice", assetId.toString(), from, isTrading ? Math.floor(nowMs / 60_000) : "final"],
    queryFn: () => fetchAssetPrice(assetId, from, to),
    refetchInterval: isTrading ? 15_000 : false,
    enabled: now !== null,
  });

  const points = useMemo(() => data?.points ?? [], [data]);
  const current = data?.current ?? (points.length > 0 ? points[points.length - 1].price : strike);

  const { tMin, tMax, yMin, yMax } = useMemo(() => {
    const times = points.map((p) => p.t);
    const prices = points.map((p) => p.price);
    const tLo = times.length > 0 ? Math.min(...times, from) : from;
    const tHi = Math.max(times.length > 0 ? Math.max(...times) : from, Math.floor(nowMs / 1000));
    const pLo = Math.min(strike, ...(prices.length > 0 ? prices : [strike]));
    const pHi = Math.max(strike, ...(prices.length > 0 ? prices : [strike]));
    const pad = Math.max((pHi - pLo) * 0.15, strike * 0.0005, 0.01);
    return { tMin: tLo, tMax: Math.max(tHi, tLo + 1), yMin: pLo - pad, yMax: pHi + pad };
  }, [points, strike, from, nowMs]);

  const xScale = (t: number) => MARGIN.left + ((t - tMin) / (tMax - tMin)) * PLOT_WIDTH;
  const yScale = (v: number) => MARGIN.top + ((yMax - v) / (yMax - yMin)) * PLOT_HEIGHT;

  const isUp = current >= strike;
  const lineColor = isUp ? colors.up : colors.down;
  const path = linePath(points, xScale, yScale);
  const pctChange = strike > 0 ? ((current - strike) / strike) * 100 : 0;
  const priceDigits = current >= 100 ? 2 : current >= 1 ? 4 : current >= 0.01 ? 6 : 8;

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || points.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const t = tMin + ((svgX - MARGIN.left) / PLOT_WIDTH) * (tMax - tMin);

    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.t - t);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <Card>
      <CardContent>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg">Price</h2>
        <div className="text-right">
          <p className="text-lg font-display" style={{ color: isUp ? "var(--up)" : "var(--down)" }}>
            ${current.toLocaleString(undefined, { maximumFractionDigits: priceDigits })}
          </p>
          <p className="text-xs font-medium" style={{ color: isUp ? "var(--up)" : "var(--down)" }}>
            {isUp ? "+" : ""}
            {pctChange.toFixed(2)}% vs strike
          </p>
        </div>
      </div>

      {isLoading && points.length === 0 ? (
        <p className="text-sm text-muted-foreground py-16 text-center">Loading price...</p>
      ) : (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full h-auto touch-none"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          >
            <line
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={yScale(strike)}
              y2={yScale(strike)}
              stroke={colors.strike}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text x={WIDTH - MARGIN.right + 6} y={yScale(strike)} dominantBaseline="middle" fontSize={10} fill={colors.strike}>
              strike
            </text>

            <text x={MARGIN.left} y={HEIGHT - 8} textAnchor="start" fontSize={10} fill={colors.axisText}>
              {shortTime(tMin)}
            </text>
            <text x={WIDTH - MARGIN.right} y={HEIGHT - 8} textAnchor="end" fontSize={10} fill={colors.axisText}>
              {shortTime(tMax)}
            </text>

            {path && (
              <motion.path
                d={path}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            )}

            {points.length > 0 && (
              <>
                <circle
                  cx={xScale(points[points.length - 1].t)}
                  cy={yScale(current)}
                  r={4}
                  fill={lineColor}
                  stroke={colors.markerRing}
                  strokeWidth={2}
                />
                <text
                  x={xScale(points[points.length - 1].t) + 8}
                  y={yScale(current)}
                  dominantBaseline="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill={colors.valueText}
                >
                  ${current.toLocaleString(undefined, { maximumFractionDigits: priceDigits })}
                </text>
              </>
            )}

            {hovered && (
              <line
                x1={xScale(hovered.t)}
                x2={xScale(hovered.t)}
                y1={MARGIN.top}
                y2={HEIGHT - MARGIN.bottom}
                stroke={colors.hoverLine}
                strokeWidth={1}
              />
            )}
          </svg>

          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="absolute top-2 pointer-events-none rounded-lg shadow-md px-3 py-2 text-xs"
                style={{
                  left: `${Math.min(80, Math.max(2, (xScale(hovered.t) / WIDTH) * 100))}%`,
                  transform: xScale(hovered.t) / WIDTH > 0.7 ? "translateX(-100%)" : undefined,
                  backgroundColor: colors.tooltipBg,
                  border: `1px solid ${colors.tooltipBorder}`,
                }}
              >
                <p className="mb-1" style={{ color: colors.tooltipText }}>
                  {shortTime(hovered.t)}
                </p>
                <p className="font-bold" style={{ color: hovered.price >= strike ? colors.up : colors.down }}>
                  ${hovered.price.toLocaleString(undefined, { maximumFractionDigits: priceDigits })}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      </CardContent>
    </Card>
  );
}

/** Dispatches to whichever chart fits the market's asset: DexScreener's own
 * embedded widget for on-chain (memecoin) pairs, or a custom chart fed by
 * Gate.com candlesticks for centralized-exchange-listed assets — see
 * DexScreenerEmbed.tsx and the price API route for why these can't share
 * one implementation (DexScreener's public API has no historical-candles
 * endpoint to build a custom chart from). */
export function PriceHistoryChart({
  assetId,
  source,
  sourceId,
  startTime,
  closeTime,
  startPriceWad,
  isTrading,
}: {
  assetId: bigint;
  source: PriceSourceName;
  sourceId: string;
  startTime: bigint;
  closeTime: bigint;
  startPriceWad: bigint;
  isTrading: boolean;
}) {
  if (source === "dexscreener") {
    return <DexScreenerEmbed pairAddress={sourceId} />;
  }
  return (
    <GateChart
      assetId={assetId}
      startTime={startTime}
      closeTime={closeTime}
      startPriceWad={startPriceWad}
      isTrading={isTrading}
    />
  );
}
