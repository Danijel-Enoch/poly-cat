// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {MarketFactory} from "../src/MarketFactory.sol";

/// @notice Sets the seed liquidity (msg.value) an already-deployed
/// MarketFactory proxy sends with every new createMarket call. No fallback
/// defaults for either required env var — this touches a live proxy's real
/// state, so a missing value should fail loudly rather than silently target
/// the wrong contract or sign with the wrong key.
///
///   PRIVATE_KEY                    must be the proxy's current owner
///   MARKET_FACTORY_PROXY_ADDRESS   the existing ERC1967Proxy
///   NEW_DEFAULT_INITIAL_LIQUIDITY_WEI   new value in wei; defaults to
///                                  0.00001 ether if unset
contract SetDefaultInitialLiquidity is Script {
    function run() external {
        uint256 ownerKey = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("MARKET_FACTORY_PROXY_ADDRESS");
        uint256 newLiquidity = vm.envOr("NEW_DEFAULT_INITIAL_LIQUIDITY_WEI", uint256(0.00001 ether));

        MarketFactory proxy = MarketFactory(proxyAddress);
        address currentOwner = proxy.owner();
        address signer = vm.addr(ownerKey);
        require(signer == currentOwner, "PRIVATE_KEY is not the proxy owner");

        uint256 previousLiquidity = proxy.defaultInitialLiquidity();

        vm.startBroadcast(ownerKey);
        proxy.setDefaultInitialLiquidity(newLiquidity);
        vm.stopBroadcast();

        console.log("Proxy:               ", proxyAddress);
        console.log("Previous liquidity (wei):", previousLiquidity);
        console.log("New liquidity (wei):     ", newLiquidity);
    }
}
