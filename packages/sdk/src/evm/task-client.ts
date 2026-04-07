/**
 * EVM Task Client for AgentArenaEVM.
 *
 * Provides a minimal chain-agnostic interface for posting and applying to tasks
 * on any EVM L2 via viem. No wagmi dependency.
 */

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEther,
  decodeEventLog,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import { AGENT_ARENA_EVM_ABI } from './abi';
import type { EVMAdapter } from './adapter';

export interface EVMChainConfig {
  chainId: number;
  rpcEndpoint: string;
  agentArenaAddress: `0x${string}`;
}

const defaultChain = { ...baseSepolia, id: 84532 };

function getChain(config: Pick<EVMChainConfig, 'chainId'>) {
  return { ...defaultChain, id: config.chainId };
}

function getPublicClient(cfg: Pick<EVMChainConfig, 'chainId' | 'rpcEndpoint'>) {
  return createPublicClient({
    chain: getChain(cfg),
    transport: http(cfg.rpcEndpoint),
  });
}

function getWalletClient(provider: unknown, cfg: Pick<EVMChainConfig, 'chainId' | 'rpcEndpoint'>) {
  return createWalletClient({
    chain: getChain(cfg),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transport: custom(provider as any),
  });
}

export interface PostTaskEVMOptions {
  evalRef: string;
  category: number;
  reward: bigint | string;
  minStake?: bigint | string;
  deadlineOffsetSeconds?: number;
  judgeDeadlineOffsetSeconds?: number;
  judge?: `0x${string}`;
}

export class EVMTaskClient {
  private config: EVMChainConfig;

  constructor(config: EVMChainConfig) {
    this.config = config;
  }

  async postTask(adapter: EVMAdapter, options: PostTaskEVMOptions): Promise<{ taskId: bigint; txHash: `0x${string}` }> {
    const publicClient = getPublicClient(this.config);
    const walletClient = getWalletClient(adapter.provider, this.config);

    const now = Math.floor(Date.now() / 1000);
    const deadline = BigInt(now + (options.deadlineOffsetSeconds ?? 3600));
    const judgeDeadline = BigInt(now + (options.judgeDeadlineOffsetSeconds ?? 7200));
    const reward = typeof options.reward === 'string' ? parseEther(options.reward) : options.reward;
    const minStake = typeof options.minStake === 'string' ? parseEther(options.minStake) : (options.minStake ?? 0n);

    const { request } = await publicClient.simulateContract({
      address: this.config.agentArenaAddress,
      abi: AGENT_ARENA_EVM_ABI,
      functionName: 'postTask',
      args: [
        options.evalRef,
        deadline,
        judgeDeadline,
        options.judge ?? '0x0000000000000000000000000000000000000000',
        options.category,
        minStake,
      ],
      account: adapter.address,
      value: reward,
    });

    const txHash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    let taskId = 0n;
    for (const log of receipt.logs) {
      try {
        const event = decodeEventLog({
          abi: AGENT_ARENA_EVM_ABI,
          eventName: 'TaskCreated',
          data: log.data,
          topics: log.topics,
        });
        if (event && 'args' in event && event.args && 'taskId' in event.args) {
          taskId = event.args.taskId;
          break;
        }
      } catch {
        // ignore
      }
    }

    return { taskId, txHash };
  }

  async applyForTask(adapter: EVMAdapter, taskId: bigint, stake?: bigint | string): Promise<`0x${string}`> {
    const publicClient = getPublicClient(this.config);
    const walletClient = getWalletClient(adapter.provider, this.config);
    const stakeValue = typeof stake === 'string' ? parseEther(stake) : (stake ?? 0n);

    const { request } = await publicClient.simulateContract({
      address: this.config.agentArenaAddress,
      abi: AGENT_ARENA_EVM_ABI,
      functionName: 'applyForTask',
      args: [taskId],
      account: adapter.address,
      value: stakeValue,
    });

    return walletClient.writeContract(request);
  }
}
