import { describe, it, expect, vi } from 'vitest';
import { ExecutingHandler } from '../executing-handler.js';
import type { GatewayPurchaseRecord } from '../../types.js';

describe('ExecutingHandler', () => {
  it('should call executionClient and return SETTLING on success', async () => {
    const runAndSettle = vi.fn().mockResolvedValue('tx-sig-123');
    const handler = new ExecutingHandler({ runAndSettle });

    const record: GatewayPurchaseRecord = {
      purchaseId: 'p1',
      buyer: 'buyer1',
      workflowId: 'swap-demo',
      amount: '100',
      txSignature: 'sig',
      blockTime: 1,
      status: 'SUBMITTED',
      taskId: '99',
      agentId: 'agent1',
      attempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await handler.handle(record);
    expect(result.nextState).toBe('SETTLING');
    expect(result.patch).toEqual({ settlementTx: 'tx-sig-123' });

    expect(runAndSettle).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'swap-demo',
        taskId: 99,
        executorAddress: 'agent1',
        inputs: {},
        timeoutMs: 60000,
      }),
    );
  });

  it('should include preferredAgent in inputs when present', async () => {
    const runAndSettle = vi.fn().mockResolvedValue('tx-sig-456');
    const handler = new ExecutingHandler({ runAndSettle });

    const record: GatewayPurchaseRecord = {
      purchaseId: 'p2',
      buyer: 'buyer2',
      workflowId: 'transfer-demo',
      amount: '200',
      txSignature: 'sig2',
      blockTime: 2,
      preferredAgent: 'pref-agent',
      status: 'SUBMITTED',
      taskId: '100',
      agentId: 'agent2',
      attempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await handler.handle(record);
    expect(runAndSettle).toHaveBeenCalledWith(
      expect.objectContaining({
        inputs: { preferredAgent: 'pref-agent' },
      }),
    );
  });

  it('should return FAILED on execution error', async () => {
    const runAndSettle = vi.fn().mockRejectedValue(new Error('TEE crashed'));
    const handler = new ExecutingHandler({ runAndSettle });

    const record: GatewayPurchaseRecord = {
      purchaseId: 'p3',
      buyer: 'buyer3',
      workflowId: 'stake-demo',
      amount: '300',
      txSignature: 'sig3',
      blockTime: 3,
      status: 'SUBMITTED',
      taskId: '101',
      agentId: 'agent3',
      attempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await handler.handle(record);
    expect(result.nextState).toBe('FAILED');
    expect((result.patch as any).error).toBe('TEE crashed');
  });
});
