/**
 * EVM Transaction Manager for Agent Daemon.
 *
 * Provides an ITransactionManager-compatible interface over AgentArenaEVM
 * using viem.
 */

import { createPublicClient, createWalletClient, http, parseEther, decodeEventLog, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { DaemonError, ErrorCodes } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { ITransactionManager, PostTaskParams, RuntimeEnv } from '../shared/transaction-manager.js';

const AGENT_ARENA_EVM_ABI = [
    {
        type: 'function',
        name: 'postTask',
        inputs: [
            { name: 'evalRef', type: 'string', internalType: 'string' },
            { name: 'deadline', type: 'uint64', internalType: 'uint64' },
            { name: 'judgeDeadline', type: 'uint64', internalType: 'uint64' },
            { name: 'judge', type: 'address', internalType: 'address' },
            { name: 'category', type: 'uint8', internalType: 'uint8' },
            { name: 'minStake', type: 'uint256', internalType: 'uint256' },
        ],
        outputs: [{ name: 'taskId', type: 'uint256', internalType: 'uint256' }],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        name: 'applyForTask',
        inputs: [{ name: 'taskId', type: 'uint256', internalType: 'uint256' }],
        outputs: [],
        stateMutability: 'payable',
    },
    {
        type: 'function',
        name: 'submitResult',
        inputs: [
            { name: 'taskId', type: 'uint256', internalType: 'uint256' },
            { name: 'resultRef', type: 'string', internalType: 'string' },
            { name: 'traceRef', type: 'string', internalType: 'string' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'cancelTask',
        inputs: [{ name: 'taskId', type: 'uint256', internalType: 'uint256' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'tasks',
        inputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
        outputs: [
            { name: 'poster', type: 'address', internalType: 'address' },
            { name: 'judge', type: 'address', internalType: 'address' },
            { name: 'winner', type: 'address', internalType: 'address' },
            { name: 'paymentToken', type: 'address', internalType: 'address' },
            { name: 'minStake', type: 'uint256', internalType: 'uint256' },
            { name: 'reward', type: 'uint256', internalType: 'uint256' },
            { name: 'deadline', type: 'uint64', internalType: 'uint64' },
            { name: 'judgeDeadline', type: 'uint64', internalType: 'uint64' },
            { name: 'category', type: 'uint8', internalType: 'uint8' },
            { name: 'score', type: 'uint8', internalType: 'uint8' },
            { name: 'state', type: 'uint8', internalType: 'enum AgentArenaEVM.TaskState' },
            { name: 'judgeMode', type: 'uint8', internalType: 'enum AgentArenaEVM.JudgeMode' },
        ],
        stateMutability: 'view',
    },
    {
        type: 'event',
        name: 'TaskCreated',
        inputs: [
            { name: 'taskId', type: 'uint256', indexed: true, internalType: 'uint256' },
            { name: 'poster', type: 'address', indexed: true, internalType: 'address' },
            { name: 'judge', type: 'address', indexed: true, internalType: 'address' },
            { name: 'category', type: 'uint8', indexed: false, internalType: 'uint8' },
            { name: 'minStake', type: 'uint256', indexed: false, internalType: 'uint256' },
            { name: 'reward', type: 'uint256', indexed: false, internalType: 'uint256' },
            { name: 'deadline', type: 'uint64', indexed: false, internalType: 'uint64' },
            { name: 'judgeDeadline', type: 'uint64', indexed: false, internalType: 'uint64' },
            { name: 'evalRef', type: 'string', indexed: false, internalType: 'string' },
        ],
        anonymous: false,
    },
    {
        type: 'function',
        name: 'taskCount',
        inputs: [],
        outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
        stateMutability: 'view',
    },
] as const;

export interface EvmTransactionManagerConfig {
    rpcUrl: string;
    chainId: number;
    agentArenaAddress: `0x${string}`;
    privateKey: `0x${string}`;
}

export class EvmTransactionManager implements ITransactionManager {
    private publicClient: ReturnType<typeof createPublicClient>;
    private walletClient: ReturnType<typeof createWalletClient>;
    private account: ReturnType<typeof privateKeyToAccount>;
    private config: EvmTransactionManagerConfig;
    private chain: Chain;

    constructor(config: EvmTransactionManagerConfig) {
        this.config = config;
        this.account = privateKeyToAccount(config.privateKey);
        this.chain = { ...baseSepolia, id: config.chainId };
        this.publicClient = createPublicClient({
            chain: this.chain,
            transport: http(config.rpcUrl),
        });
        this.walletClient = createWalletClient({
            account: this.account,
            chain: this.chain,
            transport: http(config.rpcUrl),
        });
        logger.info(
            { rpcUrl: config.rpcUrl, chainId: config.chainId, address: this.account.address },
            'EvmTransactionManager initialized',
        );
    }

    async getNextTaskId(): Promise<bigint> {
        try {
            const count = await this.publicClient.readContract({
                address: this.config.agentArenaAddress,
                abi: AGENT_ARENA_EVM_ABI,
                functionName: 'taskCount',
                args: [],
            });
            return (count as bigint) + 1n;
        } catch (error) {
            logger.error({ error }, 'Failed to get next EVM task ID');
            throw new DaemonError(
                ErrorCodes.SOLANA_ERROR,
                `Failed to get next task ID: ${error instanceof Error ? error.message : String(error)}`,
                500,
            );
        }
    }

    async getBalance(): Promise<number> {
        try {
            const balanceWei = await this.publicClient.getBalance({ address: this.account.address });
            return Number(balanceWei) / 1e18;
        } catch (error) {
            logger.error({ error }, 'Failed to get EVM balance');
            throw new DaemonError(
                ErrorCodes.SOLANA_ERROR,
                `Failed to get balance: ${error instanceof Error ? error.message : String(error)}`,
                500,
            );
        }
    }

    async postTask(params: PostTaskParams): Promise<string> {
        try {
            const { request } = await this.publicClient.simulateContract({
                address: this.config.agentArenaAddress,
                abi: AGENT_ARENA_EVM_ABI,
                functionName: 'postTask',
                args: [
                    params.evalRef,
                    BigInt(params.deadline),
                    BigInt(params.judgeDeadline),
                    (params.judge as `0x${string}` | undefined) ?? '0x0000000000000000000000000000000000000000',
                    params.category,
                    BigInt(params.minStake),
                ],
                account: this.account.address,
                value: BigInt(params.reward),
            });

            const txHash = await this.walletClient.writeContract(request);
            const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });

            let taskId = 0n;
            for (const log of receipt.logs) {
                if (log.address.toLowerCase() !== this.config.agentArenaAddress.toLowerCase()) continue;
                try {
                    const event = decodeEventLog({
                        abi: AGENT_ARENA_EVM_ABI,
                        eventName: 'TaskCreated',
                        data: log.data,
                        topics: log.topics,
                    });
                    if (event && 'args' in event && event.args && 'taskId' in event.args) {
                        taskId = event.args.taskId as bigint;
                        break;
                    }
                } catch {
                    // ignore
                }
            }

            logger.info({ txHash, taskId: taskId.toString() }, 'Posted task on EVM');
            return txHash;
        } catch (error) {
            logger.error({ error }, 'Failed to post task on EVM');
            throw new DaemonError(
                ErrorCodes.SOLANA_ERROR,
                `Failed to post task: ${error instanceof Error ? error.message : String(error)}`,
                500,
            );
        }
    }

    async applyForTask(taskId: string): Promise<string> {
        try {
            const { request } = await this.publicClient.simulateContract({
                address: this.config.agentArenaAddress,
                abi: AGENT_ARENA_EVM_ABI,
                functionName: 'applyForTask',
                args: [BigInt(taskId)],
                account: this.account.address,
                value: 0n,
            });

            const txHash = await this.walletClient.writeContract(request);
            logger.info({ txHash, taskId }, 'Applied for task on EVM');
            return txHash;
        } catch (error) {
            logger.error({ error, taskId }, 'Failed to apply for task on EVM');
            throw new DaemonError(
                ErrorCodes.SOLANA_ERROR,
                `Failed to apply for task: ${error instanceof Error ? error.message : String(error)}`,
                500,
            );
        }
    }

    async submitResult(
        taskId: string,
        resultCid: string,
        traceCid?: string,
        _runtimeEnv?: RuntimeEnv,
    ): Promise<string> {
        try {
            const { request } = await this.publicClient.simulateContract({
                address: this.config.agentArenaAddress,
                abi: AGENT_ARENA_EVM_ABI,
                functionName: 'submitResult',
                args: [BigInt(taskId), resultCid, traceCid ?? resultCid],
                account: this.account.address,
            });

            const txHash = await this.walletClient.writeContract(request);
            logger.info({ txHash, taskId }, 'Submitted result on EVM');
            return txHash;
        } catch (error) {
            logger.error({ error, taskId }, 'Failed to submit result on EVM');
            throw new DaemonError(
                ErrorCodes.SOLANA_ERROR,
                `Failed to submit result: ${error instanceof Error ? error.message : String(error)}`,
                500,
            );
        }
    }

    async claimReward(_taskId: string): Promise<string> {
        throw new DaemonError(
            ErrorCodes.INVALID_REQUEST,
            'claimReward is not implemented for EVM; rewards are distributed automatically during judgeAndPay',
            400,
        );
    }
}
