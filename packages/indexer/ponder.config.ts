import { createConfig } from "ponder";

import { MarketFactoryAbi } from "./abis/MarketFactoryAbi";

// Robinhood Chain (mainnet) is only wired in once its network details and the
// mainnet MarketFactory deployment are known — set PONDER_RPC_URL_ROBINHOOD,
// ROBINHOOD_CHAIN_ID, and MARKET_FACTORY_ADDRESS_ROBINHOOD when deploying there.
// Until then the indexer runs anvil-only, so an unset/placeholder mainnet RPC can
// never break local dev.
const hasRobinhoodConfig = !!process.env.PONDER_RPC_URL_ROBINHOOD && !!process.env.ROBINHOOD_CHAIN_ID;

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
