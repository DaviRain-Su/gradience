/**
 * Gradience Indexer SDK Client
 *
 * TypeScript client for the Agent Arena Indexer REST API.
 * Used by AgentM Pro to fetch tasks, profiles, reputation, etc.
 */

import type {
    TaskApi,
    SubmissionApi,
    AgentProfileApi,
    ReputationApi,
    JudgePoolEntryApi,
    TaskListParams,
} from './types';

const DEFAULT_BASE_URL =
    process.env.NEXT_PUBLIC_INDEXER_URL ?? 'https://indexer.gradiences.xyz';

export class IndexerClient {
    private baseUrl: string;

    constructor(baseUrl?: string) {
        this.baseUrl = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    }

    async getTasks(params?: TaskListParams): Promise<TaskApi[]> {
        const query = new URLSearchParams();
        if (params?.state) query.set('state', params.state);
        if (params?.poster) query.set('poster', params.poster);
        if (params?.category !== undefined) query.set('category', String(params.category));
        if (params?.limit !== undefined) query.set('limit', String(params.limit));
        if (params?.offset !== undefined) query.set('offset', String(params.offset));
        const qs = query.toString();
        return this.get<TaskApi[]>(`/api/tasks${qs ? '?' + qs : ''}`);
    }

    async getTask(taskId: number): Promise<TaskApi> {
        return this.get<TaskApi>(`/api/tasks/${taskId}`);
    }

    async getTaskSubmissions(taskId: number): Promise<SubmissionApi[]> {
        return this.get<SubmissionApi[]>(`/api/tasks/${taskId}/submissions`);
    }

    async getAgentProfile(pubkey: string): Promise<AgentProfileApi> {
        return this.get<AgentProfileApi>(`/api/agents/${pubkey}/profile`);
    }

    async getAgentReputation(pubkey: string): Promise<ReputationApi> {
        return this.get<ReputationApi>(`/api/agents/${pubkey}/reputation`);
    }

    async getJudgePool(category: number): Promise<JudgePoolEntryApi[]> {
        return this.get<JudgePoolEntryApi[]>(`/api/judge-pool/${category}`);
    }

    async healthCheck(): Promise<boolean> {
        try {
            await this.get<{ status: string }>('/healthz');
            return true;
        } catch {
            return false;
        }
    }

    private async get<T>(path: string): Promise<T> {
        const res = await fetch(`${this.baseUrl}${path}`);
        if (!res.ok) {
            const body = await res.text();
            throw new IndexerError(res.status, body);
        }
        return res.json();
    }
}

export class IndexerError extends Error {
    constructor(
        public readonly status: number,
        public readonly body: string,
    ) {
        super(`Indexer API error ${status}: ${body}`);
        this.name = 'IndexerError';
    }
}

/** Singleton default client */
let defaultClient: IndexerClient | null = null;

export function getIndexerClient(): IndexerClient {
    if (!defaultClient) {
        defaultClient = new IndexerClient();
    }
    return defaultClient;
}
