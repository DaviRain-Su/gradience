import type { ReputationData } from '@/types';

export interface MetaplexReputationBridge {
    metaplexAgentId: string;
    verificationRef: string;
    tier: 'elite' | 'trusted' | 'growing';
    highReputationBadge: boolean;
    crossProtocolIdentity: {
        chainHubAgent: string;
        metaplexHandle: string;
        gridlessNetwork: true;
    };
}

export function buildMetaplexReputationBridge(
    agentAddress: string,
    reputation: ReputationData
): MetaplexReputationBridge {
    const normalizedAddress = agentAddress.trim();
    const normalizedWinRate =
        reputation.win_rate > 1 ? reputation.win_rate / 100 : reputation.win_rate;
    const tier =
        reputation.avg_score >= 85 && reputation.completed >= 20
            ? 'elite'
            : reputation.avg_score >= 70 && reputation.completed >= 6
              ? 'trusted'
              : 'growing';

    const highReputationBadge =
        reputation.avg_score >= 80 &&
        normalizedWinRate >= 0.72 &&
        reputation.completed >= 10;

    const verificationSeed = [
        normalizedAddress,
        reputation.avg_score,
        reputation.completed,
        normalizedWinRate.toFixed(4),
        reputation.total_earned,
    ].join(':');

    return {
        metaplexAgentId: `metaplex-agent:${normalizedAddress.slice(0, 8).toLowerCase()}`,
        verificationRef: `chainhub-proof-${checksum(verificationSeed)}`,
        tier,
        highReputationBadge,
        crossProtocolIdentity: {
            chainHubAgent: normalizedAddress,
            metaplexHandle: `metaplex://${normalizedAddress}`,
            gridlessNetwork: true,
        },
    };
}

function checksum(value: string): string {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0).toString(16);
}
