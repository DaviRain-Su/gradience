export interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
    first<T = Record<string, unknown>>(): Promise<T | null>;
    run(): Promise<unknown>;
}

export interface D1Database {
    prepare(query: string): D1PreparedStatement;
}

export interface Env {
    DB: D1Database;
    WEBHOOK_AUTH_TOKEN?: string;
    CORS_ALLOW_ORIGIN?: string;
}

export type ProgramEvent =
    | {
          event: 'task_created';
          task_id: number;
          poster: number[];
          judge: number[];
          reward: number;
          category: number;
          deadline: number;
      }
    | {
          event: 'submission_received';
          task_id: number;
          agent: number[];
          result_ref: string;
          trace_ref: string;
          submission_slot: number;
      }
    | {
          event: 'task_judged';
          task_id: number;
          winner: number[];
          score: number;
          agent_payout: number;
          judge_fee: number;
          protocol_fee: number;
      }
    | {
          event: 'task_refunded';
          task_id: number;
          reason: number;
          amount: number;
      }
    | {
          event: 'judge_registered';
          judge: number[];
          stake: number;
          categories: number[];
      }
    | {
          event: 'task_applied';
          task_id: number;
          agent: number[];
          stake: number;
          slot: number;
      }
    | {
          event: 'task_cancelled';
          task_id: number;
          poster: number[];
          refund_amount: number;
          protocol_fee: number;
      }
    | {
          event: 'judge_unstaked';
          judge: number[];
          returned_stake: number;
          categories: number[];
      };

export interface EventEnvelope {
    slot: number;
    timestamp: number;
    event: ProgramEvent;
}

export interface WebhookTransaction {
    slot: number;
    timestamp: number;
    logs: string[];
}

export interface TaskRow {
    task_id: number;
    poster: string;
    judge: string;
    judge_mode: number;
    reward: number;
    mint: string;
    min_stake: number;
    state: number;
    category: number;
    eval_ref: string;
    deadline: number;
    judge_deadline: number;
    submission_count: number;
    winner: string | null;
    created_at: number;
    slot: number;
}

export interface SubmissionRow {
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

export interface ReputationRow {
    agent: string;
    global_avg_score: number;
    global_win_rate: number;
    global_completed: number;
    global_total_applied: number;
    total_earned: number;
    updated_slot: number;
}

export interface JudgePoolRow {
    judge: string;
    stake: number;
    weight: number;
}

export interface WorkerHandler {
    fetch(request: Request, env: Env): Promise<Response>;
}
