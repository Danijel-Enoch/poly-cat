// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";

import {MarketFactory} from "../src/MarketFactory.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract MarketFactoryTest is Test {
    MarketFactory factory;
    MockUSDC usdc;

    address treasury = makeAddr("treasury");
    address creator = makeAddr("creator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant INITIAL_LIQUIDITY = 1_000e6;
    uint64 closeTime;

    function setUp() public {
        usdc = new MockUSDC();
        factory = new MarketFactory(treasury);

        closeTime = uint64(block.timestamp + 7 days);

        for (uint256 i = 0; i < 3; i++) {
            address user = i == 0 ? creator : i == 1 ? alice : bob;
            usdc.mint(user, 10_000_000e6);
            vm.prank(user);
            usdc.approve(address(factory), type(uint256).max);
        }
    }

    function _createMarket() internal returns (uint256 marketId) {
        MarketFactory.CreateMarketParams memory p = MarketFactory.CreateMarketParams({
            collateralToken: address(usdc),
            questionHash: keccak256("Will it rain tomorrow?"),
            metadataURI: "ipfs://example",
            closeTime: closeTime,
            initialLiquidity: INITIAL_LIQUIDITY
        });
        vm.prank(creator);
        marketId = factory.createMarket(p);
    }

    function test_Constructor_RevertsOnZeroTreasury() public {
        vm.expectRevert();
        new MarketFactory(address(0));
    }

    // ---------- createMarket ----------

    function test_CreateMarket_SeedsCurveAndPullsLiquidity() public {
        uint256 creatorBalBefore = usdc.balanceOf(creator);
        uint256 marketId = _createMarket();

        MarketFactory.Market memory m = factory.getMarket(marketId);
        assertEq(m.reserve, INITIAL_LIQUIDITY);
        assertEq(m.yesSupply, m.noSupply);
        assertGt(m.yesSupply, 0);
        assertEq(uint8(m.state), uint8(MarketFactory.MarketState.Trading));
        assertEq(usdc.balanceOf(creator), creatorBalBefore - INITIAL_LIQUIDITY);
        assertEq(usdc.balanceOf(address(factory)), INITIAL_LIQUIDITY);
    }

    function test_CreateMarket_RevertsIfCloseTimeTooSoon() public {
        MarketFactory.CreateMarketParams memory p = MarketFactory.CreateMarketParams({
            collateralToken: address(usdc),
            questionHash: keccak256("x"),
            metadataURI: "",
            closeTime: uint64(block.timestamp + 1),
            initialLiquidity: INITIAL_LIQUIDITY
        });
        vm.expectRevert(MarketFactory.CloseTimeTooSoon.selector);
        factory.createMarket(p);
    }

    function test_CreateMarket_RevertsIfLiquidityTooLow() public {
        MarketFactory.CreateMarketParams memory p = MarketFactory.CreateMarketParams({
            collateralToken: address(usdc),
            questionHash: keccak256("x"),
            metadataURI: "",
            closeTime: closeTime,
            initialLiquidity: 1
        });
        vm.expectRevert(MarketFactory.LiquidityTooLow.selector);
        factory.createMarket(p);
    }

    function test_CreateMarket_RevertsIfCollateralNotAContract() public {
        MarketFactory.CreateMarketParams memory p = MarketFactory.CreateMarketParams({
            collateralToken: address(0xdead),
            questionHash: keccak256("x"),
            metadataURI: "",
            closeTime: closeTime,
            initialLiquidity: INITIAL_LIQUIDITY
        });
        vm.expectRevert(MarketFactory.NotAContract.selector);
        factory.createMarket(p);
    }

    // ---------- admin-controlled protocol fee ----------

    function test_DefaultFeeBpsIsOnePercent() public view {
        assertEq(factory.feeBps(), 100);
    }

    function test_SetFeeBps_UpdatesFeeAndAppliesToTrades() public {
        factory.setFeeBps(500); // 5%
        assertEq(factory.feeBps(), 500);

        uint256 marketId = _createMarket();
        vm.prank(alice);
        factory.buyShares(marketId, true, 100e6, 0);

        MarketFactory.Market memory m = factory.getMarket(marketId);
        // At 5% fee on a 100e6 input, fee should be materially larger than the 1% default.
        assertGt(m.collectedFees, 4e6);
    }

    function test_SetFeeBps_RevertsIfTooHigh() public {
        vm.expectRevert(MarketFactory.FeeTooHigh.selector);
        factory.setFeeBps(501);
    }

    function test_SetFeeBps_RevertsIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        factory.setFeeBps(200);
    }

    // ---------- trading ----------

    function test_BuyShares_IncreasesSupplyAndCreditsBalance() public {
        uint256 marketId = _createMarket();

        vm.prank(alice);
        uint256 sharesOut = factory.buyShares(marketId, true, 100e6, 0);

        assertGt(sharesOut, 0);
        assertEq(factory.shareBalanceOf(marketId, true, alice), sharesOut);

        MarketFactory.Market memory m = factory.getMarket(marketId);
        assertGt(m.collectedFees, 0);
        assertEq(m.reserve, INITIAL_LIQUIDITY + 100e6);
    }

    function test_BuyShares_RevertsOnSlippage() public {
        uint256 marketId = _createMarket();

        vm.prank(alice);
        vm.expectRevert(MarketFactory.SlippageExceeded.selector);
        factory.buyShares(marketId, true, 100e6, type(uint256).max);
    }

    function test_BuyShares_RevertsAfterClose() public {
        uint256 marketId = _createMarket();
        vm.warp(closeTime);

        vm.prank(alice);
        vm.expectRevert(MarketFactory.MarketClosed.selector);
        factory.buyShares(marketId, true, 100e6, 0);
    }

    function test_SellShares_RoundTripLosesToFees() public {
        uint256 marketId = _createMarket();

        vm.startPrank(alice);
        uint256 sharesOut = factory.buyShares(marketId, true, 100e6, 0);
        uint256 collateralOut = factory.sellShares(marketId, true, sharesOut, 0);
        vm.stopPrank();

        assertLt(collateralOut, 100e6, "fees + rounding must cost the trader");
    }

    function test_SellShares_RevertsIfInsufficientBalance() public {
        uint256 marketId = _createMarket();

        vm.prank(alice);
        vm.expectRevert(MarketFactory.InsufficientShareBalance.selector);
        factory.sellShares(marketId, true, 1e6, 0);
    }

    // ---------- admin settlement + redemption ----------

    function test_FullLifecycle_AdminSettleAndRedeem() public {
        uint256 marketId = _createMarket();

        vm.prank(alice);
        uint256 aliceShares = factory.buyShares(marketId, true, 200e6, 0);
        vm.prank(bob);
        factory.buyShares(marketId, false, 100e6, 0);

        vm.warp(closeTime);
        factory.settleMarket(marketId, true);

        MarketFactory.Market memory m = factory.getMarket(marketId);
        assertEq(uint8(m.state), uint8(MarketFactory.MarketState.Finalized));
        assertTrue(m.outcome);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        uint256 payout = factory.redeem(marketId);

        assertEq(payout, aliceShares);
        assertEq(usdc.balanceOf(alice), balBefore + aliceShares);

        // Bob held only NO shares (losing side) — nothing to redeem.
        vm.prank(bob);
        vm.expectRevert(MarketFactory.NothingToRedeem.selector);
        factory.redeem(marketId);
    }

    function test_SettleMarket_RevertsIfNotOwner() public {
        uint256 marketId = _createMarket();
        vm.warp(closeTime);

        vm.prank(alice);
        vm.expectRevert();
        factory.settleMarket(marketId, true);
    }

    function test_SettleMarket_RevertsIfNotClosed() public {
        uint256 marketId = _createMarket();

        vm.expectRevert(MarketFactory.SettlementNotOpen.selector);
        factory.settleMarket(marketId, true);
    }

    function test_SettleMarket_RevertsIfAlreadyFinalized() public {
        uint256 marketId = _createMarket();
        vm.warp(closeTime);
        factory.settleMarket(marketId, true);

        vm.expectRevert(MarketFactory.AlreadyResolved.selector);
        factory.settleMarket(marketId, false);
    }

    function test_Redeem_RevertsBeforeFinalized() public {
        uint256 marketId = _createMarket();
        vm.prank(alice);
        vm.expectRevert(MarketFactory.MarketNotFinalized.selector);
        factory.redeem(marketId);
    }

    function test_BuyShares_RevertsIfMarketAlreadyFinalized() public {
        uint256 marketId = _createMarket();
        vm.warp(closeTime);
        factory.settleMarket(marketId, true);

        vm.prank(bob);
        vm.expectRevert(MarketFactory.MarketNotTrading.selector);
        factory.buyShares(marketId, true, 100e6, 0);
    }

    function test_BuyShares_RevertsOnZeroAmount() public {
        uint256 marketId = _createMarket();
        vm.prank(alice);
        vm.expectRevert(MarketFactory.ZeroAmount.selector);
        factory.buyShares(marketId, true, 0, 0);
    }

    function test_SellShares_RevertsOnZeroAmount() public {
        uint256 marketId = _createMarket();
        vm.prank(alice);
        vm.expectRevert(MarketFactory.ZeroAmount.selector);
        factory.sellShares(marketId, true, 0, 0);
    }

    function test_SellShares_RevertsOnSlippage() public {
        uint256 marketId = _createMarket();
        vm.startPrank(alice);
        uint256 sharesOut = factory.buyShares(marketId, true, 100e6, 0);
        vm.expectRevert(MarketFactory.SlippageExceeded.selector);
        factory.sellShares(marketId, true, sharesOut, type(uint256).max);
        vm.stopPrank();
    }

    // ---------- probability ----------

    function test_GetProbability_IsFiftyFiftyAtGenesis() public {
        uint256 marketId = _createMarket();
        (uint256 yesProb, uint256 noProb) = factory.getProbability(marketId);
        assertApproxEqAbs(yesProb, 0.5e18, 1e10);
        assertApproxEqAbs(noProb, 0.5e18, 1e10);
    }

    function test_GetProbability_ShiftsAfterBuy() public {
        uint256 marketId = _createMarket();
        vm.prank(alice);
        factory.buyShares(marketId, true, 500e6, 0);

        (uint256 yesProb,) = factory.getProbability(marketId);
        assertGt(yesProb, 0.5e18);
    }

    // ---------- fees ----------

    function test_WithdrawFees_TransfersToTreasuryAndResets() public {
        uint256 marketId = _createMarket();
        vm.prank(alice);
        factory.buyShares(marketId, true, 100e6, 0);

        MarketFactory.Market memory before = factory.getMarket(marketId);
        assertGt(before.collectedFees, 0);

        factory.withdrawFees(marketId);

        MarketFactory.Market memory afterWithdraw = factory.getMarket(marketId);
        assertEq(afterWithdraw.collectedFees, 0);
        assertEq(usdc.balanceOf(treasury), before.collectedFees);
    }

    function test_WithdrawFees_RevertsIfNotOwner() public {
        uint256 marketId = _createMarket();
        vm.prank(alice);
        vm.expectRevert();
        factory.withdrawFees(marketId);
    }

    function test_WithdrawFees_RevertsIfNoFees() public {
        uint256 marketId = _createMarket();
        vm.expectRevert(MarketFactory.NoFeesToWithdraw.selector);
        factory.withdrawFees(marketId);
    }

    function test_SetProtocolTreasury_RevertsOnZeroAddress() public {
        vm.expectRevert();
        factory.setProtocolTreasury(address(0));
    }

    function test_SetProtocolTreasury_UpdatesTreasury() public {
        address newTreasury = makeAddr("newTreasury");
        factory.setProtocolTreasury(newTreasury);
        assertEq(factory.protocolTreasury(), newTreasury);
    }
}
