// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {SocialGraph} from "../src/SocialGraph.sol";

contract SocialGraphTest is Test {
    SocialGraph public graph;
    address public owner = address(1);
    address public alice = address(2);
    address public bob = address(3);

    function setUp() public {
        graph = new SocialGraph();
        graph.initialize(owner);
    }

    function test_Follow() public {
        vm.prank(alice);
        graph.follow(bob);
        assertTrue(graph.isFollowing(alice, bob));
    }

    function test_Revert_SelfFollow() public {
        vm.prank(alice);
        vm.expectRevert(SocialGraph.SelfFollow.selector);
        graph.follow(alice);
    }

    function test_Revert_AlreadyFollowing() public {
        vm.startPrank(alice);
        graph.follow(bob);
        vm.expectRevert(abi.encodeWithSelector(SocialGraph.AlreadyFollowing.selector, alice, bob));
        graph.follow(bob);
        vm.stopPrank();
    }

    function test_Unfollow() public {
        vm.startPrank(alice);
        graph.follow(bob);
        graph.unfollow(bob);
        vm.stopPrank();
        assertFalse(graph.isFollowing(alice, bob));
    }

    function test_Revert_NotFollowing() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SocialGraph.NotFollowing.selector, alice, bob));
        graph.unfollow(bob);
    }

    function test_GetFollowingsAndFollowers() public {
        vm.prank(alice);
        graph.follow(bob);
        address[] memory followings = graph.getFollowings(alice);
        address[] memory followers = graph.getFollowers(bob);
        assertEq(followings.length, 1);
        assertEq(followers.length, 1);
        assertEq(followings[0], bob);
        assertEq(followers[0], alice);
    }
}
