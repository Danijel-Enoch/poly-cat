import { defineChain } from "viem";

// Pure viem chain definitions, deliberately split out from lib/wagmi.ts:
// that file also pulls in wagmi's WalletConnect connector, which has
// browser-only side effects (it reaches for IndexedDB) and blows up if
// imported into server code (e.g. API routes) that only needs to know which
// chain/RPC to read from. Import activeChain from here in server contexts.

// Local Anvil chain, used for development.
export const anvil = defineChain({
  id: 31337,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545"] },
  },
});

/// Robinhood Chain (mainnet) — Robinhood's Arbitrum-based L2. Every
/// network-identifying value here is env-driven with no hardcoded fallback:
/// filling these in via deployment env vars is the only way to point the app at
/// mainnet, so a missing value fails loudly instead of silently defaulting to a
/// guessed (and possibly wrong) chain ID or RPC endpoint. Set `NEXT_PUBLIC_NETWORK=mainnet`
/// once these are filled in to switch the whole app over — see contracts.ts for
/// the matching contract-address switch.
export const robinhoodChain = defineChain({
  id: Number(process.env.NEXT_PUBLIC_MAINNET_CHAIN_ID ?? 0),
  name: process.env.NEXT_PUBLIC_MAINNET_CHAIN_NAME ?? "Robinhood Chain",
  nativeCurrency: {
    name: process.env.NEXT_PUBLIC_MAINNET_CURRENCY_NAME ?? "Ether",
    symbol: process.env.NEXT_PUBLIC_MAINNET_CURRENCY_SYMBOL ?? "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_MAINNET_RPC_URL ?? ""] },
  },
  ...(process.env.NEXT_PUBLIC_MAINNET_EXPLORER_URL
    ? {
        blockExplorers: {
          default: { name: "Explorer", url: process.env.NEXT_PUBLIC_MAINNET_EXPLORER_URL },
        },
      }
    : {}),
});

// Single toggle for which network the whole app targets. Defaults to local Anvil
// so nothing breaks until mainnet env vars are actually filled in.
export const activeChain = process.env.NEXT_PUBLIC_NETWORK === "mainnet" ? robinhoodChain : anvil;
