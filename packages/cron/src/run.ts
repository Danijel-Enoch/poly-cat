import { MarketFactoryAbi, MarketState } from "./abi.js";
import { account, marketFactoryAddress, publicClient, walletClient } from "./chain.js";
import { MARKET_DURATION_SECONDS, PriceSource } from "./config.js";
import { fetchPriceWad } from "./priceFeed.js";
import { isAssetActive } from "./assetStatus.js";

type AssetInfo = { symbol: string; source: PriceSource; sourceId: string };
type MarketInfo = {
  assetId: bigint;
  startTime: bigint;
  closeTime: bigint;
  startPriceWad: bigint;
  closePriceWad: bigint;
  reserve: bigint;
  upSupply: bigint;
  downSupply: bigint;
  genesisSupply: bigint;
  collectedFees: bigint;
  state: number;
  outcome: boolean;
};

/// Each registered asset has at most one *open* market at a time —
/// `currentMarketId` always points at it. This function always settles that
/// market first (if its window has closed) before ever opening the next
/// one, so `currentMarketId` never advances past a market that still needs
/// settling — there's no other bookkeeping anywhere of "which markets still
/// need settling," so that invariant is what keeps this script stateless and
/// safe to just re-run on a timer.
///
/// Takes its reads pre-fetched (see main()'s bulk-fetch phase) rather than
/// reading them itself — every asset's `getAsset`/`currentMarketId`/
/// `getMarket` state is independent of every other asset's, and independent
/// of any write this function performs, so fetching all of it up front
/// before any asset is processed is always safe, and lets those reads
/// collapse into one Multicall3 batch (see chain.ts's MULTICALL3_ADDRESS)
/// instead of firing individually per asset.
async function processAsset(
  assetId: bigint,
  asset: AssetInfo,
  existingId: bigint,
  existingMarket: MarketInfo | undefined,
  defaultInitialLiquidity: bigint,
  nowSeconds: bigint,
): Promise<void> {
  const label = asset.symbol;

  if (existingId > 0n) {
    const market = existingMarket!; // fetched in main() whenever existingId > 0n

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
  // the chain. Unless an admin has paused this asset (see assetStatus.ts) —
  // paused only blocks *new* windows from opening, it never touches a
  // market that's already Trading (that still settles above as normal).
  if (!(await isAssetActive(assetId, asset.symbol))) {
    console.log(`[${label}] paused — skipping new window`);
    return;
  }

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
    value: defaultInitialLiquidity,
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

  const assetIds = Array.from({ length: Number(nextAssetId) }, (_, i) => BigInt(i));

  // Bulk-fetch phase: every asset's registration + current-market-id, plus
  // the one value every new-market call needs, all issued concurrently so
  // they collapse into a single Multicall3 batch when MULTICALL3_ADDRESS is
  // configured (see chain.ts) instead of 2N+1 individual RPC round trips.
  const [assets, currentMarketIds, defaultInitialLiquidity] = await Promise.all([
    Promise.all(
      assetIds.map((assetId) =>
        publicClient.readContract({
          address: marketFactoryAddress,
          abi: MarketFactoryAbi,
          functionName: "getAsset",
          args: [assetId],
        }),
      ),
    ),
    Promise.all(
      assetIds.map((assetId) =>
        publicClient.readContract({
          address: marketFactoryAddress,
          abi: MarketFactoryAbi,
          functionName: "currentMarketId",
          args: [assetId],
        }),
      ),
    ),
    publicClient.readContract({
      address: marketFactoryAddress,
      abi: MarketFactoryAbi,
      functionName: "defaultInitialLiquidity",
    }),
  ]);

  // Second bulk fetch: `getMarket` for whichever assets actually have one,
  // now that currentMarketIds is known. Also independent per market, so
  // this is a second (smaller) multicall batch rather than N more
  // individual calls.
  const idsWithMarkets = currentMarketIds.filter((id) => id > 0n);
  const fetchedMarkets = await Promise.all(
    idsWithMarkets.map((marketId) =>
      publicClient.readContract({
        address: marketFactoryAddress,
        abi: MarketFactoryAbi,
        functionName: "getMarket",
        args: [marketId],
      }),
    ),
  );
  const marketsById = new Map(idsWithMarkets.map((id, i) => [id, fetchedMarkets[i]]));

  // Assets are independent — one asset's RPC hiccup, revert, or price-feed
  // outage shouldn't stop the rest from being checked in this pass. Writes
  // stay sequential and per-asset (the bulk-fetch phase above only ever
  // reads, before any asset's write can run, so nothing here is stale).
  for (let i = 0; i < assetIds.length; i++) {
    const assetId = assetIds[i];
    try {
      await processAsset(
        assetId,
        assets[i],
        currentMarketIds[i],
        marketsById.get(currentMarketIds[i]),
        defaultInitialLiquidity,
        nowSeconds,
      );
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
