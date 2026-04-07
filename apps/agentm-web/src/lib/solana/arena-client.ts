/**
 * Unified SDK Client for AgentM Web
 *
 * Uses @gradiences/sdk as the single source of truth for on-chain and
 * off-chain operations. All types are re-exported from the unified SDK.
 */

import { Gradience } from '@gradiences/sdk';
import type {
  TaskApi,
  SubmissionApi,
  ReputationApi,
  WalletAdapter,
} from '@gradiences/sdk';
import type { Address } from '@solana/kit';

export type { TaskApi, SubmissionApi, ReputationApi, WalletAdapter, Address };

function getRpcEndpoint(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem('agentm:settings');
      if (stored) {
        const settings = JSON.parse(stored);
        if (settings.rpcEndpoint) return settings.rpcEndpoint;
      }
    } catch {}
  }
  return process.env.NEXT_PUBLIC_GRADIENCE_RPC_ENDPOINT || 'https://api.devnet.solana.com';
}

function getIndexerEndpoint(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem('agentm:settings');
      if (stored) {
        const settings = JSON.parse(stored);
        if (settings.indexerUrl) return settings.indexerUrl;
      }
    } catch {}
  }
  return process.env.NEXT_PUBLIC_GRADIENCE_INDEXER || 'https://api.gradiences.xyz/indexer';
}

let _client: Gradience | null = null;

export function getArenaSDK(): Gradience {
  if (!_client) {
    _client = new Gradience({
      rpcEndpoint: getRpcEndpoint(),
      indexerEndpoint: getIndexerEndpoint(),
    });
  }
  return _client;
}

export function resetArenaSDK(): void {
  _client = null;
}

// ---- Task Operations ----

export interface PostTaskParams {
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
}

export async function postTask(
  params: PostTaskParams,
): Promise<{ taskId: bigint; signature: string }> {
  const client = getArenaSDK();
  return client.postTask(
    {
      description: params.evalRef,
      category: params.category,
      reward: params.reward,
      minStake: params.minStake ?? 0,
      deadlineOffsetSeconds: params.deadlineOffsetSeconds ?? 3600,
      judgeDeadlineOffsetSeconds: params.judgeDeadlineOffsetSeconds ?? 3600,
      judgeMode: params.judgeMode ?? 1,
      judge: params.judge,
      mint: params.mint,
    },
    params.wallet,
  );
}

export interface ApplyForTaskParams {
  wallet: WalletAdapter;
  taskId: number | bigint;
  mint?: Address;
}

export async function applyForTask(params: ApplyForTaskParams): Promise<string> {
  const client = getArenaSDK();
  return client.applyTask(params.taskId, params.wallet);
}

export interface SubmitResultParams {
  wallet: WalletAdapter;
  taskId: number | bigint;
  resultRef: string;
  traceRef: string;
  runtimeProvider?: string;
  runtimeModel?: string;
}

export async function submitResult(params: SubmitResultParams): Promise<string> {
  const client = getArenaSDK();
  return client.submitResult(
    {
      taskId: params.taskId,
      resultRef: params.resultRef,
      traceRef: params.traceRef ?? '',
      runtimeEnv: {
        provider: params.runtimeProvider ?? 'gradience',
        model: params.runtimeModel ?? 'agent-v1',
        runtime: 'nodejs',
        version: '1.0.0',
      },
    },
    params.wallet,
  );
}

export interface JudgeAndPayParams {
  wallet: WalletAdapter;
  taskId: number | bigint;
  winner: Address;
  poster: Address;
  score: number;
  reasonRef: string;
  mint?: Address;
}

export async function judgeAndPay(params: JudgeAndPayParams): Promise<string> {
  const client = getArenaSDK();
  return client.judgeTask(
    {
      taskId: params.taskId,
      winner: params.winner,
      poster: params.poster,
      score: params.score,
      reasonRef: params.reasonRef,
      mint: params.mint,
    },
    params.wallet,
  );
}

export interface CancelTaskParams {
  wallet: WalletAdapter;
  taskId: number | bigint;
  mint?: Address;
}

export async function cancelTask(params: CancelTaskParams): Promise<string> {
  const client = getArenaSDK();
  return client.cancelTask(
    {
      taskId: params.taskId,
      mint: params.mint,
    },
    params.wallet,
  );
}

// ---- Query Operations (via Indexer) ----

export async function fetchTasks(params?: {
  status?: 'open' | 'completed' | 'refunded';
  category?: number;
  poster?: string;
  limit?: number;
  offset?: number;
}): Promise<TaskApi[]> {
  const client = getArenaSDK();
  return client.getTasks(params);
}

export async function fetchTask(taskId: number): Promise<TaskApi | null> {
  const client = getArenaSDK();
  try {
    return await client.getTask(taskId);
  } catch {
    return null;
  }
}

export async function fetchSubmissions(taskId: number): Promise<SubmissionApi[] | null> {
  const client = getArenaSDK();
  try {
    return await client.getSubmissions(taskId);
  } catch {
    return null;
  }
}

export async function fetchReputation(agent: string): Promise<import('@gradiences/sdk').ReputationData | null> {
  const client = getArenaSDK();
  return client.getReputation(agent);
}

// ---- Explorer ----

export function getExplorerUrl(signature: string): string {
  return `https://solana.fm/tx/${signature}?cluster=devnet-solana`;
}
