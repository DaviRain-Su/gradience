export interface GoldRushRiskMetrics {
    address: string;
    source: 'goldrush' | 'heuristic';
    tokenCount: number;
    topHoldingRatio: number;
    staleApprovals: number;
    txCount24h: number;
    suspiciousTxRatio: number;
    riskScore: number;
    generatedAt: string;
}

export interface ChainHubReputationSnapshot {
    avgScore: number;
    completed: number;
    winRate: number;
}

export interface CounterpartyTrustSnapshot {
    address: string;
    risk: GoldRushRiskMetrics;
    reputation: ChainHubReputationSnapshot;
    trustScore: number;
    trustLevel: 'high' | 'medium' | 'low';
}

export interface GoldRushClientOptions {
    apiKey?: string;
    chainName?: string;
    baseUrl?: string;
    fetcher?: typeof fetch;
}

export class GoldRushClient {
    private readonly apiKey: string | null;
    private readonly chainName: string;
    private readonly baseUrl: string;
    private readonly fetcher: typeof fetch;

    constructor(options: GoldRushClientOptions = {}) {
        this.apiKey = options.apiKey?.trim() || null;
        this.chainName = options.chainName ?? 'solana-mainnet';
        this.baseUrl = options.baseUrl ?? 'https://api.covalenthq.com/v1';
        this.fetcher = options.fetcher ?? fetch;
    }

    async getWalletRiskMetrics(address: string): Promise<GoldRushRiskMetrics> {
        const normalizedAddress = address.trim();
        if (!normalizedAddress) {
            throw new Error('wallet address is required');
        }

        const live = await this.fetchLiveMetrics(normalizedAddress);
        if (live) {
            return live;
        }
        return buildHeuristicMetrics(normalizedAddress);
    }

    combineWithReputation(
        address: string,
        risk: GoldRushRiskMetrics,
        reputation: ChainHubReputationSnapshot,
    ): CounterpartyTrustSnapshot {
        const normalizedWinRate = reputation.winRate > 1 ? reputation.winRate / 100 : reputation.winRate;
        const reputationComponent = clampScore(
            Math.round(
                reputation.avgScore * 0.72 + Math.min(reputation.completed, 40) * 0.45 + normalizedWinRate * 100 * 0.1,
            ),
        );
        const riskComponent = clampScore(100 - risk.riskScore);
        const trustScore = clampScore(Math.round(reputationComponent * 0.65 + riskComponent * 0.35));

        return {
            address: address.trim(),
            risk,
            reputation,
            trustScore,
            trustLevel: trustScore >= 70 ? 'high' : trustScore >= 45 ? 'medium' : 'low',
        };
    }

    private async fetchLiveMetrics(address: string): Promise<GoldRushRiskMetrics | null> {
        if (!this.apiKey) {
            return null;
        }
        try {
            const [balancesRes, txRes] = await Promise.all([
                this.fetcher(
                    `${this.baseUrl}/${encodeURIComponent(this.chainName)}/address/${encodeURIComponent(
                        address,
                    )}/balances_v2/?key=${encodeURIComponent(this.apiKey)}`,
                    { cache: 'no-store' },
                ),
                this.fetcher(
                    `${this.baseUrl}/${encodeURIComponent(this.chainName)}/address/${encodeURIComponent(
                        address,
                    )}/transactions_v3/?key=${encodeURIComponent(this.apiKey)}&page-size=100`,
                    { cache: 'no-store' },
                ),
            ]);

            if (!balancesRes.ok || !txRes.ok) {
                return null;
            }

            const balances = (await balancesRes.json()) as {
                data?: { items?: Array<{ quote?: number; spenders?: unknown[] }> };
            };
            const transactions = (await txRes.json()) as {
                data?: {
                    items?: Array<{
                        successful?: boolean;
                        value_quote?: number | null;
                    }>;
                };
            };

            const balanceItems = balances.data?.items ?? [];
            const quotes = balanceItems
                .map((item) => Number(item.quote ?? 0))
                .filter((value) => Number.isFinite(value) && value > 0);
            const totalQuote = quotes.reduce((acc, value) => acc + value, 0);
            const topHoldingRatio = totalQuote > 0 ? Math.max(...quotes, 0) / totalQuote : 0;
            const staleApprovals = balanceItems.reduce((acc, item) => {
                const spenders = Array.isArray(item.spenders) ? item.spenders.length : 0;
                return acc + spenders;
            }, 0);

            const txItems = transactions.data?.items ?? [];
            const txCount24h = txItems.length;
            const suspiciousCount = txItems.filter((item) => {
                const failed = item.successful === false;
                const highValue = Number(item.value_quote ?? 0) > 10_000;
                return failed || highValue;
            }).length;
            const suspiciousTxRatio = txCount24h > 0 ? suspiciousCount / txCount24h : 0;

            return buildMetricsFromInputs(address, 'goldrush', {
                tokenCount: quotes.length,
                topHoldingRatio,
                staleApprovals,
                txCount24h,
                suspiciousTxRatio,
            });
        } catch {
            return null;
        }
    }
}

function buildHeuristicMetrics(address: string): GoldRushRiskMetrics {
    const seed = hashAddress(address);
    return buildMetricsFromInputs(address, 'heuristic', {
        tokenCount: 2 + (seed % 10),
        topHoldingRatio: 0.2 + (seed % 70) / 100,
        staleApprovals: seed % 5,
        txCount24h: 1 + (seed % 40),
        suspiciousTxRatio: ((seed % 35) + 1) / 100,
    });
}

function buildMetricsFromInputs(
    address: string,
    source: 'goldrush' | 'heuristic',
    inputs: {
        tokenCount: number;
        topHoldingRatio: number;
        staleApprovals: number;
        txCount24h: number;
        suspiciousTxRatio: number;
    },
): GoldRushRiskMetrics {
    const concentrationRisk = clampScore(
        Math.round(inputs.topHoldingRatio * 70 + Math.max(0, 5 - inputs.tokenCount) * 4),
    );
    const approvalRisk = clampScore(Math.round(inputs.staleApprovals * 9));
    const txPatternRisk = clampScore(
        Math.round(inputs.suspiciousTxRatio * 100 * 0.8 + Math.max(0, 6 - inputs.txCount24h) * 3),
    );
    const riskScore = clampScore(Math.round(concentrationRisk * 0.4 + approvalRisk * 0.25 + txPatternRisk * 0.35));

    return {
        address: address.trim(),
        source,
        tokenCount: inputs.tokenCount,
        topHoldingRatio: inputs.topHoldingRatio,
        staleApprovals: inputs.staleApprovals,
        txCount24h: inputs.txCount24h,
        suspiciousTxRatio: inputs.suspiciousTxRatio,
        riskScore,
        generatedAt: new Date().toISOString(),
    };
}

function hashAddress(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
        hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
    }
    return hash;
}

function clampScore(value: number): number {
    return Math.max(0, Math.min(100, value));
}
