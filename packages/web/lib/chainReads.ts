import { createPublicClient, http } from "viem";
import { activeChain } from "./chains";
import { MARKET_FACTORY_ADDRESS } from "./contracts";
import { MarketFactoryAbi } from "./abis/MarketFactoryAbi";

/** Direct on-chain reads — for the state that has to be exact and live
 * (trade quoting, redeeming, a specific open market's own page) rather than
 * indexed. Browsing views (the home page grid, admin's markets table, full
 * market history, "needs redeeming") read packages/indexer instead — see
 * lib/indexerApi.ts — specifically to avoid the RPC volume all of those used
 * to cost polling this file's reads every few seconds. Every function here
 * either reads current contract state directly, or (for trade history)
 * scopes a `getContractEvents` call to a single market's own short (5min)
 * lifetime, which is cheap without an indexer specifically because these
 * markets are short-lived rather than an unbounded, ever-growing set.
 *
 * `batch: { multicall: true }` below folds every `readContract` call issued
 * within the same tick (e.g. a `Promise.all` loop over N markets in
 * getUserPositions) into one `eth_call` against Robinhood Chain's deployed
 * Multicall3 contract, instead of N individual RPC requests — this is what
 * actually relieves pressure on the public RPC endpoint's rate limit, unlike
 * the transport's own `batch: true` (still just HTTP-level JSON-RPC batching,
 * which most providers still rate-limit per underlying call). Only safe
 * because `robinhoodChain` in lib/chains.ts registers a real Multicall3
 * address; a fresh local Anvil instance has no Multicall3 deployed by
 * default, so this only turns on when `activeChain` actually has one
 * configured — otherwise every call would fail trying to batch against a
 * contract that doesn't exist. */
const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(activeChain.rpcUrls.default.http[0], { batch: true }),
  batch: { multicall: !!activeChain.contracts?.multicall3 },
});

export type PriceSourceName = "gate" | "dexscreener";
export type MarketStateName = "Trading" | "Finalized" | "Cancelled";

// Order matters — must match MarketFactory.sol's `enum PriceSource`/`enum
// MarketState` exactly, since these are ABI-encoded as a plain uint8 index.
const SOURCE_NAMES: readonly PriceSourceName[] = ["gate", "dexscreener"];
const STATE_NAMES: readonly MarketStateName[] = ["Trading", "Finalized", "Cancelled"];

/// Every market is a fixed 5-minute window — see the project's decision to
/// drop the 30m/1h timeframes entirely. Kept as a named export rather than a
/// magic number wherever a duration is needed client-side (e.g. the price
/// chart's default lookback).
export const MARKET_DURATION_SECONDS = 5 * 60;

export type Asset = {
  id: bigint;
  symbol: string;
  source: PriceSourceName;
  sourceId: string;
};

export type MarketRow = {
  id: bigint;
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
  state: MarketStateName;
  outcome: boolean;
};

type RawMarket = {
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

type RawAsset = { symbol: string; source: number; sourceId: string };

function toMarketRow(id: bigint, raw: RawMarket): MarketRow {
  return {
    id,
    assetId: raw.assetId,
    startTime: raw.startTime,
    closeTime: raw.closeTime,
    startPriceWad: raw.startPriceWad,
    closePriceWad: raw.closePriceWad,
    reserve: raw.reserve,
    upSupply: raw.upSupply,
    downSupply: raw.downSupply,
    genesisSupply: raw.genesisSupply,
    collectedFees: raw.collectedFees,
    state: STATE_NAMES[raw.state],
    outcome: raw.outcome,
  };
}

function toAsset(id: bigint, raw: RawAsset): Asset {
  return { id, symbol: raw.symbol, source: SOURCE_NAMES[raw.source], sourceId: raw.sourceId };
}

async function readNextAssetId(): Promise<bigint> {
  return publicClient.readContract({
    address: MARKET_FACTORY_ADDRESS,
    abi: MarketFactoryAbi,
    functionName: "nextAssetId",
  });
}

async function readAsset(id: bigint): Promise<RawAsset> {
  return publicClient.readContract({
    address: MARKET_FACTORY_ADDRESS,
    abi: MarketFactoryAbi,
    functionName: "getAsset",
    args: [id],
  }) as unknown as Promise<RawAsset>;
}

async function readNextMarketId(): Promise<bigint> {
  return publicClient.readContract({
    address: MARKET_FACTORY_ADDRESS,
    abi: MarketFactoryAbi,
    functionName: "nextMarketId",
  });
}

async function readMarket(id: bigint): Promise<RawMarket> {
  return publicClient.readContract({
    address: MARKET_FACTORY_ADDRESS,
    abi: MarketFactoryAbi,
    functionName: "getMarket",
    args: [id],
  }) as unknown as Promise<RawMarket>;
}

/** Every registered asset, in registration order (id 0 first). There's no
 * hardcoded asset list anymore — this is the owner-curated registry
 * `registerAsset` writes to (see the admin dashboard's "Add market" panel). */
export async function getAssets(): Promise<Asset[]> {
  const nextId = await readNextAssetId();
  const ids = Array.from({ length: Number(nextId) }, (_, i) => BigInt(i));
  const raws = await Promise.all(ids.map((id) => readAsset(id)));
  return ids.map((id, i) => toAsset(id, raws[i]));
}

export async function getAsset(assetId: bigint): Promise<Asset> {
  return toAsset(assetId, await readAsset(assetId));
}

/** A single market by id, or `null` if `id` was never created (0, or `>=
 * nextMarketId` — the mapping default for an unset id is a zeroed struct,
 * not a revert, so this is the only reliable "does it exist" check). */
export async function getMarket(id: bigint): Promise<MarketRow | null> {
  if (id <= 0n) return null;
  const nextId = await readNextMarketId();
  if (id >= nextId) return null;
  const raw = await readMarket(id);
  return toMarketRow(id, raw);
}

export type TradeRow = {
  side: "buy" | "sell";
  isUp: boolean;
  trader: `0x${string}`;
  collateralAmount: bigint;
  sharesAmount: bigint;
  feePaid: bigint;
  upSupplyAfter: bigint;
  downSupplyAfter: bigint;
  blockNumber: bigint;
  logIndex: number;
  txHash: `0x${string}`;
};

/** A block's timestamp never changes, so once the search below actually
 * resolves an answer for a given `targetTimestamp` (a market's `startTime`),
 * that answer is valid forever — cached here so `getTradeHistory`'s 10-second
 * refetch (see TradeHistoryTable) only re-runs the `getContractEvents` calls,
 * not the ~log2(block height) `getBlock` point lookups too. `getBlock` isn't
 * an `eth_call`, so unlike the rest of this file it can't be folded into a
 * multicall batch — this cache is what actually keeps it cheap on repeat. */
const blockAtOrAfterCache = new Map<string, bigint>();

/** Binary-searches for the first block at or after `targetTimestamp`, so
 * `getTradeHistory` can scope its event query to a market's own short
 * lifetime instead of scanning from genesis — a handful of `eth_getBlockBy
 * Number` point lookups (~O(log blocks)), not a range scan, so it stays
 * cheap regardless of how long the chain has been running. */
async function findBlockAtOrAfter(targetTimestamp: bigint): Promise<bigint> {
  const cacheKey = targetTimestamp.toString();
  const cached = blockAtOrAfterCache.get(cacheKey);
  if (cached !== undefined) return cached;

  let lo = 0n;
  let hi = await publicClient.getBlockNumber();
  const latest = await publicClient.getBlock({ blockNumber: hi });
  // Target is beyond the chain's current head (e.g. a market that just this
  // moment opened) — there's no stable answer yet, so don't cache it.
  if (latest.timestamp < targetTimestamp) return hi;

  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    const block = await publicClient.getBlock({ blockNumber: mid });
    if (block.timestamp < targetTimestamp) {
      lo = mid + 1n;
    } else {
      hi = mid;
    }
  }
  blockAtOrAfterCache.set(cacheKey, lo);
  return lo;
}

/** Every buy/sell for one market, oldest first. `startTime` (from that
 * market's `getMarket` row) bounds the search so it never has to scan
 * further back than the market has existed. */
export async function getTradeHistory(marketId: bigint, startTime: bigint): Promise<TradeRow[]> {
  const fromBlock = await findBlockAtOrAfter(startTime);

  const [boughtLogs, soldLogs] = await Promise.all([
    publicClient.getContractEvents({
      address: MARKET_FACTORY_ADDRESS,
      abi: MarketFactoryAbi,
      eventName: "SharesBought",
      args: { marketId },
      fromBlock,
      toBlock: "latest",
    }),
    publicClient.getContractEvents({
      address: MARKET_FACTORY_ADDRESS,
      abi: MarketFactoryAbi,
      eventName: "SharesSold",
      args: { marketId },
      fromBlock,
      toBlock: "latest",
    }),
  ]);

  const rows: TradeRow[] = [
    ...boughtLogs.map((log) => ({
      side: "buy" as const,
      isUp: log.args.isUp!,
      trader: log.args.buyer!,
      collateralAmount: log.args.collateralIn!,
      sharesAmount: log.args.sharesOut!,
      feePaid: log.args.feePaid!,
      upSupplyAfter: log.args.newUpSupply!,
      downSupplyAfter: log.args.newDownSupply!,
      blockNumber: log.blockNumber,
      logIndex: log.logIndex,
      txHash: log.transactionHash,
    })),
    ...soldLogs.map((log) => ({
      side: "sell" as const,
      isUp: log.args.isUp!,
      trader: log.args.seller!,
      collateralAmount: log.args.collateralOut!,
      sharesAmount: log.args.sharesIn!,
      feePaid: log.args.feePaid!,
      upSupplyAfter: log.args.newUpSupply!,
      downSupplyAfter: log.args.newDownSupply!,
      blockNumber: log.blockNumber,
      logIndex: log.logIndex,
      txHash: log.transactionHash,
    })),
  ];

  rows.sort((a, b) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : Number(a.blockNumber - b.blockNumber)));
  return rows;
}

export type PositionRow = {
  marketId: bigint;
  market: MarketRow;
  asset: Asset;
  upBalance: bigint;
  downBalance: bigint;
};

/** A holder's nonzero Up/Down positions across the most recent `lookback`
 * markets (default comfortably covers everything a user could plausibly
 * still hold or need to redeem — this app deliberately doesn't keep
 * full-history positions the way an indexer-backed one would). Newest first. */
export async function getUserPositions(holder: `0x${string}`, lookback = 300): Promise<PositionRow[]> {
  const nextId = await readNextMarketId();
  if (nextId <= 1n) return [];

  const oldestId = nextId - 1n > BigInt(lookback) ? nextId - 1n - BigInt(lookback) : 1n;
  const ids: bigint[] = [];
  for (let id = nextId - 1n; id >= oldestId; id--) ids.push(id);

  const [markets, upBalances, downBalances, assets] = await Promise.all([
    Promise.all(ids.map((id) => readMarket(id))),
    Promise.all(
      ids.map((id) =>
        publicClient.readContract({
          address: MARKET_FACTORY_ADDRESS,
          abi: MarketFactoryAbi,
          functionName: "shareBalanceOf",
          args: [id, true, holder],
        }),
      ),
    ),
    Promise.all(
      ids.map((id) =>
        publicClient.readContract({
          address: MARKET_FACTORY_ADDRESS,
          abi: MarketFactoryAbi,
          functionName: "shareBalanceOf",
          args: [id, false, holder],
        }),
      ),
    ),
    getAssets(),
  ]);
  const assetsById = new Map(assets.map((a) => [a.id, a]));

  const positions: PositionRow[] = [];
  for (let i = 0; i < ids.length; i++) {
    const upBalance = upBalances[i];
    const downBalance = downBalances[i];
    if (upBalance === 0n && downBalance === 0n) continue;
    const market = toMarketRow(ids[i], markets[i]);
    const asset = assetsById.get(market.assetId);
    if (!asset) continue; // shouldn't happen — every market's assetId was registered before it could be created
    positions.push({ marketId: ids[i], market, asset, upBalance, downBalance });
  }
  return positions;
}
