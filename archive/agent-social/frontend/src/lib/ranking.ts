import type { JudgePoolEntryApi, ReputationApi } from '@gradience/sdk';

export interface AgentDiscoveryRow {
    agent: string;
    stake: number;
    weight: number;
    reputation: ReputationApi | null;
}

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
        if (scoreB !== scoreA) {
            return scoreB - scoreA;
        }
        const completedA = a.reputation?.global_completed ?? 0;
        const completedB = b.reputation?.global_completed ?? 0;
        if (completedB !== completedA) {
            return completedB - completedA;
        }
        return b.weight - a.weight;
    });
}

export function toDiscoveryRows(
    judgePool: JudgePoolEntryApi[] | null,
    reputations: Map<string, ReputationApi | null>,
): AgentDiscoveryRow[] {
    if (!judgePool) {
        return [];
    }
    return judgePool.map((row) => ({
        agent: row.judge,
        stake: row.stake,
        weight: row.weight,
        reputation: reputations.get(row.judge) ?? null,
    }));
}
