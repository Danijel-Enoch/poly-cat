import { index, onchainTable, relations } from "ponder";

// Mirrors MarketFactory.sol's on-chain state plus a running trade tally, not
// a 1:1 copy of every field the contract exposes — `reserve` in particular
// stays a direct `getMarket` read wherever it's actually needed (trade
// quoting in TradePanel, portfolio's sell-value estimate — see
// packages/web/lib/chainReads.ts), since that's real money-moving state that
// has to be exact and live, not indexed. `upSupply`/`downSupply` here exist
// specifically so *browsing* (the home page grid, admin's markets table)
// doesn't need a live RPC read per asset just to show the implied
// probability — see the note on `market.upSupply` below for why indexing
// them introduces no approximation despite not replaying the contract's own
// genesis-seeding math.

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
    // Set to exact equal placeholders (1n/1n) at creation and then updated to
    // the exact bigint from SharesBought/SharesSold's newUpSupply/
    // newDownSupply on every trade — never independently computed. This is
    // exact, not approximate, despite not replaying `PythagoreanMath.
    // seedGenesis`'s integer-sqrt math for the true genesis value: the
    // display-only "chance Up" formula (upSupply² / (upSupply² +
    // downSupply²), see lib/format.ts's upProbabilityFromSupplies) is 50/50
    // for *any* equal pair, and the contract always seeds both sides equal —
    // so 1n/1n is exactly as correct as the real genesis value for every
    // consumer of these two columns, until the first real trade overwrites
    // them with the actual on-chain figures anyway.
    upSupply: t.bigint().notNull().default(1n),
    downSupply: t.bigint().notNull().default(1n),
    // Running tally of feePaid across every trade, zeroed on FeesWithdrawn
    // (which the contract always empties in full — see MarketFactory.sol's
    // withdrawFees). Lets the admin markets table read this from the indexer
    // instead of a live getMarket call per row.
    collectedFees: t.bigint().notNull().default(0n),
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
