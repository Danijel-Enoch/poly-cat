import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// A small off-chain, admin-toggled pause list — see packages/web's matching
// lib/assetStatusStore.ts (same file, same shape, no shared package since
// these are two independent scripts/apps). The contract itself has no
// per-asset pause flag; this only ever gates *this* script from opening a
// new market for a paused asset — an already-open Trading market still
// settles normally on its next pass regardless of this file. Resolved
// relative to this module's own location (not `cwd()`) so it works
// regardless of how this script is invoked.
const STATE_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../data/asset-status.json");

type AssetStatusFile = { inactiveAssetIds?: string[] };

export async function isAssetActive(assetId: bigint): Promise<boolean> {
  let raw: string;
  try {
    raw = await readFile(STATE_FILE, "utf8");
  } catch {
    return true; // no file yet ⇒ nothing has ever been paused
  }
  const parsed = JSON.parse(raw) as AssetStatusFile;
  return !(parsed.inactiveAssetIds ?? []).includes(assetId.toString());
}
