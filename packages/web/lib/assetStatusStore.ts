import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// A small off-chain, admin-toggled pause list — see packages/cron's matching
// src/assetStatus.ts (same file, same shape, no shared package since these
// are two independent scripts/apps in this monorepo). The contract itself
// has no per-asset pause flag; this only ever gates the cron script from
// opening a *new* market for a paused asset. Only meaningful when this app
// and packages/cron run on the same machine/filesystem (local dev today) —
// a distributed deployment (e.g. Vercel + a separately-hosted cron) would
// need a real datastore instead. Resolved relative to this module's own
// location (not `cwd()`) so it works regardless of how Next.js is invoked.
const STATE_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../data/asset-status.json");

type AssetStatusFile = { inactiveAssetIds: string[] };

async function readState(): Promise<AssetStatusFile> {
  try {
    const raw = await readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<AssetStatusFile>;
    return { inactiveAssetIds: parsed.inactiveAssetIds ?? [] };
  } catch {
    return { inactiveAssetIds: [] };
  }
}

export async function getInactiveAssetIds(): Promise<string[]> {
  return (await readState()).inactiveAssetIds;
}

export async function setAssetActive(assetId: string, active: boolean): Promise<void> {
  const state = await readState();
  const withoutAsset = state.inactiveAssetIds.filter((id) => id !== assetId);
  const next: AssetStatusFile = {
    inactiveAssetIds: active ? withoutAsset : [...withoutAsset, assetId],
  };
  await mkdir(path.dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(next, null, 2));
}
