import { ponderQuery } from "./ponder";

export type LeaderboardEntry = {
  address: string;
  volume: bigint;
};

const MAX_PAGES = 5;
const PAGE_SIZE = 1000;

type TradePage = {
  trades: {
    items: { trader: string; collateralAmount: string }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

/** Ponder's GraphQL API has no server-side aggregation, so this pages through
 * the `trade` table (capped at MAX_PAGES * PAGE_SIZE rows — generous for
 * local/demo scale) and sums volume per trader client-side. */
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const totals = new Map<string, bigint>();
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const data: TradePage = await ponderQuery<TradePage>(
      `query($after: String) {
        trades(limit: ${PAGE_SIZE}, after: $after) {
          items { trader collateralAmount }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { after: cursor },
    );

    for (const { trader, collateralAmount } of data.trades.items) {
      const key = trader.toLowerCase();
      totals.set(key, (totals.get(key) ?? 0n) + BigInt(collateralAmount));
    }

    if (!data.trades.pageInfo.hasNextPage) break;
    cursor = data.trades.pageInfo.endCursor;
  }

  return [...totals.entries()]
    .map(([address, volume]) => ({ address, volume }))
    .sort((a, b) => (a.volume < b.volume ? 1 : -1))
    .slice(0, 50);
}
