import { createPublicClient, createWalletClient, defineChain, getAddress, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { requireEnv } from "./config.js";

// Optional — set to a real, `aggregate3`-compatible Multicall3 address to
// fold every `readContract` call issued within the same tick into one
// `eth_call` instead of firing them individually (see run.ts's bulk-fetch
// phase) — the same fix packages/web applies for the same reason: relieving
// pressure on a shared/rate-limited RPC endpoint. On Robinhood Chain
// mainnet, use the canonical 0xcA11bde05977b3631167028862bE2a173976CA11 —
// confirmed deployed and `aggregate3`-compatible there — NOT the chain's
// own "L2 Multicall" contract at 0x2cAC2D899eCC914d704FeaAE33ac1bF36277DaD1,
// which has code but doesn't actually implement `aggregate3` (confirmed
// empirically: it reverts even with zero sub-calls) and would silently
// break every read this script makes, not just the batched ones, since
// viem calls `aggregate3` unconditionally once batching is enabled — this
// broke packages/web in exactly this way before the address was corrected.
// Left unset by default since local Anvil has no Multicall3 deployed out of
// the box; batching only turns on when this resolves to a real, working
// address, same safety gate as packages/web/lib/chainReads.ts.
const multicall3Address = process.env.MULTICALL3_ADDRESS;

// A minimal, generic chain definition from plain env vars — deliberately not
// importing packages/web/lib/chains.ts, which is written around Next.js's
// NEXT_PUBLIC_* convention. This script has no browser/build-time concerns,
// so it just needs a chain id + RPC URL.
const chain = defineChain({
  id: Number(requireEnv("CHAIN_ID")),
  name: "Polycat settlement chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [requireEnv("RPC_URL")] } },
  ...(multicall3Address
    ? { contracts: { multicall3: { address: getAddress(multicall3Address) } } }
    : {}),
});

const account = privateKeyToAccount(requireEnv("CRON_PRIVATE_KEY") as `0x${string}`);

export const marketFactoryAddress = getAddress(requireEnv("MARKET_FACTORY_ADDRESS"));

export const publicClient = createPublicClient({
  chain,
  transport: http(requireEnv("RPC_URL")),
  batch: { multicall: !!multicall3Address },
});
export const walletClient = createWalletClient({ account, chain, transport: http(requireEnv("RPC_URL")) });
export { account };
