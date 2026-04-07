// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {DeterministicDeployer} from "../src/utils/DeterministicDeployer.sol";
import {AgentArenaEVM} from "../src/AgentArenaEVM.sol";
import {JudgeRegistry} from "../src/JudgeRegistry.sol";
import {AgentMRegistry} from "../src/AgentMRegistry.sol";
import {GradienceReputationFeed} from "../src/GradienceReputationFeed.sol";
import {SocialGraph} from "../src/SocialGraph.sol";

/**
 * @notice Deploys full AgentArenaEVM P0 infrastructure deterministically via CREATE2.
 * @dev Salt format: keccak256("GRADIENCE_V1_<CONTRACT_NAME>")
 */
contract DeterministicDeployScript is Script {
    bytes32 internal constant SALT_DEPLOYER = keccak256("GRADIENCE_V1_DeterministicDeployer");
    bytes32 internal constant SALT_JUDGE_REGISTRY = keccak256("GRADIENCE_V1_JudgeRegistry");
    bytes32 internal constant SALT_AGENT_M_REGISTRY = keccak256("GRADIENCE_V1_AgentMRegistry");
    bytes32 internal constant SALT_REPUTATION_FEED = keccak256("GRADIENCE_V1_GradienceReputationFeed");
    bytes32 internal constant SALT_SOCIAL_GRAPH = keccak256("GRADIENCE_V1_SocialGraph");
    bytes32 internal constant SALT_ARENA_IMPL = keccak256("GRADIENCE_V1_AgentArenaEVM_Impl");
    bytes32 internal constant SALT_ARENA_PROXY = keccak256("GRADIENCE_V1_AgentArenaEVM_Proxy");

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address oracle = vm.envOr("ORACLE_ADDRESS", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Reuse existing DeterministicDeployer if env var is set, otherwise deploy fresh.
        DeterministicDeployer dd;
        try vm.envAddress("DETERMINISTIC_DEPLOYER") returns (address existing) {
            dd = DeterministicDeployer(existing);
        } catch {
            dd = new DeterministicDeployer();
        }

        // 2. Deploy JudgeRegistry
        address predictedRegistry = dd.computeAddress(SALT_JUDGE_REGISTRY, keccak256(type(JudgeRegistry).creationCode));
        if (predictedRegistry.code.length == 0) {
            dd.deploy(SALT_JUDGE_REGISTRY, type(JudgeRegistry).creationCode);
        }
        JudgeRegistry registry = JudgeRegistry(predictedRegistry);

        // 3. Deploy AgentMRegistry
        address predictedAgentMRegistry = dd.computeAddress(SALT_AGENT_M_REGISTRY, keccak256(type(AgentMRegistry).creationCode));
        if (predictedAgentMRegistry.code.length == 0) {
            dd.deploy(SALT_AGENT_M_REGISTRY, type(AgentMRegistry).creationCode);
        }
        AgentMRegistry agentMRegistry = AgentMRegistry(predictedAgentMRegistry);

        // 4. Deploy GradienceReputationFeed (UUPS proxy)
        address predictedReputationFeedImpl = dd.computeAddress(
            keccak256("GRADIENCE_V1_GradienceReputationFeed_Impl"),
            keccak256(type(GradienceReputationFeed).creationCode)
        );
        if (predictedReputationFeedImpl.code.length == 0) {
            dd.deploy(keccak256("GRADIENCE_V1_GradienceReputationFeed_Impl"), type(GradienceReputationFeed).creationCode);
        }
        bytes memory reputationFeedInit = abi.encodeWithSelector(GradienceReputationFeed.initialize.selector, deployer, oracle);
        address predictedReputationFeedProxy = dd.computeAddress(
            SALT_REPUTATION_FEED,
            keccak256(abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(predictedReputationFeedImpl, reputationFeedInit)))
        );
        if (predictedReputationFeedProxy.code.length == 0) {
            dd.deploy(
                SALT_REPUTATION_FEED,
                abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(predictedReputationFeedImpl, reputationFeedInit))
            );
        }
        GradienceReputationFeed reputationFeed = GradienceReputationFeed(predictedReputationFeedProxy);

        // 5. Deploy SocialGraph (UUPS proxy)
        address predictedSocialGraphImpl = dd.computeAddress(
            keccak256("GRADIENCE_V1_SocialGraph_Impl"),
            keccak256(type(SocialGraph).creationCode)
        );
        if (predictedSocialGraphImpl.code.length == 0) {
            dd.deploy(keccak256("GRADIENCE_V1_SocialGraph_Impl"), type(SocialGraph).creationCode);
        }
        bytes memory socialGraphInit = abi.encodeWithSelector(SocialGraph.initialize.selector, deployer);
        address predictedSocialGraphProxy = dd.computeAddress(
            SALT_SOCIAL_GRAPH,
            keccak256(abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(predictedSocialGraphImpl, socialGraphInit)))
        );
        if (predictedSocialGraphProxy.code.length == 0) {
            dd.deploy(
                SALT_SOCIAL_GRAPH,
                abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(predictedSocialGraphImpl, socialGraphInit))
            );
        }
        SocialGraph socialGraph = SocialGraph(predictedSocialGraphProxy);

        // 6. Deploy AgentArenaEVM implementation
        address predictedImpl = dd.computeAddress(SALT_ARENA_IMPL, keccak256(type(AgentArenaEVM).creationCode));
        if (predictedImpl.code.length == 0) {
            dd.deploy(SALT_ARENA_IMPL, type(AgentArenaEVM).creationCode);
        }

        // 7. Deploy proxy with deterministic init data
        bytes memory proxyInitData = abi.encodeWithSelector(AgentArenaEVM.initialize.selector, deployer, deployer);
        address predictedProxy = dd.computeAddress(
            SALT_ARENA_PROXY,
            keccak256(abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(predictedImpl, proxyInitData)))
        );
        if (predictedProxy.code.length == 0) {
            dd.deploy(
                SALT_ARENA_PROXY,
                abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(predictedImpl, proxyInitData))
            );
        }
        AgentArenaEVM arena = AgentArenaEVM(predictedProxy);

        // 8. Wire up references
        arena.setJudgeRegistry(address(registry));
        arena.setReputationFeed(address(reputationFeed));
        registry.setArena(address(arena));

        vm.stopBroadcast();
    }
}
