import { DEXSCREENER_CHAIN_ID, PriceSource } from "./config.js";

const GATE_TICKER_URL = "http://127.0.0.1:8899/api/v4/spot/tickers";
const DEXSCREENER_PAIRS_URL = "http://127.0.0.1:8899/latest/dex/pairs";

/** Converts a decimal price string (e.g. "67432.15000000") to a WAD (1e18)
 * fixed-point bigint, matching `startPriceWad`/`closePriceWad` on-chain.
 * Parses the string directly instead of going through a float, since a
 * float can't represent most decimal prices exactly and this value gets
 * compared for strict equality on-chain (the tie/push case) — this matters
 * even more for memecoin prices, which routinely have 6+ significant
 * decimal digits (e.g. "0.009771"). */
export function decimalStringToWad(price: string): bigint {
  const [whole, frac = ""] = price.split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole || "0") * 10n ** 18n + BigInt(fracPadded || "0");
}

/** Fetches a "blue chip" (centralized-exchange-listed) asset's spot price
 * from Gate.com's public REST API — no API key required. `currencyPair` is
 * whatever's stored in the asset's on-chain `sourceId`, e.g. "BTC_USDT". */
export async function fetchGatePrice(currencyPair: string): Promise<bigint> {
  const res = await fetch(`${GATE_TICKER_URL}?currency_pair=${currencyPair}`);
  if (!res.ok) {
    throw new Error(`Gate ticker request for ${currencyPair} failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { currency_pair: string; last: string }[];
  const ticker = data[0];
  if (!ticker) throw new Error(`Gate ticker request for ${currencyPair} returned no data`);
  return decimalStringToWad(ticker.last);
}

/** Fetches an on-chain pair's price from DexScreener's public REST API — no
 * API key required. `pairAddress` is whatever's stored in the asset's
 * on-chain `sourceId`. Scoped to Robinhood Chain (`DEXSCREENER_CHAIN_ID`),
 * since that's the only chain this protocol trusts a DexScreener-sourced
 * asset to actually live on. */
export async function fetchDexScreenerPrice(pairAddress: string): Promise<bigint> {
  const res = await fetch(`${DEXSCREENER_PAIRS_URL}/${DEXSCREENER_CHAIN_ID}/${pairAddress}`);
  if (!res.ok) {
    throw new Error(`DexScreener pair request for ${pairAddress} failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { pair?: { priceUsd: string } | null; pairs?: { priceUsd: string }[] | null };
  const priceUsd = data.pair?.priceUsd ?? data.pairs?.[0]?.priceUsd;
  if (!priceUsd) throw new Error(`DexScreener pair request for ${pairAddress} returned no price`);
  return decimalStringToWad(priceUsd);
}

/** Single entry point `run.ts` calls — dispatches to whichever API an
 * asset's registered `source` points at, so callers never need to branch on
 * it themselves. */
export async function fetchPriceWad(source: PriceSource, sourceId: string): Promise<bigint> {
  return source === PriceSource.Gate ? fetchGatePrice(sourceId) : fetchDexScreenerPrice(sourceId);
}
