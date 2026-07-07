// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {MarketFactory} from "../src/MarketFactory.sol";

contract MarketFactoryTest is Test {
    MarketFactory factory;

    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant INITIAL_LIQUIDITY = 0.3 ether;
    uint256 constant START_PRICE_WAD = 50_000e18;
    uint256 constant UP_CLOSE_PRICE_WAD = 55_000e18;
    uint256 constant DOWN_CLOSE_PRICE_WAD = 45_000e18;

    uint256 btcAssetId;
    uint256 cashcatAssetId;
    uint64 startTime;
    uint64 closeTime;

    function setUp() public {
        MarketFactory implementation = new MarketFactory();
        ERC1967Proxy proxy =
            new ERC1967Proxy(address(implementation), abi.encodeCall(MarketFactory.initialize, (treasury)));
        factory = MarketFactory(address(proxy));

        // The test contract itself is the owner (it deployed the proxy) — the
        // account registerAsset/createMarket/settlement calls act as unless
        // pranked, and the account new markets' seed liquidity is sent from.
        btcAssetId = factory.registerAsset("BTC", MarketFactory.PriceSource.Gate, "BTC_USDT");
        cashcatAssetId = factory.registerAsset(
            "CASHCAT", MarketFactory.PriceSource.DexScreener, "0xa70fc67c9f69da90b63a0e4c05d229954574e313"
        );

        startTime = uint64(block.timestamp);
        closeTime = uint64(block.timestamp + 7 days);

        vm.deal(address(this), 1000 ether);
        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);
    }

    function _createMarket() internal returns (uint256 marketId) {
        marketId = factory.createMarket{value: factory.defaultInitialLiquidity()}(
            btcAssetId, startTime, closeTime, START_PRICE_WAD
        );
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

    // ---------- registerAsset ----------

    function test_RegisterAsset_StoresInfoAndIncrementsId() public {
        uint256 assetId = factory.registerAsset("ETH", MarketFactory.PriceSource.Gate, "ETH_USDT");
        assertEq(assetId, 2); // BTC=0, CASHCAT=1 already registered in setUp

        MarketFactory.AssetInfo memory info = factory.getAsset(assetId);
        assertEq(info.symbol, "ETH");
        assertEq(uint8(info.source), uint8(MarketFactory.PriceSource.Gate));
        assertEq(info.sourceId, "ETH_USDT");
        assertEq(factory.nextAssetId(), 3);
    }

    function test_RegisterAsset_DexScreenerSource() public view {
        MarketFactory.AssetInfo memory info = factory.getAsset(cashcatAssetId);
        assertEq(info.symbol, "CASHCAT");
        assertEq(uint8(info.source), uint8(MarketFactory.PriceSource.DexScreener));
        assertEq(info.sourceId, "0xa70fc67c9f69da90b63a0e4c05d229954574e313");
    }

    function test_RegisterAsset_RevertsOnEmptySymbol() public {
        vm.expectRevert(MarketFactory.InvalidAsset.selector);
        factory.registerAsset("", MarketFactory.PriceSource.Gate, "ETH_USDT");
    }

    function test_RegisterAsset_RevertsOnEmptySourceId() public {
        vm.expectRevert(MarketFactory.InvalidAsset.selector);
        factory.registerAsset("ETH", MarketFactory.PriceSource.Gate, "");
    }

    function test_RegisterAsset_RevertsIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        factory.registerAsset("ETH", MarketFactory.PriceSource.Gate, "ETH_USDT");
    }

    // ---------- createMarket ----------

    function test_CreateMarket_SeedsCurveAndPullsLiquidityFromOwner() public {
        uint256 ownerBalBefore = address(this).balance;
        uint256 marketId = _createMarket();

        MarketFactory.Market memory m = factory.getMarket(marketId);
        assertEq(m.assetId, btcAssetId);
        assertEq(m.reserve, INITIAL_LIQUIDITY);
        assertEq(m.upSupply, m.downSupply);
        assertGt(m.upSupply, 0);
        assertEq(m.startPriceWad, START_PRICE_WAD);
        assertEq(uint8(m.state), uint8(MarketFactory.MarketState.Trading));
        assertEq(address(this).balance, ownerBalBefore - INITIAL_LIQUIDITY);
        assertEq(address(factory).balance, INITIAL_LIQUIDITY);
        assertEq(factory.currentMarketId(btcAssetId), marketId);
    }

    function test_CreateMarket_RevertsIfCloseTimeTooSoon() public {
        vm.expectRevert(MarketFactory.CloseTimeTooSoon.selector);
        factory.createMarket{value: INITIAL_LIQUIDITY}(btcAssetId, startTime, startTime + 1, START_PRICE_WAD);
    }

    function test_CreateMarket_RevertsIfStartPriceZero() public {
        vm.expectRevert(MarketFactory.ZeroAmount.selector);
        factory.createMarket{value: INITIAL_LIQUIDITY}(btcAssetId, startTime, closeTime, 0);
    }

    function test_CreateMarket_RevertsIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        factory.createMarket{value: INITIAL_LIQUIDITY}(btcAssetId, startTime, closeTime, START_PRICE_WAD);
    }

    function test_CreateMarket_RevertsIfAssetNotRegistered() public {
        // Compute the unregistered id before `expectRevert` so the `nextAssetId()`
        // view call (evaluated as an argument below) isn't itself mistaken for
        // the reverting call `expectRevert` is watching for.
        uint256 unregisteredAssetId = factory.nextAssetId();
        vm.expectRevert(MarketFactory.InvalidAsset.selector);
        factory.createMarket{value: INITIAL_LIQUIDITY}(unregisteredAssetId, startTime, closeTime, START_PRICE_WAD);
    }

    function test_CreateMarket_RevertsIfIncorrectValue() public {
        vm.expectRevert(MarketFactory.IncorrectValue.selector);
        factory.createMarket{value: INITIAL_LIQUIDITY - 1}(btcAssetId, startTime, closeTime, START_PRICE_WAD);
    }

    function test_CreateMarket_RevertsIfSlotAlreadyOpen() public {
        _createMarket();
        vm.expectRevert(MarketFactory.SlotAlreadyOpen.selector);
        factory.createMarket{value: INITIAL_LIQUIDITY}(btcAssetId, startTime, closeTime, START_PRICE_WAD);
    }

    function test_CreateMarket_DifferentAssetsDoNotConflict() public {
        _createMarket();
        uint256 cashcatMarketId =
            factory.createMarket{value: INITIAL_LIQUIDITY}(cashcatAssetId, startTime, closeTime, 1e16);
        assertGt(cashcatMarketId, 0);
    }

    function test_CreateMarket_SucceedsAfterPriorMarketClosed() public {
        uint256 firstId = _createMarket();
        vm.warp(closeTime);

        uint256 secondId = factory.createMarket{value: INITIAL_LIQUIDITY}(
            btcAssetId, closeTime, closeTime + 7 days, START_PRICE_WAD
        );

        assertGt(secondId, firstId);
        assertEq(factory.currentMarketId(btcAssetId), secondId);
    }

    // ---------- admin-controlled protocol fee ----------

    function test_DefaultFeeBpsIsOnePercent() public view {
        assertEq(factory.feeBps(), 100);
    }

    function test_SetFeeBps_UpdatesFeeAndAppliesToTrades() public {
        factory.setFeeBps(500); // 5%

        uint256 marketId = _createMarket();
        vm.prank(alice);
        factory.buyShares{value: 0.1 ether}(marketId, true, 0);

        MarketFactory.Market memory m = factory.getMarket(marketId);
        // At 5% fee on a 0.1 ether input, fee should be materially larger than the 1% default.
        assertGt(m.collectedFees, 0.004 ether);
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

    // ---------- admin-controlled default seed liquidity ----------

    function test_DefaultInitialLiquidityIsPointThreeEth() public view {
        assertEq(factory.defaultInitialLiquidity(), 0.3 ether);
    }

    function test_SetDefaultInitialLiquidity_UpdatesAndAppliesToNextMarket() public {
        factory.setDefaultInitialLiquidity(0.5 ether);
        uint256 marketId = _createMarket();

        MarketFactory.Market memory m = factory.getMarket(marketId);
        assertEq(m.reserve, 0.5 ether);
    }

    function test_SetDefaultInitialLiquidity_RevertsIfZero() public {
        vm.expectRevert(MarketFactory.LiquidityTooLow.selector);
        factory.setDefaultInitialLiquidity(0);
    }

    function test_SetDefaultInitialLiquidity_RevertsIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        factory.setDefaultInitialLiquidity(1);
    }

    // ---------- trading ----------

    function test_BuyShares_IncreasesSupplyAndCreditsBalance() public {
        uint256 marketId = _createMarket();

        vm.prank(alice);
        uint256 sharesOut = factory.buyShares{value: 0.1 ether}(marketId, true, 0);

        assertGt(sharesOut, 0);
        assertEq(factory.shareBalanceOf(marketId, true, alice), sharesOut);

        MarketFactory.Market memory m = factory.getMarket(marketId);
        assertGt(m.collectedFees, 0);
        assertEq(m.reserve, INITIAL_LIQUIDITY + 0.1 ether);
    }

    function test_BuyShares_RevertsOnSlippage() public {
        uint256 marketId = _createMarket();

        vm.prank(alice);
        vm.expectRevert(MarketFactory.SlippageExceeded.selector);
        factory.buyShares{value: 0.1 ether}(marketId, true, type(uint256).max);
    }

    function test_BuyShares_RevertsAfterClose() public {
        uint256 marketId = _createMarket();
        vm.warp(closeTime);

        vm.prank(alice);
        vm.expectRevert(MarketFactory.MarketClosed.selector);
        factory.buyShares{value: 0.1 ether}(marketId, true, 0);
    }

    function test_SellShares_RoundTripLosesToFees() public {
        uint256 marketId = _createMarket();

        vm.startPrank(alice);
        uint256 sharesOut = factory.buyShares{value: 0.1 ether}(marketId, true, 0);
        uint256 collateralOut = factory.sellShares(marketId, true, sharesOut, 0);
        vm.stopPrank();

        assertLt(collateralOut, 0.1 ether, "fees + rounding must cost the trader");
    }

    function test_SellShares_RevertsIfInsufficientBalance() public {
        uint256 marketId = _createMarket();

        vm.prank(alice);
        vm.expectRevert(MarketFactory.InsufficientShareBalance.selector);
        factory.sellShares(marketId, true, 1e15, 0);
    }

    function test_BuyShares_RevertsOnZeroAmount() public {
        uint256 marketId = _createMarket();
        vm.prank(alice);
        vm.expectRevert(MarketFactory.ZeroAmount.selector);
        factory.buyShares(marketId, true, 0);
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
        uint256 sharesOut = factory.buyShares{value: 0.1 ether}(marketId, true, 0);
        vm.expectRevert(MarketFactory.SlippageExceeded.selector);
        factory.sellShares(marketId, true, sharesOut, type(uint256).max);
        vm.stopPrank();
    }

    // ---------- settlement + redemption ----------

    function test_FullLifecycle_UpWinsAndRedeems() public {
        uint256 marketId = _createMarket();

        vm.prank(alice);
        uint256 aliceShares = factory.buyShares{value: 0.2 ether}(marketId, true, 0);
        vm.prank(bob);
        factory.buyShares{value: 0.1 ether}(marketId, false, 0);

        vm.warp(closeTime);
        factory.settleMarket(marketId, UP_CLOSE_PRICE_WAD);

        MarketFactory.Market memory m = factory.getMarket(marketId);
        assertEq(uint8(m.state), uint8(MarketFactory.MarketState.Finalized));
        assertTrue(m.outcome);
        assertEq(m.closePriceWad, UP_CLOSE_PRICE_WAD);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        uint256 payout = factory.redeem(marketId);

        assertEq(payout, aliceShares);
        assertEq(alice.balance, balBefore + aliceShares);

        // Bob held only Down shares (losing side) — nothing to redeem.
        vm.prank(bob);
        vm.expectRevert(MarketFactory.NothingToRedeem.selector);
        factory.redeem(marketId);
    }

    function test_FullLifecycle_DownWinsAndRedeems() public {
        uint256 marketId = _createMarket();

        vm.prank(bob);
        uint256 bobShares = factory.buyShares{value: 0.15 ether}(marketId, false, 0);

        vm.warp(closeTime);
        factory.settleMarket(marketId, DOWN_CLOSE_PRICE_WAD);

        MarketFactory.Market memory m = factory.getMarket(marketId);
        assertFalse(m.outcome);

        vm.prank(bob);
        uint256 payout = factory.redeem(marketId);
        assertEq(payout, bobShares);
    }

    function test_SettleMarket_TieResultsInPush() public {
        uint256 marketId = _createMarket();

        vm.prank(alice);
        uint256 aliceShares = factory.buyShares{value: 0.2 ether}(marketId, true, 0);
        vm.prank(bob);
        uint256 bobShares = factory.buyShares{value: 0.1 ether}(marketId, false, 0);

        vm.warp(closeTime);
        factory.settleMarket(marketId, START_PRICE_WAD);

        MarketFactory.Market memory m = factory.getMarket(marketId);
        assertEq(uint8(m.state), uint8(MarketFactory.MarketState.Cancelled));

        uint256 totalShares = (m.upSupply - m.genesisSupply) + (m.downSupply - m.genesisSupply);
        vm.prank(alice);
        uint256 alicePayout = factory.claimRefund(marketId);
        assertEq(alicePayout, (m.reserve * aliceShares) / totalShares);

        vm.prank(bob);
        uint256 bobPayout = factory.claimRefund(marketId);
        assertEq(bobPayout, (m.reserve * bobShares) / totalShares);
    }

    function test_SettleMarket_RevertsIfNotOwner() public {
        uint256 marketId = _createMarket();
        vm.warp(closeTime);

        vm.prank(alice);
        vm.expectRevert();
        factory.settleMarket(marketId, UP_CLOSE_PRICE_WAD);
    }

    function test_SettleMarket_RevertsIfNotClosed() public {
        uint256 marketId = _createMarket();

        vm.expectRevert(MarketFactory.SettlementNotOpen.selector);
        factory.settleMarket(marketId, UP_CLOSE_PRICE_WAD);
    }

    function test_SettleMarket_RevertsIfAlreadyFinalized() public {
        uint256 marketId = _createMarket();
        vm.warp(closeTime);
        factory.settleMarket(marketId, UP_CLOSE_PRICE_WAD);

        vm.expectRevert(MarketFactory.AlreadyResolved.selector);
        factory.settleMarket(marketId, DOWN_CLOSE_PRICE_WAD);
    }

    function test_SettleMarket_RevertsOnZeroClosePrice() public {
        uint256 marketId = _createMarket();
        vm.warp(closeTime);

        vm.expectRevert(MarketFactory.ZeroAmount.selector);
        factory.settleMarket(marketId, 0);
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
        factory.settleMarket(marketId, UP_CLOSE_PRICE_WAD);

        vm.prank(bob);
        vm.expectRevert(MarketFactory.MarketNotTrading.selector);
        factory.buyShares{value: 0.1 ether}(marketId, true, 0);
    }

    // ---------- probability ----------

    function test_GetProbability_IsFiftyFiftyAtGenesis() public {
        uint256 marketId = _createMarket();
        (uint256 upProb, uint256 downProb) = factory.getProbability(marketId);
        assertApproxEqAbs(upProb, 0.5e18, 1e10);
        assertApproxEqAbs(downProb, 0.5e18, 1e10);
    }

    function test_GetProbability_ShiftsAfterBuy() public {
        uint256 marketId = _createMarket();
        vm.prank(alice);
        factory.buyShares{value: 0.5 ether}(marketId, true, 0);

        (uint256 upProb,) = factory.getProbability(marketId);
        assertGt(upProb, 0.5e18);
    }

    // ---------- fees ----------

    function test_WithdrawFees_TransfersToTreasuryAndResets() public {
        uint256 marketId = _createMarket();
        vm.prank(alice);
        factory.buyShares{value: 0.1 ether}(marketId, true, 0);

        MarketFactory.Market memory before = factory.getMarket(marketId);
        assertGt(before.collectedFees, 0);

        factory.withdrawFees(marketId);

        MarketFactory.Market memory afterWithdraw = factory.getMarket(marketId);
        assertEq(afterWithdraw.collectedFees, 0);
        assertEq(treasury.balance, before.collectedFees);
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
        factory.settleMarket(marketId, UP_CLOSE_PRICE_WAD);

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
        factory.buyShares{value: 0.1 ether}(marketId, true, 0);

        factory.extendCloseTime(marketId, closeTime + 7 days);

        vm.prank(alice);
        uint256 sharesOut = factory.buyShares{value: 0.1 ether}(marketId, true, 0);
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
        factory.settleMarket(marketId, UP_CLOSE_PRICE_WAD);

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
        factory.buyShares{value: 0.2 ether}(marketId, true, 0);

        factory.cancelMarket(marketId);

        MarketFactory.Market memory m = factory.getMarket(marketId);
        uint256 balBefore = alice.balance;

        vm.prank(alice);
        uint256 payout = factory.claimRefund(marketId);

        // Sole holder of all outstanding shares gets the whole reserve.
        assertEq(payout, m.reserve);
        assertEq(alice.balance, balBefore + m.reserve);
        assertEq(factory.shareBalanceOf(marketId, true, alice), 0);
    }

    function test_ClaimRefund_ProRataMultipleHolders() public {
        uint256 marketId = _createMarket();
        vm.prank(alice);
        uint256 aliceShares = factory.buyShares{value: 0.2 ether}(marketId, true, 0);
        vm.prank(bob);
        uint256 bobShares = factory.buyShares{value: 0.1 ether}(marketId, false, 0);

        factory.cancelMarket(marketId);
        MarketFactory.Market memory m = factory.getMarket(marketId);

        vm.prank(alice);
        uint256 alicePayout = factory.claimRefund(marketId);
        vm.prank(bob);
        uint256 bobPayout = factory.claimRefund(marketId);

        uint256 totalShares = (m.upSupply - m.genesisSupply) + (m.downSupply - m.genesisSupply);
        assertEq(alicePayout, (m.reserve * aliceShares) / totalShares);
        assertEq(bobPayout, (m.reserve * bobShares) / totalShares);
        // Rounding is always down, so the sum can never exceed the reserve that backed it.
        assertLe(alicePayout + bobPayout, m.reserve);
    }

    function test_ClaimRefund_RevertsIfNotCancelled() public {
        uint256 marketId = _createMarket();
        vm.prank(alice);
        factory.buyShares{value: 0.1 ether}(marketId, true, 0);

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
        factory.buyShares{value: 0.1 ether}(marketId, true, 0);
        factory.cancelMarket(marketId);

        vm.startPrank(alice);
        factory.claimRefund(marketId);
        vm.expectRevert(MarketFactory.NothingToRefund.selector);
        factory.claimRefund(marketId);
        vm.stopPrank();
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
        factory.buyShares{value: 0.1 ether}(marketId, true, 0);
        MarketFactory.Market memory before = factory.getMarket(marketId);

        MarketFactoryV2Mock v2 = new MarketFactoryV2Mock();
        factory.upgradeToAndCall(address(v2), "");

        MarketFactory.Market memory afterUpgrade = factory.getMarket(marketId);
        assertEq(afterUpgrade.assetId, before.assetId);
        assertEq(afterUpgrade.reserve, before.reserve);
        assertEq(afterUpgrade.upSupply, before.upSupply);
        assertEq(afterUpgrade.downSupply, before.downSupply);
        assertEq(afterUpgrade.collectedFees, before.collectedFees);

        assertEq(MarketFactoryV2Mock(address(factory)).version(), 2);
    }
}

/// @dev Minimal upgrade target used only to test the UUPS upgrade path.
contract MarketFactoryV2Mock is MarketFactory {
    function version() external pure returns (uint256) {
        return 2;
    }
}
