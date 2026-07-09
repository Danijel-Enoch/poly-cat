import type { Address } from "viem";
import type { PriceSourceName } from "./chainReads";

/** Everything the web app reads from packages/indexer goes through here, as
 * plain GraphQL over HTTP (Ponder also serves SQL-over-HTTP, but this app
 * deliberately doesn't use it — GraphQL only) — hand-rolled `fetch` calls,
 * matching this repo's existing style for every other proxied API
 * (lib/assetSearchApi.ts, lib/priceApi.ts), rather than pulling in a GraphQL
 * client library for a handful of read-only queries. */
// Server-side callers (RSC pages, route handlers) hit the indexer directly —
// fastest path, and a relative URL wouldn't resolve there anyway. Browser
// callers go through this app's own /api/indexer proxy (see that route for
// why: it's what makes the indexer reachable at all when this app is loaded
// through a forwarded dev URL rather than plain localhost).
const INDEXER_URL = process.env.NEXT_PUBLIC_PONDER_URL ?? "http://localhost:42069";

class IndexerError extends Error {}

async function graphqlRequest<T>(query: string): Promise<T> {
  const url = typeof window === "undefined" ? INDEXER_URL : "/api/indexer";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new IndexerError(`Indexer request failed: ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new IndexerError(json.errors[0].message);
  if (!json.data) throw new IndexerError("Indexer returned no data");
  return json.data;
}

// Ponder's BigInt/Boolean/String scalars all come back as their natural JSON
// representation except BigInt, which is a string (JS numbers can't hold
// arbitrary-precision integers) — these convert just that field back to a
// real `bigint`, same type every direct chain read already returns.
function toBigInt(value: string): bigint {
  return BigInt(value);
}
function toBigIntOrNull(value: string | null): bigint | null {
  return value === null ? null : BigInt(value);
}

// ---------------------------------------------------------------------------
// Admin dashboard: every market ever created (components/AdminMarketHistory.tsx)
// ---------------------------------------------------------------------------

export type IndexedMarketRow = {
  id: bigint;
  assetId: bigint;
  assetSymbol: string | null;
  state: "Trading" | "Finalized" | "Cancelled";
  outcome: boolean | null;
  cancelReason: "push" | "manual" | null;
  startPriceWad: bigint;
  closePriceWad: bigint | null;
  volume: bigint;
  tradeCount: number;
  startTime: bigint;
  closeTime: bigint;
  createdAt: bigint;
};

type RawMarketFields = {
  id: string;
  assetId: string;
  state: "Trading" | "Finalized" | "Cancelled";
  outcome: boolean | null;
  cancelReason: "push" | "manual" | null;
  startPriceWad: string;
  closePriceWad: string | null;
  volume: string;
  tradeCount: number;
  startTime: string;
  closeTime: string;
  createdAt: string;
  asset: { symbol: string } | null;
};

function toIndexedMarketRow(raw: RawMarketFields): IndexedMarketRow {
  return {
    id: toBigInt(raw.id),
    assetId: toBigInt(raw.assetId),
    assetSymbol: raw.asset?.symbol ?? null,
    state: raw.state,
    outcome: raw.outcome,
    cancelReason: raw.cancelReason,
    startPriceWad: toBigInt(raw.startPriceWad),
    closePriceWad: toBigIntOrNull(raw.closePriceWad),
    volume: toBigInt(raw.volume),
    tradeCount: raw.tradeCount,
    startTime: toBigInt(raw.startTime),
    closeTime: toBigInt(raw.closeTime),
    createdAt: toBigInt(raw.createdAt),
  };
}

/** Every market ever created, newest first — what a direct chain read can't
 * cheaply answer (`currentMarketId` only ever points at each asset's *latest*
 * market, see lib/chainReads.ts). Powers the admin dashboard's full history
 * table. */
export async function fetchAllMarkets(limit: number, offset: number): Promise<IndexedMarketRow[]> {
  const data = await graphqlRequest<{ markets: { items: RawMarketFields[] } }>(`{
    markets(orderBy: "id", orderDirection: "desc", limit: ${limit}, offset: ${offset}) {
      items {
        id assetId state outcome cancelReason startPriceWad closePriceWad
        volume tradeCount startTime closeTime createdAt
        asset { symbol }
      }
    }
  }`);
  return data.markets.items.map(toIndexedMarketRow);
}

// ---------------------------------------------------------------------------
// Portfolio: every unclaimed, resolved position a wallet has ever held
// (components/NeedsRedeemingList.tsx)
// ---------------------------------------------------------------------------

export type RedeemableRow = {
  marketId: bigint;
  assetSymbol: string;
  // The GraphQL API has no nested-relation filter (only top-level `where`),
  // so this can't be narrowed server-side the way the old SQL version's
  // `inArray` could — typed as the table's full state union and filtered
  // client-side instead, see isActuallyRedeemable below.
  state: "Trading" | "Finalized" | "Cancelled";
  outcome: boolean | null;
  upBalance: bigint;
  downBalance: bigint;
};

type RawPositionFields = {
  marketId: string;
  upBalance: string;
  downBalance: string;
  market: { state: "Trading" | "Finalized" | "Cancelled"; outcome: boolean | null; asset: { symbol: string } | null };
};

/** Every market `holder` has ever held a position in that's now resolved and
 * still unclaimed — the full-history counterpart to lib/chainReads.ts's
 * getUserPositions, which only scans the most recent ~300 markets. */
export async function fetchRedeemablePositions(holder: Address): Promise<RedeemableRow[]> {
  const data = await graphqlRequest<{ positions: { items: RawPositionFields[] } }>(`{
    positions(
      where: { holder: "${holder.toLowerCase()}", claimed: false }
      orderBy: "marketId"
      orderDirection: "desc"
      limit: 1000
    ) {
      items {
        marketId upBalance downBalance
        market { state outcome asset { symbol } }
      }
    }
  }`);
  return data.positions.items.map((row) => ({
    marketId: toBigInt(row.marketId),
    assetSymbol: row.market.asset?.symbol ?? "?",
    state: row.market.state,
    outcome: row.market.outcome,
    upBalance: toBigInt(row.upBalance),
    downBalance: toBigInt(row.downBalance),
  }));
}

/** A Finalized market only has something to claim on the winning side; a
 * Cancelled (pushed or manually cancelled) market is refundable on either
 * side; a still-Trading market has nothing to claim yet either way. */
export function isActuallyRedeemable(row: RedeemableRow): boolean {
  if (row.state === "Finalized") return row.outcome ? row.upBalance > 0n : row.downBalance > 0n;
  if (row.state === "Cancelled") return row.upBalance > 0n || row.downBalance > 0n;
  return false;
}

// ---------------------------------------------------------------------------
// Home page + admin's live markets table: each asset's current market
// (lib/indexerMarketsList.ts's fetchIndexerMarketsList — see there)
// ---------------------------------------------------------------------------

export type IndexerAsset = {
  id: bigint;
  symbol: string;
  source: PriceSourceName;
  sourceId: string;
  // Lifetime totals across every market this asset has ever had — see
  // ponder.schema.ts's asset table. Distinct from a market row's own
  // `volume`/`collectedFees`, which only cover that one 5-minute window.
  totalVolume: bigint;
  totalFees: bigint;
  totalTrades: number;
  marketCount: number;
};

type RawAssetFields = {
  id: string;
  symbol: string;
  source: PriceSourceName;
  sourceId: string;
  totalVolume: string;
  totalFees: string;
  totalTrades: number;
  marketCount: number;
};

/** Every registered asset, in registration order — the indexer-backed
 * equivalent of lib/chainReads.ts's getAssets, used wherever the full
 * registry (not just "assets with a current market") is needed without a
 * direct chain read. */
export async function fetchIndexedAssets(): Promise<IndexerAsset[]> {
  const data = await graphqlRequest<{ assets: { items: RawAssetFields[] } }>(`{
    assets(orderBy: "id", orderDirection: "asc", limit: 1000) {
      items { id symbol source sourceId totalVolume totalFees totalTrades marketCount }
    }
  }`);
  return data.assets.items.map((a) => ({
    id: toBigInt(a.id),
    symbol: a.symbol,
    source: a.source,
    sourceId: a.sourceId,
    totalVolume: toBigInt(a.totalVolume),
    totalFees: toBigInt(a.totalFees),
    totalTrades: a.totalTrades,
    marketCount: a.marketCount,
  }));
}

/** Every market id ever created for one asset, oldest first — the indexer
 * already has this indexed (market.assetIdx in ponder.schema.ts), this just
 * hides the limit/offset pagination a single asset's full history can
 * require behind one `await`, reusing the same paginated query shape
 * fetchAllMarkets uses for the admin history table. */
export async function fetchMarketIdsByAsset(assetId: bigint): Promise<bigint[]> {
  const pageSize = 1000;
  const ids: bigint[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const data = await graphqlRequest<{ markets: { items: { id: string }[] } }>(`{
      markets(where: { assetId: "${assetId}" }, orderBy: "id", orderDirection: "asc", limit: ${pageSize}, offset: ${offset}) {
        items { id }
      }
    }`);
    const page = data.markets.items;
    ids.push(...page.map((m) => toBigInt(m.id)));
    if (page.length < pageSize) break;
  }
  return ids;
}

export type IndexerMarketRow = {
  id: bigint;
  assetId: bigint;
  startTime: bigint;
  closeTime: bigint;
  startPriceWad: bigint;
  closePriceWad: bigint | null;
  state: "Trading" | "Finalized" | "Cancelled";
  outcome: boolean | null;
  upSupply: bigint;
  downSupply: bigint;
  collectedFees: bigint;
  volume: bigint;
};

type RawLatestMarketFields = RawMarketFields & { upSupply: string; downSupply: string; collectedFees: string };

function toIndexerMarketRow(raw: RawLatestMarketFields): IndexerMarketRow {
  return {
    id: toBigInt(raw.id),
    assetId: toBigInt(raw.assetId),
    startTime: toBigInt(raw.startTime),
    closeTime: toBigInt(raw.closeTime),
    startPriceWad: toBigInt(raw.startPriceWad),
    closePriceWad: toBigIntOrNull(raw.closePriceWad),
    state: raw.state,
    outcome: raw.outcome,
    upSupply: toBigInt(raw.upSupply),
    downSupply: toBigInt(raw.downSupply),
    collectedFees: toBigInt(raw.collectedFees),
    volume: toBigInt(raw.volume),
  };
}

/** Each registered asset's highest-id (i.e. current) market, one indexer
 * round-trip regardless of how many assets exist: one aliased sub-query per
 * asset ID (`a<id>: markets(where: {assetId: "<id>"}, ...limit: 1)`) in a
 * single GraphQL request — the indexer's GraphQL API has no GROUP BY/MAX
 * aggregation, so this is the batched alternative to N separate requests. */
export async function fetchLatestMarketsByAsset(assetIds: bigint[]): Promise<Map<string, IndexerMarketRow>> {
  if (assetIds.length === 0) return new Map();

  const fields = `id assetId state outcome cancelReason startPriceWad closePriceWad
        volume tradeCount startTime closeTime createdAt upSupply downSupply collectedFees`;
  const subqueries = assetIds
    .map((id) => `a${id}: markets(where: { assetId: "${id}" }, orderBy: "id", orderDirection: "desc", limit: 1) { items { ${fields} } }`)
    .join("\n");

  const data = await graphqlRequest<Record<string, { items: RawLatestMarketFields[] }>>(`{ ${subqueries} }`);

  const byAssetId = new Map<string, IndexerMarketRow>();
  for (const id of assetIds) {
    const item = data[`a${id}`]?.items[0];
    if (item) byAssetId.set(id.toString(), toIndexerMarketRow(item));
  }
  return byAssetId;
}

// ---------------------------------------------------------------------------
// Market tape: the latest trades on one market (components/TradeHistoryTable.tsx)
// ---------------------------------------------------------------------------

export type IndexedTradeRow = {
  id: string; // the indexer's per-log id — a stable React key
  trader: Address;
  side: "buy" | "sell";
  isUp: boolean;
  collateralAmount: bigint;
  sharesAmount: bigint;
  feePaid: bigint;
  timestamp: bigint;
  txHash: `0x${string}`;
};

type RawTradeFields = {
  id: string;
  trader: string;
  side: "buy" | "sell";
  isUp: boolean;
  collateralAmount: string;
  sharesAmount: string;
  feePaid: string;
  timestamp: string;
  txHash: string;
};

/** The most recent trades on one market, newest first — the indexer-backed
 * replacement for lib/chainReads.ts's getTradeHistory, which scans
 * SharesBought/SharesSold logs over the market's whole lifetime on every
 * 10-second refetch. Every trade is already indexed (see the `trade` table in
 * packages/indexer/ponder.schema.ts), so the tape is a single GraphQL read
 * instead of a per-poll `getContractEvents` pair. `limit` bounds it to the
 * latest N rather than returning an unbounded market's full history. */
export async function fetchMarketTrades(marketId: bigint, limit = 50): Promise<IndexedTradeRow[]> {
  const data = await graphqlRequest<{ trades: { items: RawTradeFields[] } }>(`{
    trades(
      where: { marketId: "${marketId}" }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: ${limit}
    ) {
      items { id trader side isUp collateralAmount sharesAmount feePaid timestamp txHash }
    }
  }`);
  return data.trades.items.map((raw) => ({
    id: raw.id,
    trader: raw.trader as Address,
    side: raw.side,
    isUp: raw.isUp,
    collateralAmount: toBigInt(raw.collateralAmount),
    sharesAmount: toBigInt(raw.sharesAmount),
    feePaid: toBigInt(raw.feePaid),
    timestamp: toBigInt(raw.timestamp),
    txHash: raw.txHash as `0x${string}`,
  }));
}

// ---------------------------------------------------------------------------
// Admin dashboard: project-wide, all-time totals (app/(dapp)/admin/page.tsx)
// ---------------------------------------------------------------------------

export type ProtocolStats = {
  totalVolume: bigint;
  totalFees: bigint;
  totalTrades: number;
  lastTradeAt: bigint | null;
};

type RawProtocolStat = {
  totalVolume: string;
  totalFees: string;
  totalTrades: number;
  lastTradeAt: string | null;
} | null;

/** The single, project-wide running totals row (see the `protocolStat`
 * singleton in packages/indexer/ponder.schema.ts) — all-time collateral
 * volume, all-time fees earned, and trade count across every market. `null`
 * fields are returned as zeros before the first trade has been indexed, so
 * callers always get a usable object. Note `totalFees` is cumulative fees
 * *earned* and is distinct from the admin table's per-market "unclaimed fees"
 * (which withdrawals zero out). */
export async function fetchProtocolStats(): Promise<ProtocolStats> {
  const data = await graphqlRequest<{ protocolStat: RawProtocolStat }>(`{
    protocolStat(id: "protocol") { totalVolume totalFees totalTrades lastTradeAt }
  }`);
  const row = data.protocolStat;
  return {
    totalVolume: row ? toBigInt(row.totalVolume) : 0n,
    totalFees: row ? toBigInt(row.totalFees) : 0n,
    totalTrades: row?.totalTrades ?? 0,
    lastTradeAt: row ? toBigIntOrNull(row.lastTradeAt) : null,
  };
}

export type IndexerAssetSlot = { asset: IndexerAsset; market: IndexerMarketRow | null };

/** The indexer-backed replacement for lib/chainReads.ts's getMarketsList —
 * every registered asset paired with its current market, sourced entirely
 * from packages/indexer instead of a direct chain read per asset. Used by
 * the home page grid and admin's live markets table, both of which used to
 * poll dozens of RPC calls (an asset list, a `currentMarketId` read and a
 * `getMarket` read per asset, plus a `getContractEvents` volume scan per
 * market) every 10 seconds. `reserve`/`genesisSupply` aren't included since
 * neither view ever needed them (see ponder.schema.ts's note on why
 * `reserve` specifically stays a live, direct read wherever it's actually
 * needed for trading). */
export async function fetchIndexerMarketsList(): Promise<IndexerAssetSlot[]> {
  const assets = await fetchIndexedAssets();
  const marketsByAssetId = await fetchLatestMarketsByAsset(assets.map((a) => a.id));
  return assets.map((asset) => ({ asset, market: marketsByAssetId.get(asset.id.toString()) ?? null }));
}

// ---------------------------------------------------------------------------
// PnL share card: one wallet's all-time, all-market trading totals
// (components/PnlShareCard.tsx, app/api/pnl-card/route.tsx)
// ---------------------------------------------------------------------------

export type TraderStats = {
  totalBought: bigint;
  totalSold: bigint;
  totalClaimed: bigint;
  totalFeesPaid: bigint;
  pnl: bigint;
  buyCount: number;
  sellCount: number;
  claimCount: number;
};

type RawTraderStat = {
  totalBought: string;
  totalSold: string;
  totalClaimed: string;
  totalFeesPaid: string;
  pnl: string;
  buyCount: number;
  sellCount: number;
  claimCount: number;
} | null;

/** One trader's all-time running totals (see the `trader` table in
 * packages/indexer/ponder.schema.ts) — every buy/sell/redeem/refund across
 * every market they've ever touched. `null` fields (wallet has never traded)
 * come back as zeros, same idiom as fetchProtocolStats, so callers always
 * get a usable object. */
export async function fetchTraderStats(address: Address): Promise<TraderStats> {
  const data = await graphqlRequest<{ trader: RawTraderStat }>(`{
    trader(id: "${address.toLowerCase()}") {
      totalBought totalSold totalClaimed totalFeesPaid pnl buyCount sellCount claimCount
    }
  }`);
  const row = data.trader;
  return {
    totalBought: row ? toBigInt(row.totalBought) : 0n,
    totalSold: row ? toBigInt(row.totalSold) : 0n,
    totalClaimed: row ? toBigInt(row.totalClaimed) : 0n,
    totalFeesPaid: row ? toBigInt(row.totalFeesPaid) : 0n,
    pnl: row ? toBigInt(row.pnl) : 0n,
    buyCount: row?.buyCount ?? 0,
    sellCount: row?.sellCount ?? 0,
    claimCount: row?.claimCount ?? 0,
  };
}

/** Realized PnL: what came back (sell proceeds + redeem/refund payouts)
 * minus what went out (buy cost). The trader row's `pnl` column already
 * carries this exact figure (updated alongside totalBought/totalSold/
 * totalClaimed in every handler that touches them — see
 * packages/indexer/src/index.ts), stored rather than computed here so the
 * leaderboard can sort by it server-side. This helper just names the field
 * for readability at call sites. */
export function pnlFromTraderStats(stats: TraderStats): bigint {
  return stats.pnl;
}

export type LeaderboardRow = {
  address: Address;
  pnl: bigint;
  totalBought: bigint;
  totalSold: bigint;
  totalClaimed: bigint;
  buyCount: number;
  sellCount: number;
};

type RawLeaderboardRow = {
  id: string;
  pnl: string;
  totalBought: string;
  totalSold: string;
  totalClaimed: string;
  buyCount: number;
  sellCount: number;
};

/** Top traders by all-time realized PnL, highest first — backs
 * components/PnlLeaderboard.tsx. Sorted server-side on the stored `pnl`
 * column (see ponder.schema.ts's note on why it's stored, not computed on
 * read: Ponder's GraphQL API can only `orderBy` a real column). */
export async function fetchPnlLeaderboard(limit = 100): Promise<LeaderboardRow[]> {
  const data = await graphqlRequest<{ traders: { items: RawLeaderboardRow[] } }>(`{
    traders(orderBy: "pnl", orderDirection: "desc", limit: ${limit}) {
      items { id pnl totalBought totalSold totalClaimed buyCount sellCount }
    }
  }`);
  return data.traders.items.map((row) => ({
    address: row.id as Address,
    pnl: toBigInt(row.pnl),
    totalBought: toBigInt(row.totalBought),
    totalSold: toBigInt(row.totalSold),
    totalClaimed: toBigInt(row.totalClaimed),
    buyCount: row.buyCount,
    sellCount: row.sellCount,
  }));
}

/** Every market `holder` has ever held a position in, claimed or not — a
 * `position` row is created the first time a holder trades a given market
 * (see packages/indexer/src/index.ts) and never deleted, so the row count is
 * exactly "markets participated in." Same 1000-row cap as
 * fetchRedeemablePositions; realistically no single wallet gets near it. */
export async function fetchTraderMarketCount(address: Address): Promise<number> {
  const data = await graphqlRequest<{ positions: { items: { marketId: string }[] } }>(`{
    positions(where: { holder: "${address.toLowerCase()}" }, limit: 1000) {
      items { marketId }
    }
  }`);
  return data.positions.items.length;
}
