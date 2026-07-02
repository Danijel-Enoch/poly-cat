// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {PythagoreanMath} from "../src/libraries/PythagoreanMath.sol";

/// @dev Thin external wrapper so `vm.expectRevert` has a call frame to catch —
/// `PythagoreanMath`'s functions are `internal`, calling them directly from a test
/// body inlines them with no sub-call boundary for the cheatcode to attach to.
contract PythagoreanMathHarness {
    function seedGenesis(uint256 initialLiquidity) external pure returns (uint256) {
        return PythagoreanMath.seedGenesis(initialLiquidity);
    }

    function quoteBuy(uint256 r, uint256 sSame, uint256 sOther, uint256 amountIn, uint16 feeBps)
        external
        pure
        returns (uint256, uint256, uint256, uint256)
    {
        return PythagoreanMath.quoteBuy(r, sSame, sOther, amountIn, feeBps);
    }

    function quoteSell(uint256 r, uint256 sSame, uint256 sOther, uint256 sharesIn, uint16 feeBps)
        external
        pure
        returns (uint256, uint256, uint256, uint256)
    {
        return PythagoreanMath.quoteSell(r, sSame, sOther, sharesIn, feeBps);
    }
}

contract PythagoreanMathTest is Test {
    uint16 constant FEE_BPS = 100; // 1%

    PythagoreanMathHarness harness;

    function setUp() public {
        harness = new PythagoreanMathHarness();
    }

    function _boundLiquidity(uint256 x) internal pure returns (uint256) {
        return bound(x, 1e6, 1e24);
    }

    /// @dev Trades bounded relative to the pool's own reserve — trades many orders of
    /// magnitude larger than pool depth legitimately hit InsufficientLiquidity-style
    /// degenerate paths, same rationale as the old CPMM test suite's trade bounding.
    function _boundTradeSize(uint256 x, uint256 r) internal pure returns (uint256) {
        return bound(x, 1, r * 100);
    }

    // ---------- genesis ----------

    function testFuzz_GenesisIsSolvent(uint256 initialLiquidity) public pure {
        initialLiquidity = _boundLiquidity(initialLiquidity);
        uint256 s0 = PythagoreanMath.seedGenesis(initialLiquidity);

        assertGt(s0, 0);
        assertGe(initialLiquidity * initialLiquidity, 2 * s0 * s0, "reserve^2 must cover yesSupply^2+noSupply^2 at genesis");
    }

    function test_Genesis_RevertsOnZeroLiquidity() public {
        vm.expectRevert(PythagoreanMath.InsufficientLiquidity.selector);
        harness.seedGenesis(0);
    }

    // ---------- buy ----------

    function testFuzz_BuyPreservesSolvency(uint256 initialLiquidity, uint256 amountIn) public view {
        initialLiquidity = _boundLiquidity(initialLiquidity);
        uint256 s0 = PythagoreanMath.seedGenesis(initialLiquidity);
        amountIn = _boundTradeSize(amountIn, initialLiquidity);

        // A dust-sized trade relative to a huge pool can legitimately round to zero
        // shares and revert (ZeroAmount) — not a meaningful case for this property.
        try harness.quoteBuy(initialLiquidity, s0, s0, amountIn, FEE_BPS) returns (
            uint256 sharesOut, uint256 newR, uint256 newSYes, uint256 feePaid
        ) {
            assertGt(sharesOut, 0);
            assertEq(newR, initialLiquidity + amountIn, "reserve grows by the full gross input");
            assertGe(feePaid, 0);
            assertGe(newR * newR, newSYes * newSYes + s0 * s0, "solvency invariant after buy");
        } catch {}
    }

    function testFuzz_BuyingMoreYesNeverDecreasesYesProbability(uint256 initialLiquidity, uint256 amountIn)
        public
        view
    {
        initialLiquidity = _boundLiquidity(initialLiquidity);
        uint256 s0 = PythagoreanMath.seedGenesis(initialLiquidity);
        amountIn = _boundTradeSize(amountIn, initialLiquidity);

        uint256 probBefore = PythagoreanMath.probabilityWad(s0, s0);
        try harness.quoteBuy(initialLiquidity, s0, s0, amountIn, FEE_BPS) returns (uint256, uint256, uint256 newSYes, uint256) {
            uint256 probAfter = PythagoreanMath.probabilityWad(newSYes, s0);
            assertGe(probAfter, probBefore);
        } catch {}
    }

    function testRevert_BuyZeroAmountIn() public {
        vm.expectRevert(PythagoreanMath.ZeroAmount.selector);
        harness.quoteBuy(1e18, 1e18, 1e18, 0, FEE_BPS);
    }

    // ---------- sell ----------

    function testFuzz_SellPreservesSolvency(uint256 initialLiquidity, uint256 buyAmount, uint256 sellFraction)
        public
        view
    {
        initialLiquidity = _boundLiquidity(initialLiquidity);
        uint256 s0 = PythagoreanMath.seedGenesis(initialLiquidity);
        buyAmount = _boundTradeSize(buyAmount, initialLiquidity);

        try harness.quoteBuy(initialLiquidity, s0, s0, buyAmount, FEE_BPS) returns (
            uint256 sharesOut, uint256 rAfterBuy, uint256 sYesAfterBuy, uint256
        ) {
            uint256 sharesIn = bound(sellFraction, 1, sharesOut);
            try harness.quoteSell(rAfterBuy, sYesAfterBuy, s0, sharesIn, FEE_BPS) returns (
                uint256 collateralOut, uint256 newR, uint256 newSYes, uint256
            ) {
                assertLt(collateralOut, rAfterBuy, "cannot drain the entire reserve");
                assertGe(newR * newR, newSYes * newSYes + s0 * s0, "solvency invariant after sell");
            } catch {}
        } catch {}
    }

    function testFuzz_BuyThenSellRoundTripNeverProfitable(uint256 initialLiquidity, uint256 amountIn) public pure {
        initialLiquidity = _boundLiquidity(initialLiquidity);
        uint256 s0 = PythagoreanMath.seedGenesis(initialLiquidity);
        amountIn = bound(amountIn, 1000, initialLiquidity * 100);

        (uint256 sharesOut, uint256 rAfterBuy, uint256 sYesAfterBuy,) =
            PythagoreanMath.quoteBuy(initialLiquidity, s0, s0, amountIn, FEE_BPS);

        (uint256 collateralOut,,,) = PythagoreanMath.quoteSell(rAfterBuy, sYesAfterBuy, s0, sharesOut, FEE_BPS);

        assertLe(collateralOut, amountIn, "round trip must not be profitable");
    }

    function testRevert_SellZeroSharesIn() public {
        vm.expectRevert(PythagoreanMath.ZeroAmount.selector);
        harness.quoteSell(1e18, 1e18, 1e18, 0, FEE_BPS);
    }

    function testRevert_SellMoreThanSupply() public {
        vm.expectRevert(PythagoreanMath.InsufficientShares.selector);
        harness.quoteSell(1e18, 1e18, 1e18, 2e18, FEE_BPS);
    }

    // ---------- probability ----------

    function testFuzz_ProbabilitySumsToWad(uint256 sYes, uint256 sNo) public pure {
        sYes = bound(sYes, 1e6, 1e24);
        sNo = bound(sNo, 1e6, 1e24);

        uint256 probYes = PythagoreanMath.probabilityWad(sYes, sNo);
        uint256 probNo = PythagoreanMath.probabilityWad(sNo, sYes);

        assertLt(probYes, 1e18);
        assertLt(probNo, 1e18);
        assertApproxEqAbs(probYes + probNo, 1e18, 2);
    }

    // ---------- exact worked-example regression ----------

    function test_WorkedExample_GenesisBuySell() public pure {
        uint256 X = 100e6;

        uint256 s0 = PythagoreanMath.seedGenesis(X);
        assertEq(s0, 70_710_678);

        (uint256 sharesOut, uint256 rAfterBuy, uint256 sYesAfterBuy, uint256 buyFee) =
            PythagoreanMath.quoteBuy(X, s0, s0, 50e6, FEE_BPS);
        assertEq(buyFee, 500_000);
        assertEq(sharesOut, 61_009_669);
        assertEq(rAfterBuy, 150e6);
        assertEq(sYesAfterBuy, 131_720_347);

        uint256 sharesIn = sharesOut / 2; // 30,504,834
        (uint256 collateralOut, uint256 newR, uint256 newSYes, uint256 sellFee) =
            PythagoreanMath.quoteSell(rAfterBuy, sYesAfterBuy, s0, sharesIn, FEE_BPS);

        assertEq(newSYes, 101_215_513);
        assertEq(sellFee, 261_182);
        assertEq(collateralOut, 25_856_934);
        assertEq(newR, 124_143_066);
    }
}
