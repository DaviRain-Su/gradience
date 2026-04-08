import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { registerMagicBlockRoutes } from '../../../src/api/routes/magicblock.js';

describe('MagicBlock API Routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(() => {
    app = Fastify();
    registerMagicBlockRoutes(app);
  });

  it('should create an ER session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/magicblock/session',
      payload: { mode: 'er', accounts: ['acc1', 'acc2'] },
    });
    expect(res.statusCode).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe('er');
    expect(body.state).toBe('initializing');
    expect(body.id).toContain('er-');
  });

  it('should create an L1 session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/magicblock/session',
      payload: { mode: 'l1', accounts: [] },
    });
    expect(res.statusCode).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe('l1');
    expect(body.state).toBe('active');
  });

  it('should reject invalid mode', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/magicblock/session',
      payload: { mode: 'invalid', accounts: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('should get session by id', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/magicblock/session',
      payload: { mode: 'er', accounts: [] },
    });
    const { id } = await createRes.json();

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/magicblock/session/${id}`,
    });
    expect(getRes.statusCode).toBe(200);
    const body = await getRes.json();
    expect(body.id).toBe(id);
  });

  it('should return 404 for unknown session', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/magicblock/session/unknown-id',
    });
    expect(res.statusCode).toBe(404);
  });

  it('should delete a session', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/magicblock/session',
      payload: { mode: 'er', accounts: [] },
    });
    const { id } = await createRes.json();

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/magicblock/session/${id}`,
    });
    expect(delRes.statusCode).toBe(200);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/magicblock/session/${id}`,
    });
    expect(getRes.statusCode).toBe(404);
  });
});
