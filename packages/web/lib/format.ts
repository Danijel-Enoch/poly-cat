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
 * (`sUp^2 / (sUp^2+sDown^2)`). This is independent of accrued-fee drift in the
 * curve's `c` coefficient, unlike the raw tradeable price. Never used to
 * determine settlement (that's the recorded start/close price — see
 * lib/chainReads.ts), only for the UI's "Up X¢ / Down Y¢" display. */
export function upProbabilityFromSupplies(upSupply: string | bigint, downSupply: string | bigint): number {
  const up = typeof upSupply === "string" ? BigInt(upSupply) : upSupply;
  const down = typeof downSupply === "string" ? BigInt(downSupply) : downSupply;
  const upSq = up * up;
  const downSq = down * down;
  if (upSq + downSq === 0n) return 0.5;
  return Number(upSq) / Number(upSq + downSq);
}

const WAD_DECIMALS = 18;

/** `startPriceWad`/`closePriceWad` are WAD (1e18) fixed-point USD prices —
 * this formats one as a dollar string, scaling precision to the asset's
 * price magnitude: whole-dollar assets like BTC need only cents, but a
 * memecoin trading at fractions of a cent (e.g. CashCat at $0.009771) needs
 * several more decimal places just to show a nonzero, meaningfully-precise
 * value at all. */
export function formatPriceWad(wad: bigint, options?: { maximumFractionDigits?: number }): string {
  const value = Number(formatUnits(wad, WAD_DECIMALS));
  const defaultDigits = value >= 100 ? 2 : value >= 1 ? 4 : value >= 0.01 ? 6 : 8;
  return value.toLocaleString(undefined, {
    maximumFractionDigits: options?.maximumFractionDigits ?? defaultDigits,
  });
}
