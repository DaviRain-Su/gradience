// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {TestPermitERC20} from "../src/mocks/TestPermitERC20.sol";

contract DeployTestPermitERC20Script is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        TestPermitERC20 token = new TestPermitERC20();
        token.mint(deployer, 10_000 * 10 ** 18);

        console.log("TestPermitERC20 deployed at:", address(token));
        console.log("Minted 10,000 TPERM to deployer:", deployer);

        vm.stopBroadcast();
    }
}
