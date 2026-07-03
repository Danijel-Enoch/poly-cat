import { onchainTable } from "ponder";

export const market = onchainTable("market", (t) => ({
  id: t.bigint().primaryKey(), // marketId
  creator: t.hex().notNull(),
  collateralToken: t.hex().notNull(),
  questionHash: t.hex().notNull(),
  metadataURI: t.text().notNull(),
  closeTime: t.bigint().notNull(),
  createdAt: t.bigint().notNull(),
  state: t.text().notNull(), // "Trading" | "Finalized" | "Cancelled"
  outcome: t.boolean(), // null until finalized
  yesSupply: t.bigint().notNull(), // virtual Pythagorean-curve supply, not a real token
  noSupply: t.bigint().notNull(),
  volume: t.bigint().notNull(), // cumulative gross collateral traded (buys + sells)
  settledAt: t.bigint(), // null until finalized; block timestamp of the MarketSettled event
}));

export const trade = onchainTable("trade", (t) => ({
  id: t.text().primaryKey(), // `${txHash}-${logIndex}`
  marketId: t.bigint().notNull(),
  trader: t.hex().notNull(),
  isYes: t.boolean().notNull(),
  side: t.text().notNull(), // "buy" | "sell"
  collateralAmount: t.bigint().notNull(), // collateral in (buy) or out (sell)
  sharesAmount: t.bigint().notNull(), // shares out (buy) or in (sell)
  feePaid: t.bigint().notNull(),
  yesSupplyAfter: t.bigint().notNull(), // pool supplies immediately after this trade — lets a price chart be reconstructed without replaying every event client-side
  noSupplyAfter: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
  txHash: t.hex().notNull(),
}));

export const position = onchainTable("position", (t) => ({
  id: t.text().primaryKey(), // `${marketId}-${holder}`
  marketId: t.bigint().notNull(),
  holder: t.hex().notNull(),
  yesBalance: t.bigint().notNull(),
  noBalance: t.bigint().notNull(),
}));

export const redemption = onchainTable("redemption", (t) => ({
  id: t.text().primaryKey(), // `${txHash}-${logIndex}`
  marketId: t.bigint().notNull(),
  redeemer: t.hex().notNull(),
  payout: t.bigint().notNull(),
  outcome: t.boolean().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const refund = onchainTable("refund", (t) => ({
  id: t.text().primaryKey(), // `${txHash}-${logIndex}`
  marketId: t.bigint().notNull(),
  claimant: t.hex().notNull(),
  payout: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}));
