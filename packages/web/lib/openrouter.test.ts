import { describe, expect, it } from "vitest";
import { pickBestPolymarketMatch } from "./openrouter";
import type { PolymarketResolution } from "./polymarket";

function resolution(overrides: Partial<PolymarketResolution>): PolymarketResolution {
  return {
    id: "1",
    question: "Will X happen?",
    description: "",
    url: "https://polymarket.com/event/x",
    closed: false,
    resolved: false,
    outcomes: ["Yes", "No"],
    outcomePrices: [0.5, 0.5],
    winningOutcome: null,
    ...overrides,
  };
}

describe("pickBestPolymarketMatch", () => {
  it("returns null when there are no candidates", () => {
    expect(pickBestPolymarketMatch("Will Portugal win the 2026 FIFA World Cup?", [])).toBeNull();
  });

  it("picks the candidate with the most word overlap", () => {
    const candidates = [
      resolution({ id: "a", question: "Will Brazil win the 2026 FIFA World Cup?" }),
      resolution({ id: "b", question: "Will Portugal win the 2026 FIFA World Cup?" }),
      resolution({ id: "c", question: "New Rihanna Album before GTA VI?" }),
    ];
    const match = pickBestPolymarketMatch("Will Portugal win the 2026 FIFA World Cup?", candidates);
    expect(match?.id).toBe("b");
  });

  it("returns null when nothing clears the overlap floor", () => {
    const candidates = [resolution({ id: "a", question: "New Rihanna Album before GTA VI?" })];
    const match = pickBestPolymarketMatch("Will Portugal win the 2026 FIFA World Cup?", candidates);
    expect(match).toBeNull();
  });

  it("prefers the exact match over a longer near-duplicate that contains every target word", () => {
    // Regression: a plain "how much of the target does this candidate contain"
    // score ties (or loses) here, because the Fair Play variant contains every
    // word of the target question plus extras — Jaccard similarity is what
    // makes the extra words count against it.
    const candidates = [
      resolution({ id: "award", question: "Will Portugal win the Fair Play Award for the 2026 FIFA World Cup?" }),
      resolution({ id: "exact", question: "Will Portugal win the 2026 FIFA World Cup?" }),
    ];
    const match = pickBestPolymarketMatch("Will Portugal win the 2026 FIFA World Cup?", candidates);
    expect(match?.id).toBe("exact");
  });
});
