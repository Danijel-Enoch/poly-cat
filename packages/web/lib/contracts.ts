import { getAddress, isAddress } from "viem";
import { MarketFactoryAbi } from "./abis/MarketFactoryAbi";

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

// Address from `forge script script/Deploy.s.sol --broadcast` against local Anvil,
// used whenever NEXT_PUBLIC_NETWORK isn't "mainnet". Override via env var when
// pointing at a different local/testnet deployment.
const LOCAL_MARKET_FACTORY_ADDRESS = cleanAddress(
  "NEXT_PUBLIC_MARKET_FACTORY_ADDRESS",
  process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS ?? "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0",
);

// On mainnet this has no hardcoded fallback: Polycat's own contract address only
// exists once it's actually deployed there. Missing the env var fails loudly at
// startup instead of silently pointing at the wrong contract.
export const MARKET_FACTORY_ADDRESS = isMainnet
  ? requireMainnetEnv(
      "NEXT_PUBLIC_MAINNET_MARKET_FACTORY_ADDRESS",
      process.env.NEXT_PUBLIC_MAINNET_MARKET_FACTORY_ADDRESS,
    )
  : LOCAL_MARKET_FACTORY_ADDRESS;

// Every market is denominated and settled in native ETH — there's no
// collateral token address to configure, on any network.
export const COLLATERAL_SYMBOL = "ETH";
export const COLLATERAL_DECIMALS = 18;

export const marketFactoryContract = {
  address: MARKET_FACTORY_ADDRESS,
  abi: MarketFactoryAbi,
} as const;
