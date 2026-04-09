import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OnChainRiskScorer, type RiskPolicy } from '../../src/risk/onchain-risk-scorer.js';

vi.mock('../../src/utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

const MOCK_GOLDRUSH_API_KEY = 'test-api-key-123';

describe('OnChainRiskScorer', () => {
    let scorer: OnChainRiskScorer;

    beforeEach(() => {
        scorer = new OnChainRiskScorer({
            goldrushApiKey: MOCK_GOLDRUSH_API_KEY,
            policy: {
                maxScoreForApplication: 70,
                blockedCategories: ['mixer', 'hack', 'phish', 'sanctions'],
                minWalletAgeDays: 14,
                minTransactionCount: 5,
            },
        });
        vi.restoreAllMocks();
    });

    it('should return zero risk for a healthy wallet', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: {
                            items: Array.from({ length: 20 }, (_, i) => ({
                                block_signed_at: new Date(Date.now() - 86400000 * (i + 30)).toISOString(),
                                successful: true,
                                value_quote: 100,
                            })),
                        },
                    }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: {
                            items: [{ quote: 1000, spenders: [] }],
                        },
                    }),
                }),
        );

        const result = await scorer.assess('HealthyWallet123');
        expect(result.score).toBe(0);
        expect(result.overallRisk).toBe('low');
        expect(result.signals.length).toBe(0);
        expect(scorer.isAllowed(result)).toBe(true);
    });

    it('should flag blacklisted wallet as critical', async () => {
        scorer.addToBlacklist(['blacklisted_wallet_abc']);
        const result = await scorer.assess('blacklisted_wallet_abc');
        expect(result.signals.some((s) => s.category === 'sanctions' && s.severity === 'critical')).toBe(true);
        expect(scorer.isAllowed(result)).toBe(false);
    });

    it('should flag new wallet with few transactions', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: {
                            items: [
                                {
                                    block_signed_at: new Date(Date.now() - 86400000 * 2).toISOString(),
                                    successful: true,
                                    value_quote: 10,
                                },
                            ],
                        },
                    }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: {
                            items: [{ quote: 100, spenders: [] }],
                        },
                    }),
                }),
        );

        const result = await scorer.assess('NewWalletXYZ');
        expect(result.signals.some((s) => s.category === 'new_wallet')).toBe(true);
        expect(result.signals.some((s) => s.category === 'inactive')).toBe(true);
        expect(result.score).toBeGreaterThan(0);
    });

    it('should flag suspicious transaction patterns', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: {
                            items: Array.from({ length: 10 }, () => ({
                                block_signed_at: new Date(Date.now() - 86400000 * 30).toISOString(),
                                successful: false,
                                value_quote: 50_000,
                            })),
                        },
                    }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: {
                            items: [{ quote: 100, spenders: [] }],
                        },
                    }),
                }),
        );

        const result = await scorer.assess('SuspiciousWallet');
        expect(result.signals.some((s) => s.category === 'bot')).toBe(true);
    });

    it('should return cached result on second call', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: {
                            items: Array.from({ length: 20 }, (_, i) => ({
                                block_signed_at: new Date(Date.now() - 86400000 * (i + 30)).toISOString(),
                                successful: true,
                                value_quote: 100,
                            })),
                        },
                    }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: {
                            items: [{ quote: 1000, spenders: [] }],
                        },
                    }),
                }),
        );

        const first = await scorer.assess('CachedWallet');
        const second = await scorer.assess('CachedWallet');
        expect(first.checkedAt).toBe(second.checkedAt);
        expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2); // only GoldRush calls for first assess
    });

    it('should allow application for low-risk wallet', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: {
                            items: Array.from({ length: 20 }, (_, i) => ({
                                block_signed_at: new Date(Date.now() - 86400000 * (i + 30)).toISOString(),
                                successful: true,
                                value_quote: 100,
                            })),
                        },
                    }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: {
                            items: [{ quote: 1000, spenders: [] }],
                        },
                    }),
                }),
        );

        const result = await scorer.assess('GoodWallet');
        expect(scorer.isAllowed(result)).toBe(true);
    });

    it('should reject application for critical-risk wallet', async () => {
        scorer.addToBlacklist(['BadActor']);
        const result = await scorer.assess('BadActor');
        expect(scorer.isAllowed(result)).toBe(false);
    });
});
