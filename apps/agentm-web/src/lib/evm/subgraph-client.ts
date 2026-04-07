/**
 * EVM Subgraph client for AgentArenaEVM.
 *
 * Queries The Graph subgraph and maps results to the same TaskApi / SubmissionApi
 * shapes used by the Solana indexer so the UI stays chain-agnostic.
 */

import { EVM_SUBGRAPH_ENDPOINT } from './subgraph-config';
import type { TaskApi, SubmissionApi } from '@/lib/solana/arena-client';
import type { ReputationData } from '@gradiences/sdk';

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function query<T>(queryString: string, variables?: Record<string, unknown>): Promise<T> {
  if (!EVM_SUBGRAPH_ENDPOINT) {
    throw new Error('EVM_SUBGRAPH_ENDPOINT is not configured');
  }
  const res = await fetch(EVM_SUBGRAPH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: queryString, variables }),
  });
  if (!res.ok) {
    throw new Error(`Subgraph query failed: ${res.status} ${await res.text()}`);
  }
  const json: GraphQLResponse<T> = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }
  if (!json.data) {
    throw new Error('Subgraph returned empty data');
  }
  return json.data;
}

function hexToAddress(bytes: string): string {
  if (!bytes) return '';
  const hex = bytes.startsWith('0x') ? bytes.toLowerCase() : `0x${bytes.toLowerCase()}`;
  return hex;
}

function mapTaskState(state: string): TaskApi['state'] {
  const s = state.toLowerCase();
  if (s === 'open') return 'open';
  if (s === 'completed') return 'completed';
  if (s === 'refunded') return 'refunded';
  return 'unknown';
}

function mapJudgeMode(mode: string): TaskApi['judge_mode'] {
  const m = mode.toLowerCase();
  if (m === 'designated') return 'designated';
  if (m === 'pool') return 'pool';
  return 'unknown';
}

interface SubgraphTask {
  taskId: string;
  poster: { id: string; address: string };
  judge?: { id: string; address: string } | null;
  winner?: { id: string; address: string } | null;
  category: number;
  minStake: string;
  reward: string;
  deadline: string;
  judgeDeadline: string;
  evalRef: string;
  paymentToken: string;
  state: string;
  judgeMode: string;
  score?: number | null;
  createdAt: string;
  updatedAt: string;
  submissions?: Array<{ id: string }>;
  applications?: Array<{ id: string }>;
}

interface SubgraphSubmission {
  task: { taskId: string };
  agent: { id: string; address: string };
  resultRef: string;
  traceRef: string;
  submittedAt: string;
}

function mapSubgraphTaskToTaskApi(task: SubgraphTask): TaskApi {
  return {
    task_id: Number(task.taskId),
    poster: hexToAddress(task.poster.address),
    judge: task.judge ? hexToAddress(task.judge.address) : '',
    judge_mode: mapJudgeMode(task.judgeMode),
    reward: Number(task.reward),
    mint: hexToAddress(task.paymentToken),
    min_stake: Number(task.minStake),
    state: mapTaskState(task.state),
    category: task.category,
    eval_ref: task.evalRef,
    deadline: Number(task.deadline),
    judge_deadline: Number(task.judgeDeadline),
    submission_count: task.submissions?.length ?? task.applications?.length ?? 0,
    winner: task.winner ? hexToAddress(task.winner.address) : null,
    created_at: Number(task.createdAt),
    slot: 0,
  };
}

function mapSubgraphSubmissionToSubmissionApi(sub: SubgraphSubmission): SubmissionApi {
  return {
    task_id: Number(sub.task.taskId),
    agent: hexToAddress(sub.agent.address),
    result_ref: sub.resultRef,
    trace_ref: sub.traceRef,
    runtime_provider: 'evm',
    runtime_model: 'default',
    runtime_runtime: 'evm',
    runtime_version: '1.0.0',
    submission_slot: 0,
    submitted_at: Number(sub.submittedAt),
  };
}

export async function fetchTasksFromSubgraph(params?: {
  state?: 'open' | 'completed' | 'refunded';
  poster?: string;
  limit?: number;
}): Promise<TaskApi[]> {
  const whereParts: string[] = [];
  if (params?.state) {
    // GraphQL enum values are capitalized in the subgraph
    const capitalized = params.state.charAt(0).toUpperCase() + params.state.slice(1);
    whereParts.push(`state: ${capitalized}`);
  }
  if (params?.poster) {
    const normalized = params.poster.toLowerCase();
    whereParts.push(`poster_: {address: "${normalized}"}`);
  }
  const where = whereParts.length ? `where: { ${whereParts.join(', ')} }` : '';
  const first = params?.limit ?? 50;

  const q = `
    query {
      tasks(${where ? `${where}, ` : ''}orderBy: createdAt, orderDirection: desc, first: ${first}) {
        taskId
        poster { id address }
        judge { id address }
        winner { id address }
        category
        minStake
        reward
        deadline
        judgeDeadline
        evalRef
        paymentToken
        state
        judgeMode
        score
        createdAt
        updatedAt
        submissions { id }
        applications { id }
      }
    }
  `;

  const data = await query<{ tasks: SubgraphTask[] }>(q);
  return data.tasks.map(mapSubgraphTaskToTaskApi);
}

export async function fetchTaskFromSubgraph(taskId: number): Promise<TaskApi | null> {
  const q = `
    query {
      tasks(where: { taskId: ${taskId} }) {
        taskId
        poster { id address }
        judge { id address }
        winner { id address }
        category
        minStake
        reward
        deadline
        judgeDeadline
        evalRef
        paymentToken
        state
        judgeMode
        score
        createdAt
        updatedAt
        submissions { id }
        applications { id }
      }
    }
  `;
  const data = await query<{ tasks: SubgraphTask[] }>(q);
  if (!data.tasks.length) return null;
  return mapSubgraphTaskToTaskApi(data.tasks[0]);
}

export async function fetchSubmissionsFromSubgraph(taskId: number): Promise<SubmissionApi[]> {
  const q = `
    query {
      submissions(where: { task_: { taskId: ${taskId} } }, orderBy: submittedAt, orderDirection: desc) {
        task { taskId }
        agent { id address }
        resultRef
        traceRef
        submittedAt
      }
    }
  `;
  const data = await query<{ submissions: SubgraphSubmission[] }>(q);
  return data.submissions.map(mapSubgraphSubmissionToSubmissionApi);
}

interface SubgraphReputation {
  id: string;
  agent: { id: string; address: string };
  globalScore: number;
  categoryScores: number[];
  lastUpdatedAt: string;
  oracle: string;
  merkleRoot?: string | null;
}

export async function fetchReputationFromSubgraph(agent: string): Promise<ReputationData | null> {
  const normalized = agent.toLowerCase();
  const q = `
    query {
      reputations(where: { agent_: { address: "${normalized}" } }) {
        id
        agent { id address }
        globalScore
        categoryScores
        lastUpdatedAt
        oracle
        merkleRoot
      }
    }
  `;
  try {
    const data = await query<{ reputations: SubgraphReputation[] }>(q);
    if (!data.reputations.length) return null;
    const rep = data.reputations[0];
    return {
      agent: hexToAddress(rep.agent.address),
      globalAvgScore: rep.globalScore,
      // EVM subgraph does not track winRate/completed/applied/earned yet
      globalWinRate: 0,
      globalCompleted: 0,
      globalTotalApplied: 0,
      totalEarned: 0,
      updatedSlot: Number(rep.lastUpdatedAt),
    };
  } catch (err) {
    console.warn('[EVM Subgraph] Failed to fetch reputation:', err);
    return null;
  }
}
