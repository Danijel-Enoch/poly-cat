import { describe, expect, it } from "vitest";
import { dailySeries, marketActivity, returningTraderCount, uniqueTraderCount } from "./analytics";
import type { TradeSummaryRow } from "./ponder";

const DAY = 86_400;

function trade(overrides: Partial<TradeSummaryRow>): TradeSummaryRow {
  return {
    marketId: "1",
    trader: "0xAAA",
    collateralAmount: "100",
    feePaid: "1",
    timestamp: String(Math.floor(Date.now() / 1000)),
    ...overrides,
  };
}

describe("dailySeries", () => {
  it("zero-fills days with no trades", () => {
    const series = dailySeries([], "collateralAmount", 3);
    expect(series).toHaveLength(3);
    expect(series.every((p) => p.value === 0n)).toBe(true);
  });

  it("buckets a field by UTC day and ignores trades outside the window", () => {
    const now = Math.floor(Date.now() / 1000);
    const trades = [
      trade({ collateralAmount: "100", timestamp: String(now) }),
      trade({ collateralAmount: "50", timestamp: String(now) }),
      trade({ collateralAmount: "999", timestamp: String(now - 30 * DAY) }), // outside a 3-day window
    ];
    const series = dailySeries(trades, "collateralAmount", 3);
    expect(series[series.length - 1].value).toBe(150n);
    expect(series.reduce((sum, p) => sum + p.value, 0n)).toBe(150n);
  });
});

describe("uniqueTraderCount", () => {
  it("dedupes case-insensitively", () => {
    const trades = [trade({ trader: "0xAAA" }), trade({ trader: "0xaaa" }), trade({ trader: "0xBBB" })];
    expect(uniqueTraderCount(trades)).toBe(2);
  });
});

describe("returningTraderCount", () => {
  it("counts only traders active on more than one distinct day", () => {
    const now = Math.floor(Date.now() / 1000);
    const trades = [
      trade({ trader: "0xAAA", timestamp: String(now) }),
      trade({ trader: "0xAAA", timestamp: String(now - 2 * DAY) }),
      trade({ trader: "0xBBB", timestamp: String(now) }),
      trade({ trader: "0xBBB", timestamp: String(now) }),
    ];
    expect(returningTraderCount(trades)).toBe(1);
  });
});

describe("marketActivity", () => {
  it("rolls up trade count, unique traders, and volume per market", () => {
    const trades = [
      trade({ marketId: "1", trader: "0xAAA", collateralAmount: "100" }),
      trade({ marketId: "1", trader: "0xBBB", collateralAmount: "50" }),
      trade({ marketId: "2", trader: "0xAAA", collateralAmount: "10" }),
    ];
    const activity = marketActivity(trades);
    const m1 = activity.find((a) => a.marketId === "1")!;
    expect(m1.tradeCount).toBe(2);
    expect(m1.uniqueTraders).toBe(2);
    expect(m1.volume).toBe(150n);
    const m2 = activity.find((a) => a.marketId === "2")!;
    expect(m2.tradeCount).toBe(1);
    expect(m2.volume).toBe(10n);
  });
});
