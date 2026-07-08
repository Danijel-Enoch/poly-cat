import { formatUnits, parseUnits } from "viem";
import { COLLATERAL_DECIMALS } from "./contracts";

/** Decimal-aware amount formatting. Takes `decimals` explicitly (rather than
 * hardcoding `COLLATERAL_DECIMALS`) so it also covers WAD (1e18) price
 * formatting elsewhere in this file. ETH gets more fraction digits since its
 * unit price is much larger than a stablecoin's. */
export function formatCollateral(raw: string | bigint, decimals: number): string {
  const value = typeof raw === "string" ? BigInt(raw) : raw;
  const formatted = Number(formatUnits(value, decimals));
  return formatted.toLocaleString(undefined, { maximumFractionDigits: decimals >= 18 ? 4 : 2 });
}

export function parseCollateral(input: string, decimals: number): bigint {
  return parseUnits(input || "0", decimals);
}

export function formatEth(raw: string | bigint): string {
  return formatCollateral(raw, COLLATERAL_DECIMALS);
}

export function parseEth(input: string): bigint {
  return parseCollateral(input, COLLATERAL_DECIMALS);
}

/** Full-precision collateral formatting, for the admin dashboard's all-time
 * volume/fee totals where a tiny amount rounding to "0.00" would be
 * misleading. Unlike formatEth (which caps at 4 fraction digits and rounds
 * through a lossy `Number`), this formats straight from viem's exact
 * `formatUnits` decimal string: it keeps every significant fraction digit the
 * value actually has (trailing zeros trimmed) so even sub-milli amounts show
 * a real, nonzero figure, while still grouping the integer part with commas
 * for readability. */
export function formatEthFull(raw: string | bigint): string {
  const value = typeof raw === "string" ? BigInt(raw) : raw;
  const decimal = formatUnits(value, COLLATERAL_DECIMALS); // exact, e.g. "1234.056700000000000000"
  const [intPart, fracPartRaw = ""] = decimal.split(".");
  const groupedInt = BigInt(intPart).toLocaleString("en-US");
  const fracPart = fracPartRaw.replace(/0+$/, "");
  return fracPart ? `${groupedInt}.${fracPart}` : groupedInt;
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
