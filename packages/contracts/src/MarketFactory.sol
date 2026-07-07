// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {PythagoreanMath} from "./libraries/PythagoreanMath.sol";

/// @notice Polycat: fixed-5-minute-window Up/Down markets over an
/// owner-curated, open-ended list of assets — not just BTC/ETH/SOL. A single
/// contract instance serves every asset and every market (no per-asset or
/// per-market clones, no chained oracle/indexer contracts). The owner (an
/// off-chain cron script — see packages/cron) registers new assets via
/// `registerAsset`, each tagged with which off-chain price API to read it
/// from (`PriceSource`), then opens/settles markets for them exactly like
/// the original fixed 3-asset design: a market is created for one asset at a
/// time with the asset's price at `startTime` recorded on-chain, then
/// settled once `closeTime` passes by submitting the observed close price —
/// Down wins if it's below the recorded start price, Up wins if above, and
/// an exact tie is a push (see `settleMarket`).
///
/// Pricing uses the same Pythagorean bonding curve as before (`reserve =
/// c*sqrt(upSupply^2 + downSupply^2)`, see `PythagoreanMath`) — the math has
/// no coupling to what a market's two outcomes represent, or to how many
/// assets exist.
///
/// Every market is denominated and settled in native ETH — traders send
/// ETH directly with `buyShares`/`createMarket` (`payable`), and every
/// payout is a low-level `call{value: ...}` rather than an ERC20 transfer.
/// There's no collateral token address to configure at all.
///
/// Deployed behind a UUPS proxy (`ERC1967Proxy`, see `script/Deploy.s.sol`).
contract MarketFactory is Initializable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardTransient {
    enum MarketState {
        Trading,
        Finalized,
        Cancelled
    }

    /// @notice Which off-chain API `packages/cron` reads an asset's price
    /// from. Gate for centralized-exchange-listed ("blue chip") tokens,
    /// DexScreener for on-chain pairs (memecoins, starting with Robinhood
    /// Chain's own).
    enum PriceSource {
        Gate,
        DexScreener
    }

    /// @notice `sourceId` is the identifier `packages/cron` passes straight
    /// through to whichever API `source` points at: a Gate.com currency pair
    /// like `"BTC_USDT"`, or a DexScreener pair address like
    /// `"0xa70fc67c9f69da90b63a0e4c05d229954574e313"`. Not validated
    /// on-chain — the owner (cron wallet) is trusted the same way it's
    /// already trusted to submit settlement prices.
    struct AssetInfo {
        string symbol;
        PriceSource source;
        string sourceId;
    }

    struct Market {
        uint256 assetId;
        uint64 startTime;
        uint64 closeTime;
        uint256 startPriceWad; // asset price (WAD, 1e18) at startTime, recorded by the cron
        uint256 closePriceWad; // asset price (WAD) at settlement; 0 until settled
        uint256 reserve; // r: real collateral custodied for this market's curve
        uint256 upSupply; // sUp: virtual accounting supply, not a real token
        uint256 downSupply; // sDown: virtual accounting supply, not a real token
        uint256 genesisSupply; // s0 baked into upSupply/downSupply at creation, held by no one — see claimRefund
        uint256 collectedFees; // withdrawable by the owner via withdrawFees
        MarketState state;
        bool outcome; // valid only when state == Finalized; true = Up won
    }

    uint64 public constant MIN_TRADING_DURATION = 4 minutes;
    uint16 public constant MAX_FEE_BPS = 500; // 5% ceiling on the admin-settable protocol fee
    uint256 private constant BPS_DENOMINATOR = 10_000;

    address public protocolTreasury;

    /// @notice Protocol-wide trading fee, in basis points, charged on both buys
    /// (taken from the input) and sells (taken from the output). Applies uniformly to
    /// every market.
    uint16 public feeBps;

    uint256 public nextMarketId; // 0 is reserved/invalid

    /// @notice Collateral seeded into a new market's bonding curve by `createMarket`,
    /// pulled from the owner's (cron wallet's) own balance. Owner-settable so the
    /// depth/starting price sensitivity of every future market can be tuned without
    /// redeploying.
    uint256 public defaultInitialLiquidity;

    /// @notice Owner-curated asset registry. `assetId`s are assigned
    /// sequentially starting at 0 and never reused — see `registerAsset`.
    mapping(uint256 => AssetInfo) public assets;
    uint256 public nextAssetId;

    mapping(uint256 => Market) public markets;
    // marketId => isUp => holder => balance. Internal balances (not per-market ERC20s).
    mapping(uint256 => mapping(bool => mapping(address => uint256))) internal shareBalances;

    /// @notice The currently open (or most recently created) market for each
    /// asset, so the cron and the frontend can both find "the current market
    /// for CASHCAT" in a single read with no off-chain bookkeeping.
    mapping(uint256 => uint256) public currentMarketId;

    event AssetRegistered(uint256 indexed assetId, string symbol, PriceSource source, string sourceId);
    event MarketCreated(
        uint256 indexed marketId,
        uint256 indexed assetId,
        uint64 startTime,
        uint64 closeTime,
        uint256 startPriceWad,
        uint256 initialLiquidity
    );
    event SharesBought(
        uint256 indexed marketId,
        address indexed buyer,
        bool isUp,
        uint256 collateralIn,
        uint256 sharesOut,
        uint256 feePaid,
        uint256 newUpSupply,
        uint256 newDownSupply
    );
    event SharesSold(
        uint256 indexed marketId,
        address indexed seller,
        bool isUp,
        uint256 sharesIn,
        uint256 collateralOut,
        uint256 feePaid,
        uint256 newUpSupply,
        uint256 newDownSupply
    );
    event Redeemed(uint256 indexed marketId, address indexed redeemer, uint256 payout, bool outcome);
    event FeesWithdrawn(uint256 indexed marketId, address indexed to, uint256 amount);
    event ProtocolTreasurySet(address indexed treasury);
    event ProtocolFeeSet(uint16 feeBps);
    event DefaultInitialLiquiditySet(uint256 defaultInitialLiquidity);
    event MarketSettled(uint256 indexed marketId, uint256 closePriceWad, bool outcome);
    event MarketPushed(uint256 indexed marketId, uint256 closePriceWad);
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
    error CloseTimeTooSoon();
    error LiquidityTooLow();
    error FeeTooHigh();
    error CloseTimeNotExtended();
    error MarketNotCancelled();
    error NothingToRefund();
    error SlotAlreadyOpen();
    error InvalidAsset();
    error IncorrectValue();
    error TransferFailed();

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
        defaultInitialLiquidity = 0.3 ether; // rough starting point (no price oracle); owner-adjustable
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

    /// @notice Admin-only update to the collateral seeded into every newly created
    /// market's bonding curve.
    function setDefaultInitialLiquidity(uint256 _defaultInitialLiquidity) external onlyOwner {
        if (_defaultInitialLiquidity == 0) revert LiquidityTooLow();
        defaultInitialLiquidity = _defaultInitialLiquidity;
        emit DefaultInitialLiquiditySet(_defaultInitialLiquidity);
    }

    /// @notice Owner-only registration of a new tradeable asset — this is
    /// the entire "add a market" flow; once registered, `createMarket` can
    /// open windows for it. `symbol` is display-only; `sourceId` is
    /// whatever identifier `source`'s API needs (see `AssetInfo`). Neither
    /// is validated beyond non-empty, the same trust level as the owner's
    /// existing settlement authority.
    function registerAsset(string calldata symbol, PriceSource source, string calldata sourceId)
        external
        onlyOwner
        returns (uint256 assetId)
    {
        if (bytes(symbol).length == 0 || bytes(sourceId).length == 0) revert InvalidAsset();
        assetId = nextAssetId++;
        assets[assetId] = AssetInfo({symbol: symbol, source: source, sourceId: sourceId});
        emit AssetRegistered(assetId, symbol, source, sourceId);
    }

    /// @notice Owner-only (the cron wallet) creation of a new 5-minute market
    /// window for one registered asset. `startPriceWad` is the asset's price
    /// at `startTime`, observed off-chain by the cron and recorded here as
    /// the strike every later buy/sell/settlement is judged against.
    /// Reverts if that asset's current market is still within its trading
    /// window — an asset has at most one open market at a time. Caller must
    /// send exactly `defaultInitialLiquidity` in ETH to seed the curve.
    function createMarket(uint256 assetId, uint64 startTime, uint64 closeTime, uint256 startPriceWad)
        external
        payable
        onlyOwner
        nonReentrant
        returns (uint256 marketId)
    {
        if (assetId >= nextAssetId) revert InvalidAsset();
        if (closeTime < startTime + MIN_TRADING_DURATION) revert CloseTimeTooSoon();
        if (startPriceWad == 0) revert ZeroAmount();

        uint256 existing = currentMarketId[assetId];
        if (existing != 0 && markets[existing].state == MarketState.Trading && block.timestamp < markets[existing].closeTime)
        {
            revert SlotAlreadyOpen();
        }

        uint256 initialLiquidity = defaultInitialLiquidity;
        if (msg.value != initialLiquidity) revert IncorrectValue();
        uint256 s0 = PythagoreanMath.seedGenesis(initialLiquidity);

        marketId = nextMarketId++;
        Market storage m = markets[marketId];
        m.assetId = assetId;
        m.startTime = startTime;
        m.closeTime = closeTime;
        m.startPriceWad = startPriceWad;
        m.reserve = initialLiquidity;
        m.upSupply = s0;
        m.downSupply = s0;
        m.genesisSupply = s0;
        m.state = MarketState.Trading;

        currentMarketId[assetId] = marketId;

        emit MarketCreated(marketId, assetId, startTime, closeTime, startPriceWad, initialLiquidity);
    }

    /// @notice Buy `isUp` shares by sending ETH via the bonding curve.
    function buyShares(uint256 marketId, bool isUp, uint256 minSharesOut)
        external
        payable
        nonReentrant
        returns (uint256 sharesOut)
    {
        Market storage m = markets[marketId];
        if (m.state != MarketState.Trading) revert MarketNotTrading();
        if (block.timestamp >= m.closeTime) revert MarketClosed();
        uint256 amountIn = msg.value;
        if (amountIn == 0) revert ZeroAmount();

        (uint256 sSame, uint256 sOther) = isUp ? (m.upSupply, m.downSupply) : (m.downSupply, m.upSupply);
        uint256 newR;
        uint256 newSSame;
        uint256 feePaid;
        (sharesOut, newR, newSSame, feePaid) = PythagoreanMath.quoteBuy(m.reserve, sSame, sOther, amountIn, feeBps);
        if (sharesOut < minSharesOut) revert SlippageExceeded();

        m.reserve = newR;
        if (isUp) {
            m.upSupply = newSSame;
        } else {
            m.downSupply = newSSame;
        }
        m.collectedFees += feePaid;
        shareBalances[marketId][isUp][msg.sender] += sharesOut;

        emit SharesBought(marketId, msg.sender, isUp, amountIn, sharesOut, feePaid, m.upSupply, m.downSupply);
    }

    /// @notice Sell `sharesIn` shares of `isUp` back to the pool for ETH.
    function sellShares(uint256 marketId, bool isUp, uint256 sharesIn, uint256 minCollateralOut)
        external
        nonReentrant
        returns (uint256 collateralOut)
    {
        Market storage m = markets[marketId];
        if (m.state != MarketState.Trading) revert MarketNotTrading();
        if (block.timestamp >= m.closeTime) revert MarketClosed();
        if (sharesIn == 0) revert ZeroAmount();
        if (shareBalances[marketId][isUp][msg.sender] < sharesIn) revert InsufficientShareBalance();

        (uint256 sSame, uint256 sOther) = isUp ? (m.upSupply, m.downSupply) : (m.downSupply, m.upSupply);
        uint256 newR;
        uint256 newSSame;
        uint256 feePaid;
        (collateralOut, newR, newSSame, feePaid) =
            PythagoreanMath.quoteSell(m.reserve, sSame, sOther, sharesIn, feeBps);
        if (collateralOut < minCollateralOut) revert SlippageExceeded();

        shareBalances[marketId][isUp][msg.sender] -= sharesIn;
        m.reserve = newR;
        if (isUp) {
            m.upSupply = newSSame;
        } else {
            m.downSupply = newSSame;
        }
        m.collectedFees += feePaid;

        _sendEth(msg.sender, collateralOut);

        emit SharesSold(marketId, msg.sender, isUp, sharesIn, collateralOut, feePaid, m.upSupply, m.downSupply);
    }

    /// @notice Redeem winning shares 1:1 for ETH after the market is finalized.
    /// Losing shares are worthless; both sides are zeroed to keep state tidy.
    function redeem(uint256 marketId) external nonReentrant returns (uint256 payout) {
        Market storage m = markets[marketId];
        if (m.state != MarketState.Finalized) revert MarketNotFinalized();

        bool outcome = m.outcome;
        payout = shareBalances[marketId][outcome][msg.sender];
        if (payout == 0) revert NothingToRedeem();

        shareBalances[marketId][true][msg.sender] = 0;
        shareBalances[marketId][false][msg.sender] = 0;

        _sendEth(msg.sender, payout);

        emit Redeemed(marketId, msg.sender, payout, outcome);
    }

    /// @notice Owner-only (the cron wallet) settlement: submits the asset's observed
    /// close price. Down wins if it's strictly below the recorded start price, Up
    /// wins if strictly above. An exact tie is a push — rather than inventing new
    /// payout math for a case that isn't really a win for either side, the market is
    /// marked `Cancelled` and reuses the same pro-rata `claimRefund` path a manually
    /// cancelled market already uses. Callable only once a market has closed, and
    /// only once per market.
    function settleMarket(uint256 marketId, uint256 closePriceWad) external onlyOwner {
        Market storage m = markets[marketId];
        if (m.state != MarketState.Trading) revert AlreadyResolved();
        if (block.timestamp < m.closeTime) revert SettlementNotOpen();
        if (closePriceWad == 0) revert ZeroAmount();

        m.closePriceWad = closePriceWad;

        if (closePriceWad == m.startPriceWad) {
            m.state = MarketState.Cancelled;
            emit MarketPushed(marketId, closePriceWad);
            return;
        }

        m.state = MarketState.Finalized;
        m.outcome = closePriceWad > m.startPriceWad;
        emit MarketSettled(marketId, closePriceWad, m.outcome);
    }

    /// @notice Push a market's close time further out, e.g. when the cron script is
    /// down past the original deadline. Note this also reopens trading until the new
    /// deadline, since `closeTime` gates both.
    function extendCloseTime(uint256 marketId, uint64 newCloseTime) external onlyOwner {
        Market storage m = markets[marketId];
        if (m.state != MarketState.Trading) revert MarketNotTrading();
        if (newCloseTime <= m.closeTime) revert CloseTimeNotExtended();
        m.closeTime = newCloseTime;
        emit CloseTimeExtended(marketId, newCloseTime);
    }

    /// @notice Emergency abandon of a market instead of settling it, letting every
    /// share holder reclaim a pro-rata slice of the pool via `claimRefund`. Callable
    /// any time the market is `Trading` — an operator safety valve, distinct from the
    /// automatic tie/push case in `settleMarket`.
    function cancelMarket(uint256 marketId) external onlyOwner {
        Market storage m = markets[marketId];
        if (m.state != MarketState.Trading) revert MarketNotTrading();
        m.state = MarketState.Cancelled;
        emit MarketCancelled(marketId);
    }

    /// @notice Claim a pro-rata refund from a cancelled (or pushed) market's reserve.
    /// Paying every Up/Down share 1:1 would be insolvent here: the Pythagorean curve
    /// guarantees `reserve <= upSupply + downSupply`, not equality. Splitting
    /// `reserve` proportionally across each holder's combined Up+Down balance instead
    /// sums to exactly `reserve` once everyone claims — `upSupply`/`downSupply`
    /// themselves are net of `genesisSupply` first, since that seed liquidity is
    /// virtual accounting baked in at creation and isn't held by any address.
    function claimRefund(uint256 marketId) external nonReentrant returns (uint256 payout) {
        Market storage m = markets[marketId];
        if (m.state != MarketState.Cancelled) revert MarketNotCancelled();

        uint256 userShares = shareBalances[marketId][true][msg.sender] + shareBalances[marketId][false][msg.sender];
        if (userShares == 0) revert NothingToRefund();

        uint256 totalShares = (m.upSupply - m.genesisSupply) + (m.downSupply - m.genesisSupply);
        payout = Math.mulDiv(m.reserve, userShares, totalShares);

        shareBalances[marketId][true][msg.sender] = 0;
        shareBalances[marketId][false][msg.sender] = 0;

        _sendEth(msg.sender, payout);
        emit RefundClaimed(marketId, msg.sender, payout);
    }

    function withdrawFees(uint256 marketId) external onlyOwner nonReentrant {
        Market storage m = markets[marketId];
        uint256 amount = m.collectedFees;
        if (amount == 0) revert NoFeesToWithdraw();
        m.collectedFees = 0;
        _sendEth(protocolTreasury, amount);
        emit FeesWithdrawn(marketId, protocolTreasury, amount);
    }

    /// @dev Low-level ETH send used by every payout path (sell, redeem, refund,
    /// fee withdrawal) — every caller already carries `nonReentrant` and follows
    /// checks-effects-interactions (state is zeroed/decremented before this
    /// runs), so a plain `call` here is safe against reentrancy.
    function _sendEth(address to, uint256 amount) private {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    /// @notice Display-only implied probabilities in WAD (1e18). NEVER used for settlement.
    function getProbability(uint256 marketId) external view returns (uint256 upProbWad, uint256 downProbWad) {
        Market storage m = markets[marketId];
        upProbWad = PythagoreanMath.probabilityWad(m.upSupply, m.downSupply);
        downProbWad = PythagoreanMath.probabilityWad(m.downSupply, m.upSupply);
    }

    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    function getAsset(uint256 assetId) external view returns (AssetInfo memory) {
        return assets[assetId];
    }

    function shareBalanceOf(uint256 marketId, bool isUp, address holder) external view returns (uint256) {
        return shareBalances[marketId][isUp][holder];
    }

    /// @dev Required by UUPSUpgradeable — restricts who can push a new implementation.
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// @dev Reserved storage slots so future upgrades can add new state variables
    /// without corrupting the layout of variables declared after this point.
    uint256[44] private __gap;
}
