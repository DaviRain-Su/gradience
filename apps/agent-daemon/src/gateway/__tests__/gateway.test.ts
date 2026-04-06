import { describe, it, expect, vi } from 'vitest';
import { DefaultWorkflowExecutionGateway } from '../gateway.js';
import { GatewayStore } from '../store.js';
import { DefaultArenaTaskFactory } from '../arena-factory.js';
import type { PurchaseEvent } from '../types.js';
import { GW_PURCHASE_NOT_FOUND, GW_NOT_RETRYABLE } from '../errors.js';

describe('WorkflowExecutionGateway', () => {
  function createMockArenaClient(overrides: Partial<import('../gateway').ArenaTaskClient> = {}) {
    return {
      post: vi.fn().mockResolvedValue('post-tx-sig'),
      apply: vi.fn().mockResolvedValue('apply-tx-sig'),
      submit: vi.fn().mockResolvedValue('submit-tx-sig'),
      getNextTaskId: vi.fn().mockResolvedValue(99n),
      ...overrides,
    };
  }

  function createMockExecutionClient(overrides: Partial<import('../gateway').ExecutionClient> = {}) {
    return {
      runAndSettle: vi.fn().mockResolvedValue('settle-tx-sig'),
      ...overrides,
    };
  }

  function createGateway(arenaOverrides = {}, executionOverrides = {}) {
    const store = new GatewayStore(':memory:');
    const factory = new DefaultArenaTaskFactory('judge1');
    const arenaClient = createMockArenaClient(arenaOverrides);
    const executionClient = createMockExecutionClient(executionOverrides);
    const gateway = new DefaultWorkflowExecutionGateway(store, factory, arenaClient, executionClient, {
      marketplaceProgramId: 'mp1',
      arenaProgramId: 'ap1',
      rpcEndpoint: 'https://mock.rpc',
      dbPath: ':memory:',
      posterWallet: { publicKey: 'poster1', signAndSendTransaction: vi.fn() },
      agentWallet: { publicKey: 'agent1', signAndSendTransaction: vi.fn() },
      defaultJudge: 'judge1',
      pollIntervalMs: 5000,
      maxRetries: 3,
      retryDelayMs: 1000,
    });
    return { gateway, store, arenaClient, executionClient };
  }

  function makeEvent(purchaseId: string): PurchaseEvent {
    return {
      purchaseId,
      buyer: 'buyer1',
      workflowId: 'wf1',
      amount: 1000n,
      txSignature: `tx-${purchaseId}`,
      blockTime: 1,
    };
  }

  it('H5: processPurchase should persist and drive to completion', async () => {
    const { gateway, store } = createGateway();
    await gateway.processPurchase(makeEvent('p1'));
    const record = store.getByPurchaseId('p1');
    expect(record?.status).toBe('SETTLED');
  });

  it('H6: should run full happy path PENDING → SETTLED with mocks', async () => {
    const { gateway, store } = createGateway();
    await gateway.processPurchase(makeEvent('p2'));
    const record = store.getByPurchaseId('p2');
    expect(record?.status).toBe('SETTLED');
    expect(record?.settlementTx).toBe('settle-tx-sig');
    expect(record?.score).toBe(100);
  });

  it('E7: should transition to FAILED when post_task fails', async () => {
    const { gateway, store } = createGateway({ post: vi.fn().mockRejectedValue(new Error('post fail')) });
    await gateway.processPurchase(makeEvent('p3'));
    const record = store.getByPurchaseId('p3');
    expect(record?.status).toBe('FAILED');
  });

  it('E8: retry should move FAILED back to TASK_CREATING and drive to completion', async () => {
    const { gateway, store } = createGateway();
    await gateway.processPurchase(makeEvent('p4'));
    // Simulate a prior failure
    store.update('p4', { status: 'FAILED', attempts: 1 });
    await gateway.retry('p4');
    const record = store.getByPurchaseId('p4');
    expect(record?.status).toBe('SETTLED');
    expect(record?.attempts).toBe(2);
  });

  it('E9: should throw GW_0008 when retrying non-failed purchase', async () => {
    const { gateway } = createGateway();
    await gateway.processPurchase(makeEvent('p5'));
    await expect(gateway.retry('p5')).rejects.toThrow();
    try {
      await gateway.retry('p5');
    } catch (e) {
      expect((e as import('../errors').GatewayError).code).toBe(GW_NOT_RETRYABLE);
    }
  });

  it('should throw GW_PURCHASE_NOT_FOUND for unknown retry', async () => {
    const { gateway } = createGateway();
    await expect(gateway.retry('unknown')).rejects.toThrow();
    try {
      await gateway.retry('unknown');
    } catch (e) {
      expect((e as import('../errors').GatewayError).code).toBe(GW_PURCHASE_NOT_FOUND);
    }
  });
});
