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
