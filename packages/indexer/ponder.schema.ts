import { index, onchainTable, relations } from "ponder";

// Mirrors MarketFactory.sol's on-chain state plus a running trade tally, not
// a 1:1 copy of every field the contract exposes — anything a live page
// already reads directly off-chain (current curve reserve/upSupply/
// downSupply, exact fee balance) stays a direct `getMarket` read there (see
// packages/web/lib/chainReads.ts); this indexer exists specifically to
// answer the two queries direct chain reads can't do cheaply: "every market
// ever created" (admin) and "every market one address has ever held a
// position in, resolved and still unclaimed" (portfolio).

export const asset = onchainTable("asset", (t) => ({
  id: t.bigint().primaryKey(), // assetId
  symbol: t.text().notNull(),
  // Lowercase to match packages/web/lib/chainReads.ts's PriceSourceName ("gate" | "dexscreener").
  source: t.text().notNull().$type<"gate" | "dexscreener">(),
  sourceId: t.text().notNull(),
  registeredBlock: t.bigint().notNull(),
  registeredAt: t.bigint().notNull(), // block timestamp
}));

export const assetRelations = relations(asset, ({ many }) => ({
  markets: many(market),
}));

export const market = onchainTable(
  "market",
  (t) => ({
    id: t.bigint().primaryKey(), // marketId
    assetId: t.bigint().notNull(),
    startTime: t.bigint().notNull(),
    closeTime: t.bigint().notNull(),
    startPriceWad: t.bigint().notNull(),
    closePriceWad: t.bigint(), // null until settled
    initialLiquidity: t.bigint().notNull(),
    // Mirrors MarketFactory.sol's enum MarketState.
    state: t.text().notNull().$type<"Trading" | "Finalized" | "Cancelled">(),
    outcome: t.boolean(), // valid only once state === "Finalized"; true = Up won
    // Set only when state === "Cancelled": "push" (settleMarket saw closePrice ==
    // startPrice) vs. "manual" (owner called cancelMarket directly).
    cancelReason: t.text().$type<"push" | "manual">(),
    // Running sum of every buy/sell's collateral amount for this market — the
    // same figure packages/web/lib/chainReads.ts's getMarketVolume computes
    // per-market on demand, kept incrementally here instead.
    volume: t.bigint().notNull().default(0n),
    tradeCount: t.integer().notNull().default(0),
    createdBlock: t.bigint().notNull(),
    createdAt: t.bigint().notNull(),
    settledBlock: t.bigint(),
    settledAt: t.bigint(),
  }),
  (table) => ({
    assetIdx: index().on(table.assetId),
    stateIdx: index().on(table.state),
  }),
);

export const marketRelations = relations(market, ({ one, many }) => ({
  asset: one(asset, { fields: [market.assetId], references: [asset.id] }),
  trades: many(trade),
  positions: many(position),
}));

export const trade = onchainTable(
  "trade",
  (t) => ({
    id: t.text().primaryKey(), // event.id — unique per log
    marketId: t.bigint().notNull(),
    trader: t.hex().notNull(),
    side: t.text().notNull().$type<"buy" | "sell">(),
    isUp: t.boolean().notNull(),
    collateralAmount: t.bigint().notNull(), // collateralIn (buy) or collateralOut (sell)
    sharesAmount: t.bigint().notNull(), // sharesOut (buy) or sharesIn (sell)
    feePaid: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    marketIdx: index().on(table.marketId),
    traderIdx: index().on(table.trader),
  }),
);

export const tradeRelations = relations(trade, ({ one }) => ({
  market: one(market, { fields: [trade.marketId], references: [market.id] }),
}));

// One row per (marketId, holder) — a running Up/Down share balance, updated
// on every buy/sell and zeroed on redeem/refund exactly like the contract's
// own `shareBalances` mapping. This is what makes "every market a user has
// ever held a position in" a single indexed query instead of the bounded
// 300-market scan packages/web/lib/chainReads.ts's getUserPositions falls
// back to without an indexer.
export const position = onchainTable(
  "position",
  (t) => ({
    id: t.text().primaryKey(), // `${marketId}-${holder}`
    marketId: t.bigint().notNull(),
    holder: t.hex().notNull(),
    upBalance: t.bigint().notNull().default(0n),
    downBalance: t.bigint().notNull().default(0n),
    // True once this holder has redeemed a win or claimed a refund for this
    // market — after which both balances are zeroed, mirroring the contract.
    claimed: t.boolean().notNull().default(false),
    claimedSide: t.text().$type<"redeem" | "refund">(),
    claimedAmount: t.bigint(),
    claimedAt: t.bigint(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    holderIdx: index().on(table.holder),
    marketIdx: index().on(table.marketId),
  }),
);

export const positionRelations = relations(position, ({ one }) => ({
  market: one(market, { fields: [position.marketId], references: [market.id] }),
}));
