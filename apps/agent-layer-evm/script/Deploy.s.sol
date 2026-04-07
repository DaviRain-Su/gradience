// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {AgentArenaEVM} from "../src/AgentArenaEVM.sol";
import {JudgeRegistry} from "../src/JudgeRegistry.sol";
import {AgentMRegistry} from "../src/AgentMRegistry.sol";
import {GradienceReputationFeed} from "../src/GradienceReputationFeed.sol";
import {SocialGraph} from "../src/SocialGraph.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address oracle = vm.envOr("ORACLE_ADDRESS", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // AgentArenaEVM (UUPS proxy)
        AgentArenaEVM arenaImpl = new AgentArenaEVM();
        ERC1967Proxy arenaProxy = new ERC1967Proxy(
            address(arenaImpl),
            abi.encodeWithSelector(AgentArenaEVM.initialize.selector, deployer, deployer)
        );
        AgentArenaEVM arena = AgentArenaEVM(address(arenaProxy));

        // JudgeRegistry
        JudgeRegistry registry = new JudgeRegistry(deployer);

        // AgentMRegistry (direct ownable)
        AgentMRegistry agentMRegistry = new AgentMRegistry(deployer);

        // GradienceReputationFeed (UUPS proxy)
        GradienceReputationFeed feedImpl = new GradienceReputationFeed();
        ERC1967Proxy feedProxy = new ERC1967Proxy(
            address(feedImpl),
            abi.encodeWithSelector(GradienceReputationFeed.initialize.selector, deployer, oracle)
        );
        GradienceReputationFeed reputationFeed = GradienceReputationFeed(address(feedProxy));

        // SocialGraph (UUPS proxy)
        SocialGraph socialImpl = new SocialGraph();
        ERC1967Proxy socialProxy = new ERC1967Proxy(
            address(socialImpl),
            abi.encodeWithSelector(SocialGraph.initialize.selector, deployer)
        );
        SocialGraph socialGraph = SocialGraph(address(socialProxy));

        // Wire up
        arena.setJudgeRegistry(address(registry));
        arena.setReputationFeed(address(reputationFeed));
        registry.setArena(address(arena));

        vm.stopBroadcast();
    }
}
