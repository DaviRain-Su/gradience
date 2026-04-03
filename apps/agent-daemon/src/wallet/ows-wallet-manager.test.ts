/**
 * OWS Wallet Manager Tests
 *
 * @module wallet/ows-wallet-manager.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import {
  OWSWalletManager,
  calculatePolicy,
  getReputationTier,
  type ReputationData,
} from './ows-wallet-manager.js';

describe('OWSWalletManager', () => {
  let db: Database.Database;
  let manager: OWSWalletManager;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'ows-wallet-test-'));
    db = new Database(join(tmpDir, 'test.db'));
    manager = new OWSWalletManager(db);
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('wallet creation', () => {
    it('should create a new wallet', async () => {
      const wallet = await manager.createWallet({
        agentId: 'agent-123',
        parentWallet: 'parent-wallet-address',
        name: 'test-wallet',
        initialReputation: 75,
      });

      expect(wallet.agentId).toBe('agent-123');
      expect(wallet.parentWallet).toBe('parent-wallet-address');
      expect(wallet.name).toBe('test-wallet');
      expect(wallet.reputationScore).toBe(75);
      expect(wallet.policy.dailyLimit).toBe(750);
      expect(wallet.policy.maxTransaction).toBe(150);
    });

    it('should use default reputation of 50', async () => {
      const wallet = await manager.createWallet({
        agentId: 'agent-456',
        parentWallet: 'parent-wallet',
        name: 'default-wallet',
      });

      expect(wallet.reputationScore).toBe(50);
    });

    it('should throw if wallet already exists for agent', async () => {
      await manager.createWallet({
        agentId: 'agent-duplicate',
        parentWallet: 'parent',
        name: 'first',
      });

      await expect(
        manager.createWallet({
          agentId: 'agent-duplicate',
          parentWallet: 'parent',
          name: 'second',
        })
      ).rejects.toThrow('Wallet already exists');
    });
  });

  describe('wallet retrieval', () => {
    it('should get wallet by agent ID', async () => {
      const created = await manager.createWallet({
        agentId: 'agent-get',
        parentWallet: 'parent',
        name: 'get-wallet',
      });

      const retrieved = manager.getWallet('agent-get');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent agent', () => {
      const wallet = manager.getWallet('non-existent');
      expect(wallet).toBeNull();
    });

    it('should get wallet by address', async () => {
      const created = await manager.createWallet({
        agentId: 'agent-by-addr',
        parentWallet: 'parent',
        name: 'by-addr-wallet',
      });

      const retrieved = manager.getWalletByAddress(created.address);
      expect(retrieved?.id).toBe(created.id);
    });

    it('should list wallets by parent', async () => {
      await manager.createWallet({
        agentId: 'agent-1',
        parentWallet: 'shared-parent',
        name: 'wallet-1',
      });
      await manager.createWallet({
        agentId: 'agent-2',
        parentWallet: 'shared-parent',
        name: 'wallet-2',
      });

      const wallets = manager.listWallets('shared-parent');
      expect(wallets).toHaveLength(2);
    });
  });

  describe('reputation updates', () => {
    it('should update reputation and recalculate policy', async () => {
      await manager.createWallet({
        agentId: 'agent-rep',
        parentWallet: 'parent',
        name: 'rep-wallet',
        initialReputation: 50,
      });

      const newRep: ReputationData = {
        score: 85,
        completed: 10,
        totalApplied: 12,
        winRate: 83,
        totalEarned: 5000,
      };

      const updated = await manager.updateReputation('agent-rep', newRep, 'task_completed');

      expect(updated).not.toBeNull();
      expect(updated?.reputationScore).toBe(85);
      expect(updated?.policy.dailyLimit).toBe(850);
      expect(updated?.policy.requireApproval).toBe(false);
    });

    it('should not update if score unchanged', async () => {
      await manager.createWallet({
        agentId: 'agent-no-change',
        parentWallet: 'parent',
        name: 'no-change-wallet',
        initialReputation: 60,
      });

      const newRep: ReputationData = {
        score: 60,
        completed: 5,
        totalApplied: 5,
        winRate: 100,
        totalEarned: 1000,
      };

      const updated = await manager.updateReputation('agent-no-change', newRep);
      expect(updated?.reputationScore).toBe(60);
    });

    it('should record reputation history', async () => {
      const wallet = await manager.createWallet({
        agentId: 'agent-history',
        parentWallet: 'parent',
        name: 'history-wallet',
        initialReputation: 40,
      });

      await manager.updateReputation(
        'agent-history',
        { score: 60, completed: 5, totalApplied: 5, winRate: 100, totalEarned: 1000 },
        'level_up'
      );

      const history = manager.getReputationHistory(wallet.id);
      expect(history).toHaveLength(1);
      expect(history[0].oldScore).toBe(40);
      expect(history[0].newScore).toBe(60);
      expect(history[0].reason).toBe('level_up');
    });
  });

  describe('transaction management', () => {
    it('should record and confirm transaction', async () => {
      const wallet = await manager.createWallet({
        agentId: 'agent-tx',
        parentWallet: 'parent',
        name: 'tx-wallet',
      });

      const tx = await manager.recordTransaction({
        walletId: wallet.id,
        agentId: wallet.agentId,
        type: 'incoming',
        amount: '1000000',
        token: 'USDC',
        txHash: 'tx-hash-123',
      });

      expect(tx.status).toBe('pending');

      await manager.confirmTransaction(tx.id);

      const transactions = manager.getTransactions(wallet.id);
      expect(transactions[0].status).toBe('confirmed');
    });

    it('should fail transaction', async () => {
      const wallet = await manager.createWallet({
        agentId: 'agent-fail',
        parentWallet: 'parent',
        name: 'fail-wallet',
      });

      const tx = await manager.recordTransaction({
        walletId: wallet.id,
        agentId: wallet.agentId,
        type: 'outgoing',
        amount: '500000',
        token: 'USDC',
        txHash: 'tx-fail',
      });

      await manager.failTransaction(tx.id);

      const transactions = manager.getTransactions(wallet.id);
      expect(transactions[0].status).toBe('failed');
    });
  });

  describe('spending limits', () => {
    it('should track daily spend', async () => {
      const wallet = await manager.createWallet({
        agentId: 'agent-spend',
        parentWallet: 'parent',
        name: 'spend-wallet',
      });

      manager.recordSpend(wallet.id, 1000);
      manager.recordSpend(wallet.id, 500);

      const dailySpend = manager.getDailySpend(wallet.id);
      expect(dailySpend).toBe(1500);
    });

    it('should allow transaction within limits', async () => {
      const wallet = await manager.createWallet({
        agentId: 'agent-allow',
        parentWallet: 'parent',
        name: 'allow-wallet',
        initialReputation: 80,
      });

      const check = manager.checkTransactionLimits(
        wallet,
        500, // $5.00
        'solana',
        'USDC'
      );

      expect(check.allowed).toBe(true);
    });

    it('should reject transaction exceeding max', async () => {
      const wallet = await manager.createWallet({
        agentId: 'agent-reject',
        parentWallet: 'parent',
        name: 'reject-wallet',
        initialReputation: 30,
      });

      // Max transaction for score 30 is $0.60
      const check = manager.checkTransactionLimits(
        wallet,
        100, // $1.00
        'solana',
        'USDC'
      );

      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('exceeds max transaction');
    });

    it('should reject disallowed chain', async () => {
      const wallet = await manager.createWallet({
        agentId: 'agent-chain',
        parentWallet: 'parent',
        name: 'chain-wallet',
        initialReputation: 30,
      });

      const check = manager.checkTransactionLimits(
        wallet,
        100,
        'ethereum', // Not allowed for bronze tier
        'USDC'
      );

      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Chain ethereum not allowed');
    });
  });
});

describe('Policy Calculation', () => {
  describe('calculatePolicy', () => {
    it('should calculate platinum tier policy', () => {
      const policy = calculatePolicy(85);
      expect(policy.dailyLimit).toBe(850);
      expect(policy.maxTransaction).toBe(170);
      expect(policy.requireApproval).toBe(false);
      expect(policy.allowedTokens).toBeNull();
    });

    it('should calculate gold tier policy', () => {
      const policy = calculatePolicy(65);
      expect(policy.dailyLimit).toBe(650);
      expect(policy.maxTransaction).toBe(130);
      expect(policy.requireApproval).toBe(false);
      expect(policy.allowedTokens).toContain('ETH');
    });

    it('should calculate silver tier policy', () => {
      const policy = calculatePolicy(45);
      expect(policy.dailyLimit).toBe(450);
      expect(policy.maxTransaction).toBe(90);
      expect(policy.requireApproval).toBe(true);
    });

    it('should calculate bronze tier policy', () => {
      const policy = calculatePolicy(20);
      expect(policy.dailyLimit).toBe(300); // Minimum
      expect(policy.maxTransaction).toBe(60); // Minimum
      expect(policy.requireApproval).toBe(true);
      expect(policy.allowedChains).toEqual(['solana']);
    });

    it('should clamp score to 0-100', () => {
      const over = calculatePolicy(150);
      expect(over.dailyLimit).toBe(1000);

      const under = calculatePolicy(-10);
      expect(under.dailyLimit).toBe(300);
    });
  });

  describe('getReputationTier', () => {
    it('should return platinum for 81+', () => {
      expect(getReputationTier(81)).toBe('platinum');
      expect(getReputationTier(100)).toBe('platinum');
    });

    it('should return gold for 51-80', () => {
      expect(getReputationTier(51)).toBe('gold');
      expect(getReputationTier(80)).toBe('gold');
    });

    it('should return silver for 31-50', () => {
      expect(getReputationTier(31)).toBe('silver');
      expect(getReputationTier(50)).toBe('silver');
    });

    it('should return bronze for 0-30', () => {
      expect(getReputationTier(0)).toBe('bronze');
      expect(getReputationTier(30)).toBe('bronze');
    });
  });
});
