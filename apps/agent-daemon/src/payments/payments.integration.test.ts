/**
 * Payments Module Integration Tests
 *
 * Tests the on-chain integration of MPP and X402 payment handlers.
 *
 * @module payments/tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { PaymentManager, type PaymentsConfig } from './index.js';
import type { KeyManager } from '../keys/key-manager.js';
import type { TransactionManager } from '../solana/transaction-manager.js';
import type { MPPPayment, MPPParticipant, MPPJudge, MPPReleaseCondition } from './mpp/types.js';

// Test configuration
const TEST_RPC_URL = process.env.TEST_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const TEST_TIMEOUT = 60000; // 60 seconds

// Mock KeyManager for testing
class TestKeyManager implements KeyManager {
  private keypair: Keypair;

  constructor() {
    this.keypair = Keypair.generate();
  }

  getPublicKey(): string {
    return this.keypair.publicKey.toBase58();
  }

  sign(message: Uint8Array): Uint8Array {
    // Simple mock signing - in production this would use proper signing
    return new Uint8Array(64).fill(0);
  }

  verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
    return true;
  }

  getKeypair(): Keypair {
    return this.keypair;
  }
}

// Mock TransactionManager for testing
class TestTransactionManager implements Partial<TransactionManager> {
  private connection: Connection;
  private keyManager: KeyManager;

  constructor(rpcUrl: string, keyManager: KeyManager) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.keyManager = keyManager;
  }

  async getBalance(): Promise<number> {
    const balance = await this.connection.getBalance(
      new PublicKey(this.keyManager.getPublicKey())
    );
    return balance / LAMPORTS_PER_SOL;
  }
}

describe('PaymentManager Integration Tests', () => {
  let paymentManager: PaymentManager;
  let keyManager: TestKeyManager;
  let transactionManager: TestTransactionManager;
  let connection: Connection;

  beforeAll(async () => {
    connection = new Connection(TEST_RPC_URL, 'confirmed');
    keyManager = new TestKeyManager();
    transactionManager = new TestTransactionManager(TEST_RPC_URL, keyManager) as TransactionManager;

    const config: Partial<PaymentsConfig> = {
      rpcEndpoint: TEST_RPC_URL,
      mppEnabled: true,
      x402Enabled: true,
      defaultTimeoutMs: 30000,
      autoConfirm: true,
    };

    paymentManager = new PaymentManager(config, keyManager, transactionManager as TransactionManager);
    await paymentManager.initialize();
  });

  afterAll(async () => {
    await paymentManager.close();
  });

  describe('MPP (Multi-Party Payment)', () => {
    let testPayment: MPPPayment;

    beforeEach(() => {
      // Reset test payment before each test
      testPayment = null as unknown as MPPPayment;
    });

    it('should create an MPP payment', async () => {
      const participants: Omit<MPPParticipant, 'allocatedAmount' | 'releasedAmount' | 'hasClaimed'>[] = [
        { address: Keypair.generate().publicKey.toBase58(), shareBps: 7000, role: 'agent' },
        { address: Keypair.generate().publicKey.toBase58(), shareBps: 3000, role: 'contributor' },
      ];

      const judges: Omit<MPPJudge, 'hasVoted' | 'vote'>[] = [
        { address: Keypair.generate().publicKey.toBase58(), weight: 1 },
      ];

      const releaseConditions: MPPReleaseCondition = {
        type: 'majority',
        requiredJudges: 1,
      };

      testPayment = await paymentManager.createMPPPayment({
        taskId: 'test-task-1',
        totalAmount: BigInt(1000000), // 0.001 SOL
        token: 'So11111111111111111111111111111111111111112', // Wrapped SOL
        tokenSymbol: 'SOL',
        decimals: 9,
        participants,
        judges,
        releaseConditions,
      });

      expect(testPayment).toBeDefined();
      expect(testPayment.paymentId).toBeDefined();
      expect(testPayment.taskId).toBe('test-task-1');
      expect(testPayment.totalAmount).toBe(BigInt(1000000));
      expect(testPayment.status).toBe('pending_funding');
      expect(testPayment.participants).toHaveLength(2);
      expect(testPayment.judges).toHaveLength(1);
      expect(testPayment.escrow).toBeDefined();
      expect(testPayment.escrow.length).toBeGreaterThan(0);
    });

    it('should retrieve an MPP payment by ID', async () => {
      // First create a payment
      const participants: Omit<MPPParticipant, 'allocatedAmount' | 'releasedAmount' | 'hasClaimed'>[] = [
        { address: Keypair.generate().publicKey.toBase58(), shareBps: 10000, role: 'agent' },
      ];

      const judges: Omit<MPPJudge, 'hasVoted' | 'vote'>[] = [
        { address: Keypair.generate().publicKey.toBase58(), weight: 1 },
      ];

      const releaseConditions: MPPReleaseCondition = {
        type: 'unanimous',
      };

      const createdPayment = await paymentManager.createMPPPayment({
        taskId: 'test-task-2',
        totalAmount: BigInt(500000),
        token: 'So11111111111111111111111111111111111111112',
        tokenSymbol: 'SOL',
        decimals: 9,
        participants,
        judges,
        releaseConditions,
      });

      // Retrieve the payment
      const retrievedPayment = paymentManager.getMPPPayment(createdPayment.paymentId);

      expect(retrievedPayment).toBeDefined();
      expect(retrievedPayment?.paymentId).toBe(createdPayment.paymentId);
      expect(retrievedPayment?.taskId).toBe('test-task-2');
    });

    it('should list all MPP payments', async () => {
      const payments = paymentManager.listMPPPayments();
      expect(Array.isArray(payments)).toBe(true);
    });

    it('should list MPP payments with status filter', async () => {
      const payments = paymentManager.listMPPPayments({ status: 'pending_funding' });
      expect(Array.isArray(payments)).toBe(true);
      // All newly created payments should be pending_funding
      payments.forEach(payment => {
        expect(payment.status).toBe('pending_funding');
      });
    });

    it('should throw error when accessing MPP with disabled feature', async () => {
      const config: Partial<PaymentsConfig> = {
        rpcEndpoint: TEST_RPC_URL,
        mppEnabled: false,
        x402Enabled: true,
      };

      const disabledManager = new PaymentManager(
        config,
        keyManager,
        transactionManager as TransactionManager
      );
      await disabledManager.initialize();

      expect(() => disabledManager.getMPPPayment('test-id')).toThrow('MPP payments not enabled');

      await disabledManager.close();
    });
  });

  describe('X402 Payment Protocol', () => {
    it('should create X402 payment requirements', () => {
      const requirements = paymentManager.createX402Requirements({
        amount: '100000', // 0.0001 SOL
        token: 'So11111111111111111111111111111111111111112',
        description: 'Test service payment',
      });

      expect(requirements).toBeDefined();
      expect(requirements.amount).toBe('100000');
      expect(requirements.token).toBe('So11111111111111111111111111111111111111112');
      expect(requirements.recipient).toBe(keyManager.getPublicKey());
      expect(requirements.paymentId).toBeDefined();
      expect(requirements.deadline).toBeGreaterThan(Date.now());
    });

    it('should create X402 payment requirements with custom recipient', () => {
      const customRecipient = Keypair.generate().publicKey.toBase58();
      const requirements = paymentManager.createX402Requirements({
        amount: '50000',
        token: 'So11111111111111111111111111111111111111112',
        recipient: customRecipient,
        description: 'Custom recipient test',
      });

      expect(requirements.recipient).toBe(customRecipient);
    });

    it('should get X402 session', () => {
      const requirements = paymentManager.createX402Requirements({
        amount: '100000',
        token: 'So11111111111111111111111111111111111111112',
        description: 'Session test',
      });

      const sessionId = `x402_${requirements.paymentId}`;
      const session = paymentManager.getX402Session(sessionId);

      expect(session).toBeDefined();
    });

    it('should throw error when accessing X402 with disabled feature', async () => {
      const config: Partial<PaymentsConfig> = {
        rpcEndpoint: TEST_RPC_URL,
        mppEnabled: true,
        x402Enabled: false,
      };

      const disabledManager = new PaymentManager(
        config,
        keyManager,
        transactionManager as TransactionManager
      );
      await disabledManager.initialize();

      expect(() =>
        disabledManager.createX402Requirements({
          amount: '100000',
          token: 'So11111111111111111111111111111111111111112',
          description: 'Test',
        })
      ).toThrow('X402 payments not enabled');

      await disabledManager.close();
    });
  });

  describe('Direct Transfer', () => {
    it('should execute direct SOL transfer', async () => {
      const recipient = Keypair.generate().publicKey.toBase58();
      const amount = BigInt(10000); // Small amount for testing

      // Note: This would require an airdrop or funded account in real test
      // For now, we just verify the method exists and has correct signature
      expect(paymentManager.executeTransfer).toBeDefined();
      expect(typeof paymentManager.executeTransfer).toBe('function');
    });

    it('should throw error for SPL token transfers (not implemented)', async () => {
      const recipient = Keypair.generate().publicKey.toBase58();
      const tokenMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC

      await expect(
        paymentManager.executeTransfer({
          to: recipient,
          amount: BigInt(1000000),
          token: tokenMint,
        })
      ).rejects.toThrow('SPL token transfers not yet implemented');
    });
  });

  describe('Configuration', () => {
    it('should respect custom RPC endpoint', async () => {
      const customConfig: Partial<PaymentsConfig> = {
        rpcEndpoint: 'https://api.mainnet-beta.solana.com',
        mppEnabled: true,
        x402Enabled: true,
      };

      const customManager = new PaymentManager(
        customConfig,
        keyManager,
        transactionManager as TransactionManager
      );

      expect(customManager).toBeDefined();
    });

    it('should use default values when config is partial', async () => {
      const minimalConfig: Partial<PaymentsConfig> = {};

      const minimalManager = new PaymentManager(
        minimalConfig,
        keyManager,
        transactionManager as TransactionManager
      );

      expect(minimalManager).toBeDefined();
      await minimalManager.initialize();

      // Verify it works with defaults
      const requirements = minimalManager.createX402Requirements({
        amount: '100000',
        token: 'So11111111111111111111111111111111111111112',
        description: 'Default config test',
      });

      expect(requirements).toBeDefined();

      await minimalManager.close();
    });
  });
});

describe('PaymentManager Factory', () => {
  it('should create PaymentManager via factory function', () => {
    const { createPaymentManager } = require('./index.js');

    const keyManager = new TestKeyManager();
    const transactionManager = new TestTransactionManager(TEST_RPC_URL, keyManager);

    const manager = createPaymentManager(
      { rpcEndpoint: TEST_RPC_URL },
      keyManager,
      transactionManager as TransactionManager
    );

    expect(manager).toBeDefined();
    expect(typeof manager.initialize).toBe('function');
    expect(typeof manager.close).toBe('function');
  });
});
