import type { Address } from "viem";
import type { PriceSourceName } from "./chainReads";

/** Everything the web app reads from packages/indexer goes through here, as
 * plain GraphQL over HTTP (Ponder also serves SQL-over-HTTP, but this app
 * deliberately doesn't use it — GraphQL only) — hand-rolled `fetch` calls,
 * matching this repo's existing style for every other proxied API
 * (lib/assetSearchApi.ts, lib/priceApi.ts), rather than pulling in a GraphQL
 * client library for a handful of read-only queries. */
const INDEXER_URL = process.env.NEXT_PUBLIC_PONDER_URL ?? "http://localhost:42069";

class IndexerError extends Error {}

async function graphqlRequest<T>(query: string): Promise<T> {
  const res = await fetch(INDEXER_URL, {
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

export type IndexerAsset = { id: bigint; symbol: string; source: PriceSourceName; sourceId: string };

type RawAssetFields = { id: string; symbol: string; source: PriceSourceName; sourceId: string };

/** Every registered asset, in registration order — the indexer-backed
 * equivalent of lib/chainReads.ts's getAssets, used wherever the full
 * registry (not just "assets with a current market") is needed without a
 * direct chain read. */
export async function fetchIndexedAssets(): Promise<IndexerAsset[]> {
  const data = await graphqlRequest<{ assets: { items: RawAssetFields[] } }>(`{
    assets(orderBy: "id", orderDirection: "asc", limit: 1000) {
      items { id symbol source sourceId }
    }
  }`);
  return data.assets.items.map((a) => ({ id: toBigInt(a.id), symbol: a.symbol, source: a.source, sourceId: a.sourceId }));
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
