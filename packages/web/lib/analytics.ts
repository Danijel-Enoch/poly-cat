import type { TradeSummaryRow } from "./ponder";

export type DailyPoint = { date: string; value: bigint };

function dayKey(timestampSeconds: string): string {
  return new Date(Number(timestampSeconds) * 1000).toISOString().slice(0, 10);
}

/** Buckets a trade field by UTC day over a fixed trailing window, zero-filling days
 * with no activity so the chart never silently drops a gap. */
export function dailySeries(
  trades: TradeSummaryRow[],
  field: "collateralAmount" | "feePaid",
  days: number,
): DailyPoint[] {
  const buckets = new Map<string, bigint>();
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    buckets.set(new Date(now - i * 86_400_000).toISOString().slice(0, 10), 0n);
  }
  for (const t of trades) {
    const key = dayKey(t.timestamp);
    if (buckets.has(key)) {
      buckets.set(key, buckets.get(key)! + BigInt(t[field]));
    }
  }
  return Array.from(buckets.entries()).map(([date, value]) => ({ date, value }));
}

export function uniqueTraderCount(trades: TradeSummaryRow[]): number {
  return new Set(trades.map((t) => t.trader.toLowerCase())).size;
}

/** A "returning" trader is one who has traded on more than one distinct UTC day —
 * repeat engagement, not just multiple trades in a single visit. */
export function returningTraderCount(trades: TradeSummaryRow[]): number {
  const daysByTrader = new Map<string, Set<string>>();
  for (const t of trades) {
    const trader = t.trader.toLowerCase();
    if (!daysByTrader.has(trader)) daysByTrader.set(trader, new Set());
    daysByTrader.get(trader)!.add(dayKey(t.timestamp));
  }
  let returning = 0;
  daysByTrader.forEach((days) => {
    if (days.size > 1) returning++;
  });
  return returning;
}

export type MarketActivity = { marketId: string; tradeCount: number; uniqueTraders: number; volume: bigint };

/** Per-market trade-count/unique-trader/volume rollup, used to rank "most traded"
 * markets independent of the market entity's own cumulative `volume` field. */
export function marketActivity(trades: TradeSummaryRow[]): MarketActivity[] {
  const map = new Map<string, { tradeCount: number; traders: Set<string>; volume: bigint }>();
  for (const t of trades) {
    const entry = map.get(t.marketId) ?? { tradeCount: 0, traders: new Set<string>(), volume: 0n };
    entry.tradeCount += 1;
    entry.traders.add(t.trader.toLowerCase());
    entry.volume += BigInt(t.collateralAmount);
    map.set(t.marketId, entry);
  }
  return Array.from(map.entries()).map(([marketId, v]) => ({
    marketId,
    tradeCount: v.tradeCount,
    uniqueTraders: v.traders.size,
    volume: v.volume,
  }));
}
