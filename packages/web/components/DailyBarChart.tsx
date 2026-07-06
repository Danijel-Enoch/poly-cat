"use client";

import { useState } from "react";
import type { DailyPoint } from "@/lib/analytics";

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Single-series daily bar chart — no legend (one series names itself via the
 * title), a hover/focus tooltip per bar, and a direct label only on the max bar. */
export function DailyBarChart({
  title,
  data,
  formatValue,
}: {
  title: string;
  data: DailyPoint[];
  formatValue: (value: bigint) => string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const max = data.reduce((m, p) => (p.value > m ? p.value : m), 0n);
  const maxNumber = Number(max) || 1;
  const maxIndex = data.findIndex((p) => p.value === max);
  const active = activeIndex !== null ? data[activeIndex] : null;

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-100">{title}</h3>
        {active ? (
          <p className="text-xs text-gray-400">
            <span className="font-semibold text-gray-100">{formatValue(active.value)}</span>{" "}
            <span suppressHydrationWarning>{formatShortDate(active.date)}</span>
          </p>
        ) : (
          <p className="text-xs text-gray-500">
            Peak <span className="font-semibold text-gray-300">{formatValue(max)}</span>
          </p>
        )}
      </div>

      <div className="flex items-end gap-1 h-28" onMouseLeave={() => setActiveIndex(null)}>
        {data.map((p, i) => {
          const heightPct = max === 0n ? 0 : Math.max((Number(p.value) / maxNumber) * 100, p.value > 0n ? 4 : 0);
          const isActive = activeIndex === i;
          return (
            <button
              key={p.date}
              type="button"
              onMouseEnter={() => setActiveIndex(i)}
              onFocus={() => setActiveIndex(i)}
              onBlur={() => setActiveIndex(null)}
              aria-label={`${formatShortDate(p.date)}: ${formatValue(p.value)}`}
              className="group relative flex-1 h-full flex items-end min-w-0"
            >
              <span
                className={`w-full rounded-t-[4px] transition-colors ${
                  isActive || i === maxIndex ? "bg-accent" : "bg-accent/40 group-hover:bg-accent/70"
                }`}
                style={{ height: `${heightPct}%` }}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-gray-500" suppressHydrationWarning>
        <span>{formatShortDate(data[0]?.date ?? "")}</span>
        <span>{formatShortDate(data[data.length - 1]?.date ?? "")}</span>
      </div>
    </div>
  );
}
