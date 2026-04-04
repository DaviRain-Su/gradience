import type { ReputationData } from '@/types';
import { scoreWalletRisk, type WalletRiskReport } from './risk-scoring';
import { fetchReputationByAddress } from '@/lib/ows/reputation';

export interface CounterpartyTrustScore {
    address: string;
    trustScore: number;
    level: 'high' | 'medium' | 'low';
    reputation: ReputationData;
    walletRisk: WalletRiskReport;
}

export async function computeCounterpartyTrustScore(
    address: string
): Promise<CounterpartyTrustScore | null> {
    const normalizedAddress = address.trim();
    if (!normalizedAddress) return null;

    const reputation = await fetchReputationByAddress(normalizedAddress);
    if (!reputation) return null;

    const walletRisk = await scoreWalletRisk(normalizedAddress);

    const normalizedWinRate =
        reputation.win_rate > 1 ? reputation.win_rate / 100 : reputation.win_rate;
    const reputationComponent = clamp(
        Math.round(
            reputation.avg_score * 0.7 +
                Math.min(reputation.completed, 30) * 0.6 +
                normalizedWinRate * 100 * 0.12
        )
    );
    const riskComponent = clamp(100 - walletRisk.riskScore);
    const trustScore = clamp(
        Math.round(reputationComponent * 0.6 + riskComponent * 0.4)
    );

    return {
        address: normalizedAddress,
        trustScore,
        level: trustScore >= 70 ? 'high' : trustScore >= 45 ? 'medium' : 'low',
        reputation,
        walletRisk,
    };
}

function clamp(value: number): number {
    return Math.max(0, Math.min(100, value));
}
