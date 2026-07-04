import { describe, expect, it } from "vitest";
import { filterLikelyDuplicates, isLikelyDuplicate, normalizeTitle } from "./marketDedupe";

describe("normalizeTitle", () => {
  it("lowercases, strips punctuation, and collapses whitespace", () => {
    expect(normalizeTitle("Will BTC hit $100k?!")).toBe("will btc hit 100k");
    expect(normalizeTitle("  Multiple   spaces  ")).toBe("multiple spaces");
  });
});

describe("isLikelyDuplicate", () => {
  const existing = ["Will BTC hit $100k by end of 2026?", "Will it rain in NYC tomorrow?"];

  it("flags an exact match ignoring punctuation/case", () => {
    expect(isLikelyDuplicate("will btc hit 100k by end of 2026", existing)).toBe(true);
  });

  it("flags a substring match either direction", () => {
    expect(isLikelyDuplicate("Will BTC hit $100k by end of 2026? (resolved by CoinGecko)", existing)).toBe(true);
  });

  it("does not flag an unrelated question", () => {
    expect(isLikelyDuplicate("Will the Lakers win the championship?", existing)).toBe(false);
  });

  it("never flags an empty title", () => {
    expect(isLikelyDuplicate("???", existing)).toBe(false);
  });
});

describe("filterLikelyDuplicates", () => {
  it("removes only candidates matching an existing title", () => {
    const candidates = [
      { question: "Will BTC hit $100k by end of 2026?" },
      { question: "Will the Lakers win the championship?" },
    ];
    const result = filterLikelyDuplicates(candidates, ["Will BTC hit $100k by end of 2026?"]);
    expect(result).toEqual([{ question: "Will the Lakers win the championship?" }]);
  });
});
