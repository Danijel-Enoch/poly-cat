import { formatUnits, parseUnits } from "viem";
import { USDC_DECIMALS } from "./contracts";

/** Decimal-aware amount formatting, shared by every collateral type (USDC/USDG
 * at 6 decimals, native ETH at 18). ETH gets more fraction digits since its
 * unit price is much larger than a stablecoin's. */
export function formatCollateral(raw: string | bigint, decimals: number): string {
  const value = typeof raw === "string" ? BigInt(raw) : raw;
  const formatted = Number(formatUnits(value, decimals));
  return formatted.toLocaleString(undefined, { maximumFractionDigits: decimals >= 18 ? 4 : 2 });
}

export function parseCollateral(input: string, decimals: number): bigint {
  return parseUnits(input || "0", decimals);
}

export function formatUsdc(raw: string | bigint): string {
  return formatCollateral(raw, USDC_DECIMALS);
}

export function parseUsdc(input: string): bigint {
  return parseCollateral(input, USDC_DECIMALS);
}

/** Matches partial-typing states ("", "1.", ".5") as well as complete decimals,
 * so it's usable directly as an onChange filter on a decimal amount input
 * without fighting the user mid-keystroke. Rejects everything a native
 * `type="number"` input's `valueAsNumber` would reject anyway (multiple dots,
 * letters, "e" scientific notation), but — unlike `type="number"` — never
 * blocks a leading "0." or silently mangles the value on mobile keyboards. */
export function isPartialDecimalInput(value: string): boolean {
  return /^\d*\.?\d*$/.test(value);
}

export function formatDate(unixSeconds: string | bigint): string {
  const seconds = typeof unixSeconds === "string" ? Number(unixSeconds) : Number(unixSeconds);
  return new Date(seconds * 1000).toLocaleString();
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Implied probability display only — derived client-side from the Pythagorean
 * bonding curve's virtual supplies, mirrors `PythagoreanMath.probabilityWad`
 * (`sYes^2 / (sYes^2+sNo^2)`). This is independent of accrued-fee drift in the
 * curve's `c` coefficient, unlike the raw tradeable price. Never used to
 * determine settlement, only for the UI. */
export function yesProbabilityFromSupplies(yesSupply: string | bigint, noSupply: string | bigint): number {
  const yes = typeof yesSupply === "string" ? BigInt(yesSupply) : yesSupply;
  const no = typeof noSupply === "string" ? BigInt(noSupply) : noSupply;
  const yesSq = yes * yes;
  const noSq = no * no;
  if (yesSq + noSq === 0n) return 0.5;
  return Number(yesSq) / Number(yesSq + noSq);
}
