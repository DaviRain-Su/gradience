import { describe, it, expect, vi } from 'vitest';
import { DefaultWorkflowExecutionGateway } from '../gateway.js';
import { GatewayStore } from '../store.js';
import { DefaultArenaTaskFactory } from '../arena-factory.js';

describe('WEG Integration', () => {
  function setup(arenaOverrides = {}, executionOverrides = {}) {
    const store = new GatewayStore(':memory:');
    const factory = new DefaultArenaTaskFactory('judge1');
    const arenaClient = {
      post: vi.fn().mockResolvedValue('post-tx'),
      apply: vi.fn().mockResolvedValue('apply-tx'),
      submit: vi.fn().mockResolvedValue('submit-tx'),
      getNextTaskId: vi.fn().mockResolvedValue(101n),
      ...arenaOverrides,
    };
    const executionClient = {
      runAndSettle: vi.fn().mockResolvedValue('settle-tx'),
      ...executionOverrides,
    };
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

  it('I1: full purchase → task → execute → settle with mocks', async () => {
    const { gateway, store } = setup();
    await gateway.processPurchase({
      purchaseId: 'int1',
      buyer: 'buyer1',
      workflowId: 'wf1',
      amount: 5000n,
      txSignature: 'tx-int1',
      blockTime: 1,
    });
    const record = store.getByPurchaseId('int1');
    expect(record?.status).toBe('SETTLED');
    expect(record?.taskId).toBe('101');
    expect(record?.settlementTx).toBe('settle-tx');
  });

  it('I2: should mark FAILED when execution fails', async () => {
    const { gateway, store } = setup({}, { runAndSettle: vi.fn().mockRejectedValue(new Error('vel timeout')) });
    await gateway.processPurchase({
      purchaseId: 'int2',
      buyer: 'buyer1',
      workflowId: 'wf1',
      amount: 5000n,
      txSignature: 'tx-int2',
      blockTime: 1,
    });
    const record = store.getByPurchaseId('int2');
    expect(record?.status).toBe('FAILED');
  });

  it('I3: should retry and eventually settle after bridge failure', async () => {
    const { gateway, store, executionClient } = setup();
    await gateway.processPurchase({
      purchaseId: 'int3',
      buyer: 'buyer1',
      workflowId: 'wf1',
      amount: 5000n,
      txSignature: 'tx-int3',
      blockTime: 1,
    });
    // Force FAILED by swapping runAndSettle to fail AFTER first success?
    // In current gateway, runAndSettle only called once per drive.
    // Instead: we simulate a retry by manually setting FAILED and then retry with a fixed client.
    store.update('int3', { status: 'FAILED', attempts: 1 });
    await gateway.retry('int3');
    const record = store.getByPurchaseId('int3');
    expect(record?.status).toBe('SETTLED');
    expect(record?.attempts).toBe(2);
  });
});
