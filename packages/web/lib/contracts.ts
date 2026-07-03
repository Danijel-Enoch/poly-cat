import { getAddress, isAddress, zeroAddress } from "viem";
import { MarketFactoryAbi } from "./abis/MarketFactoryAbi";
import { MockUSDCAbi } from "./abis/MockUSDCAbi";

const isMainnet = process.env.NEXT_PUBLIC_NETWORK === "mainnet";

// Env vars pasted into a hosting dashboard (Vercel, Railway, ...) routinely pick up
// stray leading/trailing whitespace or a newline, which fails viem's strict "is this
// exactly 20 bytes" address check with a confusing "invalid address" error deep in a
// wallet call. Trim and re-checksum every address env var up front so that class of
// bug fails loudly here instead.
function cleanAddress(name: string, value: string): `0x${string}` {
  const trimmed = value.trim();
  if (!isAddress(trimmed)) {
    throw new Error(`${name}="${value}" is not a valid address (see lib/contracts.ts).`);
  }
  return getAddress(trimmed);
}

function requireMainnetEnv(name: string, value: string | undefined): `0x${string}` {
  if (!value) {
    throw new Error(
      `${name} must be set when NEXT_PUBLIC_NETWORK=mainnet (see lib/contracts.ts and lib/wagmi.ts for the full list of mainnet env vars).`,
    );
  }
  return cleanAddress(name, value);
}

// Addresses from `forge script script/Deploy.s.sol --broadcast` against local Anvil,
// used whenever NEXT_PUBLIC_NETWORK isn't "mainnet". Override via env vars when
// pointing at a different local/testnet deployment.
const LOCAL_MARKET_FACTORY_ADDRESS = cleanAddress(
  "NEXT_PUBLIC_MARKET_FACTORY_ADDRESS",
  process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS ?? "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0",
);
const LOCAL_USDC_ADDRESS = cleanAddress(
  "NEXT_PUBLIC_MOCK_USDC_ADDRESS",
  process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS ?? "0x5fbdb2315678afecb367f032d93f642f64180aa3",
);

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

// Robinhood Chain mainnet's real collateral token is USDG ("Global Dollar"), not
// USDC — same decimal count so none of the numeric logic differs, but every
// user-facing label needs to say the right name.
export const COLLATERAL_SYMBOL = isMainnet ? "USDG" : "USDC";

export const marketFactoryContract = {
  address: MARKET_FACTORY_ADDRESS,
  abi: MarketFactoryAbi,
} as const;

export const usdcContract = {
  address: USDC_ADDRESS,
  abi: MockUSDCAbi,
} as const;

export const USDC_DECIMALS = 6;

// Sentinel `collateralToken` value meaning "this market is backed by native
// ETH", matching `NATIVE_TOKEN` in MarketFactory.sol — there's no canonical
// WETH on Robinhood Chain to wrap into, so native ETH is a first-class
// collateral option alongside any ERC20, picked per-market at creation.
export const NATIVE_TOKEN = zeroAddress;

export function isNativeCollateral(token: string): boolean {
  return token.toLowerCase() === NATIVE_TOKEN;
}

export function collateralDecimals(token: string): number {
  return isNativeCollateral(token) ? 18 : USDC_DECIMALS;
}

export function collateralSymbol(token: string): string {
  return isNativeCollateral(token) ? "ETH" : COLLATERAL_SYMBOL;
}
