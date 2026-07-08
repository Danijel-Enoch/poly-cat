import { and, desc, eq, inArray, type Client } from "@ponder/client";
import type { Address } from "viem";

import { schema } from "./ponder";

type Db = Client<typeof schema>["db"];

/** Every market ever created, newest first — what a direct chain read can't
 * cheaply answer (`currentMarketId` only ever points at each asset's *latest*
 * market, see lib/chainReads.ts). Powers the admin dashboard's full history
 * table. `db` is whatever `usePonderQuery`'s `queryFn` hands in. */
export function allMarketsQuery(db: Db, limit: number, offset: number) {
  return db
    .select({
      id: schema.market.id,
      assetId: schema.market.assetId,
      assetSymbol: schema.asset.symbol,
      state: schema.market.state,
      outcome: schema.market.outcome,
      cancelReason: schema.market.cancelReason,
      startPriceWad: schema.market.startPriceWad,
      closePriceWad: schema.market.closePriceWad,
      volume: schema.market.volume,
      tradeCount: schema.market.tradeCount,
      startTime: schema.market.startTime,
      closeTime: schema.market.closeTime,
      createdAt: schema.market.createdAt,
    })
    .from(schema.market)
    .leftJoin(schema.asset, eq(schema.market.assetId, schema.asset.id))
    .orderBy(desc(schema.market.id))
    .limit(limit)
    .offset(offset);
}

export type RedeemableRow = {
  marketId: bigint;
  assetSymbol: string;
  // The query below always filters to just these two via `inArray` — typed as
  // the table's full state union (drizzle doesn't narrow column types from a
  // WHERE clause) rather than asserting past that filter.
  state: "Trading" | "Finalized" | "Cancelled";
  outcome: boolean | null;
  upBalance: bigint;
  downBalance: bigint;
};

/** Every market `holder` has ever held a position in that's now resolved and
 * still unclaimed — the full-history counterpart to lib/chainReads.ts's
 * getUserPositions, which only scans the most recent ~300 markets. Resolved
 * but not-a-win positions (losing shares on a Finalized market) are excluded
 * client-side below since there's nothing to claim there. */
export function redeemablePositionsQuery(db: Db, holder: Address) {
  return db
    .select({
      marketId: schema.position.marketId,
      upBalance: schema.position.upBalance,
      downBalance: schema.position.downBalance,
      state: schema.market.state,
      outcome: schema.market.outcome,
      assetSymbol: schema.asset.symbol,
    })
    .from(schema.position)
    .innerJoin(schema.market, eq(schema.position.marketId, schema.market.id))
    .innerJoin(schema.asset, eq(schema.market.assetId, schema.asset.id))
    .where(
      and(
        eq(schema.position.holder, holder.toLowerCase() as Address),
        eq(schema.position.claimed, false),
        inArray(schema.market.state, ["Finalized", "Cancelled"]),
      ),
    )
    .orderBy(desc(schema.position.marketId));
}

/** Client-side filter for redeemablePositionsQuery's raw rows: a Finalized
 * market only has something to claim on the winning side; a Cancelled
 * (pushed or manually cancelled) market is refundable on either side; a
 * still-Trading market (shouldn't reach here given the query's own
 * `inArray` filter, but this stays correct even if a caller skips it) has
 * nothing to claim yet either way. */
export function isActuallyRedeemable(row: RedeemableRow): boolean {
  if (row.state === "Finalized") return row.outcome ? row.upBalance > 0n : row.downBalance > 0n;
  if (row.state === "Cancelled") return row.upBalance > 0n || row.downBalance > 0n;
  return false;
}
