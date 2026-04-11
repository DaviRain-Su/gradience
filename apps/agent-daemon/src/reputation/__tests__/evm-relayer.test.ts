import { describe, it, expect, vi } from 'vitest';
import { createReputationEVMRelayer, ReputationEVMRelayer } from '../evm-relayer.js';
import { ethers } from 'ethers';

describe('ReputationEVMRelayer', () => {
  it('should skip push when nonce is stale', async () => {
    const relayer = new ReputationEVMRelayer({
      rpcUrl: 'http://localhost:8545',
      privateKey: ethers.Wallet.createRandom().privateKey,
      contractAddress: '0x' + 'a'.repeat(40),
      chainId: 84532,
    });

    // @ts-expect-error - accessing private field for test
    relayer['contract'] = {
      nonces: vi.fn().mockResolvedValue(5n),
    };

    const payload: any = {
      agentId: ethers.ZeroHash,
      globalScore: 8750,
      categoryScores: [9200, 8500, 0, 0, 8800, 0, 0, 7600],
      updatedAt: Math.floor(Date.now() / 1000),
      confidence: 94,
      nonce: 3,
      merkleRoot: ethers.ZeroHash,
      sourceChain: 'solana',
    };

    const result = await relayer.pushReputation(payload, '0x' + 'b'.repeat(130));
    expect(result.success).toBe(false);
    expect(result.error).toContain('Nonce stale');
  });

  it('should push reputation successfully', async () => {
    const relayer = new ReputationEVMRelayer({
      rpcUrl: 'http://localhost:8545',
      privateKey: ethers.Wallet.createRandom().privateKey,
      contractAddress: '0x' + 'a'.repeat(40),
      chainId: 84532,
    });

    // @ts-expect-error - accessing private field for test
    relayer['contract'] = {
      nonces: vi.fn().mockResolvedValue(0n),
      updateReputation: vi.fn().mockResolvedValue({
        wait: vi.fn().mockResolvedValue({ hash: '0xtxhash' }),
      }),
    };

    const payload: any = {
      agentId: ethers.ZeroHash,
      globalScore: 8750,
      categoryScores: [9200, 8500, 0, 0, 8800, 0, 0, 7600],
      updatedAt: Math.floor(Date.now() / 1000),
      confidence: 94,
      nonce: 1,
      merkleRoot: ethers.ZeroHash,
      sourceChain: 'solana',
    };

    const result = await relayer.pushReputation(payload, '0x' + 'b'.repeat(130));
    expect(result.success).toBe(true);
    expect(result.txHash).toBe('0xtxhash');
  });
});
