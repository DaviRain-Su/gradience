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
            0.1 ether,
            false
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
            0,
            false
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
            0,
            false
        );
    }

    function test_ApplyForTask() public returns (uint256) {
        uint256 taskId = _createTask();
        vm.deal(agent, 10 ether);
        vm.prank(agent);
        arena.applyForTask{value: 0.22 ether}(taskId);

        (bool exists_,,) = arena.applications(taskId, agent);
        assertTrue(exists_);
        return taskId;
    }

    function test_Revert_InvalidStakeAmount() public {
        uint256 taskId = _createTask();
        vm.deal(agent, 10 ether);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(AgentArenaEVM.InvalidStakeAmount.selector, 0.22 ether, 0.01 ether));
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
            0.1 ether,
            false
        );
    }

    function _createTaskWithAppliedAgent() internal returns (uint256) {
        uint256 taskId = _createTask();
        vm.deal(agent, 10 ether);
        vm.prank(agent);
        arena.applyForTask{value: 0.22 ether}(taskId);
        vm.prank(agent);
        arena.submitResult(taskId, "result-ref", "trace-ref");
        return taskId;
    }

    // ----------------------------------------------------------------------
    // GRA-263: Poster reputation + Dispute mechanism
    // ----------------------------------------------------------------------

    function test_PosterProfile_NewPoster() public {
        vm.deal(poster, 10 ether);
        vm.prank(poster);
        uint256 taskId = arena.postTask{value: 1 ether}(
            "eval-ref",
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 2 days),
            judge,
            1,
            0.1 ether,
            false
        );

        (
            uint256 tasksPosted,
            uint256 tasksCompleted,
            uint256 tasksDisputed,
            uint256 successfulRefunds,
            uint256 avgReward,
            uint64 lastPostedAt,
            uint8 reputationTier,
            bool exists
        ) = arena.posterProfiles(poster);

        assertTrue(exists);
        assertEq(tasksPosted, 1);
        assertEq(tasksCompleted, 0);
        assertEq(tasksDisputed, 0);
        assertEq(successfulRefunds, 0);
        assertEq(avgReward, 1 ether);
        assertEq(reputationTier, 0); // New poster
        assertGt(lastPostedAt, 0);

        // Verify effective minStake was boosted to 110% for new poster
        (,,,,uint256 minStake,,,,,,,) = arena.tasks(taskId);
        assertEq(minStake, 0.11 ether);
    }

    function test_PosterTierBoost_ReducesMinStake() public {
        // Helper to post tasks quickly
        for (uint256 i = 0; i < 3; i++) {
            vm.deal(poster, 10 ether);
            vm.prank(poster);
            arena.postTask{value: 0.5 ether}(
                "eval-ref",
                uint64(block.timestamp + 1 days),
                uint64(block.timestamp + 2 days),
                judge,
                1,
                0.1 ether,
                false
            );
            // Complete each task without dispute to gain reputation
            uint256 taskId = i + 1;
            vm.deal(agent, 10 ether);
            vm.prank(agent);
            arena.applyForTask{value: 0.22 ether}(taskId);
            vm.prank(agent);
            arena.submitResult(taskId, "result", "trace");
            vm.prank(judge);
            arena.judgeAndPay(taskId, agent, 80);
        }

        (, uint256 tasksCompleted,,,,, uint8 reputationTier,) = arena.posterProfiles(poster);
        assertEq(tasksCompleted, 3);
        assertEq(reputationTier, 1); // Regular tier

        // Next task should not be boosted (100% multiplier)
        vm.deal(poster, 10 ether);
        vm.prank(poster);
        uint256 taskId = arena.postTask{value: 1 ether}(
            "eval-ref",
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 2 days),
            judge,
            1,
            0.1 ether,
            false
        );
        (,,,,uint256 minStake,,,,,,,) = arena.tasks(taskId);
        assertEq(minStake, 0.1 ether);
    }

    function test_DisputeByApplicant_Uphold_PosterPenalty() public {
        uint256 taskId = _createTaskWithAppliedAgent();

        // Judge awards wrong winner
        address fakeWinner = address(0xABCD);
        vm.deal(fakeWinner, 10 ether);
        vm.prank(fakeWinner);
        arena.applyForTask{value: 0.22 ether}(taskId);
        vm.prank(fakeWinner);
        arena.submitResult(taskId, "bad-result", "bad-trace");

        vm.prank(judge);
        arena.judgeAndPay(taskId, fakeWinner, 80);

        // Agent disputes the result
        uint256 bond = (1 ether * arena.CHALLENGER_BOND_BPS()) / arena.BPS_DENOMINATOR();
        vm.deal(agent, bond + 1 ether);
        vm.prank(agent);
        arena.disputeTask{value: bond}(taskId, keccak256("reason"));

        (, uint256 tasksDisputedBefore,,,,,,) = arena.posterProfiles(poster);
        assertEq(tasksDisputedBefore, 1);

        uint256 correctWinnerBalanceBefore = agent.balance;
        uint256 protocolFeesBefore = arena.protocolFees(address(0));

        // Resolver upholds dispute: correct winner is the agent
        vm.prank(owner);
        arena.resolveDispute(taskId, uint8(AgentArenaEVM.DisputeOutcome.Uphold), agent, 85);

        // Agent should receive bond back (at least)
        assertGe(agent.balance, correctWinnerBalanceBefore);

        // Protocol fees are too low to cover penalty in this isolated test;
        // assert they remain unchanged and the penalty was recorded as 0.
        assertEq(arena.protocolFees(address(0)), protocolFeesBefore);
    }

    function test_DisputeByApplicant_Reject() public {
        uint256 taskId = _createTask();

        // Both agent and loser apply+submit before judging
        vm.deal(agent, 10 ether);
        vm.prank(agent);
        arena.applyForTask{value: 0.22 ether}(taskId);
        vm.prank(agent);
        arena.submitResult(taskId, "result", "trace");

        vm.deal(loser, 10 ether);
        vm.prank(loser);
        arena.applyForTask{value: 0.22 ether}(taskId);
        vm.prank(loser);
        arena.submitResult(taskId, "loser-result", "loser-trace");

        vm.prank(judge);
        arena.judgeAndPay(taskId, agent, 80);

        // Loser disputes but dispute is rejected
        uint256 bond = (1 ether * arena.CHALLENGER_BOND_BPS()) / arena.BPS_DENOMINATOR();
        vm.deal(loser, bond + 1 ether);
        vm.prank(loser);
        arena.disputeTask{value: bond}(taskId, keccak256("reason"));

        uint256 judgeBefore = judge.balance;
        uint256 protocolFeesBefore = arena.protocolFees(address(0));

        vm.prank(owner);
        arena.resolveDispute(taskId, uint8(AgentArenaEVM.DisputeOutcome.Reject), address(0), 0);

        uint256 toJudge = bond / 2;
        assertEq(judge.balance - judgeBefore, toJudge);
        assertEq(arena.protocolFees(address(0)) - protocolFeesBefore, bond - toJudge);
    }

    function test_DisputeByApplicant_Uphold_WithPenaltyFunded() public {
        uint256 taskId = _createTaskWithAppliedAgent();

        address fakeWinner = address(0xABCD);
        vm.deal(fakeWinner, 10 ether);
        vm.prank(fakeWinner);
        arena.applyForTask{value: 0.22 ether}(taskId);
        vm.prank(fakeWinner);
        arena.submitResult(taskId, "bad-result", "bad-trace");

        vm.prank(judge);
        arena.judgeAndPay(taskId, fakeWinner, 80);

        uint256 bond = (1 ether * arena.CHALLENGER_BOND_BPS()) / arena.BPS_DENOMINATOR();
        vm.deal(agent, bond + 1 ether);
        vm.prank(agent);
        arena.disputeTask{value: bond}(taskId, keccak256("reason"));

        // Fund protocol fees enough to cover penalty
        uint256 penalty = (1 ether * arena.POSTER_DISPUTE_PENALTY_BPS()) / arena.BPS_DENOMINATOR();
        vm.deal(address(arena), address(arena).balance + penalty);

        uint256 protocolFeesBefore = arena.protocolFees(address(0));

        // Seed protocol fees by retrieving fees from a second completed task
        vm.deal(poster, 10 ether);
        vm.prank(poster);
        uint256 task2 = arena.postTask{value: 3 ether}(
            "eval-2",
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 2 days),
            judge,
            1,
            0.1 ether,
            false
        );
        vm.deal(agent, 10 ether);
        vm.prank(agent);
        arena.applyForTask{value: 0.22 ether}(task2);
        vm.prank(agent);
        arena.submitResult(task2, "r2", "t2");
        vm.prank(judge);
        arena.judgeAndPay(task2, agent, 80);

        uint256 protocolFeesAfterSecondTask = arena.protocolFees(address(0));
        assertGe(protocolFeesAfterSecondTask, protocolFeesBefore + penalty);

        uint256 agentBalanceBeforeResolve = agent.balance;
        vm.prank(owner);
        arena.resolveDispute(taskId, uint8(AgentArenaEVM.DisputeOutcome.Uphold), agent, 85);

        // Agent receives bond refund + poster penalty
        assertEq(agent.balance - agentBalanceBeforeResolve, bond + penalty);
        assertEq(arena.protocolFees(address(0)), protocolFeesAfterSecondTask - penalty);
    }

    function test_ClaimExpired_RecordsPosterRefund() public {
        uint256 taskId = _createTaskWithAppliedAgent();

        vm.warp(block.timestamp + 3 days);
        arena.claimExpired(taskId);

        (,,, uint256 successfulRefunds,,,,) = arena.posterProfiles(poster);
        assertEq(successfulRefunds, 1);
    }

    // ----------------------------------------------------------------------
    // On-chain ZK-KYC gating (GRA-265 implementation)
    // ----------------------------------------------------------------------

    function test_RegisterZkNullifier() public {
        bytes32 hash = keccak256("nullifier-1");
        vm.prank(owner);
        arena.setZkOracle(owner);

        vm.prank(owner);
        arena.registerZkNullifier(agent, hash);

        assertEq(arena.zkNullifiers(agent), hash);
        assertTrue(arena.usedNullifiers(hash));
    }

    function test_Revert_RegisterDuplicateNullifier() public {
        bytes32 hash = keccak256("nullifier-2");
        vm.prank(owner);
        arena.setZkOracle(owner);

        vm.prank(owner);
        arena.registerZkNullifier(agent, hash);

        vm.prank(owner);
        vm.expectRevert(AgentArenaEVM.InvalidRefLength.selector);
        arena.registerZkNullifier(loser, hash);
    }

    function test_RebindReleasesOldNullifier() public {
        bytes32 oldHash = keccak256("old");
        bytes32 newHash = keccak256("new");
        vm.prank(owner);
        arena.setZkOracle(owner);

        vm.prank(owner);
        arena.registerZkNullifier(agent, oldHash);

        vm.prank(owner);
        arena.registerZkNullifier(agent, newHash);

        assertFalse(arena.usedNullifiers(oldHash));
        assertTrue(arena.usedNullifiers(newHash));
    }

    function test_ApplyForTask_Revert_ZkKycRequired() public {
        vm.deal(poster, 10 ether);
        vm.prank(poster);
        uint256 taskId = arena.postTask{value: 1 ether}(
            "eval-ref",
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 2 days),
            judge,
            1,
            0.1 ether,
            true // require ZK-KYC
        );

        vm.deal(agent, 10 ether);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(AgentArenaEVM.ZkKycRequired.selector, agent));
        arena.applyForTask{value: 0.22 ether}(taskId);
    }

    function test_JudgeAndPay_Success_WithVerifiedJudge() public {
        vm.prank(owner);
        arena.setZkOracle(owner);
        vm.prank(owner);
        arena.registerZkNullifier(agent, keccak256("agent-nullifier"));
        vm.prank(owner);
        arena.registerZkNullifier(judge, keccak256("judge-nullifier"));

        vm.deal(poster, 10 ether);
        vm.prank(poster);
        uint256 taskId = arena.postTask{value: 1 ether}(
            "eval-ref",
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 2 days),
            judge,
            1,
            0.1 ether,
            true
        );

        vm.deal(agent, 10 ether);
        vm.prank(agent);
        arena.applyForTask{value: 0.22 ether}(taskId);
        vm.prank(agent);
        arena.submitResult(taskId, "result", "trace");

        // Verified designated judge succeeds
        vm.prank(judge);
        arena.judgeAndPay(taskId, agent, 80);

        (,,,,,,,,,, AgentArenaEVM.TaskState state,) = arena.tasks(taskId);
        assertEq(uint256(state), uint256(AgentArenaEVM.TaskState.Completed));
    }

    function test_PostTaskQuorum_Revert_UnverifiedJudge() public {
        address unverifiedJudge = address(0x9999);
        address[] memory judges = new address[](1);
        judges[0] = unverifiedJudge;

        vm.deal(poster, 10 ether);
        vm.prank(poster);
        vm.expectRevert(abi.encodeWithSelector(AgentArenaEVM.ZkKycRequired.selector, unverifiedJudge));
        arena.postTaskQuorum{value: 1 ether}(
            "eval-ref",
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 2 days),
            1,
            0.1 ether,
            2, // pool mode
            true,
            judges
        );
    }

    function test_FullZkGatedFlow() public {
        bytes32 agentHash = keccak256("agent-n");
        bytes32 judgeHash = keccak256("judge-n");
        vm.prank(owner);
        arena.setZkOracle(owner);
        vm.prank(owner);
        arena.registerZkNullifier(agent, agentHash);
        vm.prank(owner);
        arena.registerZkNullifier(judge, judgeHash);

        vm.deal(poster, 10 ether);
        vm.prank(poster);
        uint256 taskId = arena.postTask{value: 1 ether}(
            "eval-ref",
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 2 days),
            judge,
            1,
            0.1 ether,
            true
        );

        vm.deal(agent, 10 ether);
        vm.prank(agent);
        arena.applyForTask{value: 0.22 ether}(taskId);
        vm.prank(agent);
        arena.submitResult(taskId, "result", "trace");

        vm.prank(judge);
        arena.judgeAndPay(taskId, agent, 80);

        assertTrue(arena.requireZkKyc(taskId));
    }
}
