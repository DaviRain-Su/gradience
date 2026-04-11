import { describe, it, expect } from 'vitest';
import {
  createReputationProofGenerator,
  hashPayload,
  verifyPayloadSignature,
} from '../proof-generator.js';
import { ethers } from 'ethers';

describe('ReputationProofGenerator', () => {
  const wallet = ethers.Wallet.createRandom();
  const generator = createReputationProofGenerator({
    oracleSignerPrivateKey: wallet.privateKey,
  });

  it('should generate a valid signed payload', async () => {
    const result = await generator.generateSignedPayload(
      '8oR7d5ShiP9XzYwQaBcDeFgHiJkLmNoPqRsTuVwXyZa',
      8750,
      [9200, 8500, 0, 0, 8800, 0, 0, 7600],
      42,
      { confidence: 94 }
    );

    expect(result.signature).toMatch(/^0x[a-fA-F0-9]{130}$/);
    expect(result.payloadHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(result.payload.globalScore).toBe(8750);
    expect(result.payload.nonce).toBe(42);
    expect(result.payload.confidence).toBe(94);
    expect(result.payload.categoryScores).toHaveLength(8);
  });

  it('should normalize category scores to 8 entries', async () => {
    const result = await generator.generateSignedPayload(
      'agent1',
      5000,
      [1000, 2000],
      1
    );
    expect(result.payload.categoryScores).toEqual([
      1000, 2000, 0, 0, 0, 0, 0, 0,
    ]);
  });

  it('should verify signature correctly', async () => {
    const result = await generator.generateSignedPayload(
      'agent2',
      5000,
      [1000, 2000],
      1
    );

    const valid = verifyPayloadSignature(
      result.payload,
      result.signature,
      wallet.address
    );
    expect(valid).toBe(true);
  });

  it('should reject tampered payload', async () => {
    const result = await generator.generateSignedPayload(
      'agent3',
      5000,
      [1000, 2000],
      1
    );

    const tampered = { ...result.payload, globalScore: 9999 };
    const valid = verifyPayloadSignature(tampered, result.signature, wallet.address);
    expect(valid).toBe(false);
  });

  it('should hash payload deterministically', async () => {
    const payload = {
      agentId: ethers.zeroPadValue('0x1234', 32),
      globalScore: 8750,
      categoryScores: [9200, 8500, 0, 0, 8800, 0, 0, 7600],
      updatedAt: 1712390400,
      confidence: 94,
      nonce: 42,
      merkleRoot: ethers.ZeroHash,
      sourceChain: 'solana',
    };

    const hash1 = hashPayload(payload);
    const hash2 = hashPayload(payload);
    expect(hash1).toBe(hash2);
  });
});
