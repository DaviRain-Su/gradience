// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {AgentMRegistry} from "../src/AgentMRegistry.sol";

contract AgentMRegistryTest is Test {
    AgentMRegistry registry;
    address owner = address(1);
    address user = address(2);

    function setUp() public {
        registry = new AgentMRegistry(owner);
    }

    function test_registerAndUpdateProfile() public {
        vm.prank(user);
        registry.registerUser("alice", "ipfs://alice-v1", "alice.eth");

        (bool exists, string memory username, string memory ensName, string memory metadataURI,,, uint64 version) = registry.users(user);
        assertTrue(exists);
        assertEq(username, "alice");
        assertEq(ensName, "alice.eth");
        assertEq(metadataURI, "ipfs://alice-v1");
        assertEq(version, 1);
        assertEq(registry.usernameToAddress("alice"), user);

        vm.prank(user);
        registry.updateProfile("ipfs://alice-v2", "alice2.eth");

        (,, string memory ensName2, string memory metadataURI2,,, uint64 version2) = registry.users(user);
        assertEq(metadataURI2, "ipfs://alice-v2");
        assertEq(ensName2, "alice2.eth");
        assertEq(version2, 2);
    }

    function test_createAndUpdateAgent() public {
        vm.prank(user);
        registry.registerUser("alice", "ipfs://alice", "");
        vm.prank(user);
        uint256 agentId = registry.createAgent("ipfs://agent-1");
        assertEq(agentId, 1);

        (bool exists, address agentOwner, string memory metadataURI,, bool isActive) = registry.agents(agentId);
        assertTrue(exists);
        assertEq(agentOwner, user);
        assertEq(metadataURI, "ipfs://agent-1");
        assertTrue(isActive);

        vm.prank(user);
        registry.updateAgent(agentId, "ipfs://agent-1-updated", false);
        (,, string memory metadataURI2,, bool isActive2) = registry.agents(agentId);
        assertEq(metadataURI2, "ipfs://agent-1-updated");
        assertFalse(isActive2);
    }

    function test_revertDuplicateUsername() public {
        vm.prank(user);
        registry.registerUser("alice", "ipfs://alice", "");
        vm.prank(address(3));
        vm.expectRevert(abi.encodeWithSelector(AgentMRegistry.UsernameTaken.selector, "alice"));
        registry.registerUser("alice", "ipfs://other", "");
    }

    function test_revertAlreadyRegistered() public {
        vm.prank(user);
        registry.registerUser("alice", "ipfs://alice", "");
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(AgentMRegistry.AlreadyRegistered.selector, user));
        registry.registerUser("alice2", "ipfs://alice2", "");
    }

    function test_resolveUsernameAndUserAgents() public {
        vm.prank(user);
        registry.registerUser("alice", "ipfs://alice", "");

        vm.prank(user);
        uint256 agentId = registry.createAgent("ipfs://agent-1");

        assertEq(registry.usernameToAddress("alice"), user);
        uint256[] memory agents = registry.getUserAgents(user);
        assertEq(agents.length, 1);
        assertEq(agents[0], agentId);
    }
}
