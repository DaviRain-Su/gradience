// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {AgentArenaEVM} from "../src/AgentArenaEVM.sol";
import {JudgeRegistry} from "../src/JudgeRegistry.sol";
import {GradienceReputationFeed} from "../src/GradienceReputationFeed.sol";

contract AgentArenaEVMTest is Test {
    AgentArenaEVM public arena;
    JudgeRegistry public judgeRegistry;
    GradienceReputationFeed public reputationFeed;

    address owner = address(1);
    address treasury = address(2);
    address poster = address(0x1001);
    address agent = address(0x1002);
    address judge = address(0x1003);
    address loser = address(0x1004);

    function setUp() public {
        vm.startPrank(owner);
        judgeRegistry = new JudgeRegistry(owner);
        judgeRegistry.setArena(address(this));

        GradienceReputationFeed feedImpl = new GradienceReputationFeed();
        ERC1967Proxy feedProxy = new ERC1967Proxy(address(feedImpl), abi.encodeWithSelector(GradienceReputationFeed.initialize.selector, owner, address(6)));
        reputationFeed = GradienceReputationFeed(address(feedProxy));

        AgentArenaEVM impl = new AgentArenaEVM();
        bytes memory initData = abi.encodeWithSelector(AgentArenaEVM.initialize.selector, owner, treasury);
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        arena = AgentArenaEVM(address(proxy));
        arena.setJudgeRegistry(address(judgeRegistry));
        arena.setReputationFeed(address(reputationFeed));
        vm.stopPrank();

        // Register a judge
        judgeRegistry.register(1);
    }

    function test_PostTaskWithETH() public {
        vm.deal(poster, 10 ether);
        vm.prank(poster);
        uint256 taskId = arena.postTask{value: 1 ether}(
            "eval-ref",
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 2 days),
            judge,
            1,
            0.1 ether
        );

        (
            address taskPoster,,,,,,,,,, AgentArenaEVM.TaskState state,
        ) = arena.tasks(taskId);
        assertEq(taskPoster, poster);
        assertEq(uint256(state), uint256(AgentArenaEVM.TaskState.Open));
    }

    function test_Revert_ZeroReward() public {
        vm.prank(poster);
        vm.expectRevert(AgentArenaEVM.ZeroReward.selector);
        arena.postTask(
            "eval-ref",
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 2 days),
            judge,
            1,
            0
        );
    }

    function test_Revert_InvalidRefLength() public {
        vm.deal(poster, 10 ether);
        vm.prank(poster);
        vm.expectRevert(AgentArenaEVM.InvalidRefLength.selector);
        arena.postTask{value: 1 ether}(
            string(new bytes(129)),
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 2 days),
            judge,
            1,
            0
        );
    }

    function test_ApplyForTask() public returns (uint256) {
        uint256 taskId = _createTask();
        vm.deal(agent, 10 ether);
        vm.prank(agent);
        arena.applyForTask{value: 0.2 ether}(taskId);

        (bool exists_,,) = arena.applications(taskId, agent);
        assertTrue(exists_);
        return taskId;
    }

    function test_Revert_InvalidStakeAmount() public {
        uint256 taskId = _createTask();
        vm.deal(agent, 10 ether);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(AgentArenaEVM.InvalidStakeAmount.selector, 0.2 ether, 0.01 ether));
        arena.applyForTask{value: 0.01 ether}(taskId);
    }

    function test_JudgeAndPay_95_3_2_Split() public {
        uint256 taskId = _createTaskWithAppliedAgent();

        uint256 winnerBefore = agent.balance;
        uint256 judgeBefore = judge.balance;
        uint256 protocolFeesBefore = arena.protocolFees(address(0));
        uint256 reward = 1 ether;

        vm.prank(judge);
        arena.judgeAndPay(taskId, agent, 80);

        assertEq(agent.balance - winnerBefore, reward * 9500 / 10000);
        assertEq(judge.balance - judgeBefore, reward * 300 / 10000);
        assertEq(arena.protocolFees(address(0)) - protocolFeesBefore, reward * 200 / 10000);

        (
            ,,,,,,,,,, AgentArenaEVM.TaskState state,
        ) = arena.tasks(taskId);
        assertEq(uint256(state), uint256(AgentArenaEVM.TaskState.Completed));
    }

    function test_RefundWhenScoreBelow60() public {
        uint256 taskId = _createTaskWithAppliedAgent();
        uint256 posterBefore = poster.balance;

        vm.prank(judge);
        arena.judgeAndPay(taskId, agent, 50);

        assertEq(poster.balance - posterBefore, 1 ether);
        (
            ,,,,,,,,,, AgentArenaEVM.TaskState state,
        ) = arena.tasks(taskId);
        assertEq(uint256(state), uint256(AgentArenaEVM.TaskState.Refunded));
    }

    function test_ClaimExpiredRefunds() public {
        uint256 taskId = _createTaskWithAppliedAgent();
        uint256 posterBefore = poster.balance;

        vm.warp(block.timestamp + 3 days);
        arena.claimExpired(taskId);

        assertEq(poster.balance - posterBefore, 1 ether);
    }

    function _createTask() internal returns (uint256) {
        vm.deal(poster, 10 ether);
        vm.prank(poster);
        return arena.postTask{value: 1 ether}(
            "eval-ref",
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 2 days),
            judge,
            1,
            0.1 ether
        );
    }

    function _createTaskWithAppliedAgent() internal returns (uint256) {
        uint256 taskId = _createTask();
        vm.deal(agent, 10 ether);
        vm.prank(agent);
        arena.applyForTask{value: 0.2 ether}(taskId);
        vm.prank(agent);
        arena.submitResult(taskId, "result-ref", "trace-ref");
        return taskId;
    }
}
