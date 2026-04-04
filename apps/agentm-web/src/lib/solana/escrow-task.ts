/**
 * Task Escrow Operations
 *
 * Connects to Agent Arena Program via @gradiences/arena-sdk.
 * Replaces the old demo stub that did self-transfers.
 *
 * For SOL tasks: reward is locked in an escrow PDA on-chain.
 * For SPL tasks: token ATA is used for escrow.
 */

import {
  postTask,
  applyForTask,
  submitResult,
  judgeAndPay,
  cancelTask,
  fetchTask,
  fetchTasks,
  fetchSubmissions,
  getExplorerUrl,
  type WalletAdapter,
  type TaskApi,
} from './arena-client';
import type { Address } from '@solana/kit';

export { getExplorerUrl };

// ---- Types (backward compatible with existing UI) ----

export interface TaskEscrowParams {
  description: string;
  category: string;
  rewardLamports: number;
  deadlineUnix: number;
  poster: string;
}

export interface TaskEscrowResult {
  signature: string;
  explorerUrl: string;
  taskId: string;
}

const CATEGORY_MAP: Record<string, number> = {
  'DeFi Analysis': 0,
  'Trading Bot': 1,
  'Smart Contract Audit': 2,
  'Data Analysis': 3,
  'Content Creation': 4,
  'Code Review': 5,
  'Research': 6,
  'Other': 7,
};

/**
 * Build and submit a task escrow transaction using the real Arena SDK.
 *
 * @deprecated Use `postTaskOnChain` directly for new code.
 */
export async function buildAndSubmitTaskEscrow(
  wallet: WalletAdapter,
  params: TaskEscrowParams,
): Promise<TaskEscrowResult> {
  const category = CATEGORY_MAP[params.category] ?? 7;
  const now = Math.floor(Date.now() / 1000);
  const deadlineOffset = Math.max(60, params.deadlineUnix - now);

  const result = await postTask({
    wallet,
    evalRef: params.description.slice(0, 200),
    category,
    reward: BigInt(params.rewardLamports),
    deadlineOffsetSeconds: deadlineOffset,
    judgeDeadlineOffsetSeconds: 3600,
  });

  const signature = result.signature;
  return {
    signature,
    explorerUrl: getExplorerUrl(signature),
    taskId: result.taskId.toString(),
  };
}

/**
 * Post a task on-chain with full control over parameters.
 */
export async function postTaskOnChain(params: {
  wallet: WalletAdapter;
  evalRef: string;
  category: number;
  reward: number | bigint;
  minStake?: number | bigint;
  deadlineOffsetSeconds?: number;
  judgeDeadlineOffsetSeconds?: number;
  judgeMode?: number;
  judge?: Address;
  mint?: Address;
}): Promise<{ taskId: bigint; signature: string }> {
  return postTask(params);
}

/**
 * Apply for a task as an agent (stakes minStake).
 */
export async function applyForTaskOnChain(params: {
  wallet: WalletAdapter;
  taskId: number | bigint;
  mint?: Address;
}): Promise<string> {
  return applyForTask(params);
}

/**
 * Submit work result for a task.
 */
export async function submitResultOnChain(params: {
  wallet: WalletAdapter;
  taskId: number | bigint;
  resultRef: string;
  traceRef: string;
  runtimeProvider?: string;
  runtimeModel?: string;
}): Promise<string> {
  return submitResult(params);
}

/**
 * Judge a task and trigger settlement (95% winner, 3% judge, 2% treasury).
 */
export async function judgeAndPayOnChain(params: {
  wallet: WalletAdapter;
  taskId: number | bigint;
  winner: Address;
  poster: Address;
  score: number;
  reasonRef: string;
  mint?: Address;
}): Promise<string> {
  return judgeAndPay(params);
}

/**
 * Cancel a task and refund escrow to poster.
 */
export async function cancelTaskOnChain(params: {
  wallet: WalletAdapter;
  taskId: number | bigint;
  mint?: Address;
}): Promise<string> {
  return cancelTask(params);
}

// ---- Query helpers ----

export { fetchTask, fetchTasks, fetchSubmissions };
export type { TaskApi };
