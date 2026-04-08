import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import Database from 'better-sqlite3';
import { registerIdentityRoutes } from '../../../src/api/routes/identity.js';

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Identity Routes', () => {
  let app: ReturnType<typeof Fastify>;
  let db: Database.Database;

  beforeEach(() => {
    app = Fastify({ logger: false });
    db = new Database(':memory:');
    registerIdentityRoutes(app, db);
  });

  describe('POST /api/v1/identity/bind', () => {
    it('should bind a new identity successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/identity/bind',
        payload: {
          accountId: 'acc-1',
          primaryWallet: '0xAbC',
          oauthHash: 'sha256-google-1',
          signature: 'sig-1',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.accountId).toBe('acc-1');
      expect(body.primaryWallet).toBe('0xabc');
      expect(body.createdAt).toBeDefined();
    });

    it('should return 400 for missing fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/identity/bind',
        payload: {
          accountId: 'acc-1',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('accountId, primaryWallet, and signature are required');
    });

    it('should return 409 for duplicate wallet', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/identity/bind',
        payload: {
          accountId: 'acc-1',
          primaryWallet: '0xAbC',
          signature: 'sig-1',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/identity/bind',
        payload: {
          accountId: 'acc-2',
          primaryWallet: '0xAbC',
          signature: 'sig-2',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Wallet already bound to another account');
    });

    it('should return 409 for duplicate oauth hash', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/identity/bind',
        payload: {
          accountId: 'acc-1',
          primaryWallet: '0x111',
          oauthHash: 'sha256-google-1',
          signature: 'sig-1',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/identity/bind',
        payload: {
          accountId: 'acc-2',
          primaryWallet: '0x222',
          oauthHash: 'sha256-google-1',
          signature: 'sig-2',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('OAuth identity already bound to another account');
    });
  });

  describe('POST /api/v1/identity/zk-verify', () => {
    it('should verify ZK nullifier successfully', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/identity/bind',
        payload: {
          accountId: 'acc-zk',
          primaryWallet: '0xZk',
          signature: 'sig-zk',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/identity/zk-verify',
        payload: {
          accountId: 'acc-zk',
          nullifierHash: 'nullifier-abc',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.accountId).toBe('acc-zk');
      expect(body.zkVerified).toBe(true);
      expect(body.nullifierHash).toBe('nullifier-abc');
    });

    it('should return 400 for missing fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/identity/zk-verify',
        payload: {
          accountId: 'acc-zk',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('accountId and nullifierHash are required');
    });

    it('should return 409 when nullifier already used by another account', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/identity/bind',
        payload: {
          accountId: 'acc-a',
          primaryWallet: '0xAa',
          signature: 'sig-a',
        },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/identity/bind',
        payload: {
          accountId: 'acc-b',
          primaryWallet: '0xBb',
          signature: 'sig-b',
        },
      });

      await app.inject({
        method: 'POST',
        url: '/api/v1/identity/zk-verify',
        payload: {
          accountId: 'acc-a',
          nullifierHash: 'nullifier-shared',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/identity/zk-verify',
        payload: {
          accountId: 'acc-b',
          nullifierHash: 'nullifier-shared',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Nullifier already used by another account');
    });

    it('should return 404 when account not found', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/identity/zk-verify',
        payload: {
          accountId: 'nonexistent',
          nullifierHash: 'nullifier-xyz',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Account not found');
    });
  });

  describe('GET /api/v1/identity/tier/:accountId', () => {
    it('should return tier info for existing account', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/identity/bind',
        payload: {
          accountId: 'acc-tier',
          primaryWallet: '0xTier',
          oauthHash: 'oauth-tier',
          signature: 'sig-tier',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/identity/tier/acc-tier',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.accountId).toBe('acc-tier');
      expect(body.tier).toBeDefined();
      expect(body.permissions).toBeDefined();
      expect(body.requirements).toBeDefined();
      expect(body.metrics).toBeDefined();
      expect(body.metrics.oauthBound).toBe(true);
    });

    it('should return 404 when account not found', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/identity/tier/nonexistent',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Account not found');
    });
  });

  describe('GET /api/v1/identity/binding/:wallet', () => {
    it('should return binding info for existing wallet', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/identity/bind',
        payload: {
          accountId: 'acc-binding',
          primaryWallet: '0xBinding',
          oauthHash: 'oauth-binding',
          signature: 'sig-binding',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/identity/binding/0xBinding',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.accountId).toBe('acc-binding');
      expect(body.primaryWallet).toBe('0xbinding');
      expect(body.oauthBound).toBe(true);
      expect(body.zkKycBound).toBe(false);
      expect(body.createdAt).toBeDefined();
      expect(typeof body.cooldownRemainingMs).toBe('number');
    });

    it('should return 404 when binding not found', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/identity/binding/0xNonExistent',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Binding not found');
    });
  });
});
