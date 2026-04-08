/**
 * Identity Binding API Routes — GRA-262
 *
 * Wallet-to-Account binding, tier resolution, and ZK-KYC wiring.
 */

import type { FastifyInstance } from 'fastify';
import {
  createAccountBindingStore,
  createVerificationTierResolver,
  COOLDOWN_MS,
  type BindRequest,
} from '../../identity/account-binding.js';
import { logger } from '../../utils/logger.js';
import type Database from 'better-sqlite3';

const resolver = createVerificationTierResolver();

export function registerIdentityRoutes(app: FastifyInstance, db: Database.Database): void {
  const store = createAccountBindingStore(db);

  // -------------------------------------------------------------------------
  // Bind wallet + OAuth identity
  // -------------------------------------------------------------------------
  app.post<{
    Body: { accountId: string; primaryWallet: string; oauthHash?: string; signature: string };
  }>('/api/v1/identity/bind', async (request, reply) => {
    try {
      const { accountId, primaryWallet, oauthHash, signature } = request.body;

      if (!accountId || !primaryWallet || !signature) {
        return reply.code(400).send({ error: 'accountId, primaryWallet, and signature are required' });
      }

      // Anti-Sybil checks
      if (store.isBound(primaryWallet)) {
        return reply.code(409).send({ error: 'Wallet already bound to another account' });
      }
      if (oauthHash && store.isBound(undefined, oauthHash)) {
        return reply.code(409).send({ error: 'OAuth identity already bound to another account' });
      }

      const record = store.bind({ accountId, primaryWallet, oauthHash, signature });
      return {
        accountId: record.accountId,
        primaryWallet: record.primaryWallet,
        createdAt: record.createdAt,
      };
    } catch (err: any) {
      logger.error({ err }, 'Failed to bind identity');
      return reply.code(500).send({ error: err.message || 'Binding failed' });
    }
  });

  // -------------------------------------------------------------------------
  // Verify ZK-KYC nullifier
  // -------------------------------------------------------------------------
  app.post<{
    Body: { accountId: string; nullifierHash: string };
  }>('/api/v1/identity/zk-verify', async (request, reply) => {
    try {
      const { accountId, nullifierHash } = request.body;

      if (!accountId || !nullifierHash) {
        return reply.code(400).send({ error: 'accountId and nullifierHash are required' });
      }

      const existing = store.getByZkNullifier(nullifierHash);
      if (existing && existing.accountId !== accountId) {
        return reply.code(409).send({ error: 'Nullifier already used by another account' });
      }

      const account = store.getByAccountId(accountId);
      if (!account) {
        return reply.code(404).send({ error: 'Account not found' });
      }

      store.setZkNullifier(accountId, nullifierHash);
      return { accountId, zkVerified: true, nullifierHash };
    } catch (err: any) {
      logger.error({ err }, 'Failed to verify ZK nullifier');
      return reply.code(500).send({ error: err.message || 'ZK verification failed' });
    }
  });

  // -------------------------------------------------------------------------
  // Resolve current verification tier
  // -------------------------------------------------------------------------
  app.get<{
    Params: { accountId: string };
  }>('/api/v1/identity/tier/:accountId', async (request, reply) => {
    try {
      const { accountId } = request.params;
      const account = store.getByAccountId(accountId);
      if (!account) {
        return reply.code(404).send({ error: 'Account not found' });
      }

      // In production, walletAgeDays and completedTasks would come from indexer/reputation service
      const walletAgeDays = Math.floor((Date.now() - account.createdAt) / (24 * 60 * 60 * 1000));
      const metrics = {
        walletAgeDays,
        oauthBound: !!account.oauthHash,
        zkKycBound: !!account.zkNullifier,
        completedTasks: 0, // TODO: integrate with reputation store
        reputationScore: 0, // TODO: integrate with reputation store
      };

      const tier = resolver.resolve(metrics);
      return {
        accountId,
        tier: tier.tier,
        permissions: tier.permissions,
        requirements: tier.requirements,
        metrics,
      };
    } catch (err: any) {
      logger.error({ err }, 'Failed to resolve tier');
      return reply.code(500).send({ error: err.message || 'Tier resolution failed' });
    }
  });

  // -------------------------------------------------------------------------
  // Get binding info by wallet
  // -------------------------------------------------------------------------
  app.get<{
    Params: { wallet: string };
  }>('/api/v1/identity/binding/:wallet', async (request, reply) => {
    try {
      const record = store.getByWallet(request.params.wallet);
      if (!record) {
        return reply.code(404).send({ error: 'Binding not found' });
      }
      return {
        accountId: record.accountId,
        primaryWallet: record.primaryWallet,
        oauthBound: !!record.oauthHash,
        zkKycBound: !!record.zkNullifier,
        createdAt: record.createdAt,
        cooldownRemainingMs: Math.max(0, COOLDOWN_MS - (Date.now() - record.lastWalletChangeAt)),
      };
    } catch (err: any) {
      logger.error({ err }, 'Failed to get binding');
      return reply.code(500).send({ error: err.message || 'Binding lookup failed' });
    }
  });

  logger.info('Identity API routes registered: /api/v1/identity/*');
}
