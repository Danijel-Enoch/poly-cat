import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { CRON_ACTIVE_SYMBOLS } from "./config.js";

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

async function isAssetIdPaused(assetId: bigint): Promise<boolean> {
  let raw: string;
  try {
    raw = await readFile(STATE_FILE, "utf8");
  } catch {
    return false; // no file yet ⇒ nothing has ever been paused
  }
  const parsed = JSON.parse(raw) as AssetStatusFile;
  return (parsed.inactiveAssetIds ?? []).includes(assetId.toString());
}

/** An asset is eligible for a new window only if it passes both gates: not
 * admin-paused (the JSON file) and, if `CRON_ACTIVE_SYMBOLS` is set, in that
 * allowlist. */
export async function isAssetActive(assetId: bigint, symbol: string): Promise<boolean> {
  if (CRON_ACTIVE_SYMBOLS && !CRON_ACTIVE_SYMBOLS.has(symbol.toUpperCase())) return false;
  return !(await isAssetIdPaused(assetId));
}
