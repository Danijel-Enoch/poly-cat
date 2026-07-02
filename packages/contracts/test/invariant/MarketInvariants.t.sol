// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";

import {MarketFactory} from "../../src/MarketFactory.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";

/// @dev Drives bounded-random sequences of createMarket/buy/sell/settle/redeem
/// against the real contracts, tracking ghost accounting totals so the invariant test
/// can assert the core solvency property: every collateral unit that enters the
/// factory is accounted for by what leaves it (sells, redemptions, fee withdrawals)
/// plus what the factory still holds. This is independent of any single market's
/// reserve bookkeeping, so it holds across many markets, finalizations, and partial
/// redemptions simultaneously.
///
/// The Handler is made the factory's owner (see `MarketInvariantsTest.setUp`) so it
/// can call `settleMarket` directly, mirroring the real admin-only settlement flow.
contract Handler is Test {
    MarketFactory public factory;
    MockUSDC public usdc;

    uint256[] public marketIds;
    address[] public actors;

    uint256 public ghost_totalIn;
    uint256 public ghost_totalOut;

    constructor(MarketFactory _factory, MockUSDC _usdc) {
        factory = _factory;
        usdc = _usdc;

        for (uint256 i = 0; i < 4; i++) {
            address actor = address(uint160(uint256(keccak256(abi.encodePacked("actor", i)))));
            actors.push(actor);
            usdc.mint(actor, 1_000_000_000e6);
            vm.prank(actor);
            usdc.approve(address(factory), type(uint256).max);
        }
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function createMarket(uint256 actorSeed, uint256 liquiditySeed, uint256 durationSeed) external {
        address actor = _actor(actorSeed);
        uint256 liquidity = bound(liquiditySeed, factory.MIN_INITIAL_LIQUIDITY(), 1_000_000e6);
        uint64 duration = uint64(bound(durationSeed, factory.MIN_TRADING_DURATION(), 30 days));

        MarketFactory.CreateMarketParams memory p = MarketFactory.CreateMarketParams({
            collateralToken: address(usdc),
            questionHash: keccak256(abi.encodePacked(marketIds.length)),
            metadataURI: "",
            closeTime: uint64(block.timestamp) + duration,
            initialLiquidity: liquidity
        });

        vm.prank(actor);
        uint256 marketId = factory.createMarket(p);
        marketIds.push(marketId);
        ghost_totalIn += liquidity;
    }

    function buyShares(uint256 marketSeed, uint256 actorSeed, bool isYes, uint256 amountSeed) external {
        if (marketIds.length == 0) return;
        uint256 marketId = marketIds[marketSeed % marketIds.length];
        MarketFactory.Market memory m = factory.getMarket(marketId);
        if (m.state != MarketFactory.MarketState.Trading || block.timestamp >= m.closeTime) return;

        address actor = _actor(actorSeed);
        uint256 amountIn = bound(amountSeed, 1e6, 10_000e6);

        vm.prank(actor);
        try factory.buyShares(marketId, isYes, amountIn, 0) {
            ghost_totalIn += amountIn;
        } catch {}
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
            ghost_totalOut += collateralOut;
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

    function redeem(uint256 marketSeed, uint256 actorSeed) external {
        if (marketIds.length == 0) return;
        uint256 marketId = marketIds[marketSeed % marketIds.length];
        MarketFactory.Market memory m = factory.getMarket(marketId);
        if (m.state != MarketFactory.MarketState.Finalized) return;

        address actor = _actor(actorSeed);
        vm.prank(actor);
        try factory.redeem(marketId) returns (uint256 payout) {
            ghost_totalOut += payout;
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
        factory = new MarketFactory(treasury);
        handler = new Handler(factory, usdc);
        factory.transferOwnership(address(handler));

        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = Handler.createMarket.selector;
        selectors[1] = Handler.buyShares.selector;
        selectors[2] = Handler.sellShares.selector;
        selectors[3] = Handler.settleMarket.selector;
        selectors[4] = Handler.redeem.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }

    /// @notice Every collateral unit that entered the factory (initial liquidity +
    /// buys) is either still held by the factory, or accounted for by an equal amount
    /// leaving (sells + redemptions + fee withdrawals). No value can be created or
    /// destroyed by rounding, fee handling, or the settlement state machine.
    function invariant_CollateralConservation() public view {
        assertEq(
            usdc.balanceOf(address(factory)) + handler.ghost_totalOut(),
            handler.ghost_totalIn(),
            "factory balance + total paid out must equal total collateral ever deposited"
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
}
