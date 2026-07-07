// Assets are an owner-curated, open-ended registry now (see `registerAsset`
// in MarketFactory.sol) — not a fixed BTC/ETH/SOL union — so there's no
// complete list to hardcode display metadata for. A small lookup covers the
// well-known ones with a nicer full name; anything else just displays its
// on-chain symbol directly.
const KNOWN_ASSET_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
};

export function assetDisplayName(symbol: string): string {
  return KNOWN_ASSET_NAMES[symbol] ?? symbol;
}

// Deterministic color per symbol (a simple string hash into a fixed
// palette), so the same token always gets the same badge color without
// needing a hardcoded map for every asset that might ever be registered.
const PALETTE = ["#f7931a", "#627eea", "#14f195", "#ff6b9d", "#ffb703", "#8ecae6", "#c77dff", "#06d6a0"];

export function assetColor(symbol: string): string {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
