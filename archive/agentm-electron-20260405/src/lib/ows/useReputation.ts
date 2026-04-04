/**
 * useReputation Hook - Reputation Query Integration
 *
 * React hook for fetching and managing reputation data from Chain Hub.
 * Can be used standalone or with OWS provider context.
 *
 * @module lib/ows/useReputation
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getOWSService } from './OWSService.ts';
import type {
    ReputationData,
    ReputationTier,
    ReputationBadgeData,
    OWSConfig,
} from './types.ts';

/**
 * Hook options
 */
export interface UseReputationOptions {
    /** Chain Hub base URL */
    chainHubBaseUrl?: string;
    /** Auto-refresh interval in ms (0 to disable) */
    refreshInterval?: number;
    /** OWS configuration */
    config?: Partial<OWSConfig>;
}

/**
 * Hook return value
 */
export interface UseReputationResult {
    /** Reputation data or null if not loaded/found */
    reputation: ReputationData | null;
    /** Whether data is currently loading */
    loading: boolean;
    /** Error message if any */
    error: string | null;
    /** Manually refresh data */
    refresh: () => Promise<void>;
    /** Computed badge data for display */
    badge: ReputationBadgeData | null;
    /** Last updated timestamp */
    lastUpdated: number | null;
}

/**
 * Determine reputation tier from score
 */
function getTier(score: number): ReputationTier {
    if (score >= 95) return 'legendary';
    if (score >= 85) return 'elite';
    if (score >= 70) return 'expert';
    if (score >= 50) return 'skilled';
    if (score > 0) return 'novice';
    return 'unknown';
}

/**
 * Get tier configuration
 */
function getTierConfig(tier: ReputationTier): { color: string; icon: string } {
    const configs: Record<ReputationTier, { color: string; icon: string }> = {
        legendary: { color: 'text-amber-400 bg-amber-600/20 border-amber-600/30', icon: '👑' },
        elite: { color: 'text-purple-400 bg-purple-600/20 border-purple-600/30', icon: '⭐' },
        expert: { color: 'text-blue-400 bg-blue-600/20 border-blue-600/30', icon: '🔷' },
        skilled: { color: 'text-green-400 bg-green-600/20 border-green-600/30', icon: '✓' },
        novice: { color: 'text-gray-400 bg-gray-600/20 border-gray-600/30', icon: '○' },
        unknown: { color: 'text-gray-500 bg-gray-700/20 border-gray-700/30', icon: '?' },
    };
    return configs[tier];
}

/**
 * Format win rate as percentage string
 */
function formatWinRate(rate: number): string {
    return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Format score for display
 */
function formatScore(score: number): string {
    return score.toFixed(1);
}

/**
 * useReputation - Fetch and manage reputation data
 *
 * @param address - Wallet address to fetch reputation for (null to disable)
 * @param options - Hook options
 * @returns Reputation data and state
 *
 * @example
 * ```tsx
 * function AgentProfile({ address }: { address: string }) {
 *   const { reputation, loading, badge } = useReputation(address);
 *
 *   if (loading) return <Spinner />;
 *   if (!reputation) return <div>No reputation data</div>;
 *
 *   return (
 *     <div>
 *       <span>{badge?.icon} {badge?.tier}</span>
 *       <span>Score: {badge?.score}</span>
 *       <span>Win Rate: {badge?.winRate}</span>
 *     </div>
 *   );
 * }
 * ```
 */
export function useReputation(
    address: string | null,
    options: UseReputationOptions = {}
): UseReputationResult {
    const { refreshInterval = 30_000, config } = options;

    const [reputation, setReputation] = useState<ReputationData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);

    const service = useMemo(() => getOWSService(config), [config]);

    const refresh = useCallback(async () => {
        if (!address) {
            setReputation(null);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const data = await service.getReputation(address);
            setReputation(data);
            setLastUpdated(Date.now());
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load reputation');
        } finally {
            setLoading(false);
        }
    }, [address, service]);

    // Initial fetch and address change
    useEffect(() => {
        refresh();
    }, [refresh]);

    // Auto-refresh interval
    useEffect(() => {
        if (refreshInterval <= 0 || !address) return;

        const interval = setInterval(() => {
            refresh();
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [refresh, refreshInterval, address]);

    // Compute badge data
    const badge = useMemo<ReputationBadgeData | null>(() => {
        if (!reputation) return null;

        const tier = getTier(reputation.globalAvgScore);
        const tierConfig = getTierConfig(tier);

        return {
            tier,
            score: formatScore(reputation.globalAvgScore),
            completedTasks: reputation.globalCompleted,
            winRate: formatWinRate(reputation.globalWinRate),
            color: tierConfig.color,
            icon: tierConfig.icon,
        };
    }, [reputation]);

    return {
        reputation,
        loading,
        error,
        refresh,
        badge,
        lastUpdated,
    };
}

/**
 * Batch reputation hook for multiple addresses
 *
 * @param addresses - Array of addresses to fetch
 * @param options - Hook options
 * @returns Map of address to reputation and loading state
 */
export function useReputationBatch(
    addresses: string[],
    options: UseReputationOptions = {}
): {
    reputations: Map<string, ReputationData>;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
} {
    const { refreshInterval = 30_000, config } = options;

    const [reputations, setReputations] = useState<Map<string, ReputationData>>(new Map());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const service = useMemo(() => getOWSService(config), [config]);

    const refresh = useCallback(async () => {
        if (addresses.length === 0) {
            setReputations(new Map());
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const results = await service.getReputationBatch(addresses);
            setReputations(results);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load reputations');
        } finally {
            setLoading(false);
        }
    }, [addresses, service]);

    // Initial fetch
    useEffect(() => {
        refresh();
    }, [refresh]);

    // Auto-refresh
    useEffect(() => {
        if (refreshInterval <= 0 || addresses.length === 0) return;

        const interval = setInterval(() => {
            refresh();
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [refresh, refreshInterval, addresses.length]);

    return { reputations, loading, error, refresh };
}

/**
 * Helper: Get tier from score (exported for use in components)
 */
export { getTier, getTierConfig, formatWinRate, formatScore };

export default useReputation;
