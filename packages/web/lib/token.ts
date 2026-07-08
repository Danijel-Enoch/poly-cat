import { getAddress, isAddress } from "viem";

// The official Polycat utility token contract address — published early
// specifically so nothing else can convincingly claim to be "the" Polycat
// token. Not tradable through this app, which only ever trades native ETH
// (see MarketFactory.sol) — see the docs page's Token section for what it's
// actually for. Env-driven with a default (same pattern as
// NEXT_PUBLIC_MARKET_FACTORY_ADDRESS in lib/contracts.ts) rather than a
// single network-specific deployment, since this is purely a display value,
// not something the app ever reads/writes on-chain.
const rawAddress = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS?.trim() ?? "0xe6ea5079ed7B6F59155FC686245B1d910bff2744";

if (!isAddress(rawAddress)) {
  throw new Error(
    `NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS="${rawAddress}" is not a valid address (see lib/token.ts).`,
  );
}

export const TOKEN_CONTRACT_ADDRESS = getAddress(rawAddress);
