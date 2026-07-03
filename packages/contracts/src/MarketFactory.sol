// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {PythagoreanMath} from "./libraries/PythagoreanMath.sol";

/// @notice Permissionless prediction-market factory, bonding-curve AMM, and
/// collateral custody hub. Settlement is handled by an AI agent (LLM): the
/// contract owner calls `settleMarket` directly once a market's close time has
/// passed — no bond, no dispute, no oracle module. Market price/probability is
/// never read as a settlement signal anywhere in this contract.
///
/// Pricing uses a Pythagorean bonding curve (`reserve = c*sqrt(yesSupply^2 +
/// noSupply^2)`, see `PythagoreanMath`) rather than a constant-product AMM — this
/// matches PNP Exchange / Azuro-style prediction market design.
///
/// One contract instance serves every market (keyed by `marketId`), rather than one
/// clone/proxy per market: this keeps outcome shares as cheap internal balances
/// instead of per-market ERC20s, and gives an indexer (Ponder) a single address and
/// ABI to track instead of discovering N child contracts.
///
/// Deployed behind a UUPS proxy (`ERC1967Proxy`, see `script/Deploy.s.sol`) so
/// logic can be upgraded later without migrating market state to a new address —
/// see `initialize`/`_authorizeUpgrade` below. `ReentrancyGuardTransient` is used
/// instead of the classic storage-based guard specifically because it needs no
/// initialization (it's stateless between transactions via EIP-1153 transient
/// storage), which sidesteps proxy-initialization pitfalls entirely.
contract MarketFactory is Initializable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    enum MarketState {
        Trading,
        Finalized,
        Cancelled
    }

    /// @notice Sentinel used as `collateralToken` to mean "this market is
    /// backed by native ETH" instead of an ERC20. Robinhood Chain's native
    /// currency is ETH itself and no canonical WETH contract is assumed to
    /// exist, so native ETH is handled directly (payable in, low-level
    /// `.call` out) rather than wrapped.
    address private constant NATIVE_TOKEN = address(0);

    struct Market {
        address creator;
        IERC20 collateralToken;
        bytes32 questionHash; // keccak256 of the question text; full text/criteria live at metadataURI
        string metadataURI;
        uint64 closeTime;
        uint64 createdAt;
        uint256 reserve; // r: real collateral custodied for this market's curve
        uint256 yesSupply; // sYes: virtual accounting supply, not a real token
        uint256 noSupply; // sNo: virtual accounting supply, not a real token
        uint256 genesisSupply; // s0 baked into yesSupply/noSupply at creation, held by no one — see claimRefund
        uint256 collectedFees; // protocol's share, withdrawable by the admin via withdrawFees
        uint256 creatorFees; // creator's share, withdrawable by the creator via withdrawCreatorFees
        MarketState state;
        bool outcome; // valid only when state == Finalized
    }

    struct CreateMarketParams {
        address collateralToken;
        bytes32 questionHash;
        string metadataURI;
        uint64 closeTime;
        uint256 initialLiquidity;
    }

    uint64 public constant MIN_TRADING_DURATION = 1 hours;
    uint16 public constant MAX_FEE_BPS = 500; // 5% ceiling on the admin-settable protocol fee
    uint256 public constant MIN_INITIAL_LIQUIDITY = 1e6; // floor in raw collateral units, avoids degenerate pools
    uint256 private constant BPS_DENOMINATOR = 10_000;

    /// @notice Fixed share of every collected trading fee that goes to a market's
    /// creator instead of the protocol treasury (500 = 5% of the fee itself, e.g.
    /// 0.05% of volume at the default 1% protocol fee — not an additional fee on
    /// top of what traders already pay).
    uint16 public constant CREATOR_FEE_SHARE_BPS = 500;

    address public protocolTreasury;

    /// @notice Protocol-wide trading fee, in basis points, charged on both buys
    /// (taken from the input) and sells (taken from the output), split between the
    /// protocol treasury and the market's creator per `CREATOR_FEE_SHARE_BPS`.
    /// Applies uniformly to every market — not creator-configurable.
    uint16 public feeBps;

    uint256 public nextMarketId; // 0 is reserved/invalid

    mapping(uint256 => Market) public markets;
    // marketId => isYes => holder => balance. Internal balances (not per-market ERC20s)
    // — cheaper, and keeps everything indexable from this single contract's events.
    mapping(uint256 => mapping(bool => mapping(address => uint256))) internal shareBalances;

    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        address indexed collateralToken,
        bytes32 questionHash,
        string metadataURI,
        uint64 closeTime,
        uint256 initialLiquidity
    );
    event SharesBought(
        uint256 indexed marketId,
        address indexed buyer,
        bool isYes,
        uint256 collateralIn,
        uint256 sharesOut,
        uint256 feePaid,
        uint256 newYesSupply,
        uint256 newNoSupply
    );
    event SharesSold(
        uint256 indexed marketId,
        address indexed seller,
        bool isYes,
        uint256 sharesIn,
        uint256 collateralOut,
        uint256 feePaid,
        uint256 newYesSupply,
        uint256 newNoSupply
    );
    event Redeemed(uint256 indexed marketId, address indexed redeemer, uint256 payout, bool outcome);
    event FeesWithdrawn(uint256 indexed marketId, address indexed to, uint256 amount);
    event CreatorFeesWithdrawn(uint256 indexed marketId, address indexed creator, uint256 amount);
    event ProtocolTreasurySet(address indexed treasury);
    event ProtocolFeeSet(uint16 feeBps);
    event MarketSettled(uint256 indexed marketId, bool outcome);
    event CloseTimeExtended(uint256 indexed marketId, uint64 newCloseTime);
    event MarketCancelled(uint256 indexed marketId);
    event RefundClaimed(uint256 indexed marketId, address indexed claimant, uint256 payout);

    error MarketNotTrading();
    error MarketNotFinalized();
    error MarketClosed();
    error AlreadyResolved();
    error SettlementNotOpen();
    error ZeroAmount();
    error SlippageExceeded();
    error InsufficientShareBalance();
    error NothingToRedeem();
    error NoFeesToWithdraw();
    error NoCreatorFeesToWithdraw();
    error NotCreator();
    error CloseTimeTooSoon();
    error LiquidityTooLow();
    error FeeTooHigh();
    error NotAContract();
    error CloseTimeNotExtended();
    error MarketNotCancelled();
    error NothingToRefund();
    error UnexpectedEthValue();
    error EthAmountMismatch();
    error EthTransferFailed();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _protocolTreasury) external initializer {
        __Ownable_init(msg.sender);
        require(_protocolTreasury != address(0));
        protocolTreasury = _protocolTreasury;
        feeBps = 100; // 1% — inline field initializers don't run against proxy storage, so this must live here
        nextMarketId = 1; // 0 is reserved/invalid
    }

    function setProtocolTreasury(address _protocolTreasury) external onlyOwner {
        require(_protocolTreasury != address(0));
        protocolTreasury = _protocolTreasury;
        emit ProtocolTreasurySet(_protocolTreasury);
    }

    /// @notice Admin-only update to the protocol-wide trading fee applied to all
    /// markets' buys and sells going forward. Capped at `MAX_FEE_BPS`.
    function setFeeBps(uint16 _feeBps) external onlyOwner {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = _feeBps;
        emit ProtocolFeeSet(_feeBps);
    }

    /// @notice Permissionlessly create a new binary prediction market on any topic.
    /// Pulls `initialLiquidity` from the caller and seeds the bonding curve. The
    /// creator receives no shares for this — it purely seeds the curve's starting
    /// depth/price and backs solvency; the creator's only return is a
    /// `CREATOR_FEE_SHARE_BPS` cut of trading fees if and when people trade.
    function createMarket(CreateMarketParams calldata p) external payable nonReentrant returns (uint256 marketId) {
        if (p.closeTime < block.timestamp + MIN_TRADING_DURATION) revert CloseTimeTooSoon();
        if (p.initialLiquidity < MIN_INITIAL_LIQUIDITY) revert LiquidityTooLow();

        bool isNative = p.collateralToken == NATIVE_TOKEN;
        if (isNative) {
            if (msg.value != p.initialLiquidity) revert EthAmountMismatch();
        } else {
            if (msg.value != 0) revert UnexpectedEthValue();
            if (p.collateralToken.code.length == 0) revert NotAContract();
        }

        uint256 s0 = PythagoreanMath.seedGenesis(p.initialLiquidity);

        marketId = nextMarketId++;
        Market storage m = markets[marketId];
        m.creator = msg.sender;
        m.collateralToken = IERC20(p.collateralToken);
        m.questionHash = p.questionHash;
        m.metadataURI = p.metadataURI;
        m.closeTime = p.closeTime;
        m.createdAt = uint64(block.timestamp);
        m.reserve = p.initialLiquidity;
        m.yesSupply = s0;
        m.noSupply = s0;
        m.genesisSupply = s0;
        m.state = MarketState.Trading;

        if (!isNative) {
            IERC20(p.collateralToken).safeTransferFrom(msg.sender, address(this), p.initialLiquidity);
        }

        emit MarketCreated(
            marketId, msg.sender, p.collateralToken, p.questionHash, p.metadataURI, p.closeTime, p.initialLiquidity
        );
    }

    /// @notice Buy `isYes` shares by depositing `amountIn` collateral via the bonding curve.
    function buyShares(uint256 marketId, bool isYes, uint256 amountIn, uint256 minSharesOut)
        external
        payable
        nonReentrant
        returns (uint256 sharesOut)
    {
        Market storage m = markets[marketId];
        if (m.state != MarketState.Trading) revert MarketNotTrading();
        if (block.timestamp >= m.closeTime) revert MarketClosed();
        if (amountIn == 0) revert ZeroAmount();

        bool isNative = address(m.collateralToken) == NATIVE_TOKEN;
        if (isNative) {
            if (msg.value != amountIn) revert EthAmountMismatch();
        } else if (msg.value != 0) {
            revert UnexpectedEthValue();
        }

        (uint256 sSame, uint256 sOther) = isYes ? (m.yesSupply, m.noSupply) : (m.noSupply, m.yesSupply);
        uint256 newR;
        uint256 newSSame;
        uint256 feePaid;
        (sharesOut, newR, newSSame, feePaid) = PythagoreanMath.quoteBuy(m.reserve, sSame, sOther, amountIn, feeBps);
        if (sharesOut < minSharesOut) revert SlippageExceeded();

        m.reserve = newR;
        if (isYes) {
            m.yesSupply = newSSame;
        } else {
            m.noSupply = newSSame;
        }
        _splitFee(m, feePaid);
        shareBalances[marketId][isYes][msg.sender] += sharesOut;

        if (!isNative) {
            m.collateralToken.safeTransferFrom(msg.sender, address(this), amountIn);
        }

        emit SharesBought(marketId, msg.sender, isYes, amountIn, sharesOut, feePaid, m.yesSupply, m.noSupply);
    }

    /// @notice Sell `sharesIn` shares of `isYes` back to the pool for collateral.
    function sellShares(uint256 marketId, bool isYes, uint256 sharesIn, uint256 minCollateralOut)
        external
        nonReentrant
        returns (uint256 collateralOut)
    {
        Market storage m = markets[marketId];
        if (m.state != MarketState.Trading) revert MarketNotTrading();
        if (block.timestamp >= m.closeTime) revert MarketClosed();
        if (sharesIn == 0) revert ZeroAmount();
        if (shareBalances[marketId][isYes][msg.sender] < sharesIn) revert InsufficientShareBalance();

        (uint256 sSame, uint256 sOther) = isYes ? (m.yesSupply, m.noSupply) : (m.noSupply, m.yesSupply);
        uint256 newR;
        uint256 newSSame;
        uint256 feePaid;
        (collateralOut, newR, newSSame, feePaid) =
            PythagoreanMath.quoteSell(m.reserve, sSame, sOther, sharesIn, feeBps);
        if (collateralOut < minCollateralOut) revert SlippageExceeded();

        shareBalances[marketId][isYes][msg.sender] -= sharesIn;
        m.reserve = newR;
        if (isYes) {
            m.yesSupply = newSSame;
        } else {
            m.noSupply = newSSame;
        }
        _splitFee(m, feePaid);

        _payOut(m, msg.sender, collateralOut);

        emit SharesSold(marketId, msg.sender, isYes, sharesIn, collateralOut, feePaid, m.yesSupply, m.noSupply);
    }

    /// @dev Splits a just-collected fee between the market's creator and the
    /// protocol treasury per `CREATOR_FEE_SHARE_BPS`, e.g. at the default 1%
    /// protocol fee, 5% of that (0.05% of volume) accrues to the creator.
    function _splitFee(Market storage m, uint256 feePaid) private {
        uint256 creatorShare = (feePaid * CREATOR_FEE_SHARE_BPS) / BPS_DENOMINATOR;
        m.creatorFees += creatorShare;
        m.collectedFees += feePaid - creatorShare;
    }

    /// @dev Pays out `amount` to `to` in whichever collateral the market
    /// uses. Always called after this market's storage has already been
    /// updated (balances/reserve/fees zeroed or decremented), so the
    /// checks-effects-interactions ordering that makes `safeTransfer` safe
    /// under `nonReentrant` carries over unchanged to the low-level ETH call.
    function _payOut(Market storage m, address to, uint256 amount) private {
        if (address(m.collateralToken) == NATIVE_TOKEN) {
            (bool ok,) = to.call{value: amount}("");
            if (!ok) revert EthTransferFailed();
        } else {
            m.collateralToken.safeTransfer(to, amount);
        }
    }

    /// @notice Redeem winning shares 1:1 for collateral after the market is finalized.
    /// Losing shares are worthless; both sides are zeroed to keep state tidy.
    function redeem(uint256 marketId) external nonReentrant returns (uint256 payout) {
        Market storage m = markets[marketId];
        if (m.state != MarketState.Finalized) revert MarketNotFinalized();

        bool outcome = m.outcome;
        payout = shareBalances[marketId][outcome][msg.sender];
        if (payout == 0) revert NothingToRedeem();

        shareBalances[marketId][true][msg.sender] = 0;
        shareBalances[marketId][false][msg.sender] = 0;

        _payOut(m, msg.sender, payout);

        emit Redeemed(marketId, msg.sender, payout, outcome);
    }

    /// @notice Settlement by AI agent (LLM). The owner account, operated by the
    /// settlement agent, is the sole source of truth for every market's outcome —
    /// no bond, no dispute, no oracle module. Callable only once a market has
    /// closed, and only once per market.
    function settleMarket(uint256 marketId, bool outcome) external onlyOwner {
        Market storage m = markets[marketId];
        if (m.state != MarketState.Trading) revert AlreadyResolved();
        if (block.timestamp < m.closeTime) revert SettlementNotOpen();
        m.state = MarketState.Finalized;
        m.outcome = outcome;
        emit MarketSettled(marketId, outcome);
    }

    /// @notice Push a market's close time further out, e.g. when the settlement
    /// agent needs more time after the original deadline passed without a
    /// settlement. Note this also reopens trading until the new deadline,
    /// since `closeTime` gates both — the same field doing the same dual job
    /// it already does at creation, just moved later.
    function extendCloseTime(uint256 marketId, uint64 newCloseTime) external onlyOwner {
        Market storage m = markets[marketId];
        if (m.state != MarketState.Trading) revert MarketNotTrading();
        if (newCloseTime <= m.closeTime) revert CloseTimeNotExtended();
        m.closeTime = newCloseTime;
        emit CloseTimeExtended(marketId, newCloseTime);
    }

    /// @notice Abandon a market instead of settling it, letting every share
    /// holder reclaim a pro-rata slice of the pool via `claimRefund`. Callable
    /// any time the market is `Trading` — same fully-trusted-owner model as
    /// `settleMarket`, no bond, no dispute.
    function cancelMarket(uint256 marketId) external onlyOwner {
        Market storage m = markets[marketId];
        if (m.state != MarketState.Trading) revert MarketNotTrading();
        m.state = MarketState.Cancelled;
        emit MarketCancelled(marketId);
    }

    /// @notice Claim a pro-rata refund from a cancelled market's reserve.
    /// Paying every YES/NO share 1:1 (like `redeem` does for the winning side)
    /// would be insolvent here: the Pythagorean curve guarantees
    /// `reserve <= yesSupply + noSupply`, not equality. Splitting `reserve`
    /// proportionally across each holder's combined YES+NO balance instead
    /// sums to exactly `reserve` once everyone claims — but `yesSupply`/
    /// `noSupply` themselves are net of `genesisSupply` first, since that
    /// seed liquidity is virtual accounting baked in at creation and isn't
    /// held by any address (see the `Market.genesisSupply` field doc). For
    /// markets created before this field existed, `genesisSupply` reads as 0
    /// and refunds fall back to the pre-upgrade (still solvent, just slightly
    /// under-distributing) behavior rather than reverting.
    function claimRefund(uint256 marketId) external nonReentrant returns (uint256 payout) {
        Market storage m = markets[marketId];
        if (m.state != MarketState.Cancelled) revert MarketNotCancelled();

        uint256 userShares = shareBalances[marketId][true][msg.sender] + shareBalances[marketId][false][msg.sender];
        if (userShares == 0) revert NothingToRefund();

        uint256 totalShares = (m.yesSupply - m.genesisSupply) + (m.noSupply - m.genesisSupply);
        payout = Math.mulDiv(m.reserve, userShares, totalShares);

        shareBalances[marketId][true][msg.sender] = 0;
        shareBalances[marketId][false][msg.sender] = 0;

        _payOut(m, msg.sender, payout);
        emit RefundClaimed(marketId, msg.sender, payout);
    }

    function withdrawFees(uint256 marketId) external onlyOwner nonReentrant {
        Market storage m = markets[marketId];
        uint256 amount = m.collectedFees;
        if (amount == 0) revert NoFeesToWithdraw();
        m.collectedFees = 0;
        _payOut(m, protocolTreasury, amount);
        emit FeesWithdrawn(marketId, protocolTreasury, amount);
    }

    /// @notice Lets a market's creator withdraw their accrued share of trading
    /// fees (`CREATOR_FEE_SHARE_BPS` of `feeBps` on every buy/sell in their
    /// market). Only the creator can call this for their own market.
    function withdrawCreatorFees(uint256 marketId) external nonReentrant {
        Market storage m = markets[marketId];
        if (msg.sender != m.creator) revert NotCreator();
        uint256 amount = m.creatorFees;
        if (amount == 0) revert NoCreatorFeesToWithdraw();
        m.creatorFees = 0;
        _payOut(m, m.creator, amount);
        emit CreatorFeesWithdrawn(marketId, m.creator, amount);
    }

    /// @notice Display-only implied probabilities in WAD (1e18). NEVER used for settlement.
    function getProbability(uint256 marketId) external view returns (uint256 yesProbWad, uint256 noProbWad) {
        Market storage m = markets[marketId];
        yesProbWad = PythagoreanMath.probabilityWad(m.yesSupply, m.noSupply);
        noProbWad = PythagoreanMath.probabilityWad(m.noSupply, m.yesSupply);
    }

    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    function shareBalanceOf(uint256 marketId, bool isYes, address holder) external view returns (uint256) {
        return shareBalances[marketId][isYes][holder];
    }

    /// @dev Required by UUPSUpgradeable — restricts who can push a new implementation.
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// @dev Reserved storage slots so future upgrades can add new state variables
    /// without corrupting the layout of variables declared after this point in a
    /// derived/future version of this contract.
    uint256[50] private __gap;
}
