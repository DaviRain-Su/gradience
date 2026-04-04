/**
 * Arena SDK Client for AgentM Web
 *
 * Wraps @gradiences/arena-sdk for browser use with Dynamic wallet.
 * Provides postTask, applyForTask, submitResult, judgeAndPay operations
 * against the on-chain Gradience Protocol.
 */

import {
  GradienceSDK,
  KeypairAdapter,
  type PostTaskSimpleRequest,
  type ApplyTaskRequest,
  type SubmitTaskResultRequest,
  type JudgeTaskRequest,
  type CancelTaskRequest,
  type WalletAdapter,
  type TaskApi,
  type SubmissionApi,
  type ReputationApi,
} from '@gradiences/arena-sdk';
import {
  createSolanaRpc,
  type Address,
} from '@solana/kit';

export type { TaskApi, SubmissionApi, ReputationApi, WalletAdapter };

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

let _sdk: GradienceSDK | null = null;

export function getArenaSDK(): GradienceSDK {
  if (!_sdk) {
    const rpcEndpoint = getRpcEndpoint();
    _sdk = new GradienceSDK({
      rpcEndpoint,
      indexerEndpoint: getIndexerEndpoint(),
      rpc: createSolanaRpc(rpcEndpoint as Parameters<typeof createSolanaRpc>[0]),
    });
  }
  return _sdk;
}

export function resetArenaSDK(): void {
  _sdk = null;
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

export async function postTask(params: PostTaskParams): Promise<{ taskId: bigint; signature: string }> {
  const sdk = getArenaSDK();
  const result = await sdk.task.postSimple(params.wallet, {
    evalRef: params.evalRef,
    category: params.category,
    reward: params.reward,
    minStake: params.minStake ?? 0,
    deadlineOffsetSeconds: params.deadlineOffsetSeconds ?? 3600,
    judgeDeadlineOffsetSeconds: params.judgeDeadlineOffsetSeconds ?? 3600,
    judgeMode: params.judgeMode ?? 1,
    judge: params.judge,
    mint: params.mint,
  });
  return result;
}

export interface ApplyForTaskParams {
  wallet: WalletAdapter;
  taskId: number | bigint;
  mint?: Address;
}

export async function applyForTask(params: ApplyForTaskParams): Promise<string> {
  const sdk = getArenaSDK();
  return sdk.task.apply(params.wallet, {
    taskId: params.taskId,
    mint: params.mint,
  });
}

export interface SubmitResultParams {
  wallet: WalletAdapter;
  taskId: number | bigint;
  resultRef: string;
  traceRef: string;
  runtimeProvider?: string;
  runtimeModel?: string;
  runtimeRuntime?: string;
  runtimeVersion?: string;
}

export async function submitResult(params: SubmitResultParams): Promise<string> {
  const sdk = getArenaSDK();
  return sdk.task.submit(params.wallet, {
    taskId: params.taskId,
    resultRef: params.resultRef,
    traceRef: params.traceRef,
    runtimeEnv: {
      provider: params.runtimeProvider ?? 'gradience',
      model: params.runtimeModel ?? 'agent-v1',
      runtime: params.runtimeRuntime ?? 'nodejs',
      version: params.runtimeVersion ?? '1.0.0',
    },
  });
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
  const sdk = getArenaSDK();
  return sdk.task.judge(params.wallet, {
    taskId: params.taskId,
    winner: params.winner,
    poster: params.poster,
    score: params.score,
    reasonRef: params.reasonRef,
    mint: params.mint,
  });
}

export interface CancelTaskParams {
  wallet: WalletAdapter;
  taskId: number | bigint;
  mint?: Address;
}

export async function cancelTask(params: CancelTaskParams): Promise<string> {
  const sdk = getArenaSDK();
  return sdk.task.cancel(params.wallet, {
    taskId: params.taskId,
    mint: params.mint,
  });
}

// ---- Query Operations (via Indexer) ----

export async function fetchTasks(params?: {
  status?: 'open' | 'completed' | 'refunded';
  category?: number;
  poster?: string;
  limit?: number;
  offset?: number;
}): Promise<TaskApi[]> {
  const sdk = getArenaSDK();
  return sdk.getTasks(params);
}

export async function fetchTask(taskId: number): Promise<TaskApi | null> {
  const sdk = getArenaSDK();
  return sdk.getTask(taskId);
}

export async function fetchSubmissions(taskId: number): Promise<SubmissionApi[] | null> {
  const sdk = getArenaSDK();
  return sdk.task.submissions(taskId);
}

export async function fetchReputation(agent: string): Promise<ReputationApi | null> {
  const sdk = getArenaSDK();
  return sdk.getReputation(agent);
}

// ---- Explorer ----

export function getExplorerUrl(signature: string): string {
  return `https://solana.fm/tx/${signature}?cluster=devnet-solana`;
}
