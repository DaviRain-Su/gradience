import type { AgentProfileApi, AgentProfileUpdate } from '../types.js';

export interface ProfileResourceOptions {
    indexerEndpoint: string;
}

/**
 * Resource for managing agent profiles via the Indexer API.
 */
export class ProfileResource {
    private readonly indexerEndpoint: string;

    constructor(options: ProfileResourceOptions) {
        this.indexerEndpoint = options.indexerEndpoint.endsWith('/')
            ? options.indexerEndpoint.slice(0, -1)
            : options.indexerEndpoint;
    }

    /**
     * Fetch agent profile from Indexer.
     * Returns `null` when not found.
     */
    async get(agent: string): Promise<AgentProfileApi | null> {
        return this.getJsonOrNull<AgentProfileApi>(`/api/agents/${encodeURIComponent(agent)}/profile`);
    }

    /**
     * Update agent profile via Indexer.
     */
    async update(agent: string, data: AgentProfileUpdate): Promise<{ ok: boolean }> {
        const url = `${this.indexerEndpoint}/api/agents/${encodeURIComponent(agent)}/profile`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(data),
            signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) {
            throw new Error(`Profile update failed (${response.status}): ${await response.text()}`);
        }
        return { ok: true };
    }

    private async getJsonOrNull<T>(path: string): Promise<T | null> {
        try {
            const url = new URL(path, `${this.indexerEndpoint}/`);
            const response = await fetch(url.toString());
            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(`Indexer request failed (${response.status}): ${await response.text()}`);
            }
            return (await response.json()) as T;
        } catch (error) {
            if (error instanceof Error && error.message.includes('404')) {
                return null;
            }
            throw error;
        }
    }
}
