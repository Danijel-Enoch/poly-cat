import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MarketCard } from "./MarketCard";
import type { IndexerAsset, IndexerAssetSlot, IndexerMarketRow } from "@/lib/indexerApi";

// MarketCard renders <AssetIcon>, which calls useQuery (to fetch a
// DexScreener-sourced asset's logo) regardless of whether that query ends up
// enabled — React Query requires a QueryClientProvider ancestor for that
// alone, same as app/providers.tsx sets up for the real app.
function renderMarketCard(slot: IndexerAssetSlot) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MarketCard slot={slot} />
    </QueryClientProvider>,
  );
}

function makeAsset(overrides: Partial<IndexerAsset> = {}): IndexerAsset {
  return { id: 0n, symbol: "BTC", source: "gate", sourceId: "BTC_USDT", ...overrides };
}

function makeMarket(overrides: Partial<IndexerMarketRow> = {}): IndexerMarketRow {
  const now = BigInt(Math.floor(Date.now() / 1000));
  return {
    id: 1n,
    assetId: 0n,
    startTime: now,
    closeTime: now + 300n,
    startPriceWad: 50_000n * 10n ** 18n,
    closePriceWad: null,
    upSupply: 100n,
    downSupply: 100n,
    collectedFees: 0n,
    volume: 0n,
    state: "Trading",
    outcome: null,
    ...overrides,
  };
}

function makeSlot(overrides: Partial<IndexerAssetSlot> = {}): IndexerAssetSlot {
  return { asset: makeAsset(), market: makeMarket(), ...overrides };
}

describe("MarketCard", () => {
  it("renders the asset and 50/50 probability at genesis", () => {
    renderMarketCard(makeSlot());
    expect(screen.getByText("Bitcoin")).toBeInTheDocument();
    expect(screen.getByText(/5m window/)).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("falls back to the raw symbol for an asset with no known display name", () => {
    renderMarketCard(makeSlot({ asset: makeAsset({ symbol: "CASHCAT", source: "dexscreener" }) }));
    expect(screen.getByText("CASHCAT")).toBeInTheDocument();
  });

  it("shows an opening-soon state when the asset has no market yet", () => {
    renderMarketCard(makeSlot({ asset: makeAsset({ symbol: "ETH" }), market: null }));
    expect(screen.getByText(/Opening soon/)).toBeInTheDocument();
  });

  it("shows the outcome for a finalized market", () => {
    renderMarketCard(makeSlot({ asset: makeAsset({ symbol: "SOL" }), market: makeMarket({ state: "Finalized", outcome: true }) }));
    expect(screen.getByText(/won/)).toBeInTheDocument();
  });

  it("shows a push badge for a cancelled (tied) market", () => {
    renderMarketCard(makeSlot({ market: makeMarket({ state: "Cancelled" }) }));
    expect(screen.getByText(/Push/)).toBeInTheDocument();
  });

  it("shows total volume when known", () => {
    renderMarketCard(makeSlot({ market: makeMarket({ volume: 1_500_000_000_000_000_000n }) }));
    expect(screen.getByText(/Vol 1\.5 ETH/)).toBeInTheDocument();
  });
});
