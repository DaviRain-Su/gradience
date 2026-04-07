// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {AgentLayerRaceTask} from "../src/AgentLayerRaceTask.sol";
import {JudgeRegistry} from "../src/JudgeRegistry.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        AgentLayerRaceTask impl = new AgentLayerRaceTask();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeWithSelector(AgentLayerRaceTask.initialize.selector, deployer, deployer)
        );
        AgentLayerRaceTask arena = AgentLayerRaceTask(address(proxy));

        JudgeRegistry registry = new JudgeRegistry(deployer);
        arena.setJudgeRegistry(address(registry));
        registry.setArena(address(arena));

        vm.stopBroadcast();
    }
}
