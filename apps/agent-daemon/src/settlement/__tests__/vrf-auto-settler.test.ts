import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VrfAutoSettler } from '../vrf-auto-settler.js';
import { Connection, PublicKey } from '@solana/web3.js';
import type { TransactionManager } from '../../solana/transaction-manager.js';

const mockConnection = {
  getAccountInfo: vi.fn(),
} as unknown as Connection;

const mockTxManager = {
  judgeAndPay: vi.fn(),
} as unknown as TransactionManager;

describe('VrfAutoSettler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should settle a task when vrf_result is fulfilled', async () => {
    const settler = new VrfAutoSettler({
      pollIntervalMs: 1000,
      connection: mockConnection,
      transactionManager: mockTxManager,
      getCandidates: async () => ['agentA', 'agentB', 'agentC'],
    });

    // Mock vrf_result account data (discriminator=0x0a, version=1, taskId=1, randomness, fulfilled=1, bump=1)
    const vrfData = Buffer.alloc(44);
    vrfData[0] = 0x0a;
    vrfData[1] = 1;
    vrfData.writeBigUInt64LE(1n, 2);
    // randomness[0..8] = 5 (so 5 % 3 = 2 -> agentC)
    vrfData.writeBigUInt64LE(5n, 10);
    vrfData[42] = 1; // fulfilled
    vrfData[43] = 1; // bump

    (mockConnection.getAccountInfo as any).mockResolvedValue({
      data: vrfData,
    });

    (mockTxManager.judgeAndPay as any).mockResolvedValue('txsig123');

    settler.track('task-1', 1n);
    await (settler as any).checkPending();

    expect(mockTxManager.judgeAndPay).toHaveBeenCalledWith({
      taskId: 'task-1',
      winner: 'agentC',
      score: 85,
      reasonRef: 'Auto-settled by VRF oracle',
    });
  });

  it('should skip settlement if vrf_result is not fulfilled', async () => {
    const settler = new VrfAutoSettler({
      pollIntervalMs: 1000,
      connection: mockConnection,
      transactionManager: mockTxManager,
      getCandidates: async () => ['agentA'],
    });

    const vrfData = Buffer.alloc(44);
    vrfData[0] = 0x0a;
    vrfData[1] = 1;
    vrfData.writeBigUInt64LE(2n, 2);
    vrfData[42] = 0; // not fulfilled
    vrfData[43] = 1;

    (mockConnection.getAccountInfo as any).mockResolvedValue({
      data: vrfData,
    });

    settler.track('task-2', 2n);
    await (settler as any).checkPending();

    expect(mockTxManager.judgeAndPay).not.toHaveBeenCalled();
  });

  it('should skip settlement if vrf_result account does not exist', async () => {
    const settler = new VrfAutoSettler({
      pollIntervalMs: 1000,
      connection: mockConnection,
      transactionManager: mockTxManager,
      getCandidates: async () => ['agentA'],
    });

    (mockConnection.getAccountInfo as any).mockResolvedValue(null);

    settler.track('task-3', 3n);
    await (settler as any).checkPending();

    expect(mockTxManager.judgeAndPay).not.toHaveBeenCalled();
  });

  it('should skip settlement if no candidates are returned', async () => {
    const settler = new VrfAutoSettler({
      pollIntervalMs: 1000,
      connection: mockConnection,
      transactionManager: mockTxManager,
      getCandidates: async () => [],
    });

    const vrfData = Buffer.alloc(44);
    vrfData[0] = 0x0a;
    vrfData[1] = 1;
    vrfData.writeBigUInt64LE(4n, 2);
    vrfData[42] = 1;
    vrfData[43] = 1;

    (mockConnection.getAccountInfo as any).mockResolvedValue({
      data: vrfData,
    });

    settler.track('task-4', 4n);
    await (settler as any).checkPending();

    expect(mockTxManager.judgeAndPay).not.toHaveBeenCalled();
  });

  it('should mark settled and ignore duplicate tracks', async () => {
    const settler = new VrfAutoSettler({
      pollIntervalMs: 1000,
      connection: mockConnection,
      transactionManager: mockTxManager,
      getCandidates: async () => ['agentA'],
    });

    const vrfData = Buffer.alloc(44);
    vrfData[0] = 0x0a;
    vrfData[1] = 1;
    vrfData.writeBigUInt64LE(5n, 2);
    vrfData[42] = 1;
    vrfData[43] = 1;

    (mockConnection.getAccountInfo as any).mockResolvedValue({
      data: vrfData,
    });
    (mockTxManager.judgeAndPay as any).mockResolvedValue('txsig');

    settler.track('task-5', 5n);
    settler.markSettled('task-5');
    settler.track('task-5', 5n);

    expect((settler as any).pending.has('task-5')).toBe(false);
  });
});
