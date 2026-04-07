// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {AgentArenaEVM} from "../src/AgentArenaEVM.sol";
import {JudgeRegistry} from "../src/JudgeRegistry.sol";

contract AgentArenaEVMTest is Test {
    AgentArenaEVM arena;
    JudgeRegistry registry;
    address poster = address(1);
    address judge = address(2);
    address agent = address(3);
    address treasury = address(4);

    function setUp() public {
        AgentArenaEVM impl = new AgentArenaEVM();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeWithSelector(AgentArenaEVM.initialize.selector, address(this), treasury)
        );
        arena = AgentArenaEVM(address(proxy));
        registry = new JudgeRegistry(address(this));
        arena.setJudgeRegistry(address(registry));
        registry.setArena(address(arena));

        vm.deal(poster, 10 ether);
        vm.deal(judge, 10 ether);
        vm.deal(agent, 10 ether);
    }

    function test_postTask_with_designated_judge() public {
        vm.prank(poster);
        uint256 taskId = arena.postTask{value: 1 ether}("cid", uint64(block.timestamp + 1 hours), uint64(block.timestamp + 2 hours), judge, 1, 0.1 ether);

        (address taskPoster, address taskJudge,,,,,,,,,,) = arena.tasks(taskId);
        assertEq(taskPoster, poster);
        assertEq(taskJudge, judge);
    }

    function test_auto_assign_judge_from_registry() public {
        registry.register(1);

        vm.prank(poster);
        uint256 taskId = arena.postTask{value: 0.5 ether}("cid", uint64(block.timestamp + 1 hours), uint64(block.timestamp + 2 hours), address(0), 1, 0);

        (address taskPoster, address taskJudge,,,,,,,,,,) = arena.tasks(taskId);
        assertEq(taskPoster, poster);
        assertEq(taskJudge, address(this));
    }

    function test_reverts_high_value_without_designated_judge() public {
        vm.prank(poster);
        vm.expectRevert(abi.encodeWithSelector(AgentArenaEVM.HighValueTaskRequiresDesignatedJudge.selector, 0));
        arena.postTask{value: 2 ether}("cid", uint64(block.timestamp + 1 hours), uint64(block.timestamp + 2 hours), address(0), 1, 0);
    }

    function test_judgeAndPay_flow() public {
        vm.prank(poster);
        uint256 taskId = arena.postTask{value: 1 ether}("cid", uint64(block.timestamp + 1 hours), uint64(block.timestamp + 2 hours), judge, 1, 0);
        
        vm.prank(agent);
        arena.applyForTask{value: 0}(taskId);
        
        vm.prank(agent);
        arena.submitResult(taskId, "result", "trace");
        
        vm.prank(judge);
        arena.judgeAndPay(taskId, agent, 80);

        (,address taskJudge,,,,,,,,uint8 score,AgentArenaEVM.TaskState state,) = arena.tasks(taskId);
        assertEq(uint256(state), uint256(AgentArenaEVM.TaskState.Completed)); // Completed
        assertEq(score, 80);
    }
}
