import { MarketFactoryAbi, MarketState } from "./abi.js";
import { account, marketFactoryAddress, publicClient, walletClient } from "./chain.js";
import { MARKET_DURATION_SECONDS, PriceSource } from "./config.js";
import { fetchPriceWad } from "./priceFeed.js";

type AssetInfo = { symbol: string; source: PriceSource; sourceId: string };

/// Each registered asset has at most one *open* market at a time —
/// `currentMarketId` always points at it. This function always settles that
/// market first (if its window has closed) before ever opening the next
/// one, so `currentMarketId` never advances past a market that still needs
/// settling — there's no other bookkeeping anywhere of "which markets still
/// need settling," so that invariant is what keeps this script stateless and
/// safe to just re-run on a timer.
async function processAsset(assetId: bigint, asset: AssetInfo, nowSeconds: bigint): Promise<void> {
  const label = asset.symbol;

  const existingId = await publicClient.readContract({
    address: marketFactoryAddress,
    abi: MarketFactoryAbi,
    functionName: "currentMarketId",
    args: [assetId],
  });

  if (existingId > 0n) {
    const market = await publicClient.readContract({
      address: marketFactoryAddress,
      abi: MarketFactoryAbi,
      functionName: "getMarket",
      args: [existingId],
    });

    if (market.state === MarketState.Trading && nowSeconds >= market.closeTime) {
      const closePrice = await fetchPriceWad(asset.source, asset.sourceId);
      console.log(`[${label}] closing window reached — settling market #${existingId} at ${closePrice}`);
      const hash = await walletClient.writeContract({
        address: marketFactoryAddress,
        abi: MarketFactoryAbi,
        functionName: "settleMarket",
        args: [existingId, closePrice],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`[${label}] settled market #${existingId} (tx ${hash})`);
    } else if (market.state === MarketState.Trading) {
      // Still within its trading window — nothing to do for this asset yet.
      return;
    }
  }

  // Either this asset has never had a market, or its current one is now
  // resolved (Finalized/Cancelled) — open the next wall-clock-aligned
  // 5-minute window, so users can predict when it resets without reading
  // the chain.
  const duration = BigInt(MARKET_DURATION_SECONDS);
  const alignedStart = (nowSeconds / duration) * duration;
  const alignedClose = alignedStart + duration;

  const startPrice = await fetchPriceWad(asset.source, asset.sourceId);
  console.log(`[${label}] opening window [${alignedStart}, ${alignedClose}) at start price ${startPrice}`);
  const hash = await walletClient.writeContract({
    address: marketFactoryAddress,
    abi: MarketFactoryAbi,
    functionName: "createMarket",
    args: [assetId, alignedStart, alignedClose, startPrice],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`[${label}] opened new market (tx ${hash})`);
}

async function main(): Promise<void> {
  const owner = await publicClient.readContract({
    address: marketFactoryAddress,
    abi: MarketFactoryAbi,
    functionName: "owner",
  });
  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(
      `CRON_PRIVATE_KEY's address ${account.address} is not the factory owner (owner is ${owner}) — ` +
        "every createMarket/settleMarket call below would revert.",
    );
  }

  // The chain's own clock is the source of truth for "has this window
  // closed?" — the contract's `closeTime` checks are evaluated against
  // `block.timestamp`, not this host's system clock, so a single
  // `getBlock()` up front keeps every comparison below consistent with what
  // `settleMarket`/`createMarket` will actually see on-chain.
  const latestBlock = await publicClient.getBlock();
  const nowSeconds = latestBlock.timestamp;

  const nextAssetId = await publicClient.readContract({
    address: marketFactoryAddress,
    abi: MarketFactoryAbi,
    functionName: "nextAssetId",
  });

  // Assets are independent — one asset's RPC hiccup, revert, or price-feed
  // outage shouldn't stop the rest from being checked in this pass.
  for (let assetId = 0n; assetId < nextAssetId; assetId++) {
    try {
      const asset = await publicClient.readContract({
        address: marketFactoryAddress,
        abi: MarketFactoryAbi,
        functionName: "getAsset",
        args: [assetId],
      });
      await processAsset(assetId, asset, nowSeconds);
    } catch (err) {
      console.error(`[assetId ${assetId}] failed:`, err);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
