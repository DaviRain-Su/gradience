// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AgentLayerRaceTask is ReentrancyGuard {
    uint256 public constant MIN_SCORE = 60;
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant WINNER_PAYOUT_BPS = 9_500;
    uint256 public constant JUDGE_FEE_BPS = 300;
    uint256 public constant PROTOCOL_FEE_BPS = 200;
    uint256 public constant MAX_REF_LEN = 128;

    enum TaskState {
        Open,
        Completed,
        Refunded
    }

    struct Task {
        address poster;
        address judge;
        uint8 category;
        uint64 deadline;
        uint64 judgeDeadline;
        uint256 minStake;
        uint256 reward;
        TaskState state;
        string evalRef;
        address winner;
        uint8 score;
    }

    struct Application {
        bool exists;
        bool submitted;
        uint256 stake;
    }

    struct Submission {
        bool exists;
        uint64 submittedAt;
        string resultRef;
        string traceRef;
    }

    struct Reputation {
        uint256 totalApplied;
        uint256 completed;
        uint256 totalEarned;
        uint256 avgScore;
        uint256 winRateBps;
    }

    error ZeroAddress();
    error InvalidCategory(uint8 category);
    error InvalidDeadline(uint64 deadline);
    error InvalidJudgeDeadline(uint64 judgeDeadline);
    error ZeroReward();
    error InvalidRefLength();
    error TaskNotFound(uint256 taskId);
    error TaskNotOpen(uint256 taskId);
    error DeadlinePassed(uint256 taskId);
    error JudgeDeadlinePassed(uint256 taskId);
    error AlreadyApplied(uint256 taskId, address agent);
    error AlreadySubmitted(uint256 taskId, address agent);
    error JudgeCannotApply(uint256 taskId, address judge);
    error NotApplied(uint256 taskId, address agent);
    error StakeNotClaimable(uint256 taskId, address agent);
    error InvalidStakeAmount(uint256 expected, uint256 actual);
    error NotTaskJudge(uint256 taskId, address caller, address expectedJudge);
    error InvalidScore(uint8 score);
    error WinnerNotApplied(uint256 taskId, address winner);
    error WinnerSubmissionMissing(uint256 taskId, address winner);
    error JudgeDeadlineNotReached(uint256 taskId);
    error TransferFailed(address to, uint256 amount);

    event TaskCreated(
        uint256 indexed taskId,
        address indexed poster,
        address indexed judge,
        uint8 category,
        uint256 minStake,
        uint256 reward,
        uint64 deadline,
        uint64 judgeDeadline,
        string evalRef
    );
    event TaskApplied(uint256 indexed taskId, address indexed agent, uint256 stake);
    event SubmissionReceived(uint256 indexed taskId, address indexed agent, string resultRef, string traceRef);
    event TaskJudged(
        uint256 indexed taskId,
        address indexed winner,
        uint8 score,
        uint256 winnerPayout,
        uint256 judgeFee,
        uint256 protocolFee
    );
    event TaskRefunded(uint256 indexed taskId, address indexed poster, uint256 reward, uint8 score);
    event StakeRefunded(uint256 indexed taskId, address indexed agent, uint256 stake);

    address public immutable treasury;
    uint256 public taskCount;

    mapping(uint256 => Task) public tasks;
    mapping(uint256 => mapping(address => Application)) public applications;
    mapping(uint256 => mapping(address => Submission)) private _submissions;
    mapping(uint256 => address[]) private _taskApplicants;
    mapping(address => Reputation) public reputations;

    constructor(address treasury_) {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
    }

    function post_task(
        string calldata eval_ref,
        uint64 deadline,
        uint64 judge_deadline,
        address judge,
        uint8 category,
        uint256 min_stake
    ) external payable returns (uint256 task_id) {
        if (msg.value == 0) revert ZeroReward();
        if (bytes(eval_ref).length == 0 || bytes(eval_ref).length > MAX_REF_LEN) revert InvalidRefLength();
        if (category > 7) revert InvalidCategory(category);
        if (deadline <= block.timestamp) revert InvalidDeadline(deadline);
        if (judge_deadline <= deadline) revert InvalidJudgeDeadline(judge_deadline);

        address taskJudge = judge == address(0) ? msg.sender : judge;
        task_id = ++taskCount;
        tasks[task_id] = Task({
            poster: msg.sender,
            judge: taskJudge,
            category: category,
            deadline: deadline,
            judgeDeadline: judge_deadline,
            minStake: min_stake,
            reward: msg.value,
            state: TaskState.Open,
            evalRef: eval_ref,
            winner: address(0),
            score: 0
        });

        emit TaskCreated(
            task_id,
            msg.sender,
            taskJudge,
            category,
            min_stake,
            msg.value,
            deadline,
            judge_deadline,
            eval_ref
        );
    }

    function apply_for_task(uint256 task_id) external payable nonReentrant {
        Task storage task = _loadOpenTask(task_id);
        if (block.timestamp >= task.deadline) revert DeadlinePassed(task_id);
        if (msg.sender == task.judge) revert JudgeCannotApply(task_id, msg.sender);

        Application storage app = applications[task_id][msg.sender];
        if (app.exists) revert AlreadyApplied(task_id, msg.sender);
        if (msg.value != task.minStake) revert InvalidStakeAmount(task.minStake, msg.value);

        app.exists = true;
        app.stake = msg.value;
        _taskApplicants[task_id].push(msg.sender);

        Reputation storage rep = reputations[msg.sender];
        rep.totalApplied += 1;

        emit TaskApplied(task_id, msg.sender, msg.value);
    }

    function submit_result(
        uint256 task_id,
        string calldata result_ref,
        string calldata trace_ref
    ) external {
        Task storage task = _loadOpenTask(task_id);
        if (block.timestamp >= task.deadline) revert DeadlinePassed(task_id);
        if (bytes(result_ref).length == 0 || bytes(result_ref).length > MAX_REF_LEN) revert InvalidRefLength();
        if (bytes(trace_ref).length == 0 || bytes(trace_ref).length > MAX_REF_LEN) revert InvalidRefLength();

        Application storage app = applications[task_id][msg.sender];
        if (!app.exists) revert NotApplied(task_id, msg.sender);

        Submission storage submission = _submissions[task_id][msg.sender];
        if (submission.exists) revert AlreadySubmitted(task_id, msg.sender);
        submission.exists = true;
        submission.submittedAt = uint64(block.timestamp);
        submission.resultRef = result_ref;
        submission.traceRef = trace_ref;
        app.submitted = true;

        emit SubmissionReceived(task_id, msg.sender, result_ref, trace_ref);
    }

    function judge_and_pay(uint256 task_id, address winner, uint8 score) external nonReentrant {
        Task storage task = _loadOpenTask(task_id);
        if (block.timestamp > task.judgeDeadline) revert JudgeDeadlinePassed(task_id);
        if (msg.sender != task.judge) revert NotTaskJudge(task_id, msg.sender, task.judge);
        if (score > 100) revert InvalidScore(score);

        Application storage winnerApplication = applications[task_id][winner];
        if (!winnerApplication.exists) revert WinnerNotApplied(task_id, winner);
        if (!_submissions[task_id][winner].exists) revert WinnerSubmissionMissing(task_id, winner);

        task.winner = winner;
        task.score = score;

        if (score >= MIN_SCORE) {
            task.state = TaskState.Completed;

            uint256 protocolFee = (task.reward * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
            uint256 judgeFee = (task.reward * JUDGE_FEE_BPS) / BPS_DENOMINATOR;
            uint256 winnerPayout = task.reward - protocolFee - judgeFee;

            _sendEth(winner, winnerPayout);
            _sendEth(task.judge, judgeFee);
            _sendEth(treasury, protocolFee);

            _updateWinnerReputation(winner, winnerPayout, score);
            emit TaskJudged(task_id, winner, score, winnerPayout, judgeFee, protocolFee);
        } else {
            task.state = TaskState.Refunded;
            _sendEth(task.poster, task.reward);
            emit TaskRefunded(task_id, task.poster, task.reward, score);
        }
    }

    function claim_expired(uint256 task_id) external nonReentrant {
        Task storage task = _loadOpenTask(task_id);
        if (block.timestamp <= task.judgeDeadline) revert JudgeDeadlineNotReached(task_id);

        task.state = TaskState.Refunded;
        _sendEth(task.poster, task.reward);
        emit TaskRefunded(task_id, task.poster, task.reward, 0);
    }

    function claim_stake(uint256 task_id) external nonReentrant {
        Task storage task = tasks[task_id];
        if (task.poster == address(0)) revert TaskNotFound(task_id);
        if (task.state == TaskState.Open) revert TaskNotOpen(task_id);

        Application storage app = applications[task_id][msg.sender];
        uint256 stake = app.stake;
        if (!app.exists || stake == 0) revert StakeNotClaimable(task_id, msg.sender);

        app.stake = 0;
        _sendEth(msg.sender, stake);
        emit StakeRefunded(task_id, msg.sender, stake);
    }

    function get_submission(uint256 task_id, address agent) external view returns (Submission memory) {
        return _submissions[task_id][agent];
    }

    function get_applicants(uint256 task_id) external view returns (address[] memory) {
        return _taskApplicants[task_id];
    }

    function _updateWinnerReputation(address winner, uint256 winnerPayout, uint8 score) internal {
        Reputation storage rep = reputations[winner];
        uint256 previousCompleted = rep.completed;
        rep.completed = previousCompleted + 1;
        rep.totalEarned += winnerPayout;
        rep.avgScore = ((rep.avgScore * previousCompleted) + score) / rep.completed;
        if (rep.totalApplied > 0) {
            rep.winRateBps = (rep.completed * BPS_DENOMINATOR) / rep.totalApplied;
        }
    }

    function _loadOpenTask(uint256 task_id) internal view returns (Task storage task) {
        task = tasks[task_id];
        if (task.poster == address(0)) revert TaskNotFound(task_id);
        if (task.state != TaskState.Open) revert TaskNotOpen(task_id);
    }

    function _sendEth(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool success, ) = payable(to).call{value: amount}("");
        if (!success) revert TransferFailed(to, amount);
    }
}
