// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {A2AChannelRegistry} from "../src/A2AChannelRegistry.sol";

contract A2AChannelRegistryTest is Test {
    A2AChannelRegistry public registry;
    address alice = address(0xA1);
    address bob = address(0xB0);
    address carol = address(0xC0);

    function setUp() public {
        registry = new A2AChannelRegistry();
    }

    function test_CreateChannel() public {
        address[] memory participants = new address[](2);
        participants[0] = alice;
        participants[1] = bob;

        bytes32 channelId = keccak256(abi.encodePacked(alice, bob));
        registry.createChannel(channelId, participants);

        A2AChannelRegistry.Channel memory ch = registry.getChannel(channelId);
        assertTrue(ch.exists);
        assertEq(ch.participants.length, 2);
    }

    function test_Revert_DuplicateChannel() public {
        address[] memory participants = new address[](2);
        participants[0] = alice;
        participants[1] = bob;

        bytes32 channelId = keccak256(abi.encodePacked(alice, bob));
        registry.createChannel(channelId, participants);

        vm.expectRevert(abi.encodeWithSelector(A2AChannelRegistry.ChannelAlreadyExists.selector, channelId));
        registry.createChannel(channelId, participants);
    }

    function test_AnchorMessage() public {
        address[] memory participants = new address[](2);
        participants[0] = alice;
        participants[1] = bob;

        bytes32 channelId = keccak256(abi.encodePacked(alice, bob));
        registry.createChannel(channelId, participants);

        bytes32 messageHash = keccak256("message");
        bytes32 previousHash = bytes32(0);

        vm.prank(alice);
        registry.anchorMessage(channelId, messageHash, previousHash);

        A2AChannelRegistry.Channel memory ch = registry.getChannel(channelId);
        assertEq(ch.lastMessageHash, messageHash);
        assertGt(ch.lastAnchorAt, 0);
    }

    function test_Revert_NotParticipantAnchoring() public {
        address[] memory participants = new address[](2);
        participants[0] = alice;
        participants[1] = bob;

        bytes32 channelId = keccak256(abi.encodePacked(alice, bob));
        registry.createChannel(channelId, participants);

        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(A2AChannelRegistry.NotParticipant.selector, channelId, carol));
        registry.anchorMessage(channelId, keccak256("msg"), bytes32(0));
    }
}
