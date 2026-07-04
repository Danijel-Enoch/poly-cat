import { createPublicClient, http, parseEther } from "viem";
import { activeChain } from "./chains";
import { marketFactoryContract, usdcContract, USDC_ADDRESS } from "./contracts";
import { parseUsdc } from "./format";
import { parseMetadataURI, type Category } from "./category";
import { getMarkets } from "./ponder";
import { fetchTrendingPolymarketMarkets } from "./polymarket";
import { filterLikelyDuplicates } from "./marketDedupe";
import { selectMajorMarkets } from "./openrouter";
import { pinImageFromUrl } from "./pinata";

// Shared by app/api/admin/import-polymarket-markets (browser-triggered, admin
// signs the resulting createMarket txs client-side) and
// scripts/import-polymarket-markets.ts (CLI, signs with its own PRIVATE_KEY) —
// see lib/chains.ts for why this reads via a plain viem publicClient rather
// than wagmi hooks (both callers run outside React).
const publicClient = createPublicClient({ chain: activeChain, transport: http() });

// Hard ceiling on how many markets a single import run can propose, regardless
// of how large the admin's balance is or what count they type in — keeps one
// run from accidentally triggering dozens of on-chain transactions.
export const MAX_IMPORT_BATCH = 25;
export const DEFAULT_MARKET_LIQUIDITY_USDC = "10";
// On top of the contract's own MIN_TRADING_DURATION floor, so a market whose
// Polymarket endDate is only just past that floor doesn't get rejected by the
// time the admin actually signs the transaction a few seconds later.
const MIN_TRADING_DURATION_BUFFER_SECONDS = 2 * 60 * 60;
const FALLBACK_CLOSE_TIME_SECONDS = 7 * 24 * 60 * 60;
const LOW_ETH_RESERVE = parseEther("0.01");

export function computeMaxAffordable(usdcBalance: bigint, liquidityPerMarket: bigint): number {
  if (liquidityPerMarket <= 0n) return 0;
  const affordable = usdcBalance / liquidityPerMarket;
  const capped = affordable > BigInt(MAX_IMPORT_BATCH) ? BigInt(MAX_IMPORT_BATCH) : affordable;
  return Number(capped);
}

export function computeEffectiveCount(requestedCount: number | null, maxAffordable: number): number {
  if (requestedCount == null) return maxAffordable;
  return Math.max(0, Math.min(Math.floor(requestedCount), maxAffordable));
}

export function clampCloseTime(endDateIso: string | null, nowSeconds: number, minTradingDuration: bigint): number {
  const floor = nowSeconds + Number(minTradingDuration) + MIN_TRADING_DURATION_BUFFER_SECONDS;
  const fallback = nowSeconds + FALLBACK_CLOSE_TIME_SECONDS;
  if (!endDateIso) return Math.max(floor, fallback);
  const parsed = Math.floor(new Date(endDateIso).getTime() / 1000);
  if (!Number.isFinite(parsed) || parsed < floor) return Math.max(floor, fallback);
  return parsed;
}

export type ImportCandidate = {
  question: string;
  category: Category;
  closeTimeSeconds: number;
  polymarketId: string;
  sourceUrl: string;
  imageCid: string | null;
};

export type ImportPlan = {
  candidates: ImportCandidate[];
  maxAffordable: number;
  liquidityPerMarket: bigint;
  collateralToken: `0x${string}`;
  usdcBalance: bigint;
  ethBalance: bigint;
  lowEthWarning: boolean;
};

/** Fetches Polymarket's trending markets, has an LLM pick the "major" ones not
 * already on HoodMarkets, and works out how many the given wallet can afford
 * to seed. Returns a proposal only — nothing here signs or sends a
 * transaction; see app/api/admin/import-polymarket-markets/route.ts (browser
 * flow) and scripts/import-polymarket-markets.ts (CLI flow) for the two
 * callers that actually submit the resulting candidates on-chain. */
export async function buildImportPlan(adminAddress: `0x${string}`, requestedCount: number | null): Promise<ImportPlan> {
  const [usdcBalance, ethBalance, minInitialLiquidity, minTradingDuration] = await Promise.all([
    publicClient.readContract({ ...usdcContract, functionName: "balanceOf", args: [adminAddress] }),
    publicClient.getBalance({ address: adminAddress }),
    publicClient.readContract({ ...marketFactoryContract, functionName: "minInitialLiquidity" }),
    publicClient.readContract({ ...marketFactoryContract, functionName: "MIN_TRADING_DURATION" }),
  ]);

  const configuredLiquidity = parseUsdc(process.env.IMPORT_MARKET_LIQUIDITY_USDC ?? DEFAULT_MARKET_LIQUIDITY_USDC);
  const liquidityPerMarket = configuredLiquidity > minInitialLiquidity ? configuredLiquidity : minInitialLiquidity;

  const maxAffordable = computeMaxAffordable(usdcBalance, liquidityPerMarket);
  const effectiveCount = computeEffectiveCount(requestedCount, maxAffordable);

  const basePlan = {
    maxAffordable,
    liquidityPerMarket,
    collateralToken: USDC_ADDRESS,
    usdcBalance,
    ethBalance,
    lowEthWarning: ethBalance < LOW_ETH_RESERVE,
  };

  if (effectiveCount <= 0) return { ...basePlan, candidates: [] };

  const existingMarkets = await getMarkets();
  const existingTitles = existingMarkets.map((m) => parseMetadataURI(m.metadataURI).title).filter(Boolean);

  const polymarketFetchCount = Math.max(effectiveCount * 3, 20);
  const polymarketCandidates = await fetchTrendingPolymarketMarkets(polymarketFetchCount);
  const filtered = filterLikelyDuplicates(polymarketCandidates, existingTitles);

  const selected = await selectMajorMarkets({ candidates: filtered, existingTitles, count: effectiveCount });

  const nowSeconds = Math.floor(Date.now() / 1000);
  const candidates: ImportCandidate[] = await Promise.all(
    selected.map(async (s) => ({
      question: s.question,
      category: s.category,
      polymarketId: s.polymarketId,
      sourceUrl: s.sourceUrl,
      closeTimeSeconds: clampCloseTime(s.endDate, nowSeconds, minTradingDuration),
      imageCid: s.imageUrl ? await pinImageFromUrl(s.imageUrl) : null,
    })),
  );

  return { ...basePlan, candidates };
}
