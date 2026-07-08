import { createConfig } from "ponder";

import { MarketFactoryAbi } from "./abis/MarketFactoryAbi";

// Plain env vars, not Ponder's own PONDER_RPC_URL_<chainId> convention —
// mirrors packages/cron/src/chain.ts and packages/web/lib/chains.ts, which
// both already point at "whichever chain this deployment targets" via
// RPC_URL/CHAIN_ID/MARKET_FACTORY_ADDRESS rather than juggling per-network
// var names. Same local-Anvil-by-default posture as the rest of the repo.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required (see .env.example)`);
  return value;
}

// Local Anvil resets on every restart, so indexing from genesis (0) is cheap
// and always correct there. A real deployment should set START_BLOCK to the
// contract's actual deploy block (see packages/contracts/addresses.txt) —
// indexing from 0 against a live chain would otherwise scan millions of
// irrelevant blocks before reaching the first real event.
const startBlock = process.env.START_BLOCK ? Number(process.env.START_BLOCK) : 0;

export default createConfig({
  chains: {
    polycat: {
      id: Number(process.env.CHAIN_ID ?? 31337),
      rpc: process.env.RPC_URL ?? "http://127.0.0.1:8545",
    },
  },
  contracts: {
    MarketFactory: {
      chain: "polycat",
      abi: MarketFactoryAbi,
      address: requireEnv("MARKET_FACTORY_ADDRESS") as `0x${string}`,
      startBlock,
    },
  },
});
