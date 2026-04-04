/**
 * OWS Wallet, Policy, and API Key routes
 *
 * Exposes the @open-wallet-standard/core SDK through REST endpoints
 * so the frontend and agents can manage wallets, policies, and keys.
 *
 * @module api/routes/ows
 */

import type { FastifyInstance } from 'fastify';
import { OWSSdkBridge } from '../../wallet/ows-sdk-bridge.js';
import { PolicyEngine, recordPolicySpend, type SigningContext } from '../../wallet/policy-engine.js';
import { logger } from '../../utils/logger.js';

const bridge = new OWSSdkBridge();
const policyEngine = new PolicyEngine();

export function registerOWSRoutes(app: FastifyInstance): void {
  // ── Wallet CRUD ──

  app.post<{
    Body: { name: string; passphrase?: string };
  }>('/api/v1/ows/wallets', async (request, reply) => {
    try {
      const { name, passphrase } = request.body;
      if (!name || typeof name !== 'string') {
        return reply.code(400).send({ error: 'name is required' });
      }
      const wallet = bridge.createAgentWallet(name, passphrase);
      return { wallet, solanaAddress: bridge.getSolanaAddress(wallet) };
    } catch (err: any) {
      logger.error({ err }, 'Failed to create OWS wallet');
      return reply.code(500).send({ error: err.message });
    }
  });

  app.get('/api/v1/ows/wallets', async (_req, reply) => {
    try {
      const wallets = bridge.listAgentWallets();
      return { wallets };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  app.get<{ Params: { id: string } }>('/api/v1/ows/wallets/:id', async (request, reply) => {
    try {
      const wallet = bridge.getAgentWallet(request.params.id);
      return { wallet, solanaAddress: bridge.getSolanaAddress(wallet) };
    } catch (err: any) {
      return reply.code(404).send({ error: err.message });
    }
  });

  app.delete<{ Params: { id: string } }>('/api/v1/ows/wallets/:id', async (request, reply) => {
    try {
      bridge.deleteAgentWallet(request.params.id);
      return { ok: true };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  app.post<{
    Body: { nameOrId: string; passphrase?: string };
  }>('/api/v1/ows/wallets/export', async (request, reply) => {
    try {
      const { nameOrId, passphrase } = request.body;
      const secret = bridge.exportAgentWallet(nameOrId, passphrase);
      return { secret };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  app.post<{
    Body: { name: string; mnemonic: string; passphrase?: string };
  }>('/api/v1/ows/wallets/import/mnemonic', async (request, reply) => {
    try {
      const { name, mnemonic, passphrase } = request.body;
      const wallet = bridge.importFromMnemonic(name, mnemonic, passphrase);
      return { wallet, solanaAddress: bridge.getSolanaAddress(wallet) };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  app.post<{
    Body: { name: string; privateKeyHex: string; chain?: string; passphrase?: string };
  }>('/api/v1/ows/wallets/import/private-key', async (request, reply) => {
    try {
      const { name, privateKeyHex, chain, passphrase } = request.body;
      const wallet = bridge.importFromPrivateKey(name, privateKeyHex, chain, passphrase);
      return { wallet, solanaAddress: bridge.getSolanaAddress(wallet) };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── Signing (policy-gated) ──

  app.post<{
    Body: {
      wallet: string;
      chain: string;
      message: string;
      credential?: string;
      policyIds?: string[];
      amount?: number;
      program?: string;
    };
  }>('/api/v1/ows/sign/message', async (request, reply) => {
    try {
      const { wallet, chain, message, credential, policyIds, amount, program } = request.body;

      const ctx: SigningContext = {
        chain,
        walletId: wallet,
        operation: 'sign_message',
        amount,
        program,
        payload: message,
        timestamp: Date.now(),
      };

      if (policyIds && policyIds.length > 0) {
        const policies = policyIds.map(id => bridge.getSigningPolicy(id));
        const evaluation = await policyEngine.evaluate(policies, ctx);
        if (!evaluation.allowed) {
          return reply.code(403).send({
            error: 'POLICY_DENIED',
            evaluation,
          });
        }
      }

      const result = bridge.signAgentMessage(wallet, chain, message, credential);
      if (amount) recordPolicySpend(wallet, amount);
      return result;
    } catch (err: any) {
      logger.error({ err }, 'OWS sign message failed');
      return reply.code(403).send({ error: err.message });
    }
  });

  app.post<{
    Body: {
      wallet: string;
      chain: string;
      txHex: string;
      credential?: string;
      policyIds?: string[];
      amount?: number;
      program?: string;
    };
  }>('/api/v1/ows/sign/transaction', async (request, reply) => {
    try {
      const { wallet, chain, txHex, credential, policyIds, amount, program } = request.body;

      const ctx: SigningContext = {
        chain,
        walletId: wallet,
        operation: 'sign_transaction',
        amount,
        program,
        payload: txHex,
        timestamp: Date.now(),
      };

      if (policyIds && policyIds.length > 0) {
        const policies = policyIds.map(id => bridge.getSigningPolicy(id));
        const evaluation = await policyEngine.evaluate(policies, ctx);
        if (!evaluation.allowed) {
          return reply.code(403).send({
            error: 'POLICY_DENIED',
            evaluation,
          });
        }
      }

      const result = bridge.signAgentTransaction(wallet, chain, txHex, credential);
      if (amount) recordPolicySpend(wallet, amount);
      return result;
    } catch (err: any) {
      logger.error({ err }, 'OWS sign transaction failed');
      return reply.code(403).send({ error: err.message });
    }
  });

  app.post<{
    Body: {
      wallet: string;
      chain: string;
      txHex: string;
      credential?: string;
      rpcUrl?: string;
      policyIds?: string[];
      amount?: number;
      program?: string;
    };
  }>('/api/v1/ows/sign/send', async (request, reply) => {
    try {
      const { wallet, chain, txHex, credential, rpcUrl, policyIds, amount, program } = request.body;

      const ctx: SigningContext = {
        chain,
        walletId: wallet,
        operation: 'sign_and_send',
        amount,
        program,
        payload: txHex,
        timestamp: Date.now(),
      };

      if (policyIds && policyIds.length > 0) {
        const policies = policyIds.map(id => bridge.getSigningPolicy(id));
        const evaluation = await policyEngine.evaluate(policies, ctx);
        if (!evaluation.allowed) {
          return reply.code(403).send({
            error: 'POLICY_DENIED',
            evaluation,
          });
        }
      }

      const result = bridge.signAndSendTransaction(wallet, chain, txHex, credential, rpcUrl);
      if (amount) recordPolicySpend(wallet, amount);
      return result;
    } catch (err: any) {
      logger.error({ err }, 'OWS sign and send failed');
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── Policy Audit Log ──

  app.get('/api/v1/ows/audit', async (request) => {
    const limit = (request.query as any)?.limit ?? 50;
    return { log: policyEngine.getAuditLog(Number(limit)) };
  });

  // ── Policy Management ──

  app.post<{
    Body: {
      id: string;
      name: string;
      rules?: Array<{ type: string; [key: string]: unknown }>;
      executable?: string | null;
      config?: Record<string, unknown> | null;
    };
  }>('/api/v1/ows/policies', async (request, reply) => {
    try {
      const { id, name, rules, executable, config } = request.body;
      bridge.createSigningPolicy({
        id,
        name,
        version: 1,
        created_at: new Date().toISOString(),
        rules,
        executable,
        config,
        action: 'deny',
      });
      return { ok: true, id };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  app.get('/api/v1/ows/policies', async (_req, reply) => {
    try {
      return { policies: bridge.listSigningPolicies() };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  app.get<{ Params: { id: string } }>('/api/v1/ows/policies/:id', async (request, reply) => {
    try {
      return { policy: bridge.getSigningPolicy(request.params.id) };
    } catch (err: any) {
      return reply.code(404).send({ error: err.message });
    }
  });

  app.delete<{ Params: { id: string } }>('/api/v1/ows/policies/:id', async (request, reply) => {
    try {
      bridge.deleteSigningPolicy(request.params.id);
      return { ok: true };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── API Key Management ──

  app.post<{
    Body: {
      name: string;
      walletIds: string[];
      policyIds: string[];
      passphrase: string;
      expiresAt?: string;
    };
  }>('/api/v1/ows/keys', async (request, reply) => {
    try {
      const { name, walletIds, policyIds, passphrase, expiresAt } = request.body;
      const result = bridge.createAgentApiKey(name, walletIds, policyIds, passphrase, expiresAt);
      return result;
    } catch (err: any) {
      logger.error({ err }, 'Failed to create OWS API key');
      return reply.code(500).send({ error: err.message });
    }
  });

  app.get('/api/v1/ows/keys', async (_req, reply) => {
    try {
      return { keys: bridge.listAgentApiKeys() };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  app.delete<{ Params: { id: string } }>('/api/v1/ows/keys/:id', async (request, reply) => {
    try {
      bridge.revokeAgentApiKey(request.params.id);
      return { ok: true };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── Utility ──

  app.post<{
    Body: { words?: 12 | 24 };
  }>('/api/v1/ows/mnemonic/generate', async (request) => {
    const words = request.body?.words ?? 12;
    return { mnemonic: bridge.generateNewMnemonic(words) };
  });

  app.post<{
    Body: { mnemonic: string; chain: string; index?: number };
  }>('/api/v1/ows/derive', async (request) => {
    const { mnemonic, chain, index } = request.body;
    return { address: bridge.deriveWalletAddress(mnemonic, chain, index ?? 0) };
  });

  // u2500u2500 Wallet Lifecycle (GRA-223) u2500u2500

  app.post<{
    Body: {
      walletId: string;
      passphrase: string;
      defaultPolicyIds?: string[];
    };
  }>('/api/v1/ows/wallets/provision-agent', async (request, reply) => {
    try {
      const { walletId, passphrase, defaultPolicyIds } = request.body;
      const wallet = bridge.getAgentWallet(walletId);
      const policyIds = defaultPolicyIds ?? [];
      const key = bridge.createAgentApiKey(
        `agent-${wallet.name}`,
        [walletId],
        policyIds,
        passphrase,
      );
      return {
        wallet,
        solanaAddress: bridge.getSolanaAddress(wallet),
        apiKey: { id: key.id, name: key.name, token: key.token },
      };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  app.post<{
    Body: {
      name: string;
      localStorageExport: {
        secretKey: number[];
        handle?: string;
      };
    };
  }>('/api/v1/ows/wallets/migrate', async (request, reply) => {
    try {
      const { name, localStorageExport } = request.body;
      const hexKey = Buffer.from(localStorageExport.secretKey).toString('hex');
      const wallet = bridge.importFromPrivateKey(name, hexKey, 'solana');
      return {
        wallet,
        solanaAddress: bridge.getSolanaAddress(wallet),
        migrated: true,
        handle: localStorageExport.handle ?? null,
      };
    } catch (err: any) {
      logger.error({ err }, 'Migration from localStorage failed');
      return reply.code(500).send({ error: err.message });
    }
  });

  app.delete<{
    Params: { id: string };
    Querystring: { revokeKeys?: string };
  }>('/api/v1/ows/wallets/:id/cascade', async (request, reply) => {
    try {
      const walletId = request.params.id;
      const revokeKeys = (request.query as any)?.revokeKeys !== 'false';

      if (revokeKeys) {
        const keys = bridge.listAgentApiKeys();
        for (const key of keys) {
          if (key.walletIds.includes(walletId)) {
            bridge.revokeAgentApiKey(key.id);
          }
        }
      }

      bridge.deleteAgentWallet(walletId);
      return { ok: true, walletDeleted: true, keysRevoked: revokeKeys };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  app.post<{
    Body: { keyId: string; passphrase: string; policyIds?: string[] };
  }>('/api/v1/ows/keys/rotate', async (request, reply) => {
    try {
      const { keyId, passphrase, policyIds } = request.body;
      const keys = bridge.listAgentApiKeys();
      const oldKey = keys.find(k => k.id === keyId);
      if (!oldKey) {
        return reply.code(404).send({ error: 'Key not found' });
      }

      const newKey = bridge.createAgentApiKey(
        oldKey.name,
        oldKey.walletIds,
        policyIds ?? oldKey.policyIds,
        passphrase,
      );

      bridge.revokeAgentApiKey(keyId);

      return {
        oldKeyRevoked: keyId,
        newKey: { id: newKey.id, name: newKey.name, token: newKey.token },
      };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  logger.info('OWS routes registered: /api/v1/ows/*');
}
