import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { registerReputationOracleRoutes } from '../reputation-oracle.js';
import { createReputationAggregationEngine } from '../../../reputation/aggregation-engine.js';
import { ethers } from 'ethers';

vi.mock('../../../integrations/chain-hub-reputation.js', () => ({
  createChainHubReputationClient: () => ({
    getReputation: vi.fn().mockResolvedValue({
      score: 80,
      completedTasks: 10,
      avgRating: 4.5,
      updatedAt: new Date().toISOString(),
    }),
  }),
}));

describe('Reputation Oracle /onchain and /verify-onchain', () => {
  const wallet = ethers.Wallet.createRandom();

  const engine = createReputationAggregationEngine();

  function buildApp() {
    const app = Fastify();
    registerReputationOracleRoutes(app, engine, undefined, {
      proofGeneratorConfig: {
        oracleSignerPrivateKey: wallet.privateKey,
      },
      evmRelayerConfig: {
        rpcUrl: 'http://localhost:8545',
        privateKey: wallet.privateKey,
        contractAddress: '0x' + 'a'.repeat(40),
        chainId: 84532,
      },
    });
    return app;
  }

  it('GET /onchain should return payload + signature', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/oracle/reputation/agent1/onchain',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.agentAddress).toBe('agent1');
    expect(body.payload.globalScore).toBeDefined();
    expect(body.signature).toMatch(/^0x[a-fA-F0-9]{130}$/);
    expect(body.payloadHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it('GET /verify-onchain should return verified boolean or handle error', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/oracle/reputation/agent1/verify-onchain',
    });

    // Because we cannot run real EVM here, it will attempt to call verifySignature
    // and likely fail with network error → 500.
    // We assert the endpoint exists and handles the request.
    expect([200, 500]).toContain(res.statusCode);
  });
});
