// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {MarketFactory} from "../src/MarketFactory.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// @notice Local/testnet deployment: MockUSDC + MarketFactory (behind a UUPS
/// `ERC1967Proxy`). The deployer is the factory owner and therefore the sole
/// account that can settle markets via `settleMarket` or push upgrades via
/// `upgradeToAndCall` — reassign ownership to a multisig before any real deployment.
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", uint256(0x1));
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        MockUSDC usdc = new MockUSDC();

        MarketFactory implementation = new MarketFactory();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation), abi.encodeCall(MarketFactory.initialize, (deployer))
        );
        MarketFactory factory = MarketFactory(address(proxy));

        usdc.mint(deployer, 1_000_000e6);

        vm.stopBroadcast();

        console.log("MockUSDC:            ", address(usdc));
        console.log("MarketFactory (impl):", address(implementation));
        console.log("MarketFactory (proxy):", address(factory));
        console.log("Deployer/owner:      ", deployer);
    }
}
