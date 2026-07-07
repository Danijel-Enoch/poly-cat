// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {MarketFactory} from "../src/MarketFactory.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// @notice MarketFactory (behind a UUPS `ERC1967Proxy`) plus a collateral
/// token: on local/testnet, a freshly deployed MockUSDC (minted to the
/// deployer for convenience); on a real network, set `USDC_ADDRESS` to an
/// already-deployed token (e.g. real USDG on Robinhood Chain mainnet) to skip
/// deploying/minting a mock entirely. The deployer is the factory owner and
/// therefore the sole account that can settle markets via `settleMarket` or
/// push upgrades via `upgradeToAndCall` — reassign ownership to a multisig
/// before any real deployment.
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", uint256(0x1));
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        address usdc = vm.envOr("USDC_ADDRESS", address(0));
        bool isMock = usdc == address(0);
        if (isMock) {
            usdc = address(new MockUSDC());
        }

        MarketFactory implementation = new MarketFactory();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation), abi.encodeCall(MarketFactory.initialize, (deployer, usdc))
        );
        MarketFactory factory = MarketFactory(address(proxy));

        if (isMock) {
            MockUSDC(usdc).mint(deployer, 1_000_000e6);
        }

        // The owner (deployer here, the cron wallet in production) is the
        // account `createMarket` pulls each new market's seed liquidity from
        // — approve the factory up front so the cron doesn't need a separate
        // approval step before its first run.
        IERC20(usdc).approve(address(factory), type(uint256).max);

        // Seed the initial asset registry: the three Gate.com-priced "blue
        // chip" assets, plus CashCat — the first Robinhood Chain memecoin,
        // priced via its DexScreener pair — as the first DexScreener-sourced
        // asset. `packages/cron` opens/settles markets for whatever's
        // registered here; more can be added later via `registerAsset`
        // (surfaced in the admin dashboard).
        factory.registerAsset("BTC", MarketFactory.PriceSource.Gate, "BTC_USDT");
        factory.registerAsset("ETH", MarketFactory.PriceSource.Gate, "ETH_USDT");
        factory.registerAsset("SOL", MarketFactory.PriceSource.Gate, "SOL_USDT");
        factory.registerAsset(
            "CASHCAT", MarketFactory.PriceSource.DexScreener, "0xa70fc67c9f69da90b63a0e4c05d229954574e313"
        );

        vm.stopBroadcast();

        console.log(isMock ? "MockUSDC:            " : "USDC (existing):     ", usdc);
        console.log("MarketFactory (impl):", address(implementation));
        console.log("MarketFactory (proxy):", address(factory));
        console.log("Deployer/owner:      ", deployer);
    }
}
