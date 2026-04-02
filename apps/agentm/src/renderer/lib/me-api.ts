import type { SubmissionApi, TaskApi } from './indexer-api.ts';

export interface MeTasksResponse {
    items: Array<{
        task: TaskApi;
        role: 'poster' | 'participant' | 'both';
        latestSubmission: Pick<
            SubmissionApi,
            'agent' | 'result_ref' | 'trace_ref' | 'submission_slot' | 'submitted_at'
        > | null;
    }>;
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
}

export class AgentImApiClient {
    constructor(private baseUrl: string = getDefaultAgentImApiBaseUrl()) {}

    async getMeTasks(params: {
        role?: 'all' | 'poster' | 'participant';
        status?: 'open' | 'completed' | 'refunded';
        sort?: 'task_id_desc' | 'task_id_asc';
        limit?: number;
        offset?: number;
    } = {}): Promise<MeTasksResponse> {
        const query = new URLSearchParams();
        if (params.role) query.set('role', params.role);
        if (params.status) query.set('status', params.status);
        if (params.sort) query.set('sort', params.sort);
        if (params.limit) query.set('limit', String(params.limit));
        if (params.offset) query.set('offset', String(params.offset));
        const qs = query.toString();
        return this.requestJson<MeTasksResponse>(`/me/tasks${qs ? `?${qs}` : ''}`);
    }

    async applyToTask(taskId: number): Promise<{ ok: boolean; taskId: number; status: string }> {
        return this.requestJson<{ ok: boolean; taskId: number; status: string }>(
            `/me/tasks/${taskId}/apply`,
            {
                method: 'POST',
            },
        );
    }

    async submitTask(
        taskId: number,
        payload: { resultRef: string; traceRef?: string | null },
    ): Promise<{ ok: boolean; taskId: number; status: string }> {
        return this.requestJson<{ ok: boolean; taskId: number; status: string }>(
            `/me/tasks/${taskId}/submit`,
            {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(payload),
            },
        );
    }

    private async requestJson<T>(path: string, init?: RequestInit): Promise<T> {
        let response: Response;
        try {
            response = await fetch(`${this.baseUrl}${path}`, {
                ...init,
                signal: AbortSignal.timeout(5000),
            });
        } catch (error) {
            throw new Error(`AgentM API unreachable: ${asMessage(error)}`);
        }

        if (!response.ok) {
            const body = await response.text();
            const errorMessage = extractApiError(body) ?? (body || response.statusText);
            throw new Error(`AgentM API ${response.status}: ${errorMessage}`);
        }

        return (await response.json()) as T;
    }
}

let _client: AgentImApiClient | null = null;

export function getAgentImApiClient(baseUrl?: string): AgentImApiClient {
    if (!_client || baseUrl) {
        _client = new AgentImApiClient(baseUrl ?? getDefaultAgentImApiBaseUrl());
    }
    return _client;
}

function getDefaultAgentImApiBaseUrl(): string {
    if (typeof import.meta !== 'undefined') {
        const fromEnv = (import.meta as { env?: { VITE_AGENT_IM_API_BASE_URL?: string } }).env
            ?.VITE_AGENT_IM_API_BASE_URL;
        if (fromEnv && fromEnv.length > 0) {
            return fromEnv;
        }
    }
    return 'http://127.0.0.1:3939';
}

function extractApiError(body: string): string | null {
    if (!body) {
        return null;
    }
    try {
        const parsed = JSON.parse(body) as { error?: unknown };
        if (typeof parsed.error === 'string' && parsed.error.length > 0) {
            return parsed.error;
        }
    } catch {
        return null;
    }
    return null;
}

function asMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
