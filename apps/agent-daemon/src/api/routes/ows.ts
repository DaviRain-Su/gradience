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
import { logger } from '../../utils/logger.js';

const bridge = new OWSSdkBridge();

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

  // ── Signing ──

  app.post<{
    Body: {
      wallet: string;
      chain: string;
      message: string;
      credential?: string;
    };
  }>('/api/v1/ows/sign/message', async (request, reply) => {
    try {
      const { wallet, chain, message, credential } = request.body;
      const result = bridge.signAgentMessage(wallet, chain, message, credential);
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
    };
  }>('/api/v1/ows/sign/transaction', async (request, reply) => {
    try {
      const { wallet, chain, txHex, credential } = request.body;
      const result = bridge.signAgentTransaction(wallet, chain, txHex, credential);
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
    };
  }>('/api/v1/ows/sign/send', async (request, reply) => {
    try {
      const { wallet, chain, txHex, credential, rpcUrl } = request.body;
      const result = bridge.signAndSendTransaction(wallet, chain, txHex, credential, rpcUrl);
      return result;
    } catch (err: any) {
      logger.error({ err }, 'OWS sign and send failed');
      return reply.code(500).send({ error: err.message });
    }
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

  logger.info('OWS routes registered: /api/v1/ows/*');
}
