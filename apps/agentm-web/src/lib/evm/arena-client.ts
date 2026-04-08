/**
 * EVM Adapter for AgentArenaEVM.
 *
 * Provides an interface similar to lib/solana/arena-client.ts but targeting
 * the EVM deployment via viem.
 */

import { createPublicClient, createWalletClient, custom, http, parseEther, decodeEventLog } from 'viem';
import { AGENT_ARENA_EVM_ABI } from './abi';
import { getChainConfig, getDefaultEvmChainId } from './config';

function getPublicClient(chainId?: number) {
  const id = chainId ?? getDefaultEvmChainId();
  const cfg = getChainConfig(id);
  return createPublicClient({
    chain: cfg.chain,
    transport: http(cfg.rpcEndpoint),
  });
}

function getWalletClient(ethereumProvider: any, chainId?: number) {
  const id = chainId ?? getDefaultEvmChainId();
  const cfg = getChainConfig(id);
  return createWalletClient({
    chain: cfg.chain,
    transport: custom(ethereumProvider),
  });
}

export interface PostTaskEVMParams {
  ethereumProvider: any;
  account: `0x${string}`;
  evalRef: string;
  category: number;
  reward: string; // ETH amount as decimal string
  minStake?: string;
  deadlineOffsetSeconds?: number;
  judgeDeadlineOffsetSeconds?: number;
  judge?: `0x${string}`;
  requireZkKyc?: boolean;
  chainId?: number;
}

export async function postTaskEVM(params: PostTaskEVMParams): Promise<{ taskId: bigint; txHash: `0x${string}` }> {
  const cfg = getChainConfig(params.chainId ?? getDefaultEvmChainId());
  const publicClient = getPublicClient(params.chainId);
  const walletClient = getWalletClient(params.ethereumProvider, params.chainId);

  const now = Math.floor(Date.now() / 1000);
  const deadline = BigInt(now + (params.deadlineOffsetSeconds ?? 3600));
  const judgeDeadline = BigInt(now + (params.judgeDeadlineOffsetSeconds ?? 7200));
  const minStake = parseEther(params.minStake ?? '0');
  const reward = parseEther(params.reward);

  const { request } = await publicClient.simulateContract({
    address: cfg.agentArenaAddress,
    abi: AGENT_ARENA_EVM_ABI,
    functionName: 'postTask',
    args: [
      params.evalRef,
      deadline,
      judgeDeadline,
      params.judge ?? '0x0000000000000000000000000000000000000000',
      params.category,
      minStake,
      params.requireZkKyc ?? false,
    ],
    account: params.account,
    value: reward,
  });

  const txHash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  // Extract taskId from first TaskCreated log
  let taskId = 0n;
  for (const log of receipt.logs) {
    try {
      const event = decodeEventLog({
        abi: AGENT_ARENA_EVM_ABI,
        eventName: 'TaskCreated',
        data: log.data,
        topics: log.topics,
      });
      if (event && event.args && event.args.taskId) {
        taskId = event.args.taskId;
        break;
      }
    } catch {
      // not a TaskCreated log
    }
  }

  return { taskId, txHash };
}

export interface ApplyForTaskEVMParams {
  ethereumProvider: any;
  account: `0x${string}`;
  taskId: bigint;
  stake?: string;
  chainId?: number;
}

export async function applyForTaskEVM(params: ApplyForTaskEVMParams): Promise<`0x${string}`> {
  const cfg = getChainConfig(params.chainId ?? getDefaultEvmChainId());
  const publicClient = getPublicClient(params.chainId);
  const walletClient = getWalletClient(params.ethereumProvider, params.chainId);

  const { request } = await publicClient.simulateContract({
    address: cfg.agentArenaAddress,
    abi: AGENT_ARENA_EVM_ABI,
    functionName: 'applyForTask',
    args: [params.taskId],
    account: params.account,
    value: params.stake ? parseEther(params.stake) : 0n,
  });

  return walletClient.writeContract(request);
}

export interface SubmitResultEVMParams {
  ethereumProvider: any;
  account: `0x${string}`;
  taskId: bigint;
  resultRef: string;
  traceRef?: string;
  chainId?: number;
}

export async function submitResultEVM(params: SubmitResultEVMParams): Promise<`0x${string}`> {
  const cfg = getChainConfig(params.chainId ?? getDefaultEvmChainId());
  const publicClient = getPublicClient(params.chainId);
  const walletClient = getWalletClient(params.ethereumProvider, params.chainId);

  const { request } = await publicClient.simulateContract({
    address: cfg.agentArenaAddress,
    abi: AGENT_ARENA_EVM_ABI,
    functionName: 'submitResult',
    args: [params.taskId, params.resultRef, params.traceRef ?? ''],
    account: params.account,
  });

  return walletClient.writeContract(request);
}

export interface JudgeAndPayEVMParams {
  ethereumProvider: any;
  account: `0x${string}`;
  taskId: bigint;
  winner: `0x${string}`;
  score: number;
  chainId?: number;
}

export async function judgeAndPayEVM(params: JudgeAndPayEVMParams): Promise<`0x${string}`> {
  const cfg = getChainConfig(params.chainId ?? getDefaultEvmChainId());
  const publicClient = getPublicClient(params.chainId);
  const walletClient = getWalletClient(params.ethereumProvider, params.chainId);

  const { request } = await publicClient.simulateContract({
    address: cfg.agentArenaAddress,
    abi: AGENT_ARENA_EVM_ABI,
    functionName: 'judgeAndPay',
    args: [params.taskId, params.winner, params.score],
    account: params.account,
  });

  return walletClient.writeContract(request);
}

export interface CancelTaskEVMParams {
  ethereumProvider: any;
  account: `0x${string}`;
  taskId: bigint;
  chainId?: number;
}

export async function cancelTaskEVM(params: CancelTaskEVMParams): Promise<`0x${string}`> {
  const cfg = getChainConfig(params.chainId ?? getDefaultEvmChainId());
  const publicClient = getPublicClient(params.chainId);
  const walletClient = getWalletClient(params.ethereumProvider, params.chainId);

  const { request } = await publicClient.simulateContract({
    address: cfg.agentArenaAddress,
    abi: AGENT_ARENA_EVM_ABI,
    functionName: 'cancelTask',
    args: [params.taskId],
    account: params.account,
  });

  return walletClient.writeContract(request);
}

export interface FetchTaskEVMParams {
  taskId: bigint;
  chainId?: number;
}

export async function fetchTaskEVM(params: FetchTaskEVMParams): Promise<{
  poster: `0x${string}`;
  judge: `0x${string}`;
  winner: `0x${string}`;
  paymentToken: `0x${string}`;
  minStake: bigint;
  reward: bigint;
  deadline: bigint;
  judgeDeadline: bigint;
  category: number;
  score: number;
  state: number;
  judgeMode: number;
} | null> {
  const cfg = getChainConfig(params.chainId ?? getDefaultEvmChainId());
  const publicClient = getPublicClient(params.chainId);
  try {
    const result = await publicClient.readContract({
      address: cfg.agentArenaAddress,
      abi: AGENT_ARENA_EVM_ABI,
      functionName: 'tasks',
      args: [params.taskId],
    });
    return {
      poster: result[0],
      judge: result[1],
      winner: result[2],
      paymentToken: result[3],
      minStake: result[4],
      reward: result[5],
      deadline: result[6],
      judgeDeadline: result[7],
      category: result[8],
      score: result[9],
      state: result[10],
      judgeMode: result[11],
    };
  } catch {
    return null;
  }
}
