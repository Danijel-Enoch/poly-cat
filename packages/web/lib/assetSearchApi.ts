export type DexScreenerResult = {
  pairAddress: string;
  symbol: string;
  name: string;
  priceUsd: string | null;
  liquidityUsd: number | null;
};

export type GateResult = {
  currencyPair: string;
  symbol: string;
  name: string;
};

/** Client for the app's own `/api/dexscreener/search` proxy — results are
 * already filtered to Robinhood Chain pairs. */
export async function searchDexScreener(query: string): Promise<DexScreenerResult[]> {
  const res = await fetch(`/api/dexscreener/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`DexScreener search failed: ${res.status}`);
  const data = (await res.json()) as { results: DexScreenerResult[] };
  return data.results;
}

/** Client for the app's own `/api/gate/pairs` proxy — results are already
 * filtered to tradable USDT pairs. */
export async function searchGatePairs(query: string): Promise<GateResult[]> {
  const res = await fetch(`/api/gate/pairs?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Gate.com pairs request failed: ${res.status}`);
  const data = (await res.json()) as { results: GateResult[] };
  return data.results;
}

/** Client for the app's own `/api/dexscreener/token-image/[pairAddress]`
 * proxy — used by <AssetIcon> for any DexScreener-sourced asset. Returns
 * `null` rather than throwing on a miss/failure so a missing icon just falls
 * back to the plain color badge instead of surfacing an error. */
export async function fetchDexScreenerTokenImage(pairAddress: string): Promise<string | null> {
  const res = await fetch(`/api/dexscreener/token-image/${pairAddress}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { imageUrl: string | null };
  return data.imageUrl;
}
