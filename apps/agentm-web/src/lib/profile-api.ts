import type { AgentProfile, AgentProfileLinks, ProfilePublishMode } from '../types.ts';

export interface AgentProfileApiInput {
    display_name: string;
    bio: string;
    links?: AgentProfileLinks;
    publish_mode?: ProfilePublishMode;
}

export interface PublishProfileInput {
    publish_mode?: ProfilePublishMode;
    content_ref?: string;
}

export interface PublishProfileResult {
    ok: boolean;
    onchain_tx: string;
    profile: AgentProfile;
}

interface AgentProfileApiResponse {
    agent: string;
    display_name: string;
    bio: string;
    links: AgentProfileLinks;
    onchain_ref: string | null;
    publish_mode: ProfilePublishMode;
    updated_at: number;
}

export class AgentProfileApiClient {
    constructor(private baseUrl: string = getDefaultAgentImApiBaseUrl()) {}

    async getAgentProfile(agent: string): Promise<AgentProfile | null> {
        const response = await this.requestJson<{ profile: AgentProfileApiResponse | null }>(
            `/api/agents/${encodeURIComponent(agent)}/profile`,
        );
        if (!response.profile) {
            return null;
        }
        return fromProfileApi(response.profile);
    }

    async upsertAgentProfile(agent: string, payload: AgentProfileApiInput): Promise<AgentProfile> {
        const response = await this.requestJson<{ profile: AgentProfileApiResponse }>(
            `/api/agents/${encodeURIComponent(agent)}/profile`,
            {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(payload),
            },
        );
        return fromProfileApi(response.profile);
    }

    async publishProfile(
        agent: string,
        payload: PublishProfileInput = {},
    ): Promise<PublishProfileResult> {
        const response = await this.requestJson<{
            ok: boolean;
            onchain_tx: string;
            profile: AgentProfileApiResponse;
        }>(
            `/api/agents/${encodeURIComponent(agent)}/profile/publish`,
            {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(payload),
            },
        );
        return {
            ok: response.ok,
            onchain_tx: response.onchain_tx,
            profile: fromProfileApi(response.profile),
        };
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

let _client: AgentProfileApiClient | null = null;

export function getAgentProfileApiClient(baseUrl?: string): AgentProfileApiClient {
    if (!_client || baseUrl) {
        _client = new AgentProfileApiClient(baseUrl ?? getDefaultAgentImApiBaseUrl());
    }
    return _client;
}

function fromProfileApi(value: AgentProfileApiResponse): AgentProfile {
    return {
        agent: value.agent,
        displayName: value.display_name,
        bio: value.bio,
        links: value.links ?? {},
        onchainRef: value.onchain_ref,
        publishMode: value.publish_mode,
        updatedAt: value.updated_at,
    };
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
