import { createPublicClient, createWalletClient, defineChain, getAddress, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { requireEnv } from "./config.js";

// A minimal, generic chain definition from plain env vars — deliberately not
// importing packages/web/lib/chains.ts, which is written around Next.js's
// NEXT_PUBLIC_* convention. This script has no browser/build-time concerns,
// so it just needs a chain id + RPC URL.
const chain = defineChain({
  id: Number(requireEnv("CHAIN_ID")),
  name: "Polycat settlement chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [requireEnv("RPC_URL")] } },
});

const account = privateKeyToAccount(requireEnv("CRON_PRIVATE_KEY") as `0x${string}`);

export const marketFactoryAddress = getAddress(requireEnv("MARKET_FACTORY_ADDRESS"));

export const publicClient = createPublicClient({ chain, transport: http(requireEnv("RPC_URL")) });
export const walletClient = createWalletClient({ account, chain, transport: http(requireEnv("RPC_URL")) });
export { account };
