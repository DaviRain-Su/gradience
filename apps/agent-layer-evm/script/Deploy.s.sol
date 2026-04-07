// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {AgentLayerRaceTask} from "../src/AgentLayerRaceTask.sol";
import {JudgeRegistry} from "../src/JudgeRegistry.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        AgentLayerRaceTask arena = new AgentLayerRaceTask(deployer);
        JudgeRegistry registry = new JudgeRegistry(deployer);

        arena.setJudgeRegistry(address(registry));
        registry.setArena(address(arena));

        vm.stopBroadcast();
    }
}
