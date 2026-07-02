import { MarketFactoryAbi } from "./abis/MarketFactoryAbi";
import { MockUSDCAbi } from "./abis/MockUSDCAbi";

const isMainnet = process.env.NEXT_PUBLIC_NETWORK === "mainnet";

function requireMainnetEnv(name: string, value: string | undefined): `0x${string}` {
  if (!value) {
    throw new Error(
      `${name} must be set when NEXT_PUBLIC_NETWORK=mainnet (see lib/contracts.ts and lib/wagmi.ts for the full list of mainnet env vars).`,
    );
  }
  return value as `0x${string}`;
}

// Addresses from `forge script script/Deploy.s.sol --broadcast` against local Anvil,
// used whenever NEXT_PUBLIC_NETWORK isn't "mainnet". Override via env vars when
// pointing at a different local/testnet deployment.
const LOCAL_MARKET_FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS ??
  "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0") as `0x${string}`;
const LOCAL_USDC_ADDRESS = (process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS ??
  "0x5fbdb2315678afecb367f032d93f642f64180aa3") as `0x${string}`;

// On mainnet neither address has a hardcoded fallback: HoodMarkets' own contract
// address only exists once it's actually deployed there, and USDC is a real,
// already-deployed token whose address must come from Robinhood Chain's own
// docs/explorer, not a guess. Missing either env var fails loudly at startup
// instead of silently pointing at the wrong contract.
export const MARKET_FACTORY_ADDRESS = isMainnet
  ? requireMainnetEnv(
      "NEXT_PUBLIC_MAINNET_MARKET_FACTORY_ADDRESS",
      process.env.NEXT_PUBLIC_MAINNET_MARKET_FACTORY_ADDRESS,
    )
  : LOCAL_MARKET_FACTORY_ADDRESS;

export const USDC_ADDRESS = isMainnet
  ? requireMainnetEnv("NEXT_PUBLIC_MAINNET_USDC_ADDRESS", process.env.NEXT_PUBLIC_MAINNET_USDC_ADDRESS)
  : LOCAL_USDC_ADDRESS;

export const marketFactoryContract = {
  address: MARKET_FACTORY_ADDRESS,
  abi: MarketFactoryAbi,
} as const;

export const usdcContract = {
  address: USDC_ADDRESS,
  abi: MockUSDCAbi,
} as const;

export const USDC_DECIMALS = 6;
