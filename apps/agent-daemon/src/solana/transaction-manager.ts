/**
 * Solana Transaction Manager
 * 
 * NOTE: All publicKey references in this file are Solana PUBLIC KEYS (addresses),
 * not private keys. Private keys are managed securely by KeyManager and never
 * exposed in this file.
 */

import {
    Connection,
    PublicKey,
    Transaction,
    TransactionInstruction,
    SystemProgram,
    LAMPORTS_PER_SOL,
    type Commitment,
} from '@solana/web3.js';
import type { KeyManager } from '../keys/key-manager.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { ARENA_PROGRAM_ADDRESS } from './program-ids.js';
import { addressToPublicKey } from './kit-compat.js';
import type { ITransactionManager, PostTaskParams, RuntimeEnv } from '../shared/transaction-manager.js';

// Re-export for backward compatibility
export type { PostTaskParams, RuntimeEnv };

// PDA seeds
const CONFIG_SEED = Buffer.from('config');
const TASK_SEED = Buffer.from('task');
const ESCROW_SEED = Buffer.from('escrow');
const APPLICATION_SEED = Buffer.from('application');
const REPUTATION_SEED = Buffer.from('reputation');
const SUBMISSION_SEED = Buffer.from('submission');
const EVENT_AUTHORITY_SEED = Buffer.from('event_authority');
const JUDGE_POOL_SEED = Buffer.from('judge_pool');
const TREASURY_SEED = Buffer.from('treasury');

// Instruction discriminators
const POST_TASK_DISCRIMINATOR = 1;
const APPLY_FOR_TASK_DISCRIMINATOR = 2;
const SUBMIT_RESULT_DISCRIMINATOR = 3;

// Account data offsets for ProgramConfig
const CONFIG_TASK_COUNT_OFFSET = 74; // 2 header + 32 treasury + 32 upgrade_authority + 8 min_judge_stake

/**
 * Manages Solana transactions for the Agent Daemon.
 * Interacts with the Gradience Arena program for task operations.
 */
export class TransactionManager implements ITransactionManager {
    private connection: Connection;
    private keyManager: KeyManager;
    private publicKey: PublicKey;

    constructor(rpcUrl: string, keyManager: KeyManager) {
        this.connection = new Connection(rpcUrl, 'confirmed');
        this.keyManager = keyManager;
        this.publicKey = new PublicKey(keyManager.getPublicKey());
        logger.info({ rpcUrl, publicKey: this.publicKey.toBase58() }, 'TransactionManager initialized');
    }

    /**
     * Get SOL balance of the agent wallet
     */
    async getBalance(): Promise<number> {
        try {
            const balanceLamports = await this.connection.getBalance(this.publicKey, 'confirmed');
            return balanceLamports / LAMPORTS_PER_SOL;
        } catch (error) {
            logger.error({ error }, 'Failed to get balance');
            throw new DaemonError(
                ErrorCodes.SOLANA_ERROR,
                `Failed to get balance: ${error instanceof Error ? error.message : String(error)}`,
                500,
            );
        }
    }

    /**
     * Create a new task on the Arena program
     */
    async postTask(params: PostTaskParams): Promise<string> {
        try {
            // Get next task ID from config
            const taskId = await this.fetchNextTaskId();
            const taskIdBuf = Buffer.alloc(8);
            taskIdBuf.writeBigUInt64LE(taskId, 0);

            // Derive PDAs
            const [configPda] = PublicKey.findProgramAddressSync([CONFIG_SEED], addressToPublicKey(ARENA_PROGRAM_ADDRESS));
            const [taskPda] = PublicKey.findProgramAddressSync([TASK_SEED, taskIdBuf], addressToPublicKey(ARENA_PROGRAM_ADDRESS));
            const [escrowPda] = PublicKey.findProgramAddressSync([ESCROW_SEED, taskIdBuf], addressToPublicKey(ARENA_PROGRAM_ADDRESS));
            const [judgePoolPda] = PublicKey.findProgramAddressSync(
                [JUDGE_POOL_SEED, Buffer.from([params.category])],
                addressToPublicKey(ARENA_PROGRAM_ADDRESS),
            );
            const [eventAuthorityPda] = PublicKey.findProgramAddressSync([EVENT_AUTHORITY_SEED], addressToPublicKey(ARENA_PROGRAM_ADDRESS));

            // Prepare mint and judge bytes
            const mintBytes = params.mint ? this.parsePubkeyToBytes(params.mint) : new Uint8Array(32).fill(0);
            const judgeBytes = params.judge ? this.parsePubkeyToBytes(params.judge) : new Uint8Array(32).fill(0);

            // Build instruction data
            const data = this.encodePostTaskData({
                ...params,
                judge: Array.from(judgeBytes),
                mint: Array.from(mintBytes),
            });

            // Determine if using SPL token path
            const isSplPath = params.mint && params.mint !== SystemProgram.programId.toBase58();

            // Build account metas (SOL path uses first 8 accounts)
            const keys = [
                { pubkey: this.publicKey, isSigner: true, isWritable: true }, // poster
                { pubkey: configPda, isSigner: false, isWritable: true }, // config
                { pubkey: taskPda, isSigner: false, isWritable: true }, // task
                { pubkey: escrowPda, isSigner: false, isWritable: true }, // escrow
                { pubkey: judgePoolPda, isSigner: false, isWritable: false }, // judge_pool
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
                { pubkey: eventAuthorityPda, isSigner: false, isWritable: false }, // event_authority
                { pubkey: addressToPublicKey(ARENA_PROGRAM_ADDRESS), isSigner: false, isWritable: false }, // gradience_program
            ];

            // For SPL tokens, we would add optional accounts here
            // For now, we only support SOL path in the basic implementation
            if (isSplPath) {
                throw new DaemonError(
                    ErrorCodes.INVALID_REQUEST,
                    'SPL token tasks not yet supported in this implementation',
                    400,
                );
            }

            const instruction = new TransactionInstruction({
                keys,
                programId: addressToPublicKey(ARENA_PROGRAM_ADDRESS),
                data,
            });

            const signature = await this.signAndSendTransaction(instruction);
            logger.info({ signature, taskId: taskId.toString() }, 'Task posted successfully');
            return signature;
        } catch (error) {
            if (error instanceof DaemonError) throw error;
            logger.error({ error, params }, 'Failed to post task');
            throw new DaemonError(
                ErrorCodes.SOLANA_ERROR,
                `Failed to post task: ${error instanceof Error ? error.message : String(error)}`,
                500,
            );
        }
    }

    /**
     * Apply for a task
     */
    async applyForTask(taskId: string): Promise<string> {
        try {
            const taskIdBigInt = BigInt(taskId);
            const taskIdBuf = Buffer.alloc(8);
            taskIdBuf.writeBigUInt64LE(taskIdBigInt, 0);

            // Derive PDAs
            const [taskPda] = PublicKey.findProgramAddressSync([TASK_SEED, taskIdBuf], addressToPublicKey(ARENA_PROGRAM_ADDRESS));
            const [escrowPda] = PublicKey.findProgramAddressSync([ESCROW_SEED, taskIdBuf], addressToPublicKey(ARENA_PROGRAM_ADDRESS));
            const [applicationPda] = PublicKey.findProgramAddressSync(
                [APPLICATION_SEED, taskIdBuf, this.publicKey.toBytes()],
                addressToPublicKey(ARENA_PROGRAM_ADDRESS),
            );
            const [reputationPda] = PublicKey.findProgramAddressSync(
                [REPUTATION_SEED, this.publicKey.toBytes()],
                addressToPublicKey(ARENA_PROGRAM_ADDRESS),
            );
            const [eventAuthorityPda] = PublicKey.findProgramAddressSync([EVENT_AUTHORITY_SEED], addressToPublicKey(ARENA_PROGRAM_ADDRESS));

            // Build instruction data (just discriminator for ApplyForTask)
            const data = Buffer.from([APPLY_FOR_TASK_DISCRIMINATOR]);

            const keys = [
                { pubkey: this.publicKey, isSigner: true, isWritable: true }, // agent
                { pubkey: taskPda, isSigner: false, isWritable: false }, // task
                { pubkey: escrowPda, isSigner: false, isWritable: true }, // escrow
                { pubkey: applicationPda, isSigner: false, isWritable: true }, // application
                { pubkey: reputationPda, isSigner: false, isWritable: true }, // reputation
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
                { pubkey: eventAuthorityPda, isSigner: false, isWritable: false }, // event_authority
                { pubkey: addressToPublicKey(ARENA_PROGRAM_ADDRESS), isSigner: false, isWritable: false }, // gradience_program
            ];

            const instruction = new TransactionInstruction({
                keys,
                programId: addressToPublicKey(ARENA_PROGRAM_ADDRESS),
                data,
            });

            const signature = await this.signAndSendTransaction(instruction);
            logger.info({ signature, taskId }, 'Applied for task successfully');
            return signature;
        } catch (error) {
            if (error instanceof DaemonError) throw error;
            logger.error({ error, taskId }, 'Failed to apply for task');
            throw new DaemonError(
                ErrorCodes.SOLANA_ERROR,
                `Failed to apply for task: ${error instanceof Error ? error.message : String(error)}`,
                500,
            );
        }
    }

    /**
     * Submit work result for a task
     */
    async submitResult(
        taskId: string,
        resultCid: string,
        traceCid?: string,
        runtimeEnv?: RuntimeEnv,
    ): Promise<string> {
        try {
            const taskIdBigInt = BigInt(taskId);
            const taskIdBuf = Buffer.alloc(8);
            taskIdBuf.writeBigUInt64LE(taskIdBigInt, 0);

            // Derive PDAs
            const [taskPda] = PublicKey.findProgramAddressSync([TASK_SEED, taskIdBuf], addressToPublicKey(ARENA_PROGRAM_ADDRESS));
            const [applicationPda] = PublicKey.findProgramAddressSync(
                [APPLICATION_SEED, taskIdBuf, this.publicKey.toBytes()],
                addressToPublicKey(ARENA_PROGRAM_ADDRESS),
            );
            const [submissionPda] = PublicKey.findProgramAddressSync(
                [SUBMISSION_SEED, taskIdBuf, this.publicKey.toBytes()],
                addressToPublicKey(ARENA_PROGRAM_ADDRESS),
            );
            const [eventAuthorityPda] = PublicKey.findProgramAddressSync([EVENT_AUTHORITY_SEED], addressToPublicKey(ARENA_PROGRAM_ADDRESS));

            // Use defaults for optional params
            const finalTraceCid = traceCid ?? resultCid;
            const finalRuntimeEnv: RuntimeEnv = runtimeEnv ?? {
                provider: 'agent-daemon',
                model: 'default',
                runtime: 'node',
                version: '1.0.0',
            };

            // Build instruction data
            const data = this.encodeSubmitResultData({
                resultRef: resultCid,
                traceRef: finalTraceCid,
                runtimeEnv: finalRuntimeEnv,
            });

            const keys = [
                { pubkey: this.publicKey, isSigner: true, isWritable: true }, // agent
                { pubkey: taskPda, isSigner: false, isWritable: true }, // task
                { pubkey: applicationPda, isSigner: false, isWritable: false }, // application
                { pubkey: submissionPda, isSigner: false, isWritable: true }, // submission
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
                { pubkey: eventAuthorityPda, isSigner: false, isWritable: false }, // event_authority
                { pubkey: addressToPublicKey(ARENA_PROGRAM_ADDRESS), isSigner: false, isWritable: false }, // gradience_program
            ];

            const instruction = new TransactionInstruction({
                keys,
                programId: addressToPublicKey(ARENA_PROGRAM_ADDRESS),
                data,
            });

            const signature = await this.signAndSendTransaction(instruction);
            logger.info({ signature, taskId, resultCid }, 'Result submitted successfully');
            return signature;
        } catch (error) {
            if (error instanceof DaemonError) throw error;
            logger.error({ error, taskId, resultCid }, 'Failed to submit result');
            throw new DaemonError(
                ErrorCodes.SOLANA_ERROR,
                `Failed to submit result: ${error instanceof Error ? error.message : String(error)}`,
                500,
            );
        }
    }

    /**
     * Claim settled reward for a task
     * Note: This is not implemented by the current Arena program - rewards are distributed
     * automatically during judgeAndPay. This method exists for API compatibility but will throw.
     */
    async claimReward(_taskId: string): Promise<string> {
        throw new DaemonError(
            ErrorCodes.INVALID_REQUEST,
            'claimReward is not implemented by the Arena program; rewards are distributed automatically during judgeAndPay',
            400,
        );
    }

    // ==================== Private Helpers ====================

    private async fetchNextTaskId(): Promise<bigint> {
        const [configPda] = PublicKey.findProgramAddressSync([CONFIG_SEED], addressToPublicKey(ARENA_PROGRAM_ADDRESS));

        const accountInfo = await this.connection.getAccountInfo(configPda, 'confirmed');
        if (!accountInfo) {
            throw new DaemonError(ErrorCodes.INVALID_REQUEST, 'Program config account not found', 400);
        }

        const data = accountInfo.data;
        if (data.length < CONFIG_TASK_COUNT_OFFSET + 8) {
            throw new DaemonError(ErrorCodes.INVALID_REQUEST, 'Invalid config account data', 400);
        }

        return data.readBigUInt64LE(CONFIG_TASK_COUNT_OFFSET);
    }

    private parsePubkeyToBytes(pubkeyStr: string): Uint8Array {
        try {
            return new PublicKey(pubkeyStr).toBytes();
        } catch {
            throw new DaemonError(ErrorCodes.INVALID_REQUEST, `Invalid public key: ${pubkeyStr}`, 400);
        }
    }

    private encodePostTaskData(params: {
        evalRef: string;
        deadline: number;
        judgeDeadline: number;
        judgeMode: number;
        judge: number[];
        category: number;
        mint: number[];
        minStake: number;
        reward: number;
    }): Buffer {
        const parts: Buffer[] = [];

        // discriminator (u8)
        parts.push(Buffer.from([POST_TASK_DISCRIMINATOR]));

        // evalRef (string: u32 len + bytes)
        parts.push(this.encodeString(params.evalRef));

        // deadline (i64 LE)
        const deadlineBuf = Buffer.alloc(8);
        deadlineBuf.writeBigInt64LE(BigInt(params.deadline), 0);
        parts.push(deadlineBuf);

        // judgeDeadline (i64 LE)
        const judgeDeadlineBuf = Buffer.alloc(8);
        judgeDeadlineBuf.writeBigInt64LE(BigInt(params.judgeDeadline), 0);
        parts.push(judgeDeadlineBuf);

        // judgeMode (u8)
        parts.push(Buffer.from([params.judgeMode]));

        // judge ([u8; 32])
        parts.push(Buffer.from(params.judge));

        // category (u8)
        parts.push(Buffer.from([params.category]));

        // mint ([u8; 32])
        parts.push(Buffer.from(params.mint));

        // minStake (u64 LE)
        const minStakeBuf = Buffer.alloc(8);
        minStakeBuf.writeBigUInt64LE(BigInt(params.minStake), 0);
        parts.push(minStakeBuf);

        // reward (u64 LE)
        const rewardBuf = Buffer.alloc(8);
        rewardBuf.writeBigUInt64LE(BigInt(params.reward), 0);
        parts.push(rewardBuf);

        return Buffer.concat(parts);
    }

    private encodeSubmitResultData(params: {
        resultRef: string;
        traceRef: string;
        runtimeEnv: RuntimeEnv;
    }): Buffer {
        const parts: Buffer[] = [];

        // discriminator (u8)
        parts.push(Buffer.from([SUBMIT_RESULT_DISCRIMINATOR]));

        // resultRef (string)
        parts.push(this.encodeString(params.resultRef));

        // traceRef (string)
        parts.push(this.encodeString(params.traceRef));

        // runtimeEnv (struct with 4 strings)
        parts.push(this.encodeString(params.runtimeEnv.provider));
        parts.push(this.encodeString(params.runtimeEnv.model));
        parts.push(this.encodeString(params.runtimeEnv.runtime));
        parts.push(this.encodeString(params.runtimeEnv.version));

        return Buffer.concat(parts);
    }

    private encodeString(str: string): Buffer {
        const strBuf = Buffer.from(str, 'utf8');
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32LE(strBuf.length, 0);
        return Buffer.concat([lenBuf, strBuf]);
    }

    private async signAndSendTransaction(
        instruction: TransactionInstruction,
        commitment: Commitment = 'confirmed',
    ): Promise<string> {
        const transaction = new Transaction().add(instruction);

        const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash(commitment);
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = this.publicKey;

        // Serialize message and sign using KeyManager
        const message = transaction.serializeMessage();
        const signature = this.keyManager.sign(message);
        transaction.addSignature(this.publicKey, Buffer.from(signature));

        // Send transaction
        const txid = await this.connection.sendRawTransaction(transaction.serialize(), {
            preflightCommitment: commitment,
        });

        // Wait for confirmation
        await this.connection.confirmTransaction(
            {
                signature: txid,
                blockhash,
                lastValidBlockHeight,
            },
            commitment,
        );

        return txid;
    }
}
