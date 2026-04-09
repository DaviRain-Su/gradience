// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {X402Settlement} from "../src/X402Settlement.sol";

contract DeployX402SettlementScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        X402Settlement settlement = new X402Settlement();

        console.log("X402Settlement deployed at:", address(settlement));
        console.log("Deployer:", deployer);

        vm.stopBroadcast();
    }
}
