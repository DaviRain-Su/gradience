/** Indexer API response types — mirrors Rust API structs */

export interface TaskApi {
    task_id: number;
    poster: string;
    judge: string;
    judge_mode: string;
    reward: number;
    mint: string;
    min_stake: number;
    state: 'open' | 'completed' | 'refunded';
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
    publish_mode: string;
    updated_at: number;
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

export interface JudgePoolEntryApi {
    judge: string;
    stake: number;
    weight: number;
}

export interface TaskListParams {
    state?: 'open' | 'completed' | 'refunded';
    poster?: string;
    category?: number;
    limit?: number;
    offset?: number;
}
