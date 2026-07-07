import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketCard } from "./MarketCard";
import type { Asset, MarketRow } from "@/lib/chainReads";

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return { id: 0n, symbol: "BTC", source: "gate", sourceId: "BTC_USDT", ...overrides };
}

function makeMarket(overrides: Partial<MarketRow> = {}): MarketRow {
  const now = BigInt(Math.floor(Date.now() / 1000));
  return {
    id: 1n,
    assetId: 0n,
    startTime: now,
    closeTime: now + 300n,
    startPriceWad: 50_000n * 10n ** 18n,
    closePriceWad: 0n,
    reserve: 1000n,
    upSupply: 100n,
    downSupply: 100n,
    genesisSupply: 100n,
    collectedFees: 0n,
    state: "Trading",
    outcome: false,
    ...overrides,
  };
}

describe("MarketCard", () => {
  it("renders the asset and 50/50 probability at genesis", () => {
    render(<MarketCard slot={{ asset: makeAsset(), market: makeMarket() }} />);
    expect(screen.getByText("Bitcoin")).toBeInTheDocument();
    expect(screen.getByText("5m window")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("falls back to the raw symbol for an asset with no known display name", () => {
    render(<MarketCard slot={{ asset: makeAsset({ symbol: "CASHCAT", source: "dexscreener" }), market: makeMarket() }} />);
    expect(screen.getByText("CASHCAT")).toBeInTheDocument();
  });

  it("shows an opening-soon state when the asset has no market yet", () => {
    render(<MarketCard slot={{ asset: makeAsset({ symbol: "ETH" }), market: null }} />);
    expect(screen.getByText("Opening soon...")).toBeInTheDocument();
  });

  it("shows the outcome for a finalized market", () => {
    render(<MarketCard slot={{ asset: makeAsset({ symbol: "SOL" }), market: makeMarket({ state: "Finalized", outcome: true }) }} />);
    expect(screen.getByText("UP won")).toBeInTheDocument();
  });

  it("shows a push badge for a cancelled (tied) market", () => {
    render(<MarketCard slot={{ asset: makeAsset(), market: makeMarket({ state: "Cancelled" }) }} />);
    expect(screen.getByText("Push")).toBeInTheDocument();
  });
});
