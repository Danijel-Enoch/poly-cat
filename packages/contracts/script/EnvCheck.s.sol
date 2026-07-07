// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import {Script, console} from "forge-std/Script.sol";
contract EnvCheck is Script {
    function run() external view {
        console.log("PRIVATE_KEY set?", vm.envOr("PRIVATE_KEY", uint256(0)) != 0);
    }
}
