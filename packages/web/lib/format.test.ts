import { describe, expect, it } from "vitest";
import { formatEth, formatEthFull, formatCollateral, isPartialDecimalInput, shortenAddress, upProbabilityFromSupplies } from "./format";

describe("formatEth", () => {
  it("formats a raw 18-decimal amount as ETH", () => {
    expect(formatEth(1_000_000_000_000_000_000n)).toBe("1");
    expect(formatEth("500000000000000000")).toBe("0.5");
    expect(formatEth(0n)).toBe("0");
  });
});

describe("formatEthFull", () => {
  it("keeps every significant fraction digit (no 4-digit cap, no lossy Number)", () => {
    // A sub-milli fee that formatEth would round to "0"; here it stays visible.
    expect(formatEthFull(1_234_567n)).toBe("0.000000000001234567");
    expect(formatEth(1_234_567n)).toBe("0");
  });

  it("trims trailing zeros and groups the integer part", () => {
    expect(formatEthFull(1_000_000_000_000_000_000n)).toBe("1");
    expect(formatEthFull("500000000000000000")).toBe("0.5");
    // 1,234.0567 CAT — large integer part grouped, fraction not rounded away.
    expect(formatEthFull(1_234_056_700_000_000_000_000n)).toBe("1,234.0567");
    expect(formatEthFull(0n)).toBe("0");
  });
});

describe("formatCollateral", () => {
  it("formats ETH (18 decimals) with more fraction digits than a stablecoin", () => {
    expect(formatCollateral(1_000_000_000_000_000_000n, 18)).toBe("1");
    expect(formatCollateral(5_000_000_000_000_000n, 18)).toBe("0.005");
  });

  it("formats a 6-decimal stablecoin amount with fewer fraction digits", () => {
    expect(formatCollateral(123_450_000n, 6)).toBe("123.45");
  });
});

describe("upProbabilityFromSupplies", () => {
  it("returns 0.5 when both supplies are zero (no trades yet)", () => {
    expect(upProbabilityFromSupplies(0n, 0n)).toBe(0.5);
    expect(upProbabilityFromSupplies("0", "0")).toBe(0.5);
  });

  it("returns 0.5 when supplies are equal", () => {
    expect(upProbabilityFromSupplies(100n, 100n)).toBe(0.5);
  });

  it("weights probability toward the larger supply, squared", () => {
    // 3^2 / (3^2 + 4^2) = 9/25 = 0.36 — Pythagorean curve, not linear.
    expect(upProbabilityFromSupplies(3n, 4n)).toBeCloseTo(0.36);
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
