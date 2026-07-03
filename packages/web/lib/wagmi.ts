import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { injected, walletConnect } from "wagmi/connectors";

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

// `injected()` alone only connects wallets that inject a `window.ethereum`
// provider (MetaMask-style browser extensions) — the common case on desktop,
// but most mobile browsers have no such extension and the connect button
// silently does nothing. WalletConnect (QR code on desktop, deep link into a
// wallet app on mobile) needs a project ID from https://cloud.reown.com
// (formerly WalletConnect Cloud) to initialize, so it's only wired in once
// one is configured — see ConnectButton for how the two are surfaced.
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const connectors = [
  injected(),
  ...(walletConnectProjectId
    ? [
        walletConnect({
          projectId: walletConnectProjectId,
          metadata: {
            name: "HoodMarkets",
            description: "The first prediction market on Robinhood Chain",
            url: appUrl,
            icons: [`${appUrl}/Icon.png`],
          },
          showQrModal: true,
        }),
      ]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [activeChain],
  connectors,
  transports: {
    [activeChain.id]: http(),
  },
  // Server-rendered pages never know a wallet's connection state, so `useAccount`
  // etc. must report "disconnected" on both the server and the client's first
  // render, then reconcile with the real (possibly-connected) state after mount —
  // otherwise SSR output and the client's first paint disagree and React discards
  // the tree. `WagmiProvider` handles the post-mount reconciliation automatically.
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
