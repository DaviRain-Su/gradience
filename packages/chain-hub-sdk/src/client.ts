/**
 * ChainHubClient — High-level SDK for Chain Hub
 *
 * Provides typed methods for reputation, registry, transactions, and SQL queries.
 * Wraps the lower-level router and adds developer-friendly error handling.
 */

export interface ChainHubClientConfig {
    /** Indexer base URL */
    baseUrl: string;
    /** Optional API key for authenticated endpoints */
    apiKey?: string;
    /** Network: devnet or mainnet */
    network?: 'devnet' | 'mainnet';
}

export interface ReputationData {
    agent: string;
    globalAvgScore: number;
    globalWinRate: number;
    globalCompleted: number;
    globalTotalApplied: number;
    totalEarned: number;
    updatedSlot: number;
}

export interface AgentInfo {
    agent: string;
    displayName: string;
    bio: string;
    links: { website?: string; github?: string; x?: string };
    onchainRef: string | null;
    publishMode: string;
    updatedAt: number;
}

export interface RegistryEntry {
    id: string;
    name: string;
    category: number;
    status: 'active' | 'paused';
    authority: string;
    uri: string;
}

export interface SqlQueryResult {
    columns: string[];
    rows: unknown[][];
    rowCount: number;
    executionMs: number;
}

const DEFAULT_CONFIG: ChainHubClientConfig = {
    baseUrl: 'https://indexer.gradiences.xyz',
    network: 'devnet',
};

export class ChainHubClient {
    private config: ChainHubClientConfig;
    private headers: Record<string, string>;

    constructor(config?: Partial<ChainHubClientConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.headers = {
            'Content-Type': 'application/json',
            ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        };
    }

    // ── Reputation API (GRA-143) ──

    async getReputation(agent: string): Promise<ReputationData | null> {
        try {
            const raw = await this.get<{
                agent: string;
                global_avg_score: number;
                global_win_rate: number;
                global_completed: number;
                global_total_applied: number;
                total_earned: number;
                updated_slot: number;
            }>(`/api/agents/${agent}/reputation`);
            return {
                agent: raw.agent,
                globalAvgScore: raw.global_avg_score,
                globalWinRate: raw.global_win_rate,
                globalCompleted: raw.global_completed,
                globalTotalApplied: raw.global_total_applied,
                totalEarned: raw.total_earned,
                updatedSlot: raw.updated_slot,
            };
        } catch (error) {
            console.warn(`[ChainHub] Failed to get reputation for ${agent}:`, error);
            return null;
        }
    }

    async getReputationBatch(agents: string[]): Promise<Map<string, ReputationData>> {
        const results = new Map<string, ReputationData>();
        const promises = agents.map(async (agent) => {
            const rep = await this.getReputation(agent);
            if (rep) results.set(agent, rep);
        });
        await Promise.all(promises);
        return results;
    }

    // ── Registry API (GRA-144) ──

    async getAgentInfo(pubkey: string): Promise<AgentInfo | null> {
        try {
            const raw = await this.get<{
                agent: string;
                display_name: string;
                bio: string;
                links: { website?: string; github?: string; x?: string };
                onchain_ref: string | null;
                publish_mode: string;
                updated_at: number;
            }>(`/api/agents/${pubkey}/profile`);
            return {
                agent: raw.agent,
                displayName: raw.display_name,
                bio: raw.bio,
                links: raw.links,
                onchainRef: raw.onchain_ref,
                publishMode: raw.publish_mode,
                updatedAt: raw.updated_at,
            };
        } catch (error) {
            console.warn(`[ChainHub] Failed to get agent info for ${pubkey}:`, error);
            return null;
        }
    }

    async registerAgent(_pubkey: string, _profile: Partial<AgentInfo>): Promise<string> {
        // TODO: Build and send Solana transaction via program CPI
        throw new Error('registerAgent requires Solana wallet signer — use SDK with @solana/kit');
    }

    // ── Transaction API (GRA-145) ──

    async getTask(taskId: number): Promise<unknown> {
        return this.get(`/api/tasks/${taskId}`);
    }

    async getTasks(params?: {
        state?: 'open' | 'completed' | 'refunded';
        poster?: string;
        limit?: number;
    }): Promise<unknown[]> {
        const query = new URLSearchParams();
        if (params?.state) query.set('state', params.state);
        if (params?.poster) query.set('poster', params.poster);
        if (params?.limit) query.set('limit', String(params.limit));
        const qs = query.toString();
        return this.get<unknown[]>(`/api/tasks${qs ? '?' + qs : ''}`);
    }

    async getTaskSubmissions(taskId: number): Promise<unknown[]> {
        return this.get<unknown[]>(`/api/tasks/${taskId}/submissions`);
    }

    async getJudgePool(category: number): Promise<unknown[]> {
        return this.get<unknown[]>(`/api/judge-pool/${category}`);
    }

    // ── SQL Query Interface (GRA-147) ──

    async query(sql: string, params?: unknown[]): Promise<SqlQueryResult> {
        return this.post<SqlQueryResult>('/api/sql/query', { sql, params });
    }

    /** Convenience: count rows matching a condition */
    async count(table: string, where?: string): Promise<number> {
        const sql = where
            ? `SELECT COUNT(*) as count FROM ${table} WHERE ${where}`
            : `SELECT COUNT(*) as count FROM ${table}`;
        const result = await this.query(sql);
        return (result.rows[0]?.[0] as number) ?? 0;
    }

    /** Convenience: select rows with limit */
    async select(table: string, options?: { where?: string; orderBy?: string; limit?: number }): Promise<unknown[][]> {
        let sql = `SELECT * FROM ${table}`;
        if (options?.where) sql += ` WHERE ${options.where}`;
        if (options?.orderBy) sql += ` ORDER BY ${options.orderBy}`;
        if (options?.limit) sql += ` LIMIT ${options.limit}`;
        const result = await this.query(sql);
        return result.rows;
    }

    // ── Health ──

    async healthCheck(): Promise<boolean> {
        try {
            await this.get<{ status: string }>('/healthz');
            return true;
        } catch (error) {
            console.warn('[ChainHub] Health check failed:', error);
            return false;
        }
    }

    // ── Internal ──

    private async get<T>(path: string): Promise<T> {
        const res = await fetch(`${this.config.baseUrl}${path}`, {
            headers: this.headers,
        });
        if (!res.ok) {
            throw new ChainHubError(res.status, await res.text());
        }
        return res.json();
    }

    private async post<T>(path: string, body: unknown): Promise<T> {
        const res = await fetch(`${this.config.baseUrl}${path}`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            throw new ChainHubError(res.status, await res.text());
        }
        return res.json();
    }
}

export class ChainHubError extends Error {
    constructor(
        public readonly status: number,
        public readonly body: string,
    ) {
        super(`ChainHub API error ${status}: ${body}`);
        this.name = 'ChainHubError';
    }
}
