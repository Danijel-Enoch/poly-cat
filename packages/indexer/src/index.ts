import { ponder } from "ponder:registry";
import { asset, market, position, protocolStat, trade } from "ponder:schema";

// The singleton row's fixed primary key — see ponder.schema.ts's protocolStat.
const PROTOCOL_STAT_ID = "protocol";

// Mirrors MarketFactory.sol's `enum PriceSource { Gate, DexScreener }` order —
// ABI-decoded as a plain uint8, same convention packages/web/lib/chainReads.ts
// uses for its own SOURCE_NAMES table.
const SOURCE_NAMES = ["gate", "dexscreener"] as const;

function positionId(marketId: bigint, holder: `0x${string}`) {
  return `${marketId}-${holder.toLowerCase()}`;
}

ponder.on("MarketFactory:AssetRegistered", async ({ event, context }) => {
  await context.db.insert(asset).values({
    id: event.args.assetId,
    symbol: event.args.symbol,
    source: SOURCE_NAMES[event.args.source] ?? "gate",
    sourceId: event.args.sourceId,
    registeredBlock: event.block.number,
    registeredAt: event.block.timestamp,
  });
});

ponder.on("MarketFactory:MarketCreated", async ({ event, context }) => {
  await context.db.insert(market).values({
    id: event.args.marketId,
    assetId: event.args.assetId,
    startTime: event.args.startTime,
    closeTime: event.args.closeTime,
    startPriceWad: event.args.startPriceWad,
    initialLiquidity: event.args.initialLiquidity,
    state: "Trading",
    createdBlock: event.block.number,
    createdAt: event.block.timestamp,
  });
});

ponder.on("MarketFactory:SharesBought", async ({ event, context }) => {
  const { marketId, buyer, isUp, collateralIn, sharesOut, feePaid, newUpSupply, newDownSupply } = event.args;

  await context.db.update(market, { id: marketId }).set((row) => ({
    volume: row.volume + collateralIn,
    tradeCount: row.tradeCount + 1,
    upSupply: newUpSupply,
    downSupply: newDownSupply,
    collectedFees: row.collectedFees + feePaid,
  }));

  await context.db
    .insert(protocolStat)
    .values({
      id: PROTOCOL_STAT_ID,
      totalVolume: collateralIn,
      totalFees: feePaid,
      totalTrades: 1,
      lastTradeAt: event.block.timestamp,
      lastTradeBlock: event.block.number,
    })
    .onConflictDoUpdate((row) => ({
      totalVolume: row.totalVolume + collateralIn,
      totalFees: row.totalFees + feePaid,
      totalTrades: row.totalTrades + 1,
      lastTradeAt: event.block.timestamp,
      lastTradeBlock: event.block.number,
    }));

  await context.db.insert(trade).values({
    id: event.id,
    marketId,
    trader: buyer,
    side: "buy",
    isUp,
    collateralAmount: collateralIn,
    sharesAmount: sharesOut,
    feePaid,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
    txHash: event.transaction.hash,
  });

  await context.db
    .insert(position)
    .values({
      id: positionId(marketId, buyer),
      marketId,
      holder: buyer,
      upBalance: isUp ? sharesOut : 0n,
      downBalance: isUp ? 0n : sharesOut,
      updatedAt: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      upBalance: isUp ? row.upBalance + sharesOut : row.upBalance,
      downBalance: isUp ? row.downBalance : row.downBalance + sharesOut,
      updatedAt: event.block.timestamp,
    }));
});

ponder.on("MarketFactory:SharesSold", async ({ event, context }) => {
  const { marketId, seller, isUp, sharesIn, collateralOut, feePaid, newUpSupply, newDownSupply } = event.args;

  await context.db.update(market, { id: marketId }).set((row) => ({
    volume: row.volume + collateralOut,
    tradeCount: row.tradeCount + 1,
    upSupply: newUpSupply,
    downSupply: newDownSupply,
    collectedFees: row.collectedFees + feePaid,
  }));

  await context.db
    .insert(protocolStat)
    .values({
      id: PROTOCOL_STAT_ID,
      totalVolume: collateralOut,
      totalFees: feePaid,
      totalTrades: 1,
      lastTradeAt: event.block.timestamp,
      lastTradeBlock: event.block.number,
    })
    .onConflictDoUpdate((row) => ({
      totalVolume: row.totalVolume + collateralOut,
      totalFees: row.totalFees + feePaid,
      totalTrades: row.totalTrades + 1,
      lastTradeAt: event.block.timestamp,
      lastTradeBlock: event.block.number,
    }));

  await context.db.insert(trade).values({
    id: event.id,
    marketId,
    trader: seller,
    side: "sell",
    isUp,
    collateralAmount: collateralOut,
    sharesAmount: sharesIn,
    feePaid,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
    txHash: event.transaction.hash,
  });

  // A sell always follows an earlier buy for the same holder/market/side (the
  // contract reverts on InsufficientShareBalance otherwise), so the position
  // row is guaranteed to already exist here.
  await context.db.update(position, { id: positionId(marketId, seller) }).set((row) => ({
    upBalance: isUp ? row.upBalance - sharesIn : row.upBalance,
    downBalance: isUp ? row.downBalance : row.downBalance - sharesIn,
    updatedAt: event.block.timestamp,
  }));
});

ponder.on("MarketFactory:MarketSettled", async ({ event, context }) => {
  await context.db.update(market, { id: event.args.marketId }).set({
    state: "Finalized",
    outcome: event.args.outcome,
    closePriceWad: event.args.closePriceWad,
    settledBlock: event.block.number,
    settledAt: event.block.timestamp,
  });
});

ponder.on("MarketFactory:MarketPushed", async ({ event, context }) => {
  await context.db.update(market, { id: event.args.marketId }).set({
    state: "Cancelled",
    cancelReason: "push",
    closePriceWad: event.args.closePriceWad,
    settledBlock: event.block.number,
    settledAt: event.block.timestamp,
  });
});

ponder.on("MarketFactory:MarketCancelled", async ({ event, context }) => {
  await context.db.update(market, { id: event.args.marketId }).set({
    state: "Cancelled",
    cancelReason: "manual",
    settledBlock: event.block.number,
    settledAt: event.block.timestamp,
  });
});

ponder.on("MarketFactory:CloseTimeExtended", async ({ event, context }) => {
  await context.db.update(market, { id: event.args.marketId }).set({ closeTime: event.args.newCloseTime });
});

ponder.on("MarketFactory:Redeemed", async ({ event, context }) => {
  await context.db.update(position, { id: positionId(event.args.marketId, event.args.redeemer) }).set({
    upBalance: 0n,
    downBalance: 0n,
    claimed: true,
    claimedSide: "redeem",
    claimedAmount: event.args.payout,
    claimedAt: event.block.timestamp,
    updatedAt: event.block.timestamp,
  });
});

ponder.on("MarketFactory:RefundClaimed", async ({ event, context }) => {
  await context.db.update(position, { id: positionId(event.args.marketId, event.args.claimant) }).set({
    upBalance: 0n,
    downBalance: 0n,
    claimed: true,
    claimedSide: "refund",
    claimedAmount: event.args.payout,
    claimedAt: event.block.timestamp,
    updatedAt: event.block.timestamp,
  });
});

ponder.on("MarketFactory:FeesWithdrawn", async ({ event, context }) => {
  // withdrawFees always empties the full balance (see MarketFactory.sol),
  // so this is always a reset to zero rather than a partial decrement.
  await context.db.update(market, { id: event.args.marketId }).set({ collectedFees: 0n });
});
