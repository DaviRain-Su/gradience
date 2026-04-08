/**
 * PDA Resolver for Agent Arena program
 *
 * Centralizes all Program Derived Address calculations needed by the daemon
 * when interacting with the on-chain Agent Arena program.
 *
 * @module solana/pda-resolver
 */

import { getProgramDerivedAddress, getAddressEncoder, type Address } from '@solana/kit';
import { ARENA_PROGRAM_ADDRESS } from './program-ids.js';

const addressEncoder = getAddressEncoder();

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
const VRF_RESULT_SEED = Buffer.from('vrf_result');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function u64LeBuffer(value: bigint | number): Buffer {
    const buf = Buffer.allocUnsafe(8);
    buf.writeBigUInt64LE(BigInt(value));
    return buf;
}

function toSeed(addr: Address): Uint8Array {
    return new Uint8Array(addressEncoder.encode(addr));
}

// ---------------------------------------------------------------------------
// PDA Resolvers
// ---------------------------------------------------------------------------

export async function findConfigPda(): Promise<[Address, number]> {
    const [addr, bump] = await getProgramDerivedAddress({
        programAddress: ARENA_PROGRAM_ADDRESS,
        seeds: [CONFIG_SEED],
    });
    return [addr, bump];
}

export async function findTaskPda(taskId: bigint | number): Promise<[Address, number]> {
    const [addr, bump] = await getProgramDerivedAddress({
        programAddress: ARENA_PROGRAM_ADDRESS,
        seeds: [TASK_SEED, u64LeBuffer(taskId)],
    });
    return [addr, bump];
}

export async function findEscrowPda(taskId: bigint | number): Promise<[Address, number]> {
    const [addr, bump] = await getProgramDerivedAddress({
        programAddress: ARENA_PROGRAM_ADDRESS,
        seeds: [ESCROW_SEED, u64LeBuffer(taskId)],
    });
    return [addr, bump];
}

export async function findApplicationPda(
    taskId: bigint | number,
    agent: Address,
): Promise<[Address, number]> {
    const [addr, bump] = await getProgramDerivedAddress({
        programAddress: ARENA_PROGRAM_ADDRESS,
        seeds: [APPLICATION_SEED, u64LeBuffer(taskId), toSeed(agent)],
    });
    return [addr, bump];
}

export async function findSubmissionPda(
    taskId: bigint | number,
    agent: Address,
): Promise<[Address, number]> {
    const [addr, bump] = await getProgramDerivedAddress({
        programAddress: ARENA_PROGRAM_ADDRESS,
        seeds: [SUBMISSION_SEED, u64LeBuffer(taskId), toSeed(agent)],
    });
    return [addr, bump];
}

export async function findReputationPda(agent: Address): Promise<[Address, number]> {
    const [addr, bump] = await getProgramDerivedAddress({
        programAddress: ARENA_PROGRAM_ADDRESS,
        seeds: [REPUTATION_SEED, toSeed(agent)],
    });
    return [addr, bump];
}

export async function findStakePda(judge: Address): Promise<[Address, number]> {
    const [addr, bump] = await getProgramDerivedAddress({
        programAddress: ARENA_PROGRAM_ADDRESS,
        seeds: [STAKE_SEED, toSeed(judge)],
    });
    return [addr, bump];
}

export async function findTreasuryPda(): Promise<[Address, number]> {
    const [addr, bump] = await getProgramDerivedAddress({
        programAddress: ARENA_PROGRAM_ADDRESS,
        seeds: [TREASURY_SEED],
    });
    return [addr, bump];
}

export async function findEventAuthorityPda(): Promise<[Address, number]> {
    const [addr, bump] = await getProgramDerivedAddress({
        programAddress: ARENA_PROGRAM_ADDRESS,
        seeds: [EVENT_AUTHORITY_SEED],
    });
    return [addr, bump];
}

export async function findJudgePoolPda(category: number): Promise<[Address, number]> {
    const [addr, bump] = await getProgramDerivedAddress({
        programAddress: ARENA_PROGRAM_ADDRESS,
        seeds: [JUDGE_POOL_SEED, Buffer.from([category])],
    });
    return [addr, bump];
}

export async function findVrfResultPda(taskId: bigint | number): Promise<[Address, number]> {
    const [addr, bump] = await getProgramDerivedAddress({
        programAddress: ARENA_PROGRAM_ADDRESS,
        seeds: [VRF_RESULT_SEED, u64LeBuffer(taskId)],
    });
    return [addr, bump];
}

// ---------------------------------------------------------------------------
// Batch resolver for judge_and_pay accounts
// ---------------------------------------------------------------------------

export interface JudgeAndPayPdas {
    task: Address;
    escrow: Address;
    winnerApplication: Address;
    winnerSubmission: Address;
    winnerReputation: Address;
    judgeStake: Address;
    treasury: Address;
    eventAuthority: Address;
}

export async function resolveJudgeAndPayPdas(
    taskId: bigint | number,
    judge: Address,
    winner: Address,
): Promise<JudgeAndPayPdas> {
    return {
        task: (await findTaskPda(taskId))[0],
        escrow: (await findEscrowPda(taskId))[0],
        winnerApplication: (await findApplicationPda(taskId, winner))[0],
        winnerSubmission: (await findSubmissionPda(taskId, winner))[0],
        winnerReputation: (await findReputationPda(winner))[0],
        judgeStake: (await findStakePda(judge))[0],
        treasury: (await findTreasuryPda())[0],
        eventAuthority: (await findEventAuthorityPda())[0],
    };
}
