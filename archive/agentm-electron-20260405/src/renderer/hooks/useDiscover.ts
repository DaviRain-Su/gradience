import { useState, useEffect, useCallback } from 'react';
import { getIndexerClient } from '../lib/indexer-api.ts';
import type { AgentDiscoveryRow } from '../../shared/types.ts';
import { useAppStore } from './useAppStore.ts';

const CATEGORIES = ['general', 'defi', 'code', 'research', 'creative', 'data', 'compute', 'gov'] as const;

export function useDiscover(category: number = 0) {
    const setDiscoveryRows = useAppStore((s) => s.setDiscoveryRows);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const client = getIndexerClient();
            const pool = await client.getJudgePool(category);

            // Fetch reputation for each agent in parallel
            const repEntries = await Promise.all(
                pool.map(async (entry) => {
                    const rep = await client.getReputation(entry.judge);
                    return [entry.judge, rep] as const;
                }),
            );

            const rows: AgentDiscoveryRow[] = pool.map((entry) => {
                const rep = repEntries.find(([addr]) => addr === entry.judge)?.[1];
                return {
                    agent: entry.judge,
                    weight: entry.weight,
                    reputation: rep
                        ? {
                              global_avg_score: rep.global_avg_score,
                              global_completed: rep.global_completed,
                              global_total_applied: rep.global_total_applied,
                              win_rate: rep.win_rate,
                          }
                        : null,
                };
            });

            setDiscoveryRows(rows);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load agents');
        } finally {
            setLoading(false);
        }
    }, [category, setDiscoveryRows]);

    useEffect(() => { refresh(); }, [refresh]);

    return { loading, error, refresh, categories: CATEGORIES };
}
