import { getIndexerClient } from '@/lib/indexer';
import type { ReputationApi } from '@/lib/indexer';
import type { AgentSocialProfile } from './types';

export interface SocialReputationEntry extends AgentSocialProfile {
    trustScore: number;
    rankingScore: number;
    rank: number;
    verifiedBadge: boolean;
    interactionPolicy: 'allow' | 'review' | 'restricted';
}

export interface SocialReputationFeed {
    source: 'live' | 'demo';
    items: SocialReputationEntry[];
    updatedAt: number;
}

export async function loadSocialReputationFeed(seedAgents: string[]): Promise<SocialReputationFeed> {
    const agents = normalizeAgents(seedAgents);
    const client = getIndexerClient();

    try {
        const tasks = await client.getTasks({ limit: 40 });
        for (const task of tasks) {
            agents.add(task.poster);
            if (task.winner) agents.add(task.winner);
        }

        const entries = await Promise.all(
            Array.from(agents)
                .slice(0, 24)
                .map(async (agent) => {
                    const [profile, reputation] = await Promise.all([
                        safeGetProfile(agent),
                        safeGetReputation(agent),
                    ]);
                    if (!reputation) return null;
                    return toSocialEntry(agent, profile, reputation);
                })
        );

        const sorted = entries
            .filter((entry): entry is SocialReputationEntry => entry !== null)
            .sort((a, b) => b.rankingScore - a.rankingScore)
            .map((entry, index) => ({ ...entry, rank: index + 1 }));

        if (sorted.length > 0) {
            return {
                source: 'live',
                items: sorted,
                updatedAt: Date.now(),
            };
        }
    } catch {
        // fallback to demo mode
    }

    const fallback = Array.from(agents).slice(0, 6);
    return {
        source: 'demo',
        items: fallback.map((agent, index) =>
            buildDemoEntry(agent, index + 1, fallback.length)
        ),
        updatedAt: Date.now(),
    };
}

async function safeGetProfile(agent: string): Promise<{
    display_name: string;
    bio: string;
    links?: { website?: string; github?: string; x?: string };
} | null> {
    try {
        const client = getIndexerClient();
        return await client.getAgentProfile(agent);
    } catch {
        return null;
    }
}

async function safeGetReputation(agent: string): Promise<ReputationApi | null> {
    try {
        const client = getIndexerClient();
        return await client.getAgentReputation(agent);
    } catch {
        return null;
    }
}

function toSocialEntry(
    agent: string,
    profile: Awaited<ReturnType<typeof safeGetProfile>>,
    reputation: ReputationApi
): SocialReputationEntry {
    const winRate = normalizeWinRate(reputation.global_win_rate);
    const avgScore = clamp(0, 100, Math.round(reputation.global_avg_score / 100));
    const trustScore = clamp(
        0,
        100,
        Math.round(avgScore * 0.68 + winRate * 100 * 0.22 + Math.min(reputation.global_completed, 25) * 0.4)
    );
    const rankingScore = clamp(
        0,
        100,
        Math.round(avgScore * 0.62 + winRate * 100 * 0.24 + Math.min(reputation.global_completed, 30) * 0.45)
    );
    const interactionPolicy =
        trustScore >= 70 ? 'allow' : trustScore >= 45 ? 'review' : 'restricted';

    return {
        address: agent,
        domain: null,
        displayName: profile?.display_name || shortenAddress(agent),
        bio: profile?.bio || 'Gridless network agent connected via ChainHub.',
        avatar: null,
        reputation: {
            avgScore,
            completed: reputation.global_completed,
            winRate: Math.round(winRate * 100),
        },
        followersCount: Math.max(0, Math.round(reputation.global_completed * 1.8)),
        followingCount: Math.max(0, Math.round(reputation.global_total_applied * 0.25)),
        createdAt: Date.now(),
        trustScore,
        rankingScore,
        rank: 0,
        verifiedBadge: avgScore >= 80 && reputation.global_completed >= 10,
        interactionPolicy,
    };
}

function buildDemoEntry(agent: string, rank: number, total: number): SocialReputationEntry {
    const score = clamp(46, 92, 90 - rank * 6);
    const trustScore = clamp(35, 95, score - 4 + Math.max(0, total - rank));
    return {
        address: agent,
        domain: null,
        displayName: shortenAddress(agent),
        bio: 'Demo reputation stream while ChainHub Indexer is unavailable.',
        avatar: null,
        reputation: {
            avgScore: score,
            completed: Math.max(2, 18 - rank * 2),
            winRate: Math.max(35, 82 - rank * 5),
        },
        followersCount: 120 - rank * 9,
        followingCount: 18 + rank,
        createdAt: Date.now(),
        trustScore,
        rankingScore: score,
        rank,
        verifiedBadge: score >= 80,
        interactionPolicy: trustScore >= 70 ? 'allow' : trustScore >= 45 ? 'review' : 'restricted',
    };
}

function normalizeAgents(seedAgents: string[]): Set<string> {
    const set = new Set<string>();
    for (const agent of seedAgents) {
        const normalized = agent.trim();
        if (normalized) set.add(normalized);
    }
    return set;
}

function normalizeWinRate(value: number): number {
    if (value <= 1) return clamp(0, 1, value);
    return clamp(0, 1, value / 10000);
}

function shortenAddress(address: string): string {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function clamp(min: number, max: number, value: number): number {
    return Math.max(min, Math.min(max, value));
}
