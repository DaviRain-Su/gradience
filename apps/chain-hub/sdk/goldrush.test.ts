import { describe, expect, it } from 'bun:test';
import { GoldRushClient } from './goldrush';

describe('GoldRushClient', () => {
    it('returns deterministic heuristic metrics without api key', async () => {
        const client = new GoldRushClient();
        const a = await client.getWalletRiskMetrics('AgentWallet111');
        const b = await client.getWalletRiskMetrics('AgentWallet111');
        expect(a.source).toBe('heuristic');
        expect(a.riskScore).toBe(b.riskScore);
        expect(a.tokenCount).toBe(b.tokenCount);
    });

    it('parses live goldrush metrics when api responses are available', async () => {
        const fetcher: typeof fetch = async (input) => {
            const url = String(input);
            if (url.includes('/balances_v2/')) {
                return new Response(
                    JSON.stringify({
                        data: {
                            items: [
                                { quote: 1000, spenders: [{ spender: 'x' }] },
                                { quote: 500, spenders: [] },
                            ],
                        },
                    }),
                    { status: 200 },
                );
            }
            return new Response(
                JSON.stringify({
                    data: {
                        items: [
                            { successful: true, value_quote: 250 },
                            { successful: false, value_quote: 100 },
                            { successful: true, value_quote: 15000 },
                        ],
                    },
                }),
                { status: 200 },
            );
        };

        const client = new GoldRushClient({ apiKey: 'demo-key', fetcher });
        const metrics = await client.getWalletRiskMetrics('AgentWallet222');
        expect(metrics.source).toBe('goldrush');
        expect(metrics.tokenCount).toBe(2);
        expect(metrics.txCount24h).toBe(3);
        expect(metrics.staleApprovals).toBe(1);
        expect(metrics.riskScore).toBeGreaterThan(0);
    });

    it('combines risk metrics with reputation into trust score', async () => {
        const client = new GoldRushClient();
        const risk = await client.getWalletRiskMetrics('AgentWallet333');
        const trust = client.combineWithReputation('AgentWallet333', risk, {
            avgScore: 88,
            completed: 23,
            winRate: 0.84,
        });

        expect(trust.address).toBe('AgentWallet333');
        expect(trust.trustScore).toBeGreaterThanOrEqual(0);
        expect(trust.trustScore).toBeLessThanOrEqual(100);
        expect(['high', 'medium', 'low']).toContain(trust.trustLevel);
    });
});
