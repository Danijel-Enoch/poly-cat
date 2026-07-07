// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {MarketFactory} from "../../src/MarketFactory.sol";

/// @dev Drives bounded-random sequences of createMarket/buy/sell/settle/redeem
/// (plus cancel/claimRefund) against the real contracts, tracking ghost
/// accounting totals so the invariant test can assert the core solvency
/// property: every wei that enters the factory is accounted for by what
/// leaves it (sells, redemptions, refunds, fee withdrawals) plus what the
/// factory still holds.
///
/// The Handler is made the factory's owner (see `MarketInvariantsTest.setUp`) so it
/// can call `createMarket`/`settleMarket`/`cancelMarket` directly, mirroring the
/// real cron-wallet-only flow. It also funds every `buyShares`/`createMarket`
/// call: `vm.prank(actor)` only fakes `msg.sender` for the callee, the ETH
/// `value` itself is still drawn from whichever contract executes the CALL
/// opcode — the Handler — so it needs its own large balance, not the actors.
contract Handler is Test {
    MarketFactory public factory;

    uint256[] public marketIds;
    address[] public actors;
    uint256[] public assetIds;

    mapping(uint256 => bool) public isCancelledMarket;
    mapping(uint256 => uint256) public cancelledReserve;
    mapping(uint256 => uint256) public claimedForMarket;

    uint256 public ghost_totalIn;
    uint256 public ghost_totalOut;

    // Registered by MarketInvariantsTest.setUp() *before* ownership transfers
    // to this Handler (registerAsset is owner-only, and this contract isn't
    // the owner yet at construction time — the test owns the factory up
    // until it explicitly calls `transferOwnership(address(handler))`), then
    // passed in here.
    constructor(MarketFactory _factory, uint256[] memory _assetIds) {
        factory = _factory;
        for (uint256 i = 0; i < _assetIds.length; i++) {
            assetIds.push(_assetIds[i]);
        }

        // Funds every createMarket/buyShares call this Handler makes on
        // behalf of itself or a pranked actor — see the contract-level note
        // above for why actors themselves don't need their own balance.
        vm.deal(address(this), 1_000_000_000 ether);

        for (uint256 i = 0; i < 4; i++) {
            address actor = address(uint160(uint256(keccak256(abi.encodePacked("actor", i)))));
            actors.push(actor);
        }
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function createMarket(uint256 assetSeed, uint256 durationSeed) external {
        uint256 assetId = assetIds[assetSeed % assetIds.length];
        uint64 duration = uint64(bound(durationSeed, factory.MIN_TRADING_DURATION(), 30 days));
        uint64 start = uint64(block.timestamp);
        uint64 close = start + duration;
        uint256 startPrice = 1e18; // fixed reference — only its relation to the settled close price matters
        uint256 liquidity = factory.defaultInitialLiquidity();

        try factory.createMarket{value: liquidity}(assetId, start, close, startPrice) returns (uint256 marketId) {
            marketIds.push(marketId);
            ghost_totalIn += liquidity;
        } catch {}
    }

    function buyShares(uint256 marketSeed, uint256 actorSeed, bool isUp, uint256 amountSeed) external {
        if (marketIds.length == 0) return;
        uint256 marketId = marketIds[marketSeed % marketIds.length];
        MarketFactory.Market memory m = factory.getMarket(marketId);
        if (m.state != MarketFactory.MarketState.Trading || block.timestamp >= m.closeTime) return;

        address actor = _actor(actorSeed);
        uint256 amountIn = bound(amountSeed, 1e12, 10 ether);
        vm.prank(actor);
        try factory.buyShares{value: amountIn}(marketId, isUp, 0) {
            ghost_totalIn += amountIn;
        } catch {}
    }

    function sellShares(uint256 marketSeed, uint256 actorSeed, bool isUp, uint256 sharesSeed) external {
        if (marketIds.length == 0) return;
        uint256 marketId = marketIds[marketSeed % marketIds.length];
        MarketFactory.Market memory m = factory.getMarket(marketId);
        if (m.state != MarketFactory.MarketState.Trading || block.timestamp >= m.closeTime) return;

        address actor = _actor(actorSeed);
        uint256 balance = factory.shareBalanceOf(marketId, isUp, actor);
        if (balance == 0) return;
        uint256 sharesIn = bound(sharesSeed, 1, balance);

        vm.prank(actor);
        try factory.sellShares(marketId, isUp, sharesIn, 0) returns (uint256 collateralOut) {
            ghost_totalOut += collateralOut;
        } catch {}
    }

    /// @dev Warps to close (if needed) then settles directly as the factory owner —
    /// the Handler itself, since ownership was transferred to it in setUp. The
    /// close price is bounded around the fixed 1e18 start price used by every
    /// market created above, so this exercises Up wins, Down wins, and ties/pushes.
    function settleMarket(uint256 marketSeed, uint256 priceSeed) external {
        if (marketIds.length == 0) return;
        uint256 marketId = marketIds[marketSeed % marketIds.length];
        MarketFactory.Market memory m = factory.getMarket(marketId);
        if (m.state != MarketFactory.MarketState.Trading) return;

        if (block.timestamp < m.closeTime) {
            vm.warp(m.closeTime);
        }

        uint256 closePrice = bound(priceSeed, 1, 2e18);
        try factory.settleMarket(marketId, closePrice) {} catch {}
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
            ghost_totalOut += payout;
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
            ghost_totalOut += payout;
        } catch {}
    }

    function marketIdsLength() external view returns (uint256) {
        return marketIds.length;
    }

    // Lets the Handler receive ETH payouts routed back to it (it also acts as
    // one of the msg.sender-pranked actors' proxy for value accounting).
    receive() external payable {}
}

contract MarketInvariantsTest is Test {
    MarketFactory factory;
    Handler handler;

    address treasury = makeAddr("treasury");

    function setUp() public {
        MarketFactory implementation = new MarketFactory();
        ERC1967Proxy proxy =
            new ERC1967Proxy(address(implementation), abi.encodeCall(MarketFactory.initialize, (treasury)));
        factory = MarketFactory(address(proxy));

        uint256[] memory assetIds = new uint256[](3);
        assetIds[0] = factory.registerAsset("BTC", MarketFactory.PriceSource.Gate, "BTC_USDT");
        assetIds[1] = factory.registerAsset("ETH", MarketFactory.PriceSource.Gate, "ETH_USDT");
        assetIds[2] = factory.registerAsset(
            "CASHCAT", MarketFactory.PriceSource.DexScreener, "0xa70fc67c9f69da90b63a0e4c05d229954574e313"
        );

        handler = new Handler(factory, assetIds);
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

    /// @notice Every wei that entered the factory (initial liquidity + buys)
    /// is either still held by the factory, or accounted for by an equal amount
    /// leaving (sells + redemptions + refunds + fee withdrawals). No value can be created or
    /// destroyed by rounding, fee handling, or the settlement state machine.
    function invariant_CollateralConservation() public view {
        assertEq(
            address(factory).balance + handler.ghost_totalOut(),
            handler.ghost_totalIn(),
            "factory balance + total paid out must equal total ETH ever deposited"
        );
    }

    /// @notice Every market's bonding-curve reserve must always cover its own
    /// supplies (`reserve^2 >= upSupply^2 + downSupply^2`, i.e. `c >= 1`), which is
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
                m.upSupply * m.upSupply + m.downSupply * m.downSupply,
                "reserve must cover sqrt(upSupply^2+downSupply^2) for every market"
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
