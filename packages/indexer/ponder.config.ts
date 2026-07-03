import { createConfig } from "ponder";

import { MarketFactoryAbi } from "./abis/MarketFactoryAbi";

// Anvil is a local-only devnet, so it's opt-in via ENABLE_ANVIL rather than
// always-on: a production deploy (VPS, Docker) has no Anvil node to reach, and
// leaving this chain wired in unconditionally means Ponder retries
// http://127.0.0.1:8545 forever and floods the logs with ECONNREFUSED. Set
// ENABLE_ANVIL=true in .env.local for local dev; leave it unset in production.
const hasAnvilConfig = process.env.ENABLE_ANVIL === "true";

// Robinhood Chain (mainnet) is only wired in once its network details AND the
// mainnet MarketFactory deployment are known — all three of
// PONDER_RPC_URL_ROBINHOOD, ROBINHOOD_CHAIN_ID, and
// MARKET_FACTORY_ADDRESS_ROBINHOOD are required together, since a chain entry
// with no contract address (or vice versa) fails Ponder's config validation
// outright rather than just being inert.
const hasRobinhoodConfig =
  !!process.env.PONDER_RPC_URL_ROBINHOOD &&
  !!process.env.ROBINHOOD_CHAIN_ID &&
  !!process.env.MARKET_FACTORY_ADDRESS_ROBINHOOD;

export default createConfig({
  chains: {
    ...(hasAnvilConfig
      ? {
          anvil: {
            id: 31337,
            rpc: process.env.PONDER_RPC_URL_ANVIL ?? "http://127.0.0.1:8545",
          },
        }
      : {}),
    ...(hasRobinhoodConfig
      ? {
          robinhood: {
            id: Number(process.env.ROBINHOOD_CHAIN_ID),
            rpc: process.env.PONDER_RPC_URL_ROBINHOOD as string,
          },
        }
      : {}),
  },
  contracts: {
    MarketFactory: {
      abi: MarketFactoryAbi,
      chain: {
        ...(hasAnvilConfig
          ? {
              anvil: {
                address: (process.env.MARKET_FACTORY_ADDRESS ??
                  "0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9") as `0x${string}`,
                startBlock: Number(process.env.START_BLOCK ?? 0),
              },
            }
          : {}),
        ...(hasRobinhoodConfig
          ? {
              robinhood: {
                address: process.env.MARKET_FACTORY_ADDRESS_ROBINHOOD as `0x${string}`,
                startBlock: Number(process.env.START_BLOCK_ROBINHOOD ?? 0),
              },
            }
          : {}),
      },
    },
  },
});
