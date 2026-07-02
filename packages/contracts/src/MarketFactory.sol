// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {PythagoreanMath} from "./libraries/PythagoreanMath.sol";

/// @notice Permissionless prediction-market factory, bonding-curve AMM, and
/// collateral custody hub. Settlement is admin-controlled: the contract owner
/// calls `settleMarket` directly once a market's close time has passed — no bond,
/// no dispute, no oracle module. Market price/probability is never read as a
/// settlement signal anywhere in this contract.
///
/// Pricing uses a Pythagorean bonding curve (`reserve = c*sqrt(yesSupply^2 +
/// noSupply^2)`, see `PythagoreanMath`) rather than a constant-product AMM — this
/// matches PNP Exchange / Azuro-style prediction market design.
///
/// One contract instance serves every market (keyed by `marketId`), rather than one
/// clone/proxy per market: this keeps outcome shares as cheap internal balances
/// instead of per-market ERC20s, and gives an indexer (Ponder) a single address and
/// ABI to track instead of discovering N child contracts.
contract MarketFactory is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum MarketState {
        Trading,
        Finalized
    }

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
        uint256 collectedFees;
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

    address public protocolTreasury;

    /// @notice Protocol-wide trading fee, in basis points, charged to the admin's
    /// benefit on both buys (taken from the input) and sells (taken from the output).
    /// Applies uniformly to every market — not creator-configurable.
    uint16 public feeBps = 100; // 1%

    uint256 public nextMarketId = 1; // 0 is reserved/invalid

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
    event ProtocolTreasurySet(address indexed treasury);
    event ProtocolFeeSet(uint16 feeBps);
    event MarketSettled(uint256 indexed marketId, bool outcome);

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
    error CloseTimeTooSoon();
    error LiquidityTooLow();
    error FeeTooHigh();
    error NotAContract();

    constructor(address _protocolTreasury) Ownable(msg.sender) {
        require(_protocolTreasury != address(0));
        protocolTreasury = _protocolTreasury;
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
    /// Pulls `initialLiquidity` from the caller and seeds the bonding curve.
    function createMarket(CreateMarketParams calldata p) external nonReentrant returns (uint256 marketId) {
        if (p.closeTime < block.timestamp + MIN_TRADING_DURATION) revert CloseTimeTooSoon();
        if (p.initialLiquidity < MIN_INITIAL_LIQUIDITY) revert LiquidityTooLow();
        if (p.collateralToken.code.length == 0) revert NotAContract();

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
        m.state = MarketState.Trading;

        IERC20(p.collateralToken).safeTransferFrom(msg.sender, address(this), p.initialLiquidity);

        emit MarketCreated(
            marketId, msg.sender, p.collateralToken, p.questionHash, p.metadataURI, p.closeTime, p.initialLiquidity
        );
    }

    /// @notice Buy `isYes` shares by depositing `amountIn` collateral via the bonding curve.
    function buyShares(uint256 marketId, bool isYes, uint256 amountIn, uint256 minSharesOut)
        external
        nonReentrant
        returns (uint256 sharesOut)
    {
        Market storage m = markets[marketId];
        if (m.state != MarketState.Trading) revert MarketNotTrading();
        if (block.timestamp >= m.closeTime) revert MarketClosed();
        if (amountIn == 0) revert ZeroAmount();

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
        m.collectedFees += feePaid;
        shareBalances[marketId][isYes][msg.sender] += sharesOut;

        m.collateralToken.safeTransferFrom(msg.sender, address(this), amountIn);

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
        m.collectedFees += feePaid;

        m.collateralToken.safeTransfer(msg.sender, collateralOut);

        emit SharesSold(marketId, msg.sender, isYes, sharesIn, collateralOut, feePaid, m.yesSupply, m.noSupply);
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

        m.collateralToken.safeTransfer(msg.sender, payout);

        emit Redeemed(marketId, msg.sender, payout, outcome);
    }

    /// @notice Admin-only settlement. The owner is the sole source of truth for
    /// every market's outcome — no bond, no dispute, no oracle module. Callable
    /// only once a market has closed, and only once per market.
    function settleMarket(uint256 marketId, bool outcome) external onlyOwner {
        Market storage m = markets[marketId];
        if (m.state != MarketState.Trading) revert AlreadyResolved();
        if (block.timestamp < m.closeTime) revert SettlementNotOpen();
        m.state = MarketState.Finalized;
        m.outcome = outcome;
        emit MarketSettled(marketId, outcome);
    }

    function withdrawFees(uint256 marketId) external onlyOwner {
        Market storage m = markets[marketId];
        uint256 amount = m.collectedFees;
        if (amount == 0) revert NoFeesToWithdraw();
        m.collectedFees = 0;
        m.collateralToken.safeTransfer(protocolTreasury, amount);
        emit FeesWithdrawn(marketId, protocolTreasury, amount);
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
}
