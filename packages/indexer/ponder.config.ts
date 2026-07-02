import { createConfig } from "ponder";

import { MarketFactoryAbi } from "./abis/MarketFactoryAbi";

// Robinhood Chain (mainnet) is only wired in once its network details AND the
// mainnet MarketFactory deployment are known — all three of
// PONDER_RPC_URL_ROBINHOOD, ROBINHOOD_CHAIN_ID, and
// MARKET_FACTORY_ADDRESS_ROBINHOOD are required together, since a chain entry
// with no contract address (or vice versa) fails Ponder's config validation
// outright rather than just being inert. Until all three are set, the indexer
// runs anvil-only, so filling in the network's RPC/chain ID ahead of actually
// deploying the contract there (as this repo's own .env.local does) can't
// break local dev.
const hasRobinhoodConfig =
  !!process.env.PONDER_RPC_URL_ROBINHOOD &&
  !!process.env.ROBINHOOD_CHAIN_ID &&
  !!process.env.MARKET_FACTORY_ADDRESS_ROBINHOOD;

export default createConfig({
  chains: {
    anvil: {
      id: 31337,
      rpc: process.env.PONDER_RPC_URL_ANVIL ?? "http://127.0.0.1:8545",
    },
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
        anvil: {
          address: (process.env.MARKET_FACTORY_ADDRESS ??
            "0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9") as `0x${string}`,
          startBlock: Number(process.env.START_BLOCK ?? 0),
        },
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
