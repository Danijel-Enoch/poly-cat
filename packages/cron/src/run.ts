import { MarketFactoryAbi, MarketState } from "./abi.js";
import { account, marketFactoryAddress, publicClient, walletClient } from "./chain.js";
import { MARKET_DURATION_SECONDS, MAX_ASSETS_PER_BATCH, PriceSource } from "./config.js";
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

// The two on-chain writes this pass might make for a single asset: settle its
// just-closed window and/or open its next one. Collected across every asset
// first (see main()), then submitted together in one `batchProcess` tx rather
// than one tx apiece — see AssetPlan below.
type PlannedSettlement = { marketId: bigint; closePriceWad: bigint };
type PlannedCreation = { assetId: bigint; startTime: bigint; closeTime: bigint; startPriceWad: bigint };
type AssetPlan = { label: string; settlement?: PlannedSettlement; creation?: PlannedCreation };

/// Each registered asset has at most one *open* market at a time —
/// `currentMarketId` always points at it. This function always settles that
/// market first (if its window has closed) before ever opening the next
/// one, so `currentMarketId` never advances past a market that still needs
/// settling — there's no other bookkeeping anywhere of "which markets still
/// need settling," so that invariant is what keeps this script stateless and
/// safe to just re-run on a timer.
///
/// Rather than *send* those writes, this only *plans* them: it returns the
/// settle/create it wants for this asset (fetching the needed price(s) along
/// the way), and main() batches every asset's plan into a single
/// `batchProcess` transaction — settling a just-closed window and opening the
/// next one still happen in that order, since `batchProcess` runs all
/// settlements before all creations (see MarketFactory.batchProcess).
///
/// Takes its reads pre-fetched (see main()'s bulk-fetch phase) rather than
/// reading them itself — every asset's `getAsset`/`currentMarketId`/
/// `getMarket` state is independent of every other asset's, and independent
/// of any write this script performs, so fetching all of it up front
/// before any asset is processed is always safe, and lets those reads
/// collapse into one Multicall3 batch (see chain.ts's MULTICALL3_ADDRESS)
/// instead of firing individually per asset.
async function planAsset(
  assetId: bigint,
  asset: AssetInfo,
  existingId: bigint,
  existingMarket: MarketInfo | undefined,
  nowSeconds: bigint,
): Promise<AssetPlan | null> {
  const label = asset.symbol;
  let settlement: PlannedSettlement | undefined;

  if (existingId > 0n) {
    const market = existingMarket!; // fetched in main() whenever existingId > 0n

    if (market.state === MarketState.Trading && nowSeconds >= market.closeTime) {
      const closePrice = await fetchPriceWad(asset.source, asset.sourceId);
      console.log(`[${label}] closing window reached — will settle market #${existingId} at ${closePrice}`);
      settlement = { marketId: existingId, closePriceWad: closePrice };
    } else if (market.state === MarketState.Trading) {
      // Still within its trading window — nothing to do for this asset yet.
      return null;
    }
  }

  // Either this asset has never had a market, or its current one is now
  // resolved (Finalized/Cancelled) or is being settled above — open the next
  // wall-clock-aligned 5-minute window, so users can predict when it resets
  // without reading the chain. Unless an admin has paused this asset (see
  // assetStatus.ts) — paused only blocks *new* windows from opening, it never
  // touches a market that's already Trading (that still settles above as
  // normal, so a pending settlement is still returned).
  if (!(await isAssetActive(assetId, asset.symbol))) {
    console.log(`[${label}] paused — skipping new window`);
    return settlement ? { label, settlement } : null;
  }

  const duration = BigInt(MARKET_DURATION_SECONDS);
  const alignedStart = (nowSeconds / duration) * duration;
  const alignedClose = alignedStart + duration;

  const startPrice = await fetchPriceWad(asset.source, asset.sourceId);
  console.log(`[${label}] opening window [${alignedStart}, ${alignedClose}) at start price ${startPrice}`);
  const creation: PlannedCreation = {
    assetId,
    startTime: alignedStart,
    closeTime: alignedClose,
    startPriceWad: startPrice,
  };
  return { label, settlement, creation };
}

/// Fallback path when the single `batchProcess` tx reverts: replay the same
/// plans as individual `settleMarket`/`createMarket` transactions, each in its
/// own try/catch. `batchProcess` is all-or-nothing, so one asset with a stale
/// read or a timing race would sink the whole pass; splitting back out here
/// isolates the bad asset so the rest still go through — the resilience the
/// per-asset loop used to have unconditionally, now only paid for on the rare
/// failing pass. Settlement runs before creation per asset, same order
/// `batchProcess` uses.
async function runIndividually(plans: AssetPlan[], defaultInitialLiquidity: bigint): Promise<void> {
  for (const plan of plans) {
    try {
      if (plan.settlement) {
        const hash = await walletClient.writeContract({
          address: marketFactoryAddress,
          abi: MarketFactoryAbi,
          functionName: "settleMarket",
          args: [plan.settlement.marketId, plan.settlement.closePriceWad],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        console.log(`[${plan.label}] settled market #${plan.settlement.marketId} (tx ${hash})`);
      }
      if (plan.creation) {
        const c = plan.creation;
        const hash = await walletClient.writeContract({
          address: marketFactoryAddress,
          abi: MarketFactoryAbi,
          functionName: "createMarket",
          args: [c.assetId, c.startTime, c.closeTime, c.startPriceWad],
          value: defaultInitialLiquidity,
        });
        await publicClient.waitForTransactionReceipt({ hash });
        console.log(`[${plan.label}] opened new market (tx ${hash})`);
      }
    } catch (err) {
      console.error(`[${plan.label}] individual call failed:`, err);
    }
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/// Submit one chunk of plans as a single `batchProcess` tx — every settlement
/// then every creation — falling back to per-asset calls if it reverts.
/// Callers keep each chunk under MAX_ASSETS_PER_BATCH so a chunk can't exceed
/// the block gas limit.
async function submitBatch(plans: AssetPlan[], defaultInitialLiquidity: bigint): Promise<void> {
  const settlements = plans.filter((p) => p.settlement).map((p) => p.settlement!);
  const creations = plans.filter((p) => p.creation).map((p) => p.creation!);
  if (settlements.length === 0 && creations.length === 0) return;

  // `batchProcess` runs every settlement before every creation, and requires
  // exactly `creations.length * defaultInitialLiquidity` in value.
  const value = defaultInitialLiquidity * BigInt(creations.length);
  try {
    console.log(`Submitting batch: ${settlements.length} settlement(s), ${creations.length} creation(s)`);
    const hash = await walletClient.writeContract({
      address: marketFactoryAddress,
      abi: MarketFactoryAbi,
      functionName: "batchProcess",
      args: [settlements, creations],
      value,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Batch processed in one tx (${hash})`);
  } catch (err) {
    console.error("Batch tx failed — falling back to per-asset calls so one bad asset can't sink the batch:", err);
    await runIndividually(plans, defaultInitialLiquidity);
  }
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
        "every batchProcess/createMarket/settleMarket call below would revert.",
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
  // outage shouldn't stop the rest from being planned in this pass. Planning
  // only reads (prices) and never writes, so nothing here is stale relative
  // to the single batched write that follows.
  const plans: AssetPlan[] = [];
  for (let i = 0; i < assetIds.length; i++) {
    const assetId = assetIds[i];
    try {
      const plan = await planAsset(
        assetId,
        assets[i],
        currentMarketIds[i],
        marketsById.get(currentMarketIds[i]),
        nowSeconds,
      );
      if (plan && (plan.settlement || plan.creation)) plans.push(plan);
    } catch (err) {
      console.error(`[assetId ${assetId}] planning failed:`, err);
    }
  }

  if (plans.length === 0) {
    console.log("Nothing to settle or open this pass.");
    return;
  }

  // One tx per chunk instead of one per settle and one per create: pays the
  // ~21k base gas + one signature + one RPC round-trip once per (up to)
  // MAX_ASSETS_PER_BATCH assets. Chunking keeps any single tx under the block
  // gas limit — without it a large enough pass would revert and drop back to
  // the per-asset path, losing the whole saving (see submitBatch's fallback).
  const chunks = chunk(plans, MAX_ASSETS_PER_BATCH);
  if (chunks.length > 1) {
    console.log(`${plans.length} assets to process → ${chunks.length} batches of up to ${MAX_ASSETS_PER_BATCH}`);
  }
  for (const group of chunks) {
    await submitBatch(group, defaultInitialLiquidity);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
