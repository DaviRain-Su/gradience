/**
 * Agent discovery ranking — migrated from agent-social/frontend/src/lib/ranking.ts
 * Simplified: no longer depends on @gradience/sdk types directly.
 */

import type { AgentDiscoveryRow } from '../types.ts';

export function sortAndFilterAgents(
    rows: AgentDiscoveryRow[],
    query: string,
): AgentDiscoveryRow[] {
    const normalized = query.trim().toLowerCase();
    const filtered = normalized
        ? rows.filter((row) => row.agent.toLowerCase().includes(normalized))
        : rows;

    return [...filtered].sort((a, b) => {
        const scoreA = a.reputation?.global_avg_score ?? 0;
        const scoreB = b.reputation?.global_avg_score ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;

        const completedA = a.reputation?.global_completed ?? 0;
        const completedB = b.reputation?.global_completed ?? 0;
        if (completedB !== completedA) return completedB - completedA;

        return b.weight - a.weight;
    });
}
