"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";

import { getTradeHistory } from "@/lib/ponder";
import { yesProbabilityFromSupplies } from "@/lib/format";
import { useNow } from "@/lib/useNow";

// SVG fill/stroke colors can't be styled with Tailwind's `dark:` classes, so this
// picks a light/dark palette explicitly based on the resolved theme.
const PALETTE = {
  light: {
    yes: "#059669", // emerald-600 — matches the Yes color used everywhere else in the app
    no: "#e11d48", // rose-600 — matches the No color used everywhere else in the app
    grid: "#e5e7eb", // gray-200, recessive hairline
    axisText: "#9ca3af", // gray-400
    valueText: "#111827", // gray-900
    markerRing: "#ffffff",
    hoverLine: "#9ca3af",
    tooltipBg: "#ffffff",
    tooltipBorder: "#e5e7eb",
    tooltipText: "#6b7280",
  },
  dark: {
    yes: "#34d399", // emerald-400
    no: "#fb7185", // rose-400
    grid: "#374151", // gray-700
    axisText: "#6b7280", // gray-500
    valueText: "#f3f4f6", // gray-100
    markerRing: "#111827", // gray-900, matches the card background so the ring blends in
    hoverLine: "#6b7280",
    tooltipBg: "#111827",
    tooltipBorder: "#1f2937",
    tooltipText: "#9ca3af",
  },
};

const WIDTH = 640;
const HEIGHT = 260;
const MARGIN = { top: 20, right: 54, bottom: 28, left: 36 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

type Point = { t: number; yes: number }; // t = unix seconds, yes = 0-100

function shortDateTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Step-after path: price holds at the previous value until the instant of the next
 * trade, then jumps — this is what actually happens in the AMM, unlike a smoothed
 * line between trades which would imply a gradual drift that never occurred. */
function stepPath(points: Point[], x: (t: number) => number, y: (v: number) => number): string {
  if (points.length === 0) return "";
  let d = `M ${x(points[0].t)} ${y(points[0].yes)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${x(points[i].t)} ${y(points[i - 1].yes)}`;
    d += ` L ${x(points[i].t)} ${y(points[i].yes)}`;
  }
  return d;
}

export function PriceHistoryChart({
  marketId,
  createdAt,
  closeTime,
}: {
  marketId: bigint;
  createdAt: bigint;
  closeTime: bigint;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const now = useNow();
  const { resolvedTheme } = useTheme();
  const colors = PALETTE[resolvedTheme === "dark" ? "dark" : "light"];

  const { data: trades, isLoading } = useQuery({
    queryKey: ["tradeHistory", marketId.toString()],
    queryFn: () => getTradeHistory(marketId.toString()),
    refetchInterval: 10_000,
  });

  const points = useMemo<Point[]>(() => {
    const start = Number(createdAt);
    const pts: Point[] = [{ t: start, yes: 50 }];
    for (const trade of trades ?? []) {
      pts.push({
        t: Number(trade.timestamp),
        yes: yesProbabilityFromSupplies(trade.yesSupplyAfter, trade.noSupplyAfter) * 100,
      });
    }
    const end = Math.min(now / 1000, Number(closeTime));
    if (end > pts[pts.length - 1].t) {
      pts.push({ t: end, yes: pts[pts.length - 1].yes });
    }
    return pts;
  }, [trades, createdAt, closeTime, now]);

  const tMin = points[0].t;
  const tMax = Math.max(points[points.length - 1].t, tMin + 1);

  const xScale = (t: number) => MARGIN.left + ((t - tMin) / (tMax - tMin)) * PLOT_WIDTH;
  const yScale = (v: number) => MARGIN.top + ((100 - v) / 100) * PLOT_HEIGHT;

  const yesPath = stepPath(points, xScale, yScale);
  const noPath = stepPath(
    points.map((p) => ({ t: p.t, yes: 100 - p.yes })),
    xScale,
    yScale,
  );

  const lastYes = points[points.length - 1].yes;

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
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

  const gridLines = [0, 25, 50, 75, 100];
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-gray-900 dark:text-gray-100">Price history</h2>
        <div className="flex items-center gap-4 text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
            <span className="inline-block w-3 h-0.5 rounded-full" style={{ backgroundColor: colors.yes }} />
            Yes
          </span>
          <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
            <span className="inline-block w-3 h-0.5 rounded-full" style={{ backgroundColor: colors.no }} />
            No
          </span>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-16 text-center">Loading price history...</p>
      ) : (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full h-auto touch-none"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          >
            {gridLines.map((g) => (
              <g key={g}>
                <line
                  x1={MARGIN.left}
                  x2={WIDTH - MARGIN.right}
                  y1={yScale(g)}
                  y2={yScale(g)}
                  stroke={colors.grid}
                  strokeWidth={1}
                />
                <text x={MARGIN.left - 8} y={yScale(g)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill={colors.axisText}>
                  {g}%
                </text>
              </g>
            ))}

            <text x={MARGIN.left} y={HEIGHT - 8} textAnchor="start" fontSize={10} fill={colors.axisText}>
              {shortDateTime(tMin)}
            </text>
            <text x={WIDTH - MARGIN.right} y={HEIGHT - 8} textAnchor="end" fontSize={10} fill={colors.axisText}>
              {shortDateTime(tMax)}
            </text>

            <motion.path
              d={noPath}
              fill="none"
              stroke={colors.no}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
            <motion.path
              d={yesPath}
              fill="none"
              stroke={colors.yes}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />

            <circle cx={xScale(tMax)} cy={yScale(lastYes)} r={4} fill={colors.yes} stroke={colors.markerRing} strokeWidth={2} />
            <circle cx={xScale(tMax)} cy={yScale(100 - lastYes)} r={4} fill={colors.no} stroke={colors.markerRing} strokeWidth={2} />
            <text x={xScale(tMax) + 8} y={yScale(lastYes)} dominantBaseline="middle" fontSize={11} fontWeight={700} fill={colors.valueText}>
              {Math.round(lastYes)}%
            </text>
            <text x={xScale(tMax) + 8} y={yScale(100 - lastYes)} dominantBaseline="middle" fontSize={11} fontWeight={700} fill={colors.valueText}>
              {Math.round(100 - lastYes)}%
            </text>

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
                  left: `${Math.min(85, Math.max(2, (xScale(hovered.t) / WIDTH) * 100))}%`,
                  transform: xScale(hovered.t) / WIDTH > 0.7 ? "translateX(-100%)" : undefined,
                  backgroundColor: colors.tooltipBg,
                  border: `1px solid ${colors.tooltipBorder}`,
                }}
              >
                <p className="mb-1" style={{ color: colors.tooltipText }}>
                  {shortDateTime(hovered.t)}
                </p>
                <p className="font-bold" style={{ color: colors.yes }}>
                  Yes {Math.round(hovered.yes)}%
                </p>
                <p className="font-bold" style={{ color: colors.no }}>
                  No {Math.round(100 - hovered.yes)}%
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
