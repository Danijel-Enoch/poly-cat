const PONDER_URL = process.env.NEXT_PUBLIC_PONDER_URL ?? "http://localhost:42069";

/** Minimal GraphQL client for Ponder's built-in `/graphql` endpoint. No caching layer
 * beyond Next.js's own fetch cache — this app's data changes too quickly (every trade)
 * for a stale-while-revalidate cache to be worth the complexity. */
export async function ponderQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${PONDER_URL}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Ponder query failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error(`Ponder query errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data as T;
}

export type MarketState = "Trading" | "Finalized" | "Cancelled";

export type MarketRow = {
  id: string;
  creator: string;
  collateralToken: string;
  questionHash: string;
  metadataURI: string;
  closeTime: string;
  createdAt: string;
  state: MarketState;
  outcome: boolean | null;
  yesSupply: string;
  noSupply: string;
  volume: string;
  settledAt: string | null;
};

export type PositionRow = {
  id: string;
  marketId: string;
  holder: string;
  yesBalance: string;
  noBalance: string;
};

export type TradeRow = {
  id: string;
  marketId: string;
  trader: string;
  isYes: boolean;
  side: "buy" | "sell";
  collateralAmount: string;
  sharesAmount: string;
  feePaid: string;
  timestamp: string;
  txHash: string;
  yesSupplyAfter: string;
  noSupplyAfter: string;
};

const MARKET_FIELDS = `
  id creator collateralToken questionHash metadataURI closeTime createdAt
  state outcome yesSupply noSupply volume settledAt
`;

export async function getMarkets(): Promise<MarketRow[]> {
  // Sort by `id` (monotonically increasing marketId), not `createdAt` — ordering by a
  // non-primary-key bigint column returns an empty result set in this Ponder version.
  const data = await ponderQuery<{ markets: { items: MarketRow[] } }>(
    `{ markets(orderBy: "id", orderDirection: "desc") { items { ${MARKET_FIELDS} } } }`,
  );
  return data.markets.items;
}

export async function getMarket(id: string): Promise<MarketRow | null> {
  const data = await ponderQuery<{ market: MarketRow | null }>(
    `query($id: BigInt!) { market(id: $id) { ${MARKET_FIELDS} } }`,
    { id },
  );
  return data.market;
}

export async function getTradeHistory(marketId: string): Promise<TradeRow[]> {
  const data = await ponderQuery<{ trades: { items: TradeRow[] } }>(
    `query($marketId: BigInt!) {
      trades(where: { marketId: $marketId }, limit: 1000) {
        items {
          id marketId trader isYes side collateralAmount sharesAmount feePaid
          timestamp txHash yesSupplyAfter noSupplyAfter
        }
      }
    }`,
    { marketId },
  );
  // Sort client-side by timestamp — ordering by a non-primary-key bigint column
  // returns an empty result set in this Ponder version (see getMarkets above).
  return [...data.trades.items].sort((a, b) => (BigInt(a.timestamp) < BigInt(b.timestamp) ? -1 : 1));
}

export type TradeSummaryRow = {
  marketId: string;
  trader: string;
  collateralAmount: string;
  feePaid: string;
  timestamp: string;
};

const TRADE_PAGE_LIMIT = 1000;
// Safety cap, not a real expected ceiling — stops a pagination bug from looping
// forever rather than reflecting an actual ceiling on trade volume.
const TRADE_PAGE_SAFETY_CAP = 50;

/** Fetches every trade across all markets for platform-wide analytics (volume/fees
 * per day, unique/returning traders, most-active markets). Paginates through
 * Ponder's 1000-row page cap via its cursor, unlike `getTradeHistory` which only
 * needs one market's worth and fits under a single page. */
export async function getAllTrades(): Promise<TradeSummaryRow[]> {
  const all: TradeSummaryRow[] = [];
  let after: string | null = null;
  for (let page = 0; page < TRADE_PAGE_SAFETY_CAP; page++) {
    const data: {
      trades: { items: TradeSummaryRow[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
    } = await ponderQuery(
      `query($after: String) {
        trades(limit: ${TRADE_PAGE_LIMIT}, after: $after) {
          items { marketId trader collateralAmount feePaid timestamp }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { after },
    );
    all.push(...data.trades.items);
    if (!data.trades.pageInfo.hasNextPage) break;
    after = data.trades.pageInfo.endCursor;
  }
  return all;
}

export async function getPositionsForHolder(holder: string): Promise<PositionRow[]> {
  const data = await ponderQuery<{ positions: { items: PositionRow[] } }>(
    `query($holder: String!) {
      positions(where: { holder: $holder }) { items { id marketId holder yesBalance noBalance } }
    }`,
    { holder: holder.toLowerCase() },
  );
  return data.positions.items;
}
