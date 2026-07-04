import { describe, expect, it } from "vitest";
import {
  formatUsdc,
  formatCollateral,
  isPartialDecimalInput,
  shortenAddress,
  yesProbabilityFromSupplies,
} from "./format";

describe("formatUsdc", () => {
  it("formats a raw 6-decimal amount as dollars", () => {
    expect(formatUsdc(123_450_000n)).toBe("123.45");
    expect(formatUsdc("100000000")).toBe("100");
    expect(formatUsdc(0n)).toBe("0");
  });
});

describe("formatCollateral", () => {
  it("formats ETH (18 decimals) with more fraction digits than a stablecoin", () => {
    expect(formatCollateral(1_000_000_000_000_000_000n, 18)).toBe("1");
    expect(formatCollateral(5_000_000_000_000_000n, 18)).toBe("0.005");
  });
});

describe("yesProbabilityFromSupplies", () => {
  it("returns 0.5 when both supplies are zero (no trades yet)", () => {
    expect(yesProbabilityFromSupplies(0n, 0n)).toBe(0.5);
    expect(yesProbabilityFromSupplies("0", "0")).toBe(0.5);
  });

  it("returns 0.5 when supplies are equal", () => {
    expect(yesProbabilityFromSupplies(100n, 100n)).toBe(0.5);
  });

  it("weights probability toward the larger supply, squared", () => {
    // 3^2 / (3^2 + 4^2) = 9/25 = 0.36 — Pythagorean curve, not linear.
    expect(yesProbabilityFromSupplies(3n, 4n)).toBeCloseTo(0.36);
  });
});

describe("isPartialDecimalInput", () => {
  it("accepts empty string and mid-typing decimal states", () => {
    expect(isPartialDecimalInput("")).toBe(true);
    expect(isPartialDecimalInput("1.")).toBe(true);
    expect(isPartialDecimalInput(".5")).toBe(true);
    expect(isPartialDecimalInput("100")).toBe(true);
    expect(isPartialDecimalInput("100.25")).toBe(true);
  });

  it("rejects letters, multiple dots, and scientific notation", () => {
    expect(isPartialDecimalInput("abc")).toBe(false);
    expect(isPartialDecimalInput("1.2.3")).toBe(false);
    expect(isPartialDecimalInput("1e5")).toBe(false);
  });
});

describe("shortenAddress", () => {
  it("keeps the first 6 and last 4 characters", () => {
    expect(shortenAddress("0x0ce71234567890abcdef1234567890abcdef1285")).toBe("0x0ce7...1285");
  });
});
