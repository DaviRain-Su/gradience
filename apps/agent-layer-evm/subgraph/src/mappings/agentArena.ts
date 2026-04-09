import {
    TaskCreated,
    TaskApplied,
    SubmissionReceived,
    TaskJudged,
    TaskRefunded,
    StakeRefunded,
    AgentCompensated,
    DisputeOpened,
    DisputeResolved,
    ProtocolFeesWithdrawn,
    LLMJudgeSet,
    TaskJudgedWithProof,
    JudgeSlashed,
} from '../../generated/AgentArenaEVM/AgentArenaEVM';
import { Task, Application, Submission, Dispute, User, ProtocolMetric, LLMJudgeOracle } from '../../generated/schema';
import { Address, BigInt, Bytes } from '@graphprotocol/graph-ts';
import { getOrCreateUser, getProtocolMetric } from '../utils/helpers';

export function handleTaskCreated(event: TaskCreated): void {
    let task = new Task(event.params.taskId.toString());
    task.taskId = event.params.taskId;
    task.poster = getOrCreateUser(event.params.poster).id;
    if (event.params.judge != Address.zero()) {
        task.judge = getOrCreateUser(event.params.judge).id;
    }
    task.category = event.params.category;
    task.minStake = event.params.minStake;
    task.reward = event.params.reward;
    task.deadline = event.params.deadline;
    task.judgeDeadline = event.params.judgeDeadline;
    task.evalRef = event.params.evalRef;
    task.paymentToken = Address.zero();
    task.state = 'Open';
    task.judgeMode = 'Designated';
    task.createdAt = event.block.timestamp;
    task.updatedAt = event.block.timestamp;
    task.save();

    let metric = getProtocolMetric();
    metric.totalTasks = metric.totalTasks.plus(BigInt.fromI32(1));
    metric.updatedAt = event.block.timestamp;
    metric.save();
}

export function handleTaskApplied(event: TaskApplied): void {
    let appId = event.params.taskId.toString() + '-' + event.params.agent.toHex();
    let app = new Application(appId);
    app.task = event.params.taskId.toString();
    app.agent = getOrCreateUser(event.params.agent).id;
    app.stake = event.params.stake;
    app.appliedAt = event.block.timestamp;
    app.submitted = false;
    app.save();
}

export function handleSubmissionReceived(event: SubmissionReceived): void {
    let subId = event.params.taskId.toString() + '-' + event.params.agent.toHex();
    let sub = new Submission(subId);
    sub.task = event.params.taskId.toString();
    sub.agent = getOrCreateUser(event.params.agent).id;
    sub.resultRef = event.params.resultRef;
    sub.traceRef = event.params.traceRef;
    sub.submittedAt = event.block.timestamp;
    sub.save();

    let appId = event.params.taskId.toString() + '-' + event.params.agent.toHex();
    let app = Application.load(appId);
    if (app) {
        app.submitted = true;
        app.save();
    }
}

export function handleTaskJudged(event: TaskJudged): void {
    let task = Task.load(event.params.taskId.toString());
    if (!task) return;
    task.state = 'Completed';
    task.score = event.params.score;
    if (event.params.winner != Address.zero()) {
        task.winner = getOrCreateUser(event.params.winner).id;
    }
    task.winnerPayout = event.params.winnerPayout;
    task.judgeFee = event.params.judgeFee;
    task.protocolFee = event.params.protocolFee;
    task.updatedAt = event.block.timestamp;
    task.save();

    let metric = getProtocolMetric();
    metric.totalCompletedTasks = metric.totalCompletedTasks.plus(BigInt.fromI32(1));
    metric.updatedAt = event.block.timestamp;
    metric.save();
}

export function handleTaskRefunded(event: TaskRefunded): void {
    let task = Task.load(event.params.taskId.toString());
    if (!task) return;
    task.state = 'Refunded';
    task.score = event.params.score;
    task.updatedAt = event.block.timestamp;
    task.save();

    let metric = getProtocolMetric();
    metric.totalRefundedTasks = metric.totalRefundedTasks.plus(BigInt.fromI32(1));
    metric.updatedAt = event.block.timestamp;
    metric.save();
}

export function handleStakeRefunded(event: StakeRefunded): void {
    // stake refund is a simple transfer event; no indexed entity update needed unless tracking balances
}

export function handleAgentCompensated(event: AgentCompensated): void {
    // compensation tracked on Task entity if needed
}

export function handleDisputeOpened(event: DisputeOpened): void {
    let dispute = new Dispute(event.params.taskId.toString());
    dispute.task = event.params.taskId.toString();
    dispute.challenger = getOrCreateUser(event.params.challenger).id;
    dispute.bond = event.params.bond;
    dispute.reasonHash = event.params.reasonHash;
    dispute.openedAt = event.block.timestamp;
    dispute.state = 'Open';
    dispute.save();

    let metric = getProtocolMetric();
    metric.totalDisputes = metric.totalDisputes.plus(BigInt.fromI32(1));
    metric.updatedAt = event.block.timestamp;
    metric.save();
}

export function handleDisputeResolved(event: DisputeResolved): void {
    let dispute = Dispute.load(event.params.taskId.toString());
    if (!dispute) return;
    dispute.state = 'Resolved';
    dispute.outcome = event.params.outcome;
    if (event.params.resolver != Address.zero()) {
        dispute.resolver = getOrCreateUser(event.params.resolver).id;
    }
    if (event.params.correctWinner != Address.zero()) {
        dispute.correctWinner = getOrCreateUser(event.params.correctWinner).id;
    }
    dispute.correctScore = event.params.correctScore;
    dispute.resolvedAt = event.block.timestamp;
    dispute.save();
}

export function handleProtocolFeesWithdrawn(event: ProtocolFeesWithdrawn): void {
    let metric = getProtocolMetric();
    if (event.params.token == Address.zero()) {
        metric.totalProtocolFeesETH = metric.totalProtocolFeesETH.plus(event.params.amount);
    } else {
        metric.totalProtocolFeesToken = metric.totalProtocolFeesToken.plus(event.params.amount);
    }
    metric.updatedAt = event.block.timestamp;
    metric.save();
}

export function handleLLMJudgeSet(event: LLMJudgeSet): void {
    let oracle = new LLMJudgeOracle(event.transaction.hash.toHex());
    oracle.previousOracle = event.params.previousOracle;
    oracle.newOracle = event.params.newOracle;
    oracle.updatedAt = event.block.timestamp;
    oracle.save();
}

export function handleTaskJudgedWithProof(event: TaskJudgedWithProof): void {
    // Data already captured by handleTaskJudged; this event is for off-chain audit
}

export function handleJudgeSlashed(event: JudgeSlashed): void {
    // Slash events are logged for audit; no core entity mutation required
}
