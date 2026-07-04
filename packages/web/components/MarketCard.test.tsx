import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketCard } from "./MarketCard";
import type { MarketRow } from "@/lib/ponder";

function makeMarket(overrides: Partial<MarketRow> = {}): MarketRow {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: "1",
    creator: "0x000000000000000000000000000000000000dEaD",
    collateralToken: "0x000000000000000000000000000000000000dEaD",
    questionHash: "0xabc123",
    metadataURI: "[Crypto]Will BTC hit $100k?",
    closeTime: String(now + 3600),
    createdAt: String(now),
    state: "Trading",
    outcome: null,
    yesSupply: "100",
    noSupply: "100",
    volume: "0",
    settledAt: null,
    ...overrides,
  };
}

describe("MarketCard", () => {
  it("renders the parsed title, category tag, and probability", () => {
    render(<MarketCard market={makeMarket()} />);
    expect(screen.getByText("Will BTC hit $100k?")).toBeInTheDocument();
    expect(screen.getByText("Crypto")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("falls back to the raw question hash when metadataURI has no title text", () => {
    render(<MarketCard market={makeMarket({ metadataURI: "[Crypto]", questionHash: "0xdeadbeef" })} />);
    expect(screen.getByText("0xdeadbeef")).toBeInTheDocument();
  });

  it("shows a verified badge only when explicitly marked verified", () => {
    const { rerender } = render(<MarketCard market={makeMarket()} verified={false} />);
    expect(screen.queryByLabelText("Verified by HoodMarkets")).not.toBeInTheDocument();

    rerender(<MarketCard market={makeMarket()} verified={true} />);
    expect(screen.getByLabelText("Verified by HoodMarkets")).toBeInTheDocument();
  });

  it("shows a Resolved badge with the outcome for a finalized market", () => {
    render(<MarketCard market={makeMarket({ state: "Finalized", outcome: true })} />);
    expect(screen.getByText(/Resolved/)).toBeInTheDocument();
    expect(screen.getByText(/YES/)).toBeInTheDocument();
  });

  it("shows a Cancelled badge for a cancelled market", () => {
    render(<MarketCard market={makeMarket({ state: "Cancelled" })} />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });
});
