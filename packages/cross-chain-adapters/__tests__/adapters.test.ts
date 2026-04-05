/**
 * Cross-Chain Adapters - Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CrossChainAdapter } from '../src/adapters/cross-chain-adapter.js';
import { LayerZeroAdapter, createEthereumAdapter } from '../src/adapters/layerzero-adapter.js';
import { WormholeAdapter, createEthereumAdapter as createWormholeEthereumAdapter } from '../src/adapters/wormhole-adapter.js';
import { DeBridgeAdapter, DEBRIDGE_CHAIN_IDS, DEBRIDGE_GATE_ADDRESSES } from '../src/adapters/debridge-adapter.js';

describe('CrossChainAdapter', () => {
  const createAdapter = () =>
    new CrossChainAdapter({
      agentId: 'test-agent',
      chains: [
        { name: 'ethereum', chainId: 1, rpcUrl: 'https://eth.rpc', nativeCurrency: 'ETH' },
        { name: 'solana', chainId: 101, rpcUrl: 'https://sol.rpc', nativeCurrency: 'SOL' },
      ],
      bridges: [{ fromChain: 'ethereum', toChain: 'solana', contractAddress: '0x123' }],
    });

  it('should initialize and shutdown', async () => {
    const adapter = createAdapter();
    await adapter.initialize();
    expect(adapter.isAvailable()).toBe(true);
    await adapter.shutdown();
    expect(adapter.isAvailable()).toBe(false);
  });

  it('should send message', async () => {
    const adapter = createAdapter();
    await adapter.initialize();

    const result = await adapter.send({
      id: 'msg-1',
      from: '0x1234567890123456789012345678901234567890',
      to: '0x4567890123456789012345678901234567890123',
      protocol: 'cross-chain',
      timestamp: Date.now(),
      payload: { test: true },
    });

    expect(result.success).toBe(true);
    expect(result.protocol).toBe('cross-chain');
  });

  it('should return health status', async () => {
    const adapter = createAdapter();
    await adapter.initialize();

    const health = adapter.health();
    expect(health.available).toBe(true);
    expect(health.peerCount).toBeGreaterThanOrEqual(0);
  });
});

describe('LayerZeroAdapter', () => {
  const createAdapter = (demoMode = true) =>
    new LayerZeroAdapter({
      solanaAgentId: 'sol-agent',
      sourceChain: 'ethereum',
      sourceEid: 30101,
      solanaEid: 30168,
      sourceAgentAddress: '0x123',
      endpointAddress: '0x456',
      rpcUrl: 'https://eth.rpc',
      demoMode,
    });

  it('should initialize and shutdown in demo mode', async () => {
    const adapter = createAdapter(true);
    await adapter.initialize();
    expect(adapter.isAvailable()).toBe(true);
    await adapter.shutdown();
    expect(adapter.isAvailable()).toBe(false);
  });

  it('should send message in demo mode', async () => {
    const adapter = createAdapter(true);
    await adapter.initialize();

    const result = await adapter.send({
      id: 'msg-1',
      from: '0x123',
      to: 'sol-agent',
      protocol: 'layerzero',
      timestamp: Date.now(),
      payload: {},
    });

    expect(result.success).toBe(true);
    expect(result.metadata?.demo).toBe(true);
  });

  it('should sync reputation in demo mode', async () => {
    const adapter = createAdapter(true);
    await adapter.initialize();

    const result = await adapter.syncReputation({
      taskCompletions: [],
      attestations: [],
      scores: [],
    });

    expect(result.status).toBe('pending');
    expect(result.txHash).toBeDefined();
  });

  it('should quote fees', async () => {
    const adapter = createAdapter(true);
    const fees = await adapter.quote('test payload');

    expect(fees.nativeFee).toBeGreaterThan(BigInt(0));
    expect(fees.lzTokenFee).toBe(BigInt(0));
  });

  it('should check message status', async () => {
    const adapter = createAdapter(true);
    await adapter.initialize();

    const result = await adapter.syncReputation({
      taskCompletions: [],
      attestations: [],
      scores: [],
    });

    // Wait for simulated delivery
    await new Promise(resolve => setTimeout(resolve, 100));

    const status = await adapter.checkMessageStatus(result.messageId);
    expect(status).toBeDefined();
    expect(status?.messageId).toBe(result.messageId);
  });

  it('should use factory functions', () => {
    const ethAdapter = createEthereumAdapter({
      solanaAgentId: 'sol-agent',
      solanaEid: 30168,
      sourceAgentAddress: '0x123',
      rpcUrl: 'https://eth.rpc',
    });

    expect(ethAdapter).toBeDefined();
  });
});

describe('WormholeAdapter', () => {
  const createAdapter = (demoMode = true) =>
    new WormholeAdapter({
      solanaAgentId: 'sol-agent',
      sourceChain: 'ethereum',
      sourceChainId: 2,
      solanaChainId: 1,
      sourceAgentAddress: '0x123',
      coreBridgeAddress: '0x456',
      rpcUrl: 'https://eth.rpc',
      demoMode,
    });

  it('should initialize and shutdown', async () => {
    const adapter = createAdapter();
    await adapter.initialize();
    expect(adapter.isAvailable()).toBe(true);
    await adapter.shutdown();
    expect(adapter.isAvailable()).toBe(false);
  });

  it('should send message', async () => {
    const adapter = createAdapter();
    await adapter.initialize();

    const result = await adapter.send({
      id: 'msg-1',
      from: '0x123',
      to: 'sol-agent',
      protocol: 'wormhole',
      timestamp: Date.now(),
      payload: {},
    });

    expect(result.success).toBe(true);
    expect(result.metadata?.demo).toBe(true);
  });

  it('should sync reputation', async () => {
    const adapter = createAdapter();
    await adapter.initialize();

    const result = await adapter.syncReputation({
      taskCompletions: [],
      attestations: [],
      scores: [],
    });

    expect(result.status).toBe('pending');
    expect(result.vaa).toBeDefined();
    expect(result.txHash).toBeDefined();
    expect(result.messageId).toBeDefined();
  });

  it('should quote fees', async () => {
    const adapter = createAdapter();
    const fees = await adapter.quote('test payload');

    expect(fees.nativeFee).toBeGreaterThan(BigInt(0));
    expect(fees.gasLimit).toBeGreaterThan(BigInt(0));
    expect(fees.estimatedTime).toBeGreaterThan(0);
  });

  it('should check message status', async () => {
    const adapter = createAdapter();
    await adapter.initialize();

    const result = await adapter.syncReputation({
      taskCompletions: [],
      attestations: [],
      scores: [],
    });

    // Wait for simulated VAA generation
    await new Promise(resolve => setTimeout(resolve, 100));

    const status = await adapter.checkMessageStatus(result.messageId);
    expect(status).toBeDefined();
    expect(status?.messageId).toBe(result.messageId);
  });

  it('should verify VAA in demo mode', async () => {
    const adapter = createAdapter();
    await adapter.initialize();

    // Create a mock VAA with sufficient signatures for demo mode
    const mockVAA = {
      version: 1,
      guardianSetIndex: 3,
      signatures: Array.from({ length: 13 }, (_, i) => ({
        guardianIndex: i,
        signature: `sig-${i}-${Date.now()}`,
      })),
      timestamp: Math.floor(Date.now() / 1000),
      nonce: 0,
      emitterChain: 2,
      emitterAddress: '0x123',
      sequence: BigInt(1),
      consistencyLevel: 15,
      payload: '0x1234',
      hash: 'vaa-test',
    };

    // VAA with 13 signatures should be valid in demo mode
    const isValid = await adapter.verifyVAA(mockVAA);
    expect(isValid).toBe(true);

    // VAA with fewer signatures should be invalid
    const invalidVAA = { ...mockVAA, signatures: mockVAA.signatures.slice(0, 5) };
    const isInvalid = await adapter.verifyVAA(invalidVAA);
    expect(isInvalid).toBe(false);
  });

  it('should redeem on Solana', async () => {
    const adapter = createAdapter();
    await adapter.initialize();

    const mockVAA = {
      version: 1,
      guardianSetIndex: 3,
      signatures: [{ guardianIndex: 0, signature: 'test' }],
      timestamp: Date.now(),
      nonce: 0,
      emitterChain: 2,
      emitterAddress: '0x123',
      sequence: BigInt(1),
      consistencyLevel: 15,
      payload: '0x1234',
      hash: 'vaa-test',
    };

    const result = await adapter.redeemOnSolana(mockVAA);
    expect(result.txHash).toBeDefined();
    expect(result.txHash.startsWith('sol-')).toBe(true);
  });

  it('should use factory functions', () => {
    const ethAdapter = createWormholeEthereumAdapter({
      solanaAgentId: 'sol-agent',
      solanaChainId: 1,
      sourceAgentAddress: '0x123',
      rpcUrl: 'https://eth.rpc',
    });

    expect(ethAdapter).toBeDefined();
  });
});

describe('DeBridgeAdapter', () => {
  const createAdapter = (demoMode = true) =>
    new DeBridgeAdapter({
      solanaAgentId: 'sol-agent',
      sourceChain: 'ethereum',
      sourceChainId: DEBRIDGE_CHAIN_IDS.ETHEREUM,
      solanaChainId: DEBRIDGE_CHAIN_IDS.SOLANA,
      sourceAgentAddress: '0x123',
      gateAddress: DEBRIDGE_GATE_ADDRESSES.ETHEREUM,
      rpcUrl: 'https://eth.rpc',
      demoMode,
    });

  it('should initialize and shutdown', async () => {
    const adapter = createAdapter();
    await adapter.initialize();
    expect(adapter.isAvailable()).toBe(true);
    await adapter.shutdown();
    expect(adapter.isAvailable()).toBe(false);
  });

  it('should send message', async () => {
    const adapter = createAdapter();
    await adapter.initialize();

    const result = await adapter.send({
      id: 'msg-1',
      from: '0x123',
      to: 'sol-agent',
      protocol: 'debridge',
      timestamp: Date.now(),
      payload: {},
    });

    expect(result.success).toBe(true);
    expect(result.metadata?.demo).toBe(true);
    expect(result.metadata?.submissionId).toBeDefined();
  });

  it('should sync reputation', async () => {
    const adapter = createAdapter();
    await adapter.initialize();

    const result = await adapter.syncReputation({
      taskCompletions: [],
      attestations: [],
      scores: [],
    });

    expect(result.status).toBe('pending');
    expect(result.txHash).toBeDefined();
    expect(result.messageId).toBeDefined();
    expect(result.submissionId).toBeDefined();
  });

  it('should quote fees', async () => {
    const adapter = createAdapter();
    const fees = await adapter.quote('test payload');

    expect(fees.fixedFee).toBeGreaterThan(BigInt(0));
    expect(fees.executionFee).toBeGreaterThan(BigInt(0));
    expect(fees.totalFee).toBeGreaterThan(BigInt(0));
    expect(fees.estimatedTime).toBeGreaterThan(0);
  });

  it('should check message status', async () => {
    const adapter = createAdapter();
    await adapter.initialize();

    const result = await adapter.syncReputation({
      taskCompletions: [],
      attestations: [],
      scores: [],
    });

    // Wait for simulated processing
    await new Promise(resolve => setTimeout(resolve, 100));

    const status = await adapter.checkMessageStatus(result.messageId);
    expect(status).toBeDefined();
    expect(status?.messageId).toBe(result.messageId);
  });

  it('should lock assets for bridging', async () => {
    const adapter = createAdapter();
    await adapter.initialize();

    const result = await adapter.lockAsset(
      '0xTokenAddress',
      '1000000000000000000', // 1 ETH
      'SolanaTokenAddress'
    );

    expect(result.status).toBe('pending');
    expect(result.txHash).toBeDefined();
    expect(result.submissionId).toBeDefined();
  });

  it('should claim assets', async () => {
    const adapter = createAdapter();
    await adapter.initialize();

    const result = await adapter.claim('db-submission-123');

    expect(result.status).toBe('completed');
    expect(result.txHash).toBeDefined();
    expect(result.submissionId).toBe('db-submission-123');
  });

  it('should create DLN order', async () => {
    const adapter = createAdapter();

    const order = await adapter.createDlnOrder({
      srcToken: '0xTokenA',
      dstToken: 'SolanaTokenB',
      srcAmount: '1000',
      minDstAmount: '900',
      recipient: 'sol-recipient',
    });

    expect(order.orderId).toBeDefined();
    expect(order.srcChainId).toBe(DEBRIDGE_CHAIN_IDS.ETHEREUM);
    expect(order.dstChainId).toBe(DEBRIDGE_CHAIN_IDS.SOLANA);
    expect(order.status).toBe('pending');
  });

  it('should get message receipt', async () => {
    const adapter = createAdapter();
    await adapter.initialize();

    const result = await adapter.syncReputation({
      taskCompletions: [],
      attestations: [],
      scores: [],
    });

    const receipt = await adapter.getMessageReceipt(result.messageId);
    expect(receipt).toBeDefined();
    expect(receipt?.submissionId).toBe(result.submissionId);
    expect(receipt?.txHash).toBe(result.txHash);
  });

  it('should handle message too large error', async () => {
    const adapter = new DeBridgeAdapter({
      solanaAgentId: 'sol-agent',
      sourceChain: 'ethereum',
      sourceChainId: DEBRIDGE_CHAIN_IDS.ETHEREUM,
      solanaChainId: DEBRIDGE_CHAIN_IDS.SOLANA,
      sourceAgentAddress: '0x123',
      gateAddress: DEBRIDGE_GATE_ADDRESSES.ETHEREUM,
      rpcUrl: 'https://eth.rpc',
      demoMode: true,
      maxMessageSize: 10, // Very small limit
    });
    await adapter.initialize();

    const result = await adapter.send({
      id: 'msg-1',
      from: '0x123',
      to: 'sol-agent',
      protocol: 'debridge',
      timestamp: Date.now(),
      payload: { data: 'this is a very long payload that exceeds the limit' },
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('DB_MESSAGE_TOO_LARGE');
  });

  it('should use factory functions', () => {
    const ethAdapter = createEthereumDeBridgeAdapter({
      solanaAgentId: 'sol-agent',
      solanaChainId: DEBRIDGE_CHAIN_IDS.SOLANA,
      sourceAgentAddress: '0x123',
      rpcUrl: 'https://eth.rpc',
    });

    expect(ethAdapter).toBeDefined();
    expect(ethAdapter.protocol).toBe('debridge');
  });
});

// Factory function for creating Ethereum DeBridge adapter
function createEthereumDeBridgeAdapter(params: {
  solanaAgentId: string;
  solanaChainId: number;
  sourceAgentAddress: string;
  rpcUrl: string;
  demoMode?: boolean;
}): DeBridgeAdapter {
  return new DeBridgeAdapter({
    solanaAgentId: params.solanaAgentId,
    sourceChain: 'ethereum',
    sourceChainId: DEBRIDGE_CHAIN_IDS.ETHEREUM,
    solanaChainId: params.solanaChainId,
    sourceAgentAddress: params.sourceAgentAddress,
    gateAddress: DEBRIDGE_GATE_ADDRESSES.ETHEREUM,
    rpcUrl: params.rpcUrl,
    demoMode: params.demoMode ?? true,
  });
}
