// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {MarketFactory} from "../../src/MarketFactory.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";

/// @dev Drives bounded-random sequences of createMarket/buy/sell/settle/redeem
/// (plus cancel/claimRefund, and both USDC- and native-ETH-collateralized
/// markets) against the real contracts, tracking ghost accounting totals so
/// the invariant test can assert the core solvency property: every collateral
/// unit that enters the factory is accounted for by what leaves it (sells,
/// redemptions, refunds, fee withdrawals) plus what the factory still holds.
/// USDC and native ETH are tracked with separate ghost totals since they're
/// entirely independent balances.
///
/// The Handler is made the factory's owner (see `MarketInvariantsTest.setUp`) so it
/// can call `settleMarket`/`cancelMarket` directly, mirroring the real admin-only flow.
contract Handler is Test {
    MarketFactory public factory;
    MockUSDC public usdc;

    uint256[] public marketIds;
    address[] public actors;

    mapping(uint256 => bool) public isNativeMarket;
    mapping(uint256 => bool) public isCancelledMarket;
    mapping(uint256 => uint256) public cancelledReserve;
    mapping(uint256 => uint256) public claimedForMarket;

    uint256 public ghost_totalIn;
    uint256 public ghost_totalOut;
    uint256 public ghost_nativeTotalIn;
    uint256 public ghost_nativeTotalOut;

    constructor(MarketFactory _factory, MockUSDC _usdc) {
        factory = _factory;
        usdc = _usdc;

        for (uint256 i = 0; i < 4; i++) {
            address actor = address(uint160(uint256(keccak256(abi.encodePacked("actor", i)))));
            actors.push(actor);
            usdc.mint(actor, 1_000_000_000e6);
            vm.prank(actor);
            usdc.approve(address(factory), type(uint256).max);
            vm.deal(actor, 1_000_000 ether);
        }
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function createMarket(uint256 actorSeed, uint256 liquiditySeed, uint256 durationSeed, bool useNative) external {
        address actor = _actor(actorSeed);
        uint64 duration = uint64(bound(durationSeed, factory.MIN_TRADING_DURATION(), 30 days));
        uint64 closeTime = uint64(block.timestamp) + duration;

        if (useNative) {
            uint256 liquidity = bound(liquiditySeed, factory.MIN_INITIAL_LIQUIDITY(), 1_000 ether);
            MarketFactory.CreateMarketParams memory p = MarketFactory.CreateMarketParams({
                collateralToken: address(0),
                questionHash: keccak256(abi.encodePacked(marketIds.length)),
                metadataURI: "",
                closeTime: closeTime,
                initialLiquidity: liquidity
            });
            vm.deal(actor, actor.balance + liquidity);
            vm.prank(actor);
            try factory.createMarket{value: liquidity}(p) returns (uint256 marketId) {
                marketIds.push(marketId);
                isNativeMarket[marketId] = true;
                ghost_nativeTotalIn += liquidity;
            } catch {}
        } else {
            uint256 liquidity = bound(liquiditySeed, factory.MIN_INITIAL_LIQUIDITY(), 1_000_000e6);
            MarketFactory.CreateMarketParams memory p = MarketFactory.CreateMarketParams({
                collateralToken: address(usdc),
                questionHash: keccak256(abi.encodePacked(marketIds.length)),
                metadataURI: "",
                closeTime: closeTime,
                initialLiquidity: liquidity
            });
            vm.prank(actor);
            try factory.createMarket(p) returns (uint256 marketId) {
                marketIds.push(marketId);
                ghost_totalIn += liquidity;
            } catch {}
        }
    }

    function buyShares(uint256 marketSeed, uint256 actorSeed, bool isYes, uint256 amountSeed) external {
        if (marketIds.length == 0) return;
        uint256 marketId = marketIds[marketSeed % marketIds.length];
        MarketFactory.Market memory m = factory.getMarket(marketId);
        if (m.state != MarketFactory.MarketState.Trading || block.timestamp >= m.closeTime) return;

        address actor = _actor(actorSeed);
        bool native = isNativeMarket[marketId];

        if (native) {
            uint256 amountIn = bound(amountSeed, 1e15, 100 ether);
            vm.deal(actor, actor.balance + amountIn);
            vm.prank(actor);
            try factory.buyShares{value: amountIn}(marketId, isYes, amountIn, 0) {
                ghost_nativeTotalIn += amountIn;
            } catch {}
        } else {
            uint256 amountIn = bound(amountSeed, 1e6, 10_000e6);
            vm.prank(actor);
            try factory.buyShares(marketId, isYes, amountIn, 0) {
                ghost_totalIn += amountIn;
            } catch {}
        }
    }

    function sellShares(uint256 marketSeed, uint256 actorSeed, bool isYes, uint256 sharesSeed) external {
        if (marketIds.length == 0) return;
        uint256 marketId = marketIds[marketSeed % marketIds.length];
        MarketFactory.Market memory m = factory.getMarket(marketId);
        if (m.state != MarketFactory.MarketState.Trading || block.timestamp >= m.closeTime) return;

        address actor = _actor(actorSeed);
        uint256 balance = factory.shareBalanceOf(marketId, isYes, actor);
        if (balance == 0) return;
        uint256 sharesIn = bound(sharesSeed, 1, balance);

        vm.prank(actor);
        try factory.sellShares(marketId, isYes, sharesIn, 0) returns (uint256 collateralOut) {
            if (isNativeMarket[marketId]) {
                ghost_nativeTotalOut += collateralOut;
            } else {
                ghost_totalOut += collateralOut;
            }
        } catch {}
    }

    /// @dev Warps to close (if needed) then settles directly as the factory owner —
    /// the Handler itself, since ownership was transferred to it in setUp.
    function settleMarket(uint256 marketSeed, uint256 actorSeed) external {
        if (marketIds.length == 0) return;
        uint256 marketId = marketIds[marketSeed % marketIds.length];
        MarketFactory.Market memory m = factory.getMarket(marketId);
        if (m.state != MarketFactory.MarketState.Trading) return;

        if (block.timestamp < m.closeTime) {
            vm.warp(m.closeTime);
        }

        try factory.settleMarket(marketId, actorSeed % 2 == 0) {} catch {}
    }

    /// @dev Abandons a market instead of settling it, mirroring `cancelMarket`
    /// being callable by the owner any time a market is `Trading`.
    function cancelMarket(uint256 marketSeed) external {
        if (marketIds.length == 0) return;
        uint256 marketId = marketIds[marketSeed % marketIds.length];
        MarketFactory.Market memory m = factory.getMarket(marketId);
        if (m.state != MarketFactory.MarketState.Trading) return;

        try factory.cancelMarket(marketId) {
            isCancelledMarket[marketId] = true;
            cancelledReserve[marketId] = m.reserve;
        } catch {}
    }

    function claimRefund(uint256 marketSeed, uint256 actorSeed) external {
        if (marketIds.length == 0) return;
        uint256 marketId = marketIds[marketSeed % marketIds.length];
        MarketFactory.Market memory m = factory.getMarket(marketId);
        if (m.state != MarketFactory.MarketState.Cancelled) return;

        address actor = _actor(actorSeed);
        vm.prank(actor);
        try factory.claimRefund(marketId) returns (uint256 payout) {
            claimedForMarket[marketId] += payout;
            if (isNativeMarket[marketId]) {
                ghost_nativeTotalOut += payout;
            } else {
                ghost_totalOut += payout;
            }
        } catch {}
    }

    function redeem(uint256 marketSeed, uint256 actorSeed) external {
        if (marketIds.length == 0) return;
        uint256 marketId = marketIds[marketSeed % marketIds.length];
        MarketFactory.Market memory m = factory.getMarket(marketId);
        if (m.state != MarketFactory.MarketState.Finalized) return;

        address actor = _actor(actorSeed);
        vm.prank(actor);
        try factory.redeem(marketId) returns (uint256 payout) {
            if (isNativeMarket[marketId]) {
                ghost_nativeTotalOut += payout;
            } else {
                ghost_totalOut += payout;
            }
        } catch {}
    }

    function marketIdsLength() external view returns (uint256) {
        return marketIds.length;
    }
}

contract MarketInvariantsTest is Test {
    MarketFactory factory;
    MockUSDC usdc;
    Handler handler;

    address treasury = makeAddr("treasury");

    function setUp() public {
        usdc = new MockUSDC();
        MarketFactory implementation = new MarketFactory();
        ERC1967Proxy proxy =
            new ERC1967Proxy(address(implementation), abi.encodeCall(MarketFactory.initialize, (treasury)));
        factory = MarketFactory(address(proxy));
        handler = new Handler(factory, usdc);
        factory.transferOwnership(address(handler));

        bytes4[] memory selectors = new bytes4[](7);
        selectors[0] = Handler.createMarket.selector;
        selectors[1] = Handler.buyShares.selector;
        selectors[2] = Handler.sellShares.selector;
        selectors[3] = Handler.settleMarket.selector;
        selectors[4] = Handler.redeem.selector;
        selectors[5] = Handler.cancelMarket.selector;
        selectors[6] = Handler.claimRefund.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }

    /// @notice Every USDC unit that entered the factory (initial liquidity +
    /// buys) is either still held by the factory, or accounted for by an equal amount
    /// leaving (sells + redemptions + refunds + fee withdrawals). No value can be created or
    /// destroyed by rounding, fee handling, or the settlement state machine.
    function invariant_CollateralConservation() public view {
        assertEq(
            usdc.balanceOf(address(factory)) + handler.ghost_totalOut(),
            handler.ghost_totalIn(),
            "factory balance + total paid out must equal total collateral ever deposited"
        );
    }

    /// @notice Same conservation property as above, tracked independently for
    /// native-ETH-collateralized markets since ETH and USDC are disjoint balances.
    function invariant_NativeCollateralConservation() public view {
        assertEq(
            address(factory).balance + handler.ghost_nativeTotalOut(),
            handler.ghost_nativeTotalIn(),
            "factory ETH balance + total native ETH paid out must equal total native ETH ever deposited"
        );
    }

    /// @notice Every market's bonding-curve reserve must always cover its own
    /// supplies (`reserve^2 >= yesSupply^2 + noSupply^2`, i.e. `c >= 1`), which is
    /// what guarantees 1:1 redemption can never be under-collateralized. Checked
    /// across every market the Handler has created, after any sequence of
    /// buys/sells/settlements/redemptions.
    function invariant_ReserveCoversSupplies() public view {
        uint256 count = handler.marketIdsLength();
        for (uint256 i = 0; i < count; i++) {
            uint256 marketId = handler.marketIds(i);
            MarketFactory.Market memory m = factory.getMarket(marketId);
            assertGe(
                m.reserve * m.reserve,
                m.yesSupply * m.yesSupply + m.noSupply * m.noSupply,
                "reserve must cover sqrt(yesSupply^2+noSupply^2) for every market"
            );
        }
    }

    /// @notice A cancelled market's cumulative refund claims can never exceed
    /// the reserve it was frozen with at cancellation time — the pro-rata
    /// `claimRefund` formula must never let claimants collectively drain more
    /// than the market actually held.
    function invariant_CancelledMarketNeverOverpays() public view {
        uint256 count = handler.marketIdsLength();
        for (uint256 i = 0; i < count; i++) {
            uint256 marketId = handler.marketIds(i);
            if (!handler.isCancelledMarket(marketId)) continue;
            assertLe(
                handler.claimedForMarket(marketId),
                handler.cancelledReserve(marketId),
                "cumulative refund claims must never exceed the market's reserve at cancellation"
            );
        }
    }
}
