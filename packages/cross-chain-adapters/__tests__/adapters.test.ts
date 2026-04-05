/**
 * Cross-Chain Adapters - Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CrossChainAdapter } from '../src/adapters/cross-chain-adapter.js';
import { LayerZeroAdapter } from '../src/adapters/layerzero-adapter.js';
import { WormholeAdapter } from '../src/adapters/wormhole-adapter.js';
import { DebridgeAdapter } from '../src/adapters/debridge-adapter.js';

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
      from: '0x123',
      to: '0x456',
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
  const createAdapter = () =>
    new LayerZeroAdapter({
      solanaAgentId: 'sol-agent',
      sourceChain: 'ethereum',
      sourceEid: 30101,
      solanaEid: 30168,
      sourceAgentAddress: '0x123',
      endpointAddress: '0x456',
      rpcUrl: 'https://eth.rpc',
    });

  it('should initialize and shutdown', async () => {
    const adapter = createAdapter();
    await adapter.initialize();
    expect(adapter.isAvailable()).toBe(true);
    await adapter.shutdown();
    expect(adapter.isAvailable()).toBe(false);
  });

  it('should send message in demo mode', async () => {
    const adapter = createAdapter();
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
  });

  it('should estimate fees', async () => {
    const adapter = createAdapter();
    const fees = await adapter.estimateFees('test payload');

    expect(fees.nativeFee).toBeGreaterThan(BigInt(0));
    expect(fees.lzTokenFee).toBe(BigInt(0));
  });
});

describe('WormholeAdapter', () => {
  const createAdapter = () =>
    new WormholeAdapter({
      solanaAgentId: 'sol-agent',
      sourceChain: 'ethereum',
      sourceChainId: 2,
      solanaChainId: 1,
      sourceAgentAddress: '0x123',
      coreBridgeAddress: '0x456',
      rpcUrl: 'https://eth.rpc',
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
  });
});

describe('DebridgeAdapter', () => {
  const createAdapter = () =>
    new DebridgeAdapter({
      solanaAgentId: 'sol-agent',
      sourceChain: 'ethereum',
      sourceChainId: 1,
      solanaChainId: 7565164,
      sourceAgentAddress: '0x123',
      gateAddress: '0x456',
      rpcUrl: 'https://eth.rpc',
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
  });

  it('should estimate fees', async () => {
    const adapter = createAdapter();
    const fees = await adapter.estimateFees('test payload');

    expect(fees.fixedFee).toBeGreaterThan(BigInt(0));
    expect(fees.executionFee).toBeGreaterThan(BigInt(0));
    expect(fees.totalFee).toBeGreaterThan(BigInt(0));
  });
});
