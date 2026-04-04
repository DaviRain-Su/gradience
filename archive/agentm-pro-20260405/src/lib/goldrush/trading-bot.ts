import type { WhaleFeedSummary } from './whale-tracker';

export interface GridlessAgentIdentity {
    agentId: string;
    walletAddress: string;
    network: 'gridless';
    chainHubReputation: number;
    trustScore: number;
    trustLevel: 'high' | 'medium' | 'low';
    lastSyncedAt: number;
}

export interface DexMarketSnapshot {
    pair: string;
    priceChange24h: number;
    volumeUsd24h: number;
    liquidityUsd: number;
    whaleSentiment: number;
}

export interface DexTradingSignal {
    action: 'buy' | 'sell' | 'hold';
    confidence: number;
    riskGuard: 'allow' | 'review' | 'block';
    reason: string;
}

export function createGridlessAgentIdentity(input: {
    agentId: string;
    walletAddress: string;
    chainHubReputation: number;
    trustScore: number;
}): GridlessAgentIdentity {
    const trustScore = clampScore(input.trustScore);
    return {
        agentId: input.agentId,
        walletAddress: input.walletAddress,
        network: 'gridless',
        chainHubReputation: clampScore(input.chainHubReputation),
        trustScore,
        trustLevel: trustScore >= 70 ? 'high' : trustScore >= 45 ? 'medium' : 'low',
        lastSyncedAt: Date.now(),
    };
}

export function estimateTrustScore(
    chainHubReputation: number,
    walletRiskScore: number
): number {
    const rep = clampScore(chainHubReputation);
    const inverseRisk = clampScore(100 - walletRiskScore);
    return clampScore(Math.round(rep * 0.68 + inverseRisk * 0.32));
}

export function deriveMarketSnapshotFromWhaleFeed(
    pair: string,
    summary: WhaleFeedSummary
): DexMarketSnapshot {
    const totalSignals = summary.buySignals + summary.sellSignals;
    const whaleSentiment =
        totalSignals > 0 ? (summary.buySignals - summary.sellSignals) / totalSignals : 0;
    const volumeUsd24h = Math.max(120_000, Math.round(summary.largestTransferUsd * 3.2));
    const liquidityUsd = Math.max(80_000, Math.round(volumeUsd24h * 0.55));
    const priceChange24h = Math.max(-22, Math.min(22, Number((whaleSentiment * 18).toFixed(2))));

    return {
        pair,
        priceChange24h,
        volumeUsd24h,
        liquidityUsd,
        whaleSentiment,
    };
}

export function generateDexTradingSignal(input: {
    agent: GridlessAgentIdentity;
    market: DexMarketSnapshot;
    walletRiskScore: number;
}): DexTradingSignal {
    const walletRisk = clampScore(input.walletRiskScore);
    const momentum =
        input.market.priceChange24h * 1.3 + input.market.whaleSentiment * 28 + (input.agent.chainHubReputation - 50) * 0.55;
    const liquidityBoost = input.market.liquidityUsd >= 300_000 ? 8 : input.market.liquidityUsd >= 160_000 ? 4 : 0;
    const riskPenalty = walletRisk * 0.6 + (input.agent.trustLevel === 'low' ? 16 : input.agent.trustLevel === 'medium' ? 7 : 0);
    const rawConfidence = clampScore(Math.round(50 + momentum + liquidityBoost - riskPenalty));

    const riskGuard: DexTradingSignal['riskGuard'] =
        walletRisk >= 80 || input.agent.trustScore < 40
            ? 'block'
            : walletRisk >= 60 || input.agent.trustScore < 55
              ? 'review'
              : 'allow';

    let action: DexTradingSignal['action'] = 'hold';
    if (rawConfidence >= 65 && riskGuard !== 'block') {
        action = 'buy';
    } else if (rawConfidence <= 35) {
        action = 'sell';
    }

    const reason =
        action === 'buy'
            ? `Bullish whale sentiment (${(input.market.whaleSentiment * 100).toFixed(1)}%) and ChainHub reputation ${input.agent.chainHubReputation}`
            : action === 'sell'
              ? `Weak conviction under risk pressure (wallet risk ${walletRisk}, trust ${input.agent.trustScore})`
              : `Signal neutral: waiting for stronger market/whale confirmation`;

    return {
        action,
        confidence: rawConfidence,
        riskGuard,
        reason,
    };
}

function clampScore(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
}
