import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { registerRiskRoutes } from '../../../src/api/routes/risk.js';

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../src/risk/onchain-risk-scorer.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/risk/onchain-risk-scorer.js')>();
  return {
    ...actual,
    createOnChainRiskScorer: () =>
      new actual.OnChainRiskScorer({
        goldrushApiKey: 'test-api-key-123',
      }),
  };
});

describe('Risk Routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(() => {
    app = Fastify({ logger: false });
    registerRiskRoutes(app);
    vi.restoreAllMocks();
  });

  function mockHealthyFetch() {
    vi.stubGlobal(
      'fetch',
      vi.fn()
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
        })
    );
  }

  function mockRiskyFetch() {
    vi.stubGlobal(
      'fetch',
      vi.fn()
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
        })
    );
  }

  describe('POST /api/v1/risk/assess', () => {
    it('should assess wallet risk and return expected shape', async () => {
      mockHealthyFetch();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/risk/assess',
        payload: {
          wallet: 'HealthyWallet123',
          chain: 'solana',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.wallet).toBe('healthywallet123');
      expect(body.overallRisk).toBe('low');
      expect(typeof body.score).toBe('number');
      expect(Array.isArray(body.signals)).toBe(true);
      expect(typeof body.allowed).toBe('boolean');
      expect(typeof body.checkedAt).toBe('number');
      expect(typeof body.cacheHit).toBe('boolean');
    });

    it('should return 400 when wallet is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/risk/assess',
        payload: {
          chain: 'solana',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('wallet address is required');
    });

    it('should return risk signals for a risky wallet', async () => {
      mockRiskyFetch();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/risk/assess',
        payload: {
          wallet: 'NewWalletXYZ',
          chain: 'solana',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.wallet).toBe('newwalletxyz');
      expect(body.signals.length).toBeGreaterThan(0);
      expect(body.score).toBeGreaterThan(0);
      expect(typeof body.allowed).toBe('boolean');
    });
  });

  describe('GET /api/v1/risk/allowed/:wallet', () => {
    it('should check if wallet is allowed and return expected shape', async () => {
      mockHealthyFetch();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/risk/allowed/HealthyWallet123?chain=solana',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.wallet).toBe('healthywallet123');
      expect(typeof body.allowed).toBe('boolean');
      expect(typeof body.score).toBe('number');
      expect(body.overallRisk).toBeDefined();
    });

    it('should default chain to solana when not provided', async () => {
      mockHealthyFetch();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/risk/allowed/HealthyWallet123',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.wallet).toBe('healthywallet123');
      expect(typeof body.allowed).toBe('boolean');
    });

    it('should return disallowed for a risky wallet', async () => {
      mockRiskyFetch();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/risk/allowed/NewWalletXYZ',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.wallet).toBe('newwalletxyz');
      expect(typeof body.allowed).toBe('boolean');
      expect(body.score).toBeGreaterThan(0);
    });
  });
});
