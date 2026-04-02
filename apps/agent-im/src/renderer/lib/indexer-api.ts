/**
 * Indexer REST API client.
 * Falls back gracefully when Indexer is offline.
 */

export interface ReputationApi {
    global_avg_score: number;
    global_completed: number;
    global_total_applied: number;
    win_rate: number;
    by_category: Record<string, { avg_score: number; completed: number }>;
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
    created_at: string;
}

export interface JudgePoolEntryApi {
    judge: string;
    stake: number;
    weight: number;
}

export class IndexerClient {
    constructor(private baseUrl: string = 'http://127.0.0.1:8787') {}

    async getReputation(address: string): Promise<ReputationApi | null> {
        return this.get<ReputationApi>(`/api/reputation/${address}`);
    }

    async getTasks(params: {
        status?: string;
        poster?: string;
        category?: number;
        limit?: number;
        offset?: number;
    } = {}): Promise<TaskApi[]> {
        const query = new URLSearchParams();
        if (params.status) query.set('status', params.status);
        if (params.poster) query.set('poster', params.poster);
        if (params.category !== undefined) query.set('category', String(params.category));
        if (params.limit) query.set('limit', String(params.limit));
        if (params.offset) query.set('offset', String(params.offset));
        const qs = query.toString();
        return (await this.get<TaskApi[]>(`/api/tasks${qs ? '?' + qs : ''}`)) ?? [];
    }

    async getJudgePool(category: number): Promise<JudgePoolEntryApi[]> {
        return (await this.get<JudgePoolEntryApi[]>(`/api/judge-pool/${category}`)) ?? [];
    }

    async getTaskSubmissions(taskId: number): Promise<unknown[]> {
        return (await this.get<unknown[]>(`/api/tasks/${taskId}/submissions`)) ?? [];
    }

    private async get<T>(path: string): Promise<T | null> {
        try {
            const res = await fetch(`${this.baseUrl}${path}`, {
                signal: AbortSignal.timeout(5000),
            });
            if (res.status === 404) return null;
            if (!res.ok) return null;
            return (await res.json()) as T;
        } catch {
            // Indexer offline — return null, don't crash
            return null;
        }
    }
}

// Singleton
let _client: IndexerClient | null = null;

export function getIndexerClient(baseUrl?: string): IndexerClient {
    if (!_client) {
        _client = new IndexerClient(baseUrl);
    }
    return _client;
}
