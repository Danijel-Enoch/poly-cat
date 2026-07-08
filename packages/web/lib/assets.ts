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

// Real logos for the well-known Gate-sourced ("blue chip") assets, from
// Trust Wallet's open, community-maintained token icon registry — no image
// field exists on-chain (see MarketFactory.sol's AssetInfo) to fetch these
// from instead. DexScreener-sourced assets (memecoins) get their image from
// DexScreener itself at render time instead (see components/AssetIcon.tsx
// and app/api/dexscreener/token-image/[pairAddress]/route.ts), since that's
// already where their own token metadata lives.
const KNOWN_ASSET_ICONS: Record<string, string> = {
  BTC: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png",
  ETH: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
  SOL: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png",
};

export function knownAssetIconUrl(symbol: string): string | null {
  return KNOWN_ASSET_ICONS[symbol] ?? null;
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
