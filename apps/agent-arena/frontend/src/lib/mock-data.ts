import type { TaskApi, SubmissionApi, ReputationApi } from '@gradiences/sdk';

// Generate realistic Solana base58 public keys (44 characters)
const generatePubkey = (): string => {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 44; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Fixed pubkeys for consistency
const MOCK_PUBKEYS = {
  judges: [
    '7nE7zR2YWMzJ8k9P3qX4vH6T1cL8wB5rD3mF9qS6jK2nE1cX7yZ',
    'B8qW2rT5yU1aS3dF6gH9jK2lZ4xC7vN1mQ9wE5rT8yU1aS3dF6g',
    '9wE5rT8yU1aS3dF6gH9jK2lZ4xC7vN1mQ9wE5rT8yU1aS3dF6g',
  ],
  posters: [
    'A7nE9zR2YWMzJ8k9P3qX4vH6T1cL8wB5rD3mF9qS6jK2nE1cX7y',
    'C8qW3rT5yU1aS3dF6gH9jK2lZ4xC7vN1mQ9wE5rT8yU1aS3dF6',
    'D9wE6rT8yU1aS3dF6gH9jK2lZ4xC7vN1mQ9wE5rT8yU1aS3dF6',
    'F1qX5vH6T1cL8wB5rD3mF9qS6jK2nE1cX7yZ2YWMzJ8k9P3q',
  ],
  agents: [
    'E1nE2zR2YWMzJ8k9P3qX4vH6T1cL8wB5rD3mF9qS6jK2nE1cX7',
    'G8qW4rT5yU1aS3dF6gH9jK2lZ4xC7vN1mQ9wE5rT8yU1aS3d',
    'H9wE7rT8yU1aS3dF6gH9jK2lZ4xC7vN1mQ9wE5rT8yU1aS3d',
    'J2qX6vH6T1cL8wB5rD3mF9qS6jK2nE1cX7yZ2YWMzJ8k9P3q',
    'K3nE8zR2YWMzJ8k9P3qX4vH6T1cL8wB5rD3mF9qS6jK2nE1c',
  ],
};

const categories = ['AI/ML', 'Web Dev', 'Data Analysis', 'DevOps', 'Security', 'Research', 'Design', 'Other'];
const states: Array<'open' | 'completed' | 'refunded'> = ['open', 'completed', 'refunded'];

// Generate timestamps
const now = Math.floor(Date.now() / 1000);
const hour = 3600;
const day = 24 * hour;

export const MOCK_TASKS: TaskApi[] = [
  {
    task_id: 1001,
    poster: MOCK_PUBKEYS.posters[0],
    judge: MOCK_PUBKEYS.judges[0],
    judge_mode: 'designated' as const,
    reward: 5000000, // 0.005 SOL
    mint: '11111111111111111111111111111112', // Native SOL
    min_stake: 100000, // 0.0001 SOL
    state: 'open' as const,
    category: 0, // AI/ML
    eval_ref: 'ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
    deadline: now + 2 * day,
    judge_deadline: now + 3 * day,
    submission_count: 3,
    winner: null,
    created_at: now - hour,
    slot: 250123456,
  },
  {
    task_id: 1002,
    poster: MOCK_PUBKEYS.posters[1],
    judge: MOCK_PUBKEYS.judges[1],
    judge_mode: 'designated' as const,
    reward: 10000000, // 0.01 SOL
    mint: '11111111111111111111111111111112',
    min_stake: 500000,
    state: 'completed' as const,
    category: 1, // Web Dev
    eval_ref: 'ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdX',
    deadline: now - hour,
    judge_deadline: now + day,
    submission_count: 5,
    winner: MOCK_PUBKEYS.agents[0],
    created_at: now - 3 * day,
    slot: 250120000,
  },
  {
    task_id: 1003,
    poster: MOCK_PUBKEYS.posters[2],
    judge: MOCK_PUBKEYS.judges[2],
    judge_mode: 'pool' as const,
    reward: 25000000, // 0.025 SOL
    mint: '11111111111111111111111111111112',
    min_stake: 1000000,
    state: 'open' as const,
    category: 2, // Data Analysis
    eval_ref: 'https://gist.github.com/agent-arena/task-1003-spec',
    deadline: now + 5 * day,
    judge_deadline: now + 7 * day,
    submission_count: 2,
    winner: null,
    created_at: now - 6 * hour,
    slot: 250125000,
  },
  {
    task_id: 1004,
    poster: MOCK_PUBKEYS.posters[3],
    judge: MOCK_PUBKEYS.judges[0],
    judge_mode: 'designated' as const,
    reward: 2000000, // 0.002 SOL
    mint: '11111111111111111111111111111112',
    min_stake: 50000,
    state: 'refunded' as const,
    category: 4, // Security
    eval_ref: 'ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdY',
    deadline: now - 2 * day,
    judge_deadline: now - day,
    submission_count: 1,
    winner: null,
    created_at: now - 4 * day,
    slot: 250115000,
  },
  {
    task_id: 1005,
    poster: MOCK_PUBKEYS.posters[0],
    judge: MOCK_PUBKEYS.judges[1],
    judge_mode: 'designated' as const,
    reward: 15000000, // 0.015 SOL
    mint: '11111111111111111111111111111112',
    min_stake: 750000,
    state: 'open' as const,
    category: 3, // DevOps
    eval_ref: 'manual://task-1005-kubernetes-deployment',
    deadline: now + 3 * day,
    judge_deadline: now + 4 * day,
    submission_count: 4,
    winner: null,
    created_at: now - 2 * hour,
    slot: 250126000,
  },
  {
    task_id: 1006,
    poster: MOCK_PUBKEYS.posters[1],
    judge: MOCK_PUBKEYS.judges[2],
    judge_mode: 'pool' as const,
    reward: 50000000, // 0.05 SOL
    mint: '11111111111111111111111111111112',
    min_stake: 2000000,
    state: 'completed' as const,
    category: 5, // Research
    eval_ref: 'arweave://Y2YxcHk3X0Y2VUV0V2NwQ2wzN3RjTWhoR05qOFZKa2M',
    deadline: now - 3 * hour,
    judge_deadline: now + 2 * day,
    submission_count: 7,
    winner: MOCK_PUBKEYS.agents[1],
    created_at: now - 5 * day,
    slot: 250110000,
  },
  {
    task_id: 1007,
    poster: MOCK_PUBKEYS.posters[2],
    judge: MOCK_PUBKEYS.judges[0],
    judge_mode: 'designated' as const,
    reward: 8000000, // 0.008 SOL
    mint: '11111111111111111111111111111112',
    min_stake: 200000,
    state: 'open' as const,
    category: 6, // Design
    eval_ref: 'ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdZ',
    deadline: now + day,
    judge_deadline: now + 2 * day,
    submission_count: 1,
    winner: null,
    created_at: now - 4 * hour,
    slot: 250127000,
  },
  {
    task_id: 1008,
    poster: MOCK_PUBKEYS.posters[3],
    judge: MOCK_PUBKEYS.judges[1],
    judge_mode: 'designated' as const,
    reward: 3000000, // 0.003 SOL
    mint: '11111111111111111111111111111112',
    min_stake: 100000,
    state: 'open' as const,
    category: 7, // Other
    eval_ref: 'manual://task-1008-documentation-review',
    deadline: now + 6 * day,
    judge_deadline: now + 8 * day,
    submission_count: 0,
    winner: null,
    created_at: now - hour / 2,
    slot: 250128000,
  },
];

export const MOCK_SUBMISSIONS: Record<number, SubmissionApi[]> = {
  1001: [
    {
      task_id: 1001,
      agent: MOCK_PUBKEYS.agents[0],
      result_ref: 'ipfs://QmResult1AGXpJzv5CZsnA625s3Xf2nemtYgPpHdWEz79oj',
      trace_ref: 'ipfs://QmTrace1AGXpJzv5CZsnA625s3Xf2nemtYgPpHdWEz79oj',
      runtime_provider: 'openai',
      runtime_model: 'gpt-4',
      runtime_runtime: 'python',
      runtime_version: '3.11.0',
      submission_slot: 250124000,
      submitted_at: now - 30 * 60, // 30 min ago
    },
    {
      task_id: 1001,
      agent: MOCK_PUBKEYS.agents[1],
      result_ref: 'ipfs://QmResult2BGXpJzv5CZsnA625s3Xf2nemtYgPpHdWEz79oj',
      trace_ref: 'ipfs://QmTrace2BGXpJzv5CZsnA625s3Xf2nemtYgPpHdWEz79oj',
      runtime_provider: 'anthropic',
      runtime_model: 'claude-3-sonnet',
      runtime_runtime: 'javascript',
      runtime_version: '18.0.0',
      submission_slot: 250124500,
      submitted_at: now - 15 * 60, // 15 min ago
    },
    {
      task_id: 1001,
      agent: MOCK_PUBKEYS.agents[2],
      result_ref: 'ipfs://QmResult3CGXpJzv5CZsnA625s3Xf2nemtYgPpHdWEz79oj',
      trace_ref: 'ipfs://QmTrace3CGXpJzv5CZsnA625s3Xf2nemtYgPpHdWEz79oj',
      runtime_provider: 'google',
      runtime_model: 'gemini-pro',
      runtime_runtime: 'python',
      runtime_version: '3.11.0',
      submission_slot: 250125000,
      submitted_at: now - 5 * 60, // 5 min ago
    },
  ],
  1002: [
    {
      task_id: 1002,
      agent: MOCK_PUBKEYS.agents[0],
      result_ref: 'ipfs://QmResult4AGXpJzv5CZsnA625s3Xf2nemtYgPpHdWEz79oj',
      trace_ref: 'ipfs://QmTrace4AGXpJzv5CZsnA625s3Xf2nemtYgPpHdWEz79oj',
      runtime_provider: 'openai',
      runtime_model: 'gpt-4',
      runtime_runtime: 'typescript',
      runtime_version: '5.0.0',
      submission_slot: 250121000,
      submitted_at: now - 2 * day,
    },
    {
      task_id: 1002,
      agent: MOCK_PUBKEYS.agents[3],
      result_ref: 'ipfs://QmResult5DGXpJzv5CZsnA625s3Xf2nemtYgPpHdWEz79oj',
      trace_ref: 'ipfs://QmTrace5DGXpJzv5CZsnA625s3Xf2nemtYgPpHdWEz79oj',
      runtime_provider: 'anthropic',
      runtime_model: 'claude-3-opus',
      runtime_runtime: 'react',
      runtime_version: '18.0.0',
      submission_slot: 250121500,
      submitted_at: now - 2 * day + hour,
    },
  ],
  1003: [
    {
      task_id: 1003,
      agent: MOCK_PUBKEYS.agents[2],
      result_ref: 'ipfs://QmResult6CGXpJzv5CZsnA625s3Xf2nemtYgPpHdWEz79oj',
      trace_ref: 'ipfs://QmTrace6CGXpJzv5CZsnA625s3Xf2nemtYgPpHdWEz79oj',
      runtime_provider: 'google',
      runtime_model: 'gemini-pro',
      runtime_runtime: 'python',
      runtime_version: '3.11.0',
      submission_slot: 250125500,
      submitted_at: now - 3 * hour,
    },
    {
      task_id: 1003,
      agent: MOCK_PUBKEYS.agents[4],
      result_ref: 'ipfs://QmResult7EGXpJzv5CZsnA625s3Xf2nemtYgPpHdWEz79oj',
      trace_ref: 'ipfs://QmTrace7EGXpJzv5CZsnA625s3Xf2nemtYgPpHdWEz79oj',
      runtime_provider: 'mistral',
      runtime_model: 'mixtral-8x7b',
      runtime_runtime: 'jupyter',
      runtime_version: '6.5.0',
      submission_slot: 250126000,
      submitted_at: now - 2 * hour,
    },
  ],
  1005: [
    {
      task_id: 1005,
      agent: MOCK_PUBKEYS.agents[1],
      result_ref: 'ipfs://QmResult8BGXpJzv5CZsnA625s3Xf2nemtYgPpHdWEz79oj',
      trace_ref: 'ipfs://QmTrace8BGXpJzv5CZsnA625s3Xf2nemtYgPpHdWEz79oj',
      runtime_provider: 'anthropic',
      runtime_model: 'claude-3-haiku',
      runtime_runtime: 'bash',
      runtime_version: '5.1.0',
      submission_slot: 250126500,
      submitted_at: now - hour,
    },
    {
      task_id: 1005,
      agent: MOCK_PUBKEYS.agents[3],
      result_ref: 'ipfs://QmResult9DGXpJzv5CZsnA625s3Xf2nemtYgPpHdWEz79oj',
      trace_ref: 'ipfs://QmTrace9DGXpJzv5CZsnA625s3Xf2nemtYgPpHdWEz79oj',
      runtime_provider: 'openai',
      runtime_model: 'gpt-3.5-turbo',
      runtime_runtime: 'docker',
      runtime_version: '24.0.0',
      submission_slot: 250127000,
      submitted_at: now - 30 * 60,
    },
  ],
  1007: [
    {
      task_id: 1007,
      agent: MOCK_PUBKEYS.agents[4],
      result_ref: 'ipfs://QmResult10EGXpJzv5CZsnA625s3Xf2nemtYgPpHdWEz79o',
      trace_ref: 'ipfs://QmTrace10EGXpJzv5CZsnA625s3Xf2nemtYgPpHdWEz79o',
      runtime_provider: 'google',
      runtime_model: 'gemini-pro',
      runtime_runtime: 'figma',
      runtime_version: '1.0.0',
      submission_slot: 250127500,
      submitted_at: now - 2 * hour,
    },
  ],
};

// Mock reputation data for agents
export const MOCK_REPUTATION: ReputationApi[] = [
  {
    agent: MOCK_PUBKEYS.agents[0],
    global_avg_score: 87.5,
    global_win_rate: 0.72,
    global_completed: 15,
    global_total_applied: 28,
    total_earned: 156000000, // 0.156 SOL
    updated_slot: 250128000,
  },
  {
    agent: MOCK_PUBKEYS.agents[1],
    global_avg_score: 91.2,
    global_win_rate: 0.85,
    global_completed: 22,
    global_total_applied: 31,
    total_earned: 287000000, // 0.287 SOL
    updated_slot: 250127800,
  },
  {
    agent: MOCK_PUBKEYS.agents[2],
    global_avg_score: 83.8,
    global_win_rate: 0.65,
    global_completed: 11,
    global_total_applied: 19,
    total_earned: 98000000, // 0.098 SOL
    updated_slot: 250127500,
  },
  {
    agent: MOCK_PUBKEYS.agents[3],
    global_avg_score: 79.3,
    global_win_rate: 0.58,
    global_completed: 8,
    global_total_applied: 16,
    total_earned: 67000000, // 0.067 SOL
    updated_slot: 250127000,
  },
  {
    agent: MOCK_PUBKEYS.agents[4],
    global_avg_score: 88.9,
    global_win_rate: 0.77,
    global_completed: 18,
    global_total_applied: 25,
    total_earned: 203000000, // 0.203 SOL
    updated_slot: 250127800,
  },
];

// Helper function to get tasks with optional filtering
export function getMockTasks(params?: {
  status?: 'open' | 'completed' | 'refunded';
  category?: number;
  mint?: string;
  poster?: string;
  limit?: number;
  offset?: number;
}): TaskApi[] {
  let filtered = [...MOCK_TASKS];

  if (params?.status) {
    filtered = filtered.filter(task => task.state === params.status);
  }

  if (params?.category !== undefined) {
    filtered = filtered.filter(task => task.category === params.category);
  }

  if (params?.poster) {
    filtered = filtered.filter(task => task.poster === params.poster);
  }

  if (params?.mint) {
    filtered = filtered.filter(task => task.mint === params.mint);
  }

  // Apply offset and limit
  const offset = params?.offset || 0;
  const limit = params?.limit || filtered.length;
  
  return filtered.slice(offset, offset + limit);
}

// Helper function to get a specific task
export function getMockTask(taskId: number): TaskApi | null {
  return MOCK_TASKS.find(task => task.task_id === taskId) || null;
}

// Helper function to get submissions for a task
export function getMockTaskSubmissions(
  taskId: number,
  params?: { sort?: 'score' | 'slot' }
): SubmissionApi[] | null {
  const submissions = MOCK_SUBMISSIONS[taskId];
  if (!submissions) {
    return null;
  }

  let sorted = [...submissions];
  
  if (params?.sort === 'score') {
    // Sort by agent name as a proxy for score (since we don't have scores in submissions)
    sorted.sort((a, b) => a.agent.localeCompare(b.agent));
  } else if (params?.sort === 'slot') {
    sorted.sort((a, b) => b.submission_slot - a.submission_slot);
  }

  return sorted;
}

// Helper function to get reputation for an agent
export function getMockReputation(agent: string): ReputationApi | null {
  return MOCK_REPUTATION.find(rep => rep.agent === agent) || null;
}

// Map reputation data to the format expected by AgentOverview component
export function getMockAgentReputation(agent: string) {
  const rep = getMockReputation(agent);
  if (!rep) {
    return null;
  }

  return {
    avg_score: rep.global_avg_score,
    completed: rep.global_completed,
    total_applied: rep.global_total_applied,
    win_rate: rep.global_win_rate,
    total_earned: rep.total_earned,
  };
}

// Get mock tasks posted by an agent (for AgentOverview)
export function getMockAgentTasks(publicKey: string) {
  return MOCK_TASKS.filter(task => task.poster === publicKey && task.state === 'open').map(task => ({
    task_id: task.task_id,
    state: task.state,
    reward: task.reward,
    category: task.category,
  }));
}