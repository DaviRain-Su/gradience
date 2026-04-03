/** Shared types matching what Gradience frontends expect from the Indexer */

export type TaskState = 'open' | 'completed' | 'refunded' | 'unknown';
export type JudgeMode = 'designated' | 'pool' | 'unknown';

export interface TaskApi {
    task_id: number;
    poster: string;
    judge: string;
    judge_mode: JudgeMode;
    reward: number;
    mint: string;
    min_stake: number;
    state: TaskState;
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

/** Simplified reputation shape returned by some frontend direct fetches */
export interface ReputationData {
    avg_score: number;
    completed: number;
    total_applied: number;
    win_rate: number;
    total_earned: number;
}

/** Combined reputation response for maximum frontend compatibility */
export interface AgentReputationResponse extends ReputationApi, ReputationData {}

export interface AgentProfileApi {
    agent: string;
    display_name: string;
    bio: string;
    links: {
        website?: string;
        github?: string;
        x?: string;
    };
    onchain_ref: string | null;
    publish_mode: 'manual' | 'git-sync';
    updated_at: number;
}

export interface JudgePoolEntryApi {
    judge: string;
    stake: number;
    weight: number;
}

/** Agent row shape expected by DiscoverView in agentm-web */
export interface AgentRowApi {
    agent: string;
    weight: number;
    reputation: {
        global_avg_score: number;
        global_completed: number;
        win_rate: number;
    } | null;
}

export interface TaskListParams {
    status?: 'open' | 'completed' | 'refunded';
    state?: 'open' | 'completed' | 'refunded';
    category?: number;
    mint?: string;
    poster?: string;
    limit?: number;
    offset?: number;
}
