import { http } from "wagmi";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { anvil, robinhoodChain, activeChain } from "./chains";

export { anvil, robinhoodChain, activeChain };

// RainbowKit's default wallet list needs a project ID from
// https://cloud.reown.com (formerly WalletConnect Cloud) to power its
// WalletConnect-based connectors (QR code on desktop, deep link on mobile).
// Injected/browser wallets (MetaMask etc.) still work fine without a real one —
// this placeholder just keeps `getDefaultConfig` from throwing on an empty
// string in local dev before a project ID is configured.
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "00000000000000000000000000000000";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const wagmiConfig = getDefaultConfig({
  appName: "Polycat",
  appDescription: "Fixed 5-minute Up/Down markets on curated blue-chip and Robinhood Chain memecoin assets",
  appUrl,
  appIcon: `${appUrl}/icon.png`,
  projectId: walletConnectProjectId,
  chains: [activeChain],
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
