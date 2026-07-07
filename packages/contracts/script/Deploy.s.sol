// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {MarketFactory} from "../src/MarketFactory.sol";

/// @notice MarketFactory behind a UUPS `ERC1967Proxy`. Trading is native
/// ETH — there's no collateral token to deploy or wire in. The deployer is
/// the factory owner and therefore the sole account that can settle markets
/// via `settleMarket` or push upgrades via `upgradeToAndCall` — reassign
/// ownership to a multisig before any real deployment.
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", uint256(0x1));
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        MarketFactory implementation = new MarketFactory();
        ERC1967Proxy proxy =
            new ERC1967Proxy(address(implementation), abi.encodeCall(MarketFactory.initialize, (deployer)));
        MarketFactory factory = MarketFactory(address(proxy));

        // Seed the initial asset registry: the three Gate.com-priced "blue
        // chip" assets, plus CashCat, the first Robinhood Chain memecoin,
        // priced via its DexScreener pair, as the first DexScreener-sourced
        // asset. packages/cron opens/settles markets for whatever's
        // registered here; more can be added later via registerAsset
        // (surfaced in the admin dashboard).
        factory.registerAsset("BTC", MarketFactory.PriceSource.Gate, "BTC_USDT");
        factory.registerAsset("ETH", MarketFactory.PriceSource.Gate, "ETH_USDT");
        factory.registerAsset("SOL", MarketFactory.PriceSource.Gate, "SOL_USDT");
        factory.registerAsset(
            "CASHCAT", MarketFactory.PriceSource.DexScreener, "0xa70fc67c9f69da90b63a0e4c05d229954574e313"
        );

        vm.stopBroadcast();

        console.log("MarketFactory (impl):", address(implementation));
        console.log("MarketFactory (proxy):", address(factory));
        console.log("Deployer/owner:      ", deployer);
    }
}
