import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { anvil, robinhoodChain, activeChain } from "./chains";

export { anvil, robinhoodChain, activeChain };

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
            name: "Robin Markets",
            description: "Trade BTC, ETH, and SOL Up or Down on 5-minute, 30-minute, and 1-hour windows",
            url: appUrl,
            icons: [`${appUrl}/icon.svg`],
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
