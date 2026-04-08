// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {JudgeRegistry} from "../src/JudgeRegistry.sol";

contract JudgeRegistryTest is Test {
    JudgeRegistry public registry;
    address public owner = address(1);
    address public arena = address(2);
    address public judge = address(3);

    function setUp() public {
        registry = new JudgeRegistry(owner);
        vm.prank(owner);
        registry.setArena(arena);
    }

    function test_RegisterWithValidCategory() public {
        vm.prank(judge);
        registry.register(1);
        assertTrue(registry.registrations(judge, 1));
    }

    function test_Revert_AlreadyRegistered() public {
        vm.startPrank(judge);
        registry.register(1);
        vm.expectRevert(abi.encodeWithSelector(JudgeRegistry.AlreadyRegistered.selector, judge, 1));
        registry.register(1);
        vm.stopPrank();
    }

    function test_Revert_InvalidCategory() public {
        vm.prank(judge);
        vm.expectRevert(abi.encodeWithSelector(JudgeRegistry.InvalidCategory.selector, 8));
        registry.register(8);
    }

    function test_Unregister() public {
        vm.startPrank(judge);
        registry.register(1);
        registry.unregister(1);
        vm.stopPrank();
        assertFalse(registry.registrations(judge, 1));
    }

    function test_Revert_NotRegisteredOnUnregister() public {
        vm.prank(judge);
        vm.expectRevert(abi.encodeWithSelector(JudgeRegistry.NotRegistered.selector, judge, 1));
        registry.unregister(1);
    }

    function test_SlashByArena() public {
        vm.prank(arena);
        registry.slash(judge, 1 ether, "bad behavior");
        assertEq(registry.totalSlashed(judge), 1 ether);
    }

    function test_SlashByOwner() public {
        vm.prank(owner);
        registry.slash(judge, 0.5 ether, "bad behavior");
        assertEq(registry.totalSlashed(judge), 0.5 ether);
    }

    function test_Revert_SlashByUnauthorized() public {
        vm.prank(judge);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), judge));
        registry.slash(judge, 1 ether, "bad behavior");
    }

    function test_isEligibleForCategory() public {
        vm.prank(judge);
        registry.register(2);
        assertTrue(registry.isEligibleForCategory(judge, 2));
        assertFalse(registry.isEligibleForCategory(judge, 3));
    }
}
