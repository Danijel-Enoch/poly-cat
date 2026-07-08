import "server-only";
import { redis } from "./redis";

/** A small off-chain, admin-curated store for how the public markets page
 * *displays* assets — separate from lib/assetStatusStore.ts's pause list,
 * which packages/cron also reads to decide whether to open an asset's
 * *next* window. Delisting/reordering here never touches that: a delisted
 * asset's market keeps trading and settling normally on-chain for anyone
 * with a direct link, this only affects discoverability and display order
 * on the public grid (mirrors the pre-pivot version of this app, which had
 * the same delisted-but-still-tradeable semantics). Backed by Redis (see
 * lib/redis.ts) rather than a local file — unlike assetStatusStore.ts,
 * nothing else needs filesystem-level access to this, so there's no reason
 * to tie it to a single host. Degrades to "nothing delisted, natural order"
 * if REDIS_URL isn't configured, so the rest of the app still works. */
const KEY = "polycat:asset-display";

type AssetDisplayFile = { delistedAssetIds: string[]; order: string[] };

async function readState(): Promise<AssetDisplayFile> {
  if (!redis) return { delistedAssetIds: [], order: [] };
  const raw = await redis.get(KEY);
  if (!raw) return { delistedAssetIds: [], order: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<AssetDisplayFile>;
    return { delistedAssetIds: parsed.delistedAssetIds ?? [], order: parsed.order ?? [] };
  } catch {
    return { delistedAssetIds: [], order: [] };
  }
}

async function writeState(state: AssetDisplayFile): Promise<void> {
  if (!redis) throw new Error("Delist/reorder is not configured (missing REDIS_URL).");
  await redis.set(KEY, JSON.stringify(state));
}

export async function getDelistedAssetIds(): Promise<string[]> {
  return (await readState()).delistedAssetIds;
}

export async function setAssetDelisted(assetId: string, delisted: boolean): Promise<void> {
  const state = await readState();
  const without = state.delistedAssetIds.filter((id) => id !== assetId);
  await writeState({ ...state, delistedAssetIds: delisted ? [...without, assetId] : without });
}

/** The full display order: every explicitly-ordered assetId first (in
 * stored order, dropping any that no longer exist), then any not-yet-ordered
 * assetId — e.g. one just registered — appended in natural registration-id
 * order, so a fresh asset always shows up somewhere rather than silently
 * sorting to an undefined position. */
export function resolveOrder(storedOrder: string[], allAssetIds: string[]): string[] {
  const known = new Set(allAssetIds);
  const ordered = storedOrder.filter((id) => known.has(id));
  const seen = new Set(ordered);
  const rest = allAssetIds.filter((id) => !seen.has(id));
  return [...ordered, ...rest];
}

export async function getAssetOrder(allAssetIds: string[]): Promise<string[]> {
  const state = await readState();
  return resolveOrder(state.order, allAssetIds);
}

/** Swaps `assetId` with its neighbor one step earlier/later in display
 * order, materializing the full resolved order (see resolveOrder) so it
 * stays stable as new assets register later. A no-op at either end. */
export async function moveAsset(assetId: string, direction: "up" | "down", allAssetIds: string[]): Promise<void> {
  const state = await readState();
  const order = resolveOrder(state.order, allAssetIds);
  const index = order.indexOf(assetId);
  if (index === -1) return;
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= order.length) return;
  [order[index], order[swapWith]] = [order[swapWith], order[index]];
  await writeState({ ...state, order });
}
