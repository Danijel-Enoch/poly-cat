import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

/** A small off-chain, admin-curated store for how the public markets page
 * *displays* assets — separate from lib/assetStatusStore.ts's pause list,
 * which packages/cron also reads to decide whether to open an asset's
 * *next* window. Delisting/reordering here never touches that: a delisted
 * asset's market keeps trading and settling normally on-chain for anyone
 * with a direct link, this only affects discoverability and display order
 * on the public grid (mirrors the pre-pivot version of this app, which had
 * the same delisted-but-still-tradeable semantics). Same "local dev only"
 * caveat as assetStatusStore.ts — a distributed deployment would need a
 * real datastore instead of a JSON file on disk. */
const STATE_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../data/asset-display.json");

type AssetDisplayFile = { delistedAssetIds: string[]; order: string[] };

async function readState(): Promise<AssetDisplayFile> {
  try {
    const raw = await readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<AssetDisplayFile>;
    return { delistedAssetIds: parsed.delistedAssetIds ?? [], order: parsed.order ?? [] };
  } catch {
    return { delistedAssetIds: [], order: [] };
  }
}

async function writeState(state: AssetDisplayFile): Promise<void> {
  await mkdir(path.dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
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
