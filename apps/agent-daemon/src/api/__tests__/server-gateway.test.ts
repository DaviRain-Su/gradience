import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import { registerGatewayRoutes } from '../routes/gateway.js';

describe('Gateway API Routes', () => {
  function buildApp(gateway: any) {
    const app = Fastify();
    if (gateway) {
      registerGatewayRoutes(app, gateway);
    }
    return app;
  }

  it('GET /api/v1/gateway/purchases/:purchaseId returns record', async () => {
    const gateway = {
      getStatus: vi.fn().mockResolvedValue({
        purchaseId: 'p1',
        status: 'SETTLING',
      }),
    };
    const app = buildApp(gateway);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/gateway/purchases/p1',
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).purchaseId).toBe('p1');
  });

  it('GET /api/v1/gateway/purchases/:purchaseId returns 404 when not found', async () => {
    const gateway = { getStatus: vi.fn().mockResolvedValue(null) };
    const app = buildApp(gateway);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/gateway/purchases/missing',
    });

    expect(res.statusCode).toBe(404);
  });

  it('POST /api/v1/gateway/purchases/:purchaseId/retry returns success', async () => {
    const gateway = { retry: vi.fn().mockResolvedValue(true) };
    const app = buildApp(gateway);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/gateway/purchases/p1/retry',
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).success).toBe(true);
  });

  it('returns 404 when gateway routes are not registered', async () => {
    const app = buildApp(null);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/gateway/purchases/p1',
    });

    expect(res.statusCode).toBe(404);
  });
});
