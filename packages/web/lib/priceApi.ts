export type PricePoint = { t: number; price: number };

export type AssetPriceResponse = {
  points: PricePoint[];
  current: number | null;
};

/** Client for the app's own `/api/price/[assetId]` proxy — only valid for
 * Gate-sourced assets (see that route for why DexScreener-sourced ones use
 * an embedded chart instead). */
export async function fetchAssetPrice(assetId: bigint, from?: number, to?: number): Promise<AssetPriceResponse> {
  const params = new URLSearchParams();
  if (from) params.set("from", String(from));
  if (to) params.set("to", String(to));
  const qs = params.toString();
  const res = await fetch(`/api/price/${assetId}${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`Failed to fetch price for asset ${assetId}: ${res.status}`);
  return res.json();
}
