/**
 * Arena SDK Client for AgentM Web
 *
 * Wraps @gradiences/arena-sdk for browser use with Dynamic wallet.
 * Provides postTask, applyForTask, submitResult, judgeAndPay operations
 * against the on-chain Gradience Protocol.
 *
 * NOTE: The @gradiences/arena-sdk type declarations are currently incomplete,
 * so this file uses runtime-compatible APIs with local type declarations.
 */

import {
  GradienceSDK,
  KeypairAdapter,
} from '@gradiences/arena-sdk';
import {
  createSolanaRpc,
  type Address,
  type Instruction,
} from '@solana/kit';

// Local type declarations to work around incomplete arena-sdk types
export interface WalletAdapter {
  signer: { address: Address } | any;
  signAndSendTransaction(
    instructions: readonly Instruction[],
    options?: Record<string, unknown>,
  ): Promise<string>;
}

export interface TaskApi {
  task_id: number;
  poster: string;
  judge: string;
  judge_mode: string;
  reward: number;
  mint: string;
  min_stake: number;
  state: string;
  category: number;
  eval_ref: string;
  deadline: number;
  judge_deadline: number;
  submission_count: number;
  winner: string | null;
  created_at: number;
  slot: number;
}

export interface SubmissionApi {
  task_id: number;
  agent: string;
  result_ref: string;
  trace_ref: string;
  runtime_provider: string;
  runtime_model: string;
  runtime_runtime: string;
  runtime_version: string;
  submission_slot: number;
  submitted_at: number;
}

export interface ReputationApi {
  agent: string;
  global_avg_score: number;
  global_win_rate: number;
  global_completed: number;
  global_total_applied: number;
  total_earned: number;
  updated_slot: number;
}

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

let _sdk: any = null;

export function getArenaSDK(): any {
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
  const result = await (sdk as any).task.postSimple(params.wallet, {
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
  return (sdk as any).task.applyForTask(params.wallet, {
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
  return (sdk as any).task.submitResult(params.wallet, {
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
  return (sdk as any).task.judgeTask(params.wallet, {
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
  return (sdk as any).task.cancelTask(params.wallet, {
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
  return (sdk as any).task.getTaskSubmissions(taskId);
}

export async function fetchReputation(agent: string): Promise<ReputationApi | null> {
  const sdk = getArenaSDK();
  return sdk.getReputation(agent);
}

// ---- Explorer ----

export function getExplorerUrl(signature: string): string {
  return `https://solana.fm/tx/${signature}?cluster=devnet-solana`;
}
