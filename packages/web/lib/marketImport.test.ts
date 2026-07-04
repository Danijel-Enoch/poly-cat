import { describe, expect, it } from "vitest";
import { MAX_IMPORT_BATCH, clampCloseTime, computeEffectiveCount, computeMaxAffordable } from "./marketImport";

describe("computeMaxAffordable", () => {
  it("divides balance by per-market liquidity", () => {
    expect(computeMaxAffordable(100n, 10n)).toBe(10);
    expect(computeMaxAffordable(95n, 10n)).toBe(9);
  });

  it("returns 0 when the balance can't afford a single market", () => {
    expect(computeMaxAffordable(5n, 10n)).toBe(0);
  });

  it("caps at MAX_IMPORT_BATCH regardless of how large the balance is", () => {
    expect(computeMaxAffordable(1_000_000n, 1n)).toBe(MAX_IMPORT_BATCH);
  });

  it("returns 0 for a zero or negative liquidity floor instead of dividing by zero", () => {
    expect(computeMaxAffordable(100n, 0n)).toBe(0);
  });
});

describe("computeEffectiveCount", () => {
  it("falls back to maxAffordable when no count is requested", () => {
    expect(computeEffectiveCount(null, 7)).toBe(7);
  });

  it("caps a requested count at maxAffordable", () => {
    expect(computeEffectiveCount(20, 7)).toBe(7);
  });

  it("honors a requested count under the affordable max", () => {
    expect(computeEffectiveCount(3, 7)).toBe(3);
  });

  it("never returns a negative count for a bogus request", () => {
    expect(computeEffectiveCount(-5, 7)).toBe(0);
  });
});

describe("clampCloseTime", () => {
  const now = 1_000_000;
  const minTradingDuration = 3600n; // 1 hour, matches MIN_TRADING_DURATION

  it("uses the Polymarket end date when it's comfortably past the floor", () => {
    const farFuture = now + 30 * 24 * 60 * 60;
    const endDateIso = new Date(farFuture * 1000).toISOString();
    expect(clampCloseTime(endDateIso, now, minTradingDuration)).toBe(farFuture);
  });

  it("falls back to +7 days when there's no end date", () => {
    expect(clampCloseTime(null, now, minTradingDuration)).toBe(now + 7 * 24 * 60 * 60);
  });

  it("falls back to +7 days when the end date is already too close to the floor", () => {
    const tooSoon = new Date((now + 60) * 1000).toISOString();
    expect(clampCloseTime(tooSoon, now, minTradingDuration)).toBe(now + 7 * 24 * 60 * 60);
  });
});
