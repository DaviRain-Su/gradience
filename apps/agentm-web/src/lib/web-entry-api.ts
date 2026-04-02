export interface WebPairCodeResponse {
    pairCode: string;
    expiresAt: number;
}

export interface WebAgentItem {
    agentId: string;
    bridgeId: string;
    displayName: string | null;
    status: 'idle' | 'busy' | 'offline';
    capabilities: Array<'text' | 'voice'>;
    updatedAt: number;
}

export class AgentImWebEntryApiClient {
    constructor(private baseUrl: string = getDefaultAgentImApiBaseUrl()) {}

    async issuePairCode(): Promise<WebPairCodeResponse> {
        return this.requestJson<WebPairCodeResponse>('/web/session/pair', {
            method: 'POST',
        });
    }

    async listAgents(): Promise<{ items: WebAgentItem[] }> {
        return this.requestJson<{ items: WebAgentItem[] }>('/web/agents');
    }

    getBaseUrl(): string {
        return this.baseUrl;
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
            const bodyText = await response.text();
            const apiError = extractApiError(bodyText);
            throw new Error(
                `AgentM API ${response.status}: ${
                    apiError?.message ?? (bodyText || response.statusText)
                }`,
            );
        }

        return (await response.json()) as T;
    }
}

let _client: AgentImWebEntryApiClient | null = null;

export function getAgentImWebEntryApiClient(baseUrl?: string): AgentImWebEntryApiClient {
    if (!_client || baseUrl) {
        _client = new AgentImWebEntryApiClient(baseUrl ?? getDefaultAgentImApiBaseUrl());
    }
    return _client;
}

function extractApiError(
    text: string,
): { code?: string; message?: string } | null {
    if (!text) return null;
    try {
        const parsed = JSON.parse(text) as { code?: unknown; error?: unknown };
        return {
            code: typeof parsed.code === 'string' ? parsed.code : undefined,
            message: typeof parsed.error === 'string' ? parsed.error : undefined,
        };
    } catch {
        return null;
    }
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

function asMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}
