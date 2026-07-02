import { MarketFactoryAbi } from "./abis/MarketFactoryAbi";
import { MockUSDCAbi } from "./abis/MockUSDCAbi";

// Addresses from `forge script script/Deploy.s.sol --broadcast` against local Anvil.
// Override via env vars when pointing at a different deployment.
export const MARKET_FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS ??
  "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512") as `0x${string}`;

export const MOCK_USDC_ADDRESS = (process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS ??
  "0x5fbdb2315678afecb367f032d93f642f64180aa3") as `0x${string}`;

export const marketFactoryContract = {
  address: MARKET_FACTORY_ADDRESS,
  abi: MarketFactoryAbi,
} as const;

export const mockUsdcContract = {
  address: MOCK_USDC_ADDRESS,
  abi: MockUSDCAbi,
} as const;

export const USDC_DECIMALS = 6;
