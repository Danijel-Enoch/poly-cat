/** Bit-exact TypeScript mirror of `PythagoreanMath.sol`'s buy/sell quotes, used
 * client-side to preview trades and to invert `quoteBuy` (solve for the ETH
 * needed to receive a *specific* number of shares) — something the contract itself
 * has no view function for. The on-chain call is still the source of truth; this
 * only prefills the UI and computes the `amountIn` actually submitted when a user
 * specifies a desired share amount instead of an ETH amount. */

const BPS_DENOMINATOR = 10_000n;

function ceilDiv(a: bigint, b: bigint): bigint {
  return a === 0n ? 0n : (a - 1n) / b + 1n;
}

function mulDivFloor(x: bigint, y: bigint, denominator: bigint): bigint {
  return (x * y) / denominator;
}

function mulDivCeil(x: bigint, y: bigint, denominator: bigint): bigint {
  return ceilDiv(x * y, denominator);
}

/** Floor integer square root (Newton's method). */
function sqrtFloor(value: bigint): bigint {
  if (value < 2n) return value;
  let x0 = value / 2n;
  let x1 = (x0 + value / x0) / 2n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + value / x0) / 2n;
  }
  return x0;
}

function sqrtCeil(value: bigint): bigint {
  const floor = sqrtFloor(value);
  return floor * floor === value ? floor : floor + 1n;
}

export class CurveQuoteError extends Error {}

export function quoteBuy(
  r: bigint,
  sSame: bigint,
  sOther: bigint,
  amountIn: bigint,
  feeBps: bigint,
): { sharesOut: bigint; newR: bigint; newSSame: bigint; feePaid: bigint } {
  if (amountIn <= 0n) throw new CurveQuoteError("ZeroAmount");
  if (r <= 0n || (sSame === 0n && sOther === 0n)) throw new CurveQuoteError("InsufficientLiquidity");

  const feePaid = ceilDiv(amountIn * feeBps, BPS_DENOMINATOR);
  const aNet = amountIn - feePaid;
  const rMid = r + aNet;

  const q = sSame * sSame + sOther * sOther;
  const y = mulDivFloor(q, rMid * rMid, r * r);
  const z = y - sOther * sOther;
  const sSameNew = sqrtFloor(z);

  if (sSameNew <= sSame) throw new CurveQuoteError("ZeroAmount");
  return { sharesOut: sSameNew - sSame, newR: rMid + feePaid, newSSame: sSameNew, feePaid };
}

export function quoteSell(
  r: bigint,
  sSame: bigint,
  sOther: bigint,
  sharesIn: bigint,
  feeBps: bigint,
): { collateralOut: bigint; newR: bigint; newSSame: bigint; feePaid: bigint } {
  if (sharesIn <= 0n) throw new CurveQuoteError("ZeroAmount");
  if (sharesIn > sSame) throw new CurveQuoteError("InsufficientShares");

  const sSameNew = sSame - sharesIn;
  const q = sSame * sSame + sOther * sOther;
  if (q === 0n) throw new CurveQuoteError("InsufficientLiquidity");
  const qNew = sSameNew * sSameNew + sOther * sOther;

  const x = mulDivCeil(r * r, qNew, q);
  const rMid = sqrtCeil(x);

  const grossOut = r - rMid;
  const feePaid = ceilDiv(grossOut * feeBps, BPS_DENOMINATOR);
  if (feePaid >= grossOut) throw new CurveQuoteError("ZeroAmount");

  return { collateralOut: grossOut - feePaid, newR: rMid + feePaid, newSSame: sSameNew, feePaid };
}

/** Inverts `quoteBuy`: finds the smallest `amountIn` that yields at least
 * `desiredSharesOut` against the given pool state. Derives a closed-form estimate
 * then self-corrects against the exact `quoteBuy` replica above (bounded loop) so
 * the result matches on-chain rounding exactly, not just the algebraic inverse. */
export function quoteAmountInForShares(
  r: bigint,
  sSame: bigint,
  sOther: bigint,
  desiredSharesOut: bigint,
  feeBps: bigint,
): bigint {
  if (desiredSharesOut <= 0n) throw new CurveQuoteError("ZeroAmount");
  if (feeBps >= BPS_DENOMINATOR) throw new CurveQuoteError("FeeTooHigh");

  const sSameNew = sSame + desiredSharesOut;
  const y = sSameNew * sSameNew + sOther * sOther;
  const q = sSame * sSame + sOther * sOther;
  const rSq = r * r;

  // Minimal rMid^2 (real-valued target) such that floor(q*rMid^2/r^2) >= y.
  const targetRSq = ceilDiv(y * rSq, q);
  const rMid = sqrtCeil(targetRSq);
  if (rMid <= r) throw new CurveQuoteError("ZeroAmount");
  const aNet = rMid - r;

  // Invert amountIn - ceil(amountIn*feeBps/10000) = aNet.
  let amountIn = ceilDiv(aNet * BPS_DENOMINATOR, BPS_DENOMINATOR - feeBps);

  for (let i = 0; i < 16; i++) {
    try {
      const { sharesOut } = quoteBuy(r, sSame, sOther, amountIn, feeBps);
      if (sharesOut >= desiredSharesOut) return amountIn;
    } catch {
      // fall through and keep nudging amountIn upward
    }
    amountIn += 1n;
  }
  return amountIn;
}
