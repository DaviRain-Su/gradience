import { describe, it, expect, vi } from 'vitest';
import { DefaultWorkflowExecutionGateway } from '../gateway.js';
import { GatewayStore } from '../store.js';
import { DefaultArenaTaskFactory } from '../arena-factory.js';

describe('DefaultWorkflowExecutionGateway drive', () => {
  const dbPath = ':memory:';

  it('should drive purchase from PENDING to SETTLING with mocks', async () => {
    const store = new GatewayStore(dbPath);
    const factory = new DefaultArenaTaskFactory('judge1');

    const arenaClient = {
      post: vi.fn().mockResolvedValue('post-tx'),
      apply: vi.fn().mockResolvedValue('apply-tx'),
      submit: vi.fn().mockResolvedValue('submit-tx'),
      getNextTaskId: vi.fn().mockResolvedValue(123n),
    };

    const executionClient = {
      runAndSettle: vi.fn().mockResolvedValue('settle-tx-sig'),
    };

    const gateway = new DefaultWorkflowExecutionGateway(
      store,
      factory,
      arenaClient as any,
      executionClient,
      {
        marketplaceProgramId: 'prog1',
        arenaProgramId: 'prog2',
        rpcEndpoint: 'http://localhost:8899',
        dbPath,
        posterWallet: { publicKey: 'judge1', signAndSendTransaction: async () => '' },
        agentWallet: { publicKey: 'agent1', signAndSendTransaction: async () => '' },
        defaultJudge: 'judge1',
        pollIntervalMs: 5000,
        maxRetries: 3,
        retryDelayMs: 1000,
      },
    );

    await gateway.processPurchase({
      purchaseId: 'p-test-1',
      buyer: 'buyer1',
      workflowId: 'swap-demo',
      amount: 100n,
      txSignature: 'purchase-sig',
      blockTime: 1,
    });

    const record = await new Promise<ReturnType<typeof gateway.getStatus>>((resolve) => {
      setTimeout(() => resolve(gateway.getStatus('p-test-1')), 100);
    });
    expect(record).not.toBeNull();
    expect(record?.status).toSatisfy((s: string) => s === 'SETTLING' || s === 'SETTLED');
    expect(record?.settlementTx).toBe('settle-tx-sig');
  });
});
