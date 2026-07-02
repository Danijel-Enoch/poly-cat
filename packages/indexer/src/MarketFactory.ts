import { ponder } from "ponder:registry";
import schema from "ponder:schema";

ponder.on("MarketFactory:MarketCreated", async ({ event, context }) => {
  const { marketId, creator, collateralToken, questionHash, metadataURI, closeTime, initialLiquidity } = event.args;

  await context.db.insert(schema.market).values({
    id: marketId,
    creator,
    collateralToken,
    questionHash,
    metadataURI,
    closeTime,
    createdAt: event.block.timestamp,
    state: "Trading",
    outcome: null,
    yesSupply: initialLiquidity, // genesis-seeded; SharesBought/Sold events correct this immediately on first trade
    noSupply: initialLiquidity,
    volume: 0n,
  });
});

ponder.on("MarketFactory:MarketSettled", async ({ event, context }) => {
  const { marketId, outcome } = event.args;

  await context.db.update(schema.market, { id: marketId }).set({
    state: "Finalized",
    outcome,
    settledAt: event.block.timestamp,
  });
});

ponder.on("MarketFactory:SharesBought", async ({ event, context }) => {
  const { marketId, buyer, isYes, collateralIn, sharesOut, feePaid, newYesSupply, newNoSupply } = event.args;

  await context.db.update(schema.market, { id: marketId }).set((row) => ({
    yesSupply: newYesSupply,
    noSupply: newNoSupply,
    volume: row.volume + collateralIn,
  }));

  await context.db
    .insert(schema.position)
    .values({
      id: `${marketId}-${buyer.toLowerCase()}`,
      marketId,
      holder: buyer,
      yesBalance: isYes ? sharesOut : 0n,
      noBalance: isYes ? 0n : sharesOut,
    })
    .onConflictDoUpdate((row) => ({
      yesBalance: isYes ? row.yesBalance + sharesOut : row.yesBalance,
      noBalance: isYes ? row.noBalance : row.noBalance + sharesOut,
    }));

  await context.db.insert(schema.trade).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    marketId,
    trader: buyer,
    isYes,
    side: "buy",
    collateralAmount: collateralIn,
    sharesAmount: sharesOut,
    feePaid,
    yesSupplyAfter: newYesSupply,
    noSupplyAfter: newNoSupply,
    timestamp: event.block.timestamp,
    txHash: event.transaction.hash,
  });
});

ponder.on("MarketFactory:SharesSold", async ({ event, context }) => {
  const { marketId, seller, isYes, sharesIn, collateralOut, feePaid, newYesSupply, newNoSupply } = event.args;

  await context.db.update(schema.market, { id: marketId }).set((row) => ({
    yesSupply: newYesSupply,
    noSupply: newNoSupply,
    volume: row.volume + collateralOut,
  }));

  await context.db.update(schema.position, { id: `${marketId}-${seller.toLowerCase()}` }).set((row) => ({
    yesBalance: isYes ? row.yesBalance - sharesIn : row.yesBalance,
    noBalance: isYes ? row.noBalance : row.noBalance - sharesIn,
  }));

  await context.db.insert(schema.trade).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    marketId,
    trader: seller,
    isYes,
    side: "sell",
    collateralAmount: collateralOut,
    sharesAmount: sharesIn,
    feePaid,
    yesSupplyAfter: newYesSupply,
    noSupplyAfter: newNoSupply,
    timestamp: event.block.timestamp,
    txHash: event.transaction.hash,
  });
});

ponder.on("MarketFactory:Redeemed", async ({ event, context }) => {
  const { marketId, redeemer, payout, outcome } = event.args;

  await context.db.insert(schema.redemption).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    marketId,
    redeemer,
    payout,
    outcome,
    timestamp: event.block.timestamp,
  });

  await context.db.update(schema.position, { id: `${marketId}-${redeemer.toLowerCase()}` }).set({
    yesBalance: 0n,
    noBalance: 0n,
  });
});
