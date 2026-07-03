// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {MarketFactory} from "../src/MarketFactory.sol";

/// @notice Upgrades an already-deployed MarketFactory UUPS proxy to a new
/// implementation. Deliberately has no fallback defaults for either env var
/// (unlike Deploy.s.sol's Anvil-friendly defaults) — this touches a live
/// proxy's real state, so a missing value should fail loudly rather than
/// silently target the wrong contract or sign with the wrong key.
///
///   PRIVATE_KEY                    must be the proxy's current owner
///   MARKET_FACTORY_PROXY_ADDRESS   the existing ERC1967Proxy — never redeployed;
///                                  all market state carries over untouched
///   POST_UPGRADE_CALLDATA          optional; ABI-encoded call (e.g. from `cast
///                                  calldata`) run atomically via delegatecall
///                                  right after the swap, in the same transaction
///                                  — for new state a fresh `initialize()` didn't
///                                  set, so there's no window where it reads as a
///                                  zero-value default. Defaults to a no-op.
contract Upgrade is Script {
    function run() external {
        uint256 ownerKey = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("MARKET_FACTORY_PROXY_ADDRESS");
        bytes memory postUpgradeCalldata = vm.envOr("POST_UPGRADE_CALLDATA", bytes(""));

        MarketFactory proxy = MarketFactory(proxyAddress);
        address currentOwner = proxy.owner();
        address signer = vm.addr(ownerKey);
        require(signer == currentOwner, "PRIVATE_KEY is not the proxy owner");

        vm.startBroadcast(ownerKey);
        MarketFactory newImplementation = new MarketFactory();
        proxy.upgradeToAndCall(address(newImplementation), postUpgradeCalldata);
        vm.stopBroadcast();

        console.log("New implementation:", address(newImplementation));
        console.log("Proxy (unchanged): ", proxyAddress);
        if (postUpgradeCalldata.length > 0) {
            console.log("Post-upgrade call executed atomically with the upgrade.");
        }
    }
}
