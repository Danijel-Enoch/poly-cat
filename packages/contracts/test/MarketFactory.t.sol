// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

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

        MarketFactory implementation = new MarketFactory();
        ERC1967Proxy proxy =
            new ERC1967Proxy(address(implementation), abi.encodeCall(MarketFactory.initialize, (treasury)));
        factory = MarketFactory(address(proxy));

        closeTime = uint64(block.timestamp + 7 days);

        for (uint256 i = 0; i < 3; i++) {
            address user = i == 0 ? creator : i == 1 ? alice : bob;
            usdc.mint(user, 10_000_000e6);
            vm.prank(user);
            usdc.approve(address(factory), type(uint256).max);
            vm.deal(user, 1_000_000 ether);
        }
    }

    uint256 constant NATIVE_INITIAL_LIQUIDITY = 1_000 ether;

    function _createNativeMarket() internal returns (uint256 marketId) {
        MarketFactory.CreateMarketParams memory p = MarketFactory.CreateMarketParams({
            collateralToken: address(0),
            questionHash: keccak256("Will ETH flip BTC?"),
            metadataURI: "ipfs://example-eth",
            closeTime: closeTime,
            initialLiquidity: NATIVE_INITIAL_LIQUIDITY
        });
        vm.prank(creator);
        marketId = factory.createMarket{value: NATIVE_INITIAL_LIQUIDITY}(p);
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

    function test_Initialize_RevertsOnZeroTreasury() public {
        MarketFactory implementation = new MarketFactory();
        vm.expectRevert();
        new ERC1967Proxy(address(implementation), abi.encodeCall(MarketFactory.initialize, (address(0))));
    }

    function test_Initialize_RevertsIfCalledTwice() public {
        vm.expectRevert();
        factory.initialize(treasury);
    }

    function test_Implementation_CannotBeInitializedDirectly() public {
        MarketFactory implementation = new MarketFactory();
        vm.expectRevert();
        implementation.initialize(treasury);
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

    // ---------- creator fee share ----------

    function test_BuyShares_SplitsFeeBetweenTreasuryAndCreator() public {
        uint256 marketId = _createMarket();
        vm.prank(alice);
        factory.buyShares(marketId, true, 100e6, 0);

        MarketFactory.Market memory m = factory.getMarket(marketId);
        uint256 totalFee = m.collectedFees + m.creatorFees;
        assertGt(totalFee, 0);
        // 5% of the fee goes to the creator, 95% to the protocol.
        assertEq(m.creatorFees, (totalFee * factory.CREATOR_FEE_SHARE_BPS()) / 10_000);
        assertEq(m.collectedFees, totalFee - m.creatorFees);
    }

    function test_SellShares_SplitsFeeBetweenTreasuryAndCreator() public {
        uint256 marketId = _createMarket();
        vm.startPrank(alice);
        uint256 sharesOut = factory.buyShares(marketId, true, 100e6, 0);
        MarketFactory.Market memory beforeSell = factory.getMarket(marketId);
        factory.sellShares(marketId, true, sharesOut, 0);
        vm.stopPrank();

        MarketFactory.Market memory m = factory.getMarket(marketId);
        uint256 sellFee = (m.collectedFees + m.creatorFees) - (beforeSell.collectedFees + beforeSell.creatorFees);
        uint256 sellCreatorShare = m.creatorFees - beforeSell.creatorFees;
        assertEq(sellCreatorShare, (sellFee * factory.CREATOR_FEE_SHARE_BPS()) / 10_000);
    }

    function test_WithdrawCreatorFees_TransfersToCreatorAndResets() public {
        uint256 marketId = _createMarket();
        vm.prank(alice);
        factory.buyShares(marketId, true, 100e6, 0);

        MarketFactory.Market memory before = factory.getMarket(marketId);
        assertGt(before.creatorFees, 0);
        uint256 creatorBalBefore = usdc.balanceOf(creator);

        vm.prank(creator);
        factory.withdrawCreatorFees(marketId);

        MarketFactory.Market memory afterWithdraw = factory.getMarket(marketId);
        assertEq(afterWithdraw.creatorFees, 0);
        assertEq(usdc.balanceOf(creator), creatorBalBefore + before.creatorFees);
    }

    function test_WithdrawCreatorFees_RevertsIfNotCreator() public {
        uint256 marketId = _createMarket();
        vm.prank(alice);
        factory.buyShares(marketId, true, 100e6, 0);

        vm.prank(alice);
        vm.expectRevert(MarketFactory.NotCreator.selector);
        factory.withdrawCreatorFees(marketId);
    }

    function test_WithdrawCreatorFees_RevertsIfNoFees() public {
        uint256 marketId = _createMarket();
        vm.prank(creator);
        vm.expectRevert(MarketFactory.NoCreatorFeesToWithdraw.selector);
        factory.withdrawCreatorFees(marketId);
    }

    // ---------- escape hatch: extend / cancel / refund ----------

    function test_ExtendCloseTime_Success() public {
        uint256 marketId = _createMarket();
        uint64 newCloseTime = closeTime + 7 days;

        factory.extendCloseTime(marketId, newCloseTime);

        MarketFactory.Market memory m = factory.getMarket(marketId);
        assertEq(m.closeTime, newCloseTime);
    }

    function test_ExtendCloseTime_RevertsIfNotOwner() public {
        uint256 marketId = _createMarket();
        vm.prank(alice);
        vm.expectRevert();
        factory.extendCloseTime(marketId, closeTime + 1 days);
    }

    function test_ExtendCloseTime_RevertsIfNotTrading() public {
        uint256 marketId = _createMarket();
        vm.warp(closeTime);
        factory.settleMarket(marketId, true);

        vm.expectRevert(MarketFactory.MarketNotTrading.selector);
        factory.extendCloseTime(marketId, closeTime + 1 days);
    }

    function test_ExtendCloseTime_RevertsIfNotForward() public {
        uint256 marketId = _createMarket();
        vm.expectRevert(MarketFactory.CloseTimeNotExtended.selector);
        factory.extendCloseTime(marketId, closeTime);
    }

    function test_ExtendCloseTime_ReopensTrading() public {
        uint256 marketId = _createMarket();
        vm.warp(closeTime);

        vm.prank(alice);
        vm.expectRevert(MarketFactory.MarketClosed.selector);
        factory.buyShares(marketId, true, 100e6, 0);

        factory.extendCloseTime(marketId, closeTime + 7 days);

        vm.prank(alice);
        uint256 sharesOut = factory.buyShares(marketId, true, 100e6, 0);
        assertGt(sharesOut, 0);
    }

    function test_CancelMarket_Success() public {
        uint256 marketId = _createMarket();
        factory.cancelMarket(marketId);

        MarketFactory.Market memory m = factory.getMarket(marketId);
        assertEq(uint8(m.state), uint8(MarketFactory.MarketState.Cancelled));
    }

    function test_CancelMarket_CallableBeforeCloseTime() public {
        uint256 marketId = _createMarket();
        // Not warped past closeTime — cancellation isn't gated on it.
        factory.cancelMarket(marketId);
        MarketFactory.Market memory m = factory.getMarket(marketId);
        assertEq(uint8(m.state), uint8(MarketFactory.MarketState.Cancelled));
    }

    function test_CancelMarket_RevertsIfNotOwner() public {
        uint256 marketId = _createMarket();
        vm.prank(alice);
        vm.expectRevert();
        factory.cancelMarket(marketId);
    }

    function test_CancelMarket_RevertsIfAlreadyFinalized() public {
        uint256 marketId = _createMarket();
        vm.warp(closeTime);
        factory.settleMarket(marketId, true);

        vm.expectRevert(MarketFactory.MarketNotTrading.selector);
        factory.cancelMarket(marketId);
    }

    function test_CancelMarket_RevertsIfAlreadyCancelled() public {
        uint256 marketId = _createMarket();
        factory.cancelMarket(marketId);

        vm.expectRevert(MarketFactory.MarketNotTrading.selector);
        factory.cancelMarket(marketId);
    }

    function test_ClaimRefund_SingleHolder() public {
        uint256 marketId = _createMarket();
        vm.prank(alice);
        factory.buyShares(marketId, true, 200e6, 0);

        factory.cancelMarket(marketId);

        MarketFactory.Market memory m = factory.getMarket(marketId);
        uint256 balBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        uint256 payout = factory.claimRefund(marketId);

        // Sole holder of all outstanding shares gets the whole reserve.
        assertEq(payout, m.reserve);
        assertEq(usdc.balanceOf(alice), balBefore + m.reserve);
        assertEq(factory.shareBalanceOf(marketId, true, alice), 0);
    }

    function test_ClaimRefund_ProRataMultipleHolders() public {
        uint256 marketId = _createMarket();
        vm.prank(alice);
        uint256 aliceShares = factory.buyShares(marketId, true, 200e6, 0);
        vm.prank(bob);
        uint256 bobShares = factory.buyShares(marketId, false, 100e6, 0);

        factory.cancelMarket(marketId);
        MarketFactory.Market memory m = factory.getMarket(marketId);

        vm.prank(alice);
        uint256 alicePayout = factory.claimRefund(marketId);
        vm.prank(bob);
        uint256 bobPayout = factory.claimRefund(marketId);

        uint256 totalShares = (m.yesSupply - m.genesisSupply) + (m.noSupply - m.genesisSupply);
        assertEq(alicePayout, (m.reserve * aliceShares) / totalShares);
        assertEq(bobPayout, (m.reserve * bobShares) / totalShares);
        // Rounding is always down, so the sum can never exceed the reserve that backed it.
        assertLe(alicePayout + bobPayout, m.reserve);
    }

    function test_ClaimRefund_RevertsIfNotCancelled() public {
        uint256 marketId = _createMarket();
        vm.prank(alice);
        factory.buyShares(marketId, true, 100e6, 0);

        vm.prank(alice);
        vm.expectRevert(MarketFactory.MarketNotCancelled.selector);
        factory.claimRefund(marketId);
    }

    function test_ClaimRefund_RevertsIfNothingToClaim() public {
        uint256 marketId = _createMarket();
        factory.cancelMarket(marketId);

        vm.prank(alice);
        vm.expectRevert(MarketFactory.NothingToRefund.selector);
        factory.claimRefund(marketId);
    }

    function test_ClaimRefund_RevertsOnDoubleClaim() public {
        uint256 marketId = _createMarket();
        vm.prank(alice);
        factory.buyShares(marketId, true, 100e6, 0);
        factory.cancelMarket(marketId);

        vm.startPrank(alice);
        factory.claimRefund(marketId);
        vm.expectRevert(MarketFactory.NothingToRefund.selector);
        factory.claimRefund(marketId);
        vm.stopPrank();
    }

    // ---------- native ETH collateral ----------

    function test_CreateMarket_Native_Success() public {
        uint256 creatorBalBefore = creator.balance;
        uint256 marketId = _createNativeMarket();

        MarketFactory.Market memory m = factory.getMarket(marketId);
        assertEq(address(m.collateralToken), address(0));
        assertEq(m.reserve, NATIVE_INITIAL_LIQUIDITY);
        assertEq(creator.balance, creatorBalBefore - NATIVE_INITIAL_LIQUIDITY);
        assertEq(address(factory).balance, NATIVE_INITIAL_LIQUIDITY);
    }

    function test_CreateMarket_Native_RevertsIfValueMismatch() public {
        MarketFactory.CreateMarketParams memory p = MarketFactory.CreateMarketParams({
            collateralToken: address(0),
            questionHash: keccak256("x"),
            metadataURI: "",
            closeTime: closeTime,
            initialLiquidity: NATIVE_INITIAL_LIQUIDITY
        });
        vm.prank(creator);
        vm.expectRevert(MarketFactory.EthAmountMismatch.selector);
        factory.createMarket{value: NATIVE_INITIAL_LIQUIDITY - 1}(p);
    }

    function test_CreateMarket_RevertsIfEthSentToErc20Market() public {
        MarketFactory.CreateMarketParams memory p = MarketFactory.CreateMarketParams({
            collateralToken: address(usdc),
            questionHash: keccak256("x"),
            metadataURI: "",
            closeTime: closeTime,
            initialLiquidity: INITIAL_LIQUIDITY
        });
        vm.prank(creator);
        vm.expectRevert(MarketFactory.UnexpectedEthValue.selector);
        factory.createMarket{value: 1 ether}(p);
    }

    function test_BuyShares_Native_Success() public {
        uint256 marketId = _createNativeMarket();
        uint256 aliceBalBefore = alice.balance;

        vm.prank(alice);
        uint256 sharesOut = factory.buyShares{value: 100 ether}(marketId, true, 100 ether, 0);

        assertGt(sharesOut, 0);
        assertEq(alice.balance, aliceBalBefore - 100 ether);
        assertEq(address(factory).balance, NATIVE_INITIAL_LIQUIDITY + 100 ether);
    }

    function test_BuyShares_Native_RevertsIfValueMismatch() public {
        uint256 marketId = _createNativeMarket();
        vm.prank(alice);
        vm.expectRevert(MarketFactory.EthAmountMismatch.selector);
        factory.buyShares{value: 50 ether}(marketId, true, 100 ether, 0);
    }

    function test_BuyShares_RevertsIfEthSentToErc20Market() public {
        uint256 marketId = _createMarket();
        vm.prank(alice);
        vm.expectRevert(MarketFactory.UnexpectedEthValue.selector);
        factory.buyShares{value: 1 ether}(marketId, true, 100e6, 0);
    }

    function test_SellShares_Native_PaysOutEth() public {
        uint256 marketId = _createNativeMarket();

        vm.startPrank(alice);
        uint256 sharesOut = factory.buyShares{value: 100 ether}(marketId, true, 100 ether, 0);
        uint256 balBefore = alice.balance;
        uint256 collateralOut = factory.sellShares(marketId, true, sharesOut, 0);
        vm.stopPrank();

        assertGt(collateralOut, 0);
        assertEq(alice.balance, balBefore + collateralOut);
    }

    function test_Redeem_Native_PaysOutEth() public {
        uint256 marketId = _createNativeMarket();

        vm.prank(alice);
        uint256 aliceShares = factory.buyShares{value: 200 ether}(marketId, true, 200 ether, 0);

        vm.warp(closeTime);
        factory.settleMarket(marketId, true);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        uint256 payout = factory.redeem(marketId);

        assertEq(payout, aliceShares);
        assertEq(alice.balance, balBefore + aliceShares);
    }

    function test_WithdrawFees_Native() public {
        uint256 marketId = _createNativeMarket();
        vm.prank(alice);
        factory.buyShares{value: 100 ether}(marketId, true, 100 ether, 0);

        MarketFactory.Market memory before = factory.getMarket(marketId);
        assertGt(before.collectedFees, 0);
        uint256 treasuryBalBefore = treasury.balance;

        factory.withdrawFees(marketId);

        assertEq(treasury.balance, treasuryBalBefore + before.collectedFees);
    }

    function test_WithdrawCreatorFees_Native() public {
        uint256 marketId = _createNativeMarket();
        vm.prank(alice);
        factory.buyShares{value: 100 ether}(marketId, true, 100 ether, 0);

        MarketFactory.Market memory before = factory.getMarket(marketId);
        assertGt(before.creatorFees, 0);
        uint256 creatorBalBefore = creator.balance;

        vm.prank(creator);
        factory.withdrawCreatorFees(marketId);

        assertEq(creator.balance, creatorBalBefore + before.creatorFees);
    }

    function test_ClaimRefund_Native() public {
        uint256 marketId = _createNativeMarket();
        vm.prank(alice);
        factory.buyShares{value: 200 ether}(marketId, true, 200 ether, 0);

        factory.cancelMarket(marketId);
        MarketFactory.Market memory m = factory.getMarket(marketId);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        uint256 payout = factory.claimRefund(marketId);

        assertEq(payout, m.reserve);
        assertEq(alice.balance, balBefore + m.reserve);
    }

    // ---------- UUPS upgradeability ----------

    function test_UpgradeToAndCall_RevertsIfNotOwner() public {
        MarketFactoryV2Mock v2 = new MarketFactoryV2Mock();
        vm.prank(alice);
        vm.expectRevert();
        factory.upgradeToAndCall(address(v2), "");
    }

    function test_UpgradeToAndCall_SucceedsForOwnerAndPreservesState() public {
        uint256 marketId = _createMarket();
        vm.prank(alice);
        factory.buyShares(marketId, true, 100e6, 0);
        MarketFactory.Market memory before = factory.getMarket(marketId);

        MarketFactoryV2Mock v2 = new MarketFactoryV2Mock();
        factory.upgradeToAndCall(address(v2), "");

        MarketFactory.Market memory afterUpgrade = factory.getMarket(marketId);
        assertEq(afterUpgrade.reserve, before.reserve);
        assertEq(afterUpgrade.creator, before.creator);
        assertEq(afterUpgrade.yesSupply, before.yesSupply);
        assertEq(afterUpgrade.noSupply, before.noSupply);
        assertEq(afterUpgrade.collectedFees, before.collectedFees);
        assertEq(afterUpgrade.creatorFees, before.creatorFees);

        assertEq(MarketFactoryV2Mock(address(factory)).version(), 2);
    }
}

/// @dev Minimal upgrade target used only to test the UUPS upgrade path.
contract MarketFactoryV2Mock is MarketFactory {
    function version() external pure returns (uint256) {
        return 2;
    }
}
