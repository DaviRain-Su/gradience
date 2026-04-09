/**
 * MPP Voting Module
 *
 * Handles voting and milestone management for Multi-Party Payments.
 *
 * @module payments/mpp/voting
 */

import { EventEmitter } from 'node:events';
import { type MPPPayment, type MPPVote, type MPPConfig } from './types.js';
import { logger } from '../../utils/logger.js';
import { DaemonError, ErrorCodes } from '../../utils/errors.js';

// ============================================================================
// MPP Voting
// ============================================================================

export class MPPVoting extends EventEmitter {
    private votes: Map<string, MPPVote[]> = new Map();
    private config: MPPConfig;

    constructor(config: Partial<MPPConfig> = {}) {
        super();

        this.config = {
            rpcEndpoint: config.rpcEndpoint || 'https://api.devnet.solana.com',
            maxParticipants: config.maxParticipants || 10,
            maxJudges: config.maxJudges || 5,
            defaultTimeoutMs: config.defaultTimeoutMs || 7 * 24 * 60 * 60 * 1000, // 7 days
            minJudgeThresholdBps: config.minJudgeThresholdBps || 5000, // 50%
            ...config,
        };
    }

    // -------------------------------------------------------------------------
    // Vote Casting
    // -------------------------------------------------------------------------

    /**
     * Cast a vote as a judge
     */
    async castVote(
        payment: MPPPayment,
        judgeAddress: string,
        vote: 'approve' | 'reject' | 'abstain',
        reason?: string,
    ): Promise<MPPPayment> {
        // Verify judge
        const judge = payment.judges.find((j) => j.address === judgeAddress);
        if (!judge) {
            throw new DaemonError(ErrorCodes.MPP_NOT_A_JUDGE, 'Not an authorized judge', 403);
        }

        if (judge.hasVoted) {
            throw new DaemonError(ErrorCodes.MPP_ALREADY_VOTED, 'Judge already voted', 400);
        }

        // Record vote
        judge.hasVoted = true;
        judge.vote = vote;

        const voteRecord: MPPVote = {
            paymentId: payment.paymentId,
            judgeAddress,
            vote,
            reason,
            timestamp: Date.now(),
            signature: '', // Would be signed
        };

        const votes = this.votes.get(payment.paymentId) || [];
        votes.push(voteRecord);
        this.votes.set(payment.paymentId, votes);

        logger.info({ paymentId: payment.paymentId, judge: judgeAddress, vote }, 'Judge voted');

        this.emit('vote_cast', { paymentId: payment.paymentId, judgeAddress, vote });

        // Check if release conditions are met
        await this.checkReleaseConditions(payment);

        return payment;
    }

    // -------------------------------------------------------------------------
    // Release Condition Checking
    // -------------------------------------------------------------------------

    /**
     * Check if release conditions are met
     */
    async checkReleaseConditions(payment: MPPPayment): Promise<boolean> {
        const condition = payment.releaseConditions;
        const votes = this.votes.get(payment.paymentId) || [];

        let shouldRelease = false;

        switch (condition.type) {
            case 'unanimous':
                shouldRelease = payment.judges.every((j) => j.hasVoted && j.vote === 'approve');
                break;

            case 'majority':
                const approveCount = votes.filter((v) => v.vote === 'approve').length;
                const required = condition.requiredJudges || Math.ceil(payment.judges.length / 2);
                shouldRelease = approveCount >= required;
                break;

            case 'threshold':
                const totalWeight = payment.judges.reduce((sum, j) => sum + j.weight, 0);
                const approveWeight = votes
                    .filter((v) => v.vote === 'approve')
                    .reduce((sum, v) => {
                        const judge = payment.judges.find((j) => j.address === v.judgeAddress);
                        return sum + (judge?.weight || 0);
                    }, 0);
                const threshold = condition.thresholdBps || this.config.minJudgeThresholdBps;
                shouldRelease = (approveWeight * 10000) / totalWeight >= threshold;
                break;

            case 'milestone':
                shouldRelease = condition.milestones?.every((m) => m.approved) || false;
                break;

            case 'time':
                shouldRelease = Date.now() >= (condition.releaseTime || 0);
                break;
        }

        if (shouldRelease && payment.status === 'in_progress') {
            payment.status = 'approved';
            this.emit('payment_approved', { paymentId: payment.paymentId });
            logger.info({ paymentId: payment.paymentId }, 'MPP payment approved for release');
        }

        return shouldRelease;
    }

    // -------------------------------------------------------------------------
    // Milestone Management
    // -------------------------------------------------------------------------

    /**
     * Complete a milestone
     */
    async completeMilestone(payment: MPPPayment, milestoneId: string, proof?: string): Promise<MPPPayment> {
        const milestone = payment.releaseConditions.milestones?.find((m) => m.id === milestoneId);
        if (!milestone) {
            throw new DaemonError(ErrorCodes.MPP_MILESTONE_NOT_FOUND, 'Milestone not found', 404);
        }

        milestone.completed = true;
        milestone.proof = proof;

        logger.info({ paymentId: payment.paymentId, milestoneId }, 'Milestone completed');

        this.emit('milestone_completed', { paymentId: payment.paymentId, milestoneId, proof });

        return payment;
    }

    /**
     * Approve a milestone (by judge)
     */
    async approveMilestone(payment: MPPPayment, milestoneId: string, judgeAddress: string): Promise<MPPPayment> {
        // Verify judge
        const judge = payment.judges.find((j) => j.address === judgeAddress);
        if (!judge) {
            throw new DaemonError(ErrorCodes.MPP_NOT_A_JUDGE, 'Not an authorized judge', 403);
        }

        const milestone = payment.releaseConditions.milestones?.find((m) => m.id === milestoneId);
        if (!milestone) {
            throw new DaemonError(ErrorCodes.MPP_MILESTONE_NOT_FOUND, 'Milestone not found', 404);
        }

        milestone.approved = true;

        logger.info({ paymentId: payment.paymentId, milestoneId, judge: judgeAddress }, 'Milestone approved');

        this.emit('milestone_approved', { paymentId: payment.paymentId, milestoneId, judgeAddress });

        // Check if all milestones approved
        await this.checkReleaseConditions(payment);

        return payment;
    }

    // -------------------------------------------------------------------------
    // Query Methods
    // -------------------------------------------------------------------------

    getVotes(paymentId: string): MPPVote[] {
        return this.votes.get(paymentId) || [];
    }

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------

    /**
     * Close voting module and cleanup
     */
    async close(): Promise<void> {
        this.votes.clear();
        this.removeAllListeners();
    }
}
