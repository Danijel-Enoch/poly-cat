// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {MarketFactory} from "../src/MarketFactory.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// @notice Local/testnet deployment: MockUSDC + MarketFactory. The deployer is the
/// factory owner and therefore the sole account that can settle markets via
/// `settleMarket` — reassign ownership to a multisig before any real deployment.
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", uint256(0x1));
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        MockUSDC usdc = new MockUSDC();
        MarketFactory factory = new MarketFactory(deployer);

        usdc.mint(deployer, 1_000_000e6);

        vm.stopBroadcast();

        console.log("MockUSDC:      ", address(usdc));
        console.log("MarketFactory: ", address(factory));
        console.log("Deployer/owner:", deployer);
    }
}
