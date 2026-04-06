/**
 * PDA Resolver for Agent Arena program
 *
 * Centralizes all Program Derived Address calculations needed by the daemon
 * when interacting with the on-chain Agent Arena program.
 *
 * @module solana/pda-resolver
 */

import { PublicKey } from '@solana/web3.js';
import { ARENA_PROGRAM_ID } from './program-ids.js';

// ---------------------------------------------------------------------------
// Seeds
// ---------------------------------------------------------------------------

const CONFIG_SEED = Buffer.from('config');
const TASK_SEED = Buffer.from('task');
const ESCROW_SEED = Buffer.from('escrow');
const APPLICATION_SEED = Buffer.from('application');
const SUBMISSION_SEED = Buffer.from('submission');
const REPUTATION_SEED = Buffer.from('reputation');
const STAKE_SEED = Buffer.from('stake');
const TREASURY_SEED = Buffer.from('treasury');
const EVENT_AUTHORITY_SEED = Buffer.from('event_authority');
const JUDGE_POOL_SEED = Buffer.from('judge_pool');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function u64LeBuffer(value: bigint | number): Buffer {
    const buf = Buffer.allocUnsafe(8);
    buf.writeBigUInt64LE(BigInt(value));
    return buf;
}

// ---------------------------------------------------------------------------
// PDA Resolvers
// ---------------------------------------------------------------------------

export function findConfigPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([CONFIG_SEED], ARENA_PROGRAM_ID);
}

export function findTaskPda(taskId: bigint | number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [TASK_SEED, u64LeBuffer(taskId)],
        ARENA_PROGRAM_ID,
    );
}

export function findEscrowPda(taskId: bigint | number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [ESCROW_SEED, u64LeBuffer(taskId)],
        ARENA_PROGRAM_ID,
    );
}

export function findApplicationPda(
    taskId: bigint | number,
    agent: PublicKey,
): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [APPLICATION_SEED, u64LeBuffer(taskId), agent.toBuffer()],
        ARENA_PROGRAM_ID,
    );
}

export function findSubmissionPda(
    taskId: bigint | number,
    agent: PublicKey,
): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [SUBMISSION_SEED, u64LeBuffer(taskId), agent.toBuffer()],
        ARENA_PROGRAM_ID,
    );
}

export function findReputationPda(agent: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [REPUTATION_SEED, agent.toBuffer()],
        ARENA_PROGRAM_ID,
    );
}

export function findStakePda(judge: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [STAKE_SEED, judge.toBuffer()],
        ARENA_PROGRAM_ID,
    );
}

export function findTreasuryPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([TREASURY_SEED], ARENA_PROGRAM_ID);
}

export function findEventAuthorityPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [EVENT_AUTHORITY_SEED],
        ARENA_PROGRAM_ID,
    );
}

export function findJudgePoolPda(category: number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [JUDGE_POOL_SEED, Buffer.from([category])],
        ARENA_PROGRAM_ID,
    );
}

// ---------------------------------------------------------------------------
// Batch resolver for judge_and_pay accounts
// ---------------------------------------------------------------------------

export interface JudgeAndPayPdas {
    task: PublicKey;
    escrow: PublicKey;
    winnerApplication: PublicKey;
    winnerSubmission: PublicKey;
    winnerReputation: PublicKey;
    judgeStake: PublicKey;
    treasury: PublicKey;
    eventAuthority: PublicKey;
}

export function resolveJudgeAndPayPdas(
    taskId: bigint | number,
    judge: PublicKey,
    winner: PublicKey,
): JudgeAndPayPdas {
    return {
        task: findTaskPda(taskId)[0],
        escrow: findEscrowPda(taskId)[0],
        winnerApplication: findApplicationPda(taskId, winner)[0],
        winnerSubmission: findSubmissionPda(taskId, winner)[0],
        winnerReputation: findReputationPda(winner)[0],
        judgeStake: findStakePda(judge)[0],
        treasury: findTreasuryPda()[0],
        eventAuthority: findEventAuthorityPda()[0],
    };
}
