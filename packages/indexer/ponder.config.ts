import { createConfig } from "ponder";

import { MarketFactoryAbi } from "./abis/MarketFactoryAbi";

export default createConfig({
  chains: {
    anvil: {
      id: 31337,
      rpc: process.env.PONDER_RPC_URL_ANVIL ?? "http://127.0.0.1:8545",
    },
  },
  contracts: {
    MarketFactory: {
      chain: "anvil",
      abi: MarketFactoryAbi,
      address: (process.env.MARKET_FACTORY_ADDRESS ??
        "0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9") as `0x${string}`,
      startBlock: Number(process.env.START_BLOCK ?? 0),
    },
  },
});
