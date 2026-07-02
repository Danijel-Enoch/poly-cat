// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Pythagorean bonding curve for a binary outcome market, matching the
/// PNP Exchange / Azuro-style AMM design: `reserve = c * sqrt(yesSupply^2 +
/// noSupply^2)`, where `c` starts at 1 and is monotonically non-decreasing (fees
/// are added directly to `reserve` without minting supply, which is the only thing
/// that grows `c`). This gives marginal prices satisfying
/// `price(yes)^2 + price(no)^2 == c^2`.
///
/// Every rounding direction below is chosen to preserve the solvency invariant
/// `reserve^2 >= yesSupply^2 + noSupply^2` (equivalently `c >= 1`) through every
/// operation: buy path rounds floor-of-floor (under-mints shares to the trader),
/// sell path rounds ceil-of-ceil (over-retains reserve in the pool). Combined with
/// `sqrt(a^2+b^2) >= max(a,b)`, this guarantees `reserve >= max(yesSupply,
/// noSupply)` always, so 1:1 redemption of the winning side can never be
/// under-collateralized.
library PythagoreanMath {
    uint256 internal constant WAD = 1e18;
    // Round-UP 18-decimal representation of sqrt(2). This direction is required:
    // an over-approximation of sqrt(2) makes genesis seeding under-mint supply
    // relative to the true curve, which is exactly what keeps c >= 1 from the very
    // first block. Do not "simplify" this to a truncated constant.
    uint256 internal constant SQRT2_WAD = 1414213562373095049;
    uint256 internal constant BPS_DENOMINATOR = 10_000;

    error ZeroAmount();
    error InsufficientLiquidity();
    error InsufficientShares();

    /// @notice Seed genesis supply for an initial liquidity deposit of `initialLiquidity`.
    /// Returns `s0` such that `yesSupply = noSupply = s0` and `reserve = initialLiquidity`.
    function seedGenesis(uint256 initialLiquidity) internal pure returns (uint256 s0) {
        s0 = Math.mulDiv(initialLiquidity, WAD, SQRT2_WAD);
        if (s0 == 0) revert InsufficientLiquidity();
    }

    /// @notice Quote buying shares of one outcome (`sSame`) by depositing `amountIn`
    /// collateral. `sOther` (the opposite outcome's supply) is untouched.
    function quoteBuy(uint256 r, uint256 sSame, uint256 sOther, uint256 amountIn, uint16 feeBps)
        internal
        pure
        returns (uint256 sharesOut, uint256 newR, uint256 newSSame, uint256 feePaid)
    {
        if (amountIn == 0) revert ZeroAmount();
        if (r == 0 || (sSame == 0 && sOther == 0)) revert InsufficientLiquidity();

        feePaid = Math.ceilDiv(amountIn * feeBps, BPS_DENOMINATOR);
        uint256 aNet = amountIn - feePaid;
        uint256 rMid = r + aNet;

        uint256 q = sSame * sSame + sOther * sOther;
        // Holding c fixed across the reserve top-up: sSameNew^2 + sOther^2 == q * rMid^2 / r^2.
        uint256 y = Math.mulDiv(q, rMid * rMid, r * r); // floor
        uint256 z = y - sOther * sOther; // proven >= sSame^2, never underflows
        uint256 sSameNew = Math.sqrt(z); // floor

        if (sSameNew <= sSame) revert ZeroAmount();
        sharesOut = sSameNew - sSame;
        newR = rMid + feePaid; // == r + amountIn exactly
        newSSame = sSameNew;
    }

    /// @notice Quote selling `sharesIn` of one outcome (`sSame`) back to the pool.
    function quoteSell(uint256 r, uint256 sSame, uint256 sOther, uint256 sharesIn, uint16 feeBps)
        internal
        pure
        returns (uint256 collateralOut, uint256 newR, uint256 newSSame, uint256 feePaid)
    {
        if (sharesIn == 0) revert ZeroAmount();
        if (sharesIn > sSame) revert InsufficientShares();

        uint256 sSameNew = sSame - sharesIn;
        uint256 q = sSame * sSame + sOther * sOther;
        if (q == 0) revert InsufficientLiquidity();
        uint256 qNew = sSameNew * sSameNew + sOther * sOther;

        // Holding c fixed across the reserve draw-down: rMid^2 == r^2 * qNew / q.
        uint256 x = Math.mulDiv(r * r, qNew, q, Math.Rounding.Ceil);
        uint256 rMid = Math.sqrt(x, Math.Rounding.Ceil);

        uint256 grossOut = r - rMid; // proven >= 0 since qNew <= q
        feePaid = Math.ceilDiv(grossOut * feeBps, BPS_DENOMINATOR);
        if (feePaid >= grossOut) revert ZeroAmount();
        collateralOut = grossOut - feePaid;

        newR = rMid + feePaid;
        newSSame = sSameNew;
    }

    /// @notice Display-only implied probability in WAD (1e18), derived purely from
    /// supplies so it stays exact and independent of accrued-fee drift in `c`.
    /// NEVER used for settlement — only the admin's `settleMarket` call determines
    /// the true outcome.
    function probabilityWad(uint256 sSame, uint256 sOther) internal pure returns (uint256) {
        uint256 q = sSame * sSame + sOther * sOther;
        if (q == 0) return WAD / 2;
        return Math.mulDiv(sSame * sSame, WAD, q);
    }
}
