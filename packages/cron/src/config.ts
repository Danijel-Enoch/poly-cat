export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required (see .env.example)`);
  return value;
}

// Every market is a single fixed 5-minute window now — see MarketFactory.sol's
// MIN_TRADING_DURATION (4 minutes, just a floor) and the project's decision to
// drop the 30m/1h timeframes entirely.
export const MARKET_DURATION_SECONDS = 5 * 60;

// Mirrors MarketFactory.sol's `enum PriceSource { Gate, DexScreener }` — index
// order must match the contract exactly, since it's ABI-encoded as a plain uint8.
export enum PriceSource {
  Gate = 0,
  DexScreener = 1,
}

export const DEXSCREENER_CHAIN_ID = "robinhood";

// Cap on how many assets (each up to one settle + one create) go into a
// single `batchProcess` transaction, so one tx can't blow past the chain's
// block gas limit and revert the whole pass. Sized from measured worst-case
// gas via the proxy — ~125k per settlement + ~320k per creation, so ~450k
// per asset — against a conservative ~30M-gas block: 25 assets ≈ 11M gas,
// comfortably under 40% of the block with headroom for gas variance and the
// base fee. Anything above the cap is split across consecutive batches (each
// its own tx — still far cheaper than one tx per settle and per create).
// Override per chain via env (raise it on a higher-block-limit chain).
export const MAX_ASSETS_PER_BATCH = (() => {
  const raw = process.env.MAX_ASSETS_PER_BATCH;
  if (!raw) return 25;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new Error(`MAX_ASSETS_PER_BATCH must be a positive integer, got "${raw}"`);
  return n;
})();

// Optional operational allowlist — a comma-separated list of asset symbols
// (e.g. "CASHCAT" or "BTC,CASHCAT"). When set, only these symbols are
// eligible for a *new* market window; everything else is treated the same
// as an admin-paused asset (see assetStatus.ts) — an already-open market
// for an excluded symbol still settles normally. Unset (the default) means
// no restriction, every registered asset is eligible. This is a host-level
// env var specifically because packages/cron can run somewhere the web
// app's admin-toggle JSON file (lib/assetStatusStore.ts) isn't reachable —
// see assetStatus.ts for how the two combine.
export const CRON_ACTIVE_SYMBOLS: Set<string> | null = process.env.CRON_ACTIVE_SYMBOLS
  ? new Set(
      process.env.CRON_ACTIVE_SYMBOLS.split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    )
  : null;
