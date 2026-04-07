// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {DeterministicDeployer} from "../src/utils/DeterministicDeployer.sol";
import {AgentArenaEVM} from "../src/AgentArenaEVM.sol";
import {JudgeRegistry} from "../src/JudgeRegistry.sol";

/**
 * @notice Deploys AgentArenaEVM infrastructure deterministically via CREATE2.
 * @dev Salt format: keccak256("GRADIENCE_V1_<CONTRACT_NAME>")
 */
contract DeterministicDeployScript is Script {
    bytes32 internal constant SALT_DEPLOYER = keccak256("GRADIENCE_V1_DeterministicDeployer");
    bytes32 internal constant SALT_JUDGE_REGISTRY = keccak256("GRADIENCE_V1_JudgeRegistry");
    bytes32 internal constant SALT_ARENA_IMPL = keccak256("GRADIENCE_V1_AgentArenaEVM_Impl");
    bytes32 internal constant SALT_ARENA_PROXY = keccak256("GRADIENCE_V1_AgentArenaEVM_Proxy");

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

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

        // 3. Deploy AgentArenaEVM implementation
        address predictedImpl = dd.computeAddress(SALT_ARENA_IMPL, keccak256(type(AgentArenaEVM).creationCode));
        if (predictedImpl.code.length == 0) {
            dd.deploy(SALT_ARENA_IMPL, type(AgentArenaEVM).creationCode);
        }

        // 4. Deploy proxy with deterministic init data
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

        // 5. Wire up references
        arena.setJudgeRegistry(address(registry));
        registry.setArena(address(arena));

        vm.stopBroadcast();
    }


}
