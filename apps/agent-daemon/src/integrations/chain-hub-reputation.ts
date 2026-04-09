/**
 * Chain Hub Reputation Client
 *
 * GRA-225a: Dedicated client for reputation queries from Chain Hub Indexer
 *
 * Provides:
 * - Agent reputation lookup
 * - Master wallet reputation aggregation
 * - Caching for performance
 */

import { logger } from '../utils/logger.js';

export interface ReputationRecord {
    score: number;
    completedTasks: number;
    avgRating: number;
    updatedAt: string;
}

export interface AgentReputation {
    agentAddress: string;
    reputation: ReputationRecord;
}

export interface AggregateReputation {
    masterWallet: string;
    aggregateScore: number;
    agentCount: number;
    agents: Array<{
        agentAddress: string;
        score: number;
        completedTasks: number;
        weight: number;
    }>;
}

interface CacheEntry {
    data: ReputationRecord;
    timestamp: number;
}

export class ChainHubReputationClient {
    private baseUrl: string;
    private cache: Map<string, CacheEntry> = new Map();
    private cacheTtlMs: number;

    constructor(config: { baseUrl: string; cacheTtlMs?: number }) {
        this.baseUrl = config.baseUrl.replace(/\/$/, '');
        this.cacheTtlMs = config.cacheTtlMs ?? 5 * 60 * 1000; // 5 minutes default
    }

    /**
     * Get reputation for a single agent
     * GRA-225a: Core reputation lookup
     */
    async getReputation(agentAddress: string): Promise<ReputationRecord | null> {
        // Check cache first
        const cached = this.cache.get(agentAddress);
        if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
            logger.debug({ agentAddress }, 'Returning cached reputation');
            return cached.data;
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/agents/${encodeURIComponent(agentAddress)}/reputation`);

            if (!response.ok) {
                if (response.status === 404) {
                    logger.debug({ agentAddress }, 'No reputation found for agent');
                    return null;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            const reputation: ReputationRecord = {
                score: data.score ?? 0,
                completedTasks: data.completed_tasks ?? 0,
                avgRating: data.avg_rating ?? 0,
                updatedAt: data.updated_at ?? new Date().toISOString(),
            };

            // Cache the result
            this.cache.set(agentAddress, {
                data: reputation,
                timestamp: Date.now(),
            });

            logger.debug({ agentAddress, score: reputation.score }, 'Fetched reputation from Chain Hub');
            return reputation;
        } catch (error) {
            logger.error({ error, agentAddress }, 'Failed to fetch reputation from Chain Hub');
            return null;
        }
    }

    /**
     * Get reputations for all agents under a master wallet
     * GRA-225a: Batch reputation lookup
     */
    async getReputationsByMaster(masterWallet: string): Promise<AgentReputation[]> {
        try {
            const response = await fetch(
                `${this.baseUrl}/api/agents?master=${encodeURIComponent(masterWallet)}&include_reputation=true`,
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (!Array.isArray(data.agents)) {
                return [];
            }

            const results: AgentReputation[] = [];

            for (const agent of data.agents) {
                if (agent.reputation) {
                    const reputation: ReputationRecord = {
                        score: agent.reputation.score ?? 0,
                        completedTasks: agent.reputation.completed_tasks ?? 0,
                        avgRating: agent.reputation.avg_rating ?? 0,
                        updatedAt: agent.reputation.updated_at ?? new Date().toISOString(),
                    };

                    results.push({
                        agentAddress: agent.address,
                        reputation,
                    });

                    // Cache individual results
                    this.cache.set(agent.address, {
                        data: reputation,
                        timestamp: Date.now(),
                    });
                }
            }

            logger.debug({ masterWallet, count: results.length }, 'Fetched reputations by master from Chain Hub');
            return results;
        } catch (error) {
            logger.error({ error, masterWallet }, 'Failed to fetch reputations by master');
            return [];
        }
    }

    /**
     * Calculate aggregate reputation for a master wallet
     * GRA-225a: Weighted average aggregation
     */
    async getAggregateReputation(masterWallet: string): Promise<AggregateReputation | null> {
        const agents = await this.getReputationsByMaster(masterWallet);

        if (agents.length === 0) {
            return null;
        }

        // Calculate weighted average (weight = completed tasks)
        const totalWeight = agents.reduce((sum, a) => sum + Math.max(a.reputation.completedTasks, 1), 0);

        const weightedScore = agents.reduce((sum, a) => {
            const weight = Math.max(a.reputation.completedTasks, 1) / totalWeight;
            return sum + a.reputation.score * weight;
        }, 0);

        const aggregateScore = Math.round(weightedScore);

        return {
            masterWallet,
            aggregateScore,
            agentCount: agents.length,
            agents: agents.map((a) => ({
                agentAddress: a.agentAddress,
                score: a.reputation.score,
                completedTasks: a.reputation.completedTasks,
                weight: Math.max(a.reputation.completedTasks, 1) / totalWeight,
            })),
        };
    }

    /**
     * Batch fetch reputations
     * GRA-225a: Efficient batch lookup with concurrency limit
     */
    async batchGetReputations(
        agentAddresses: string[],
        concurrency: number = 5,
    ): Promise<Map<string, ReputationRecord | null>> {
        const results = new Map<string, ReputationRecord | null>();

        // Process in batches
        for (let i = 0; i < agentAddresses.length; i += concurrency) {
            const batch = agentAddresses.slice(i, i + concurrency);

            const batchResults = await Promise.all(
                batch.map(async (address) => {
                    const reputation = await this.getReputation(address);
                    return { address, reputation };
                }),
            );

            for (const { address, reputation } of batchResults) {
                results.set(address, reputation);
            }
        }

        return results;
    }

    /**
     * Clear cache for specific agent or all
     */
    clearCache(agentAddress?: string): void {
        if (agentAddress) {
            this.cache.delete(agentAddress);
            logger.debug({ agentAddress }, 'Cleared reputation cache');
        } else {
            this.cache.clear();
            logger.debug('Cleared all reputation cache');
        }
    }

    /**
     * Get cache stats
     */
    getCacheStats(): {
        size: number;
        oldestEntry: number | null;
        newestEntry: number | null;
    } {
        const timestamps = Array.from(this.cache.values()).map((e) => e.timestamp);

        return {
            size: this.cache.size,
            oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : null,
            newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : null,
        };
    }
}

// Factory function
export function createChainHubReputationClient(config: {
    baseUrl: string;
    cacheTtlMs?: number;
}): ChainHubReputationClient {
    return new ChainHubReputationClient(config);
}
