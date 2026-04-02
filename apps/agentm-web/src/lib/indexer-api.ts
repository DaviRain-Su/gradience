const INDEXER_BASE = import.meta.env.VITE_INDEXER_BASE_URL ?? 'http://127.0.0.1:3001';

export interface ReputationApi {
    avg_score: number;
    completed: number;
    total_applied: number;
    win_rate: number;
    total_earned: number;
}

export interface TaskApi {
    task_id: number;
    poster: string;
    judge: string;
    reward: number;
    state: string;
    category: number;
    deadline: string;
    submission_count: number;
    winner: string | null;
}

export async function getReputation(agent: string): Promise<ReputationApi | null> {
    try {
        const res = await fetch(`${INDEXER_BASE}/api/agents/${encodeURIComponent(agent)}/reputation`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

export async function getTasks(params: { state?: string; limit?: number } = {}): Promise<TaskApi[]> {
    const qs = new URLSearchParams();
    if (params.state) qs.set('state', params.state);
    if (params.limit) qs.set('limit', String(params.limit));
    try {
        const res = await fetch(`${INDEXER_BASE}/api/tasks?${qs}`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return [];
        return res.json();
    } catch {
        return [];
    }
}

export async function getJudgePool(category: number): Promise<Array<{ agent: string; weight: number; reputation: ReputationApi | null }>> {
    try {
        const res = await fetch(`${INDEXER_BASE}/api/judge-pool/${category}`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return [];
        return res.json();
    } catch {
        return [];
    }
}
