// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {AgentLayerRaceTask} from "../src/AgentLayerRaceTask.sol";
import {JudgeRegistry} from "../src/JudgeRegistry.sol";

contract AgentLayerRaceTaskTest is Test {
    AgentLayerRaceTask arena;
    JudgeRegistry registry;
    address poster = address(1);
    address judge = address(2);
    address agent = address(3);
    address treasury = address(4);

    function setUp() public {
        arena = new AgentLayerRaceTask(treasury);
        registry = new JudgeRegistry(address(this));
        arena.setJudgeRegistry(address(registry));
        registry.setArena(address(arena));

        vm.deal(poster, 10 ether);
        vm.deal(judge, 10 ether);
        vm.deal(agent, 10 ether);
    }

    function test_post_task_with_designated_judge() public {
        vm.prank(poster);
        uint256 taskId = arena.post_task{value: 1 ether}("cid", uint64(block.timestamp + 1 hours), uint64(block.timestamp + 2 hours), judge, 1, 0.1 ether);

        (address taskPoster, address taskJudge,,,,,,,,,,) = arena.tasks(taskId);
        assertEq(taskPoster, poster);
        assertEq(taskJudge, judge);
    }

    function test_auto_assign_judge_from_registry() public {
        registry.register(1);

        vm.prank(poster);
        uint256 taskId = arena.post_task{value: 0.5 ether}("cid", uint64(block.timestamp + 1 hours), uint64(block.timestamp + 2 hours), address(0), 1, 0);

        (address taskPoster, address taskJudge,,,,,,,,,,) = arena.tasks(taskId);
        assertEq(taskPoster, poster);
        assertEq(taskJudge, address(this));
    }

    function test_reverts_high_value_without_designated_judge() public {
        vm.prank(poster);
        vm.expectRevert(abi.encodeWithSelector(AgentLayerRaceTask.HighValueTaskRequiresDesignatedJudge.selector, 0));
        arena.post_task{value: 2 ether}("cid", uint64(block.timestamp + 1 hours), uint64(block.timestamp + 2 hours), address(0), 1, 0);
    }

    function test_judge_and_pay_flow() public {
        vm.prank(poster);
        uint256 taskId = arena.post_task{value: 1 ether}("cid", uint64(block.timestamp + 1 hours), uint64(block.timestamp + 2 hours), judge, 1, 0);
        
        vm.prank(agent);
        arena.apply_for_task{value: 0}(taskId);
        
        vm.prank(agent);
        arena.submit_result(taskId, "result", "trace");
        
        vm.prank(judge);
        arena.judge_and_pay(taskId, agent, 80);

        (,address taskJudge,,,,,,,,uint8 score,AgentLayerRaceTask.TaskState state,) = arena.tasks(taskId);
        assertEq(uint256(state), 1); // Completed
        assertEq(score, 80);
    }
}
