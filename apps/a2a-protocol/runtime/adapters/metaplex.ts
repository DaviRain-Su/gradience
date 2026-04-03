/**
 * Metaplex Agent Registry Adapter
 *
 * Integrates A2A Protocol with Metaplex Agent Registry for:
 * - Agent discovery via on-chain registry
 * - Reputation-ranked agent listing
 * - Cross-protocol identity resolution
 */

export interface MetaplexAgentEntry {
    mint: string;
    owner: string;
    name: string;
    uri: string;
    reputation?: {
        avgScore: number;
        completed: number;
        winRate: number;
    };
}

export interface MetaplexRegistryClient {
    /** Fetch agents registered in Metaplex Agent Registry */
    listAgents(options?: { limit?: number; offset?: number }): Promise<MetaplexAgentEntry[]>;
    /** Lookup a single agent by mint address */
    getAgent(mint: string): Promise<MetaplexAgentEntry | null>;
    /** Lookup agent by owner address */
    getAgentByOwner(owner: string): Promise<MetaplexAgentEntry | null>;
}

export class MetaplexAdapter {
    constructor(private readonly client: MetaplexRegistryClient) {}

    /** Discover agents ranked by reputation for A2A interaction */
    async discoverAgents(options?: {
        minScore?: number;
        limit?: number;
    }): Promise<MetaplexAgentEntry[]> {
        const agents = await this.client.listAgents({ limit: options?.limit ?? 50 });

        const filtered = options?.minScore
            ? agents.filter((a) => (a.reputation?.avgScore ?? 0) >= options.minScore!)
            : agents;

        // Sort by reputation score descending
        return filtered.sort(
            (a, b) => (b.reputation?.avgScore ?? 0) - (a.reputation?.avgScore ?? 0),
        );
    }

    /** Resolve A2A envelope recipient to Metaplex agent identity */
    async resolveRecipient(address: string): Promise<MetaplexAgentEntry | null> {
        return this.client.getAgentByOwner(address);
    }

    /** Calculate reputation tier for an agent */
    getTier(agent: MetaplexAgentEntry): 'elite' | 'trusted' | 'growing' {
        const score = agent.reputation?.avgScore ?? 0;
        const completed = agent.reputation?.completed ?? 0;

        if (score >= 85 && completed >= 20) return 'elite';
        if (score >= 70 && completed >= 6) return 'trusted';
        return 'growing';
    }

    /** Build A2A-compatible agent profile from Metaplex entry */
    toA2AProfile(agent: MetaplexAgentEntry): {
        address: string;
        name: string;
        metaplexMint: string;
        tier: string;
        reputation: MetaplexAgentEntry['reputation'];
    } {
        return {
            address: agent.owner,
            name: agent.name,
            metaplexMint: agent.mint,
            tier: this.getTier(agent),
            reputation: agent.reputation,
        };
    }
}
