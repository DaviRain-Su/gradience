import { describe, it, expect, vi } from 'vitest';
import { PendingHandler } from '../handlers/pending-handler.js';
import { TaskCreatingHandler } from '../handlers/task-creating-handler.js';
import { TaskCreatedHandler } from '../handlers/task-created-handler.js';
import { ApplyingHandler } from '../handlers/applying-handler.js';
import { ExecutingHandler } from '../handlers/executing-handler.js';
import { SettlingHandler } from '../handlers/settling-handler.js';
import { DefaultArenaTaskFactory } from '../arena-factory.js';
import type { GatewayPurchaseRecord } from '../types.js';

describe('State Handlers', () => {
    const baseRecord: GatewayPurchaseRecord = {
        purchaseId: 'p1',
        buyer: 'buyer1',
        workflowId: 'wf1',
        amount: '1000',
        txSignature: 'tx1',
        blockTime: 1,
        status: 'PENDING',
        attempts: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    it('PendingHandler → TASK_CREATING', async () => {
        const handler = new PendingHandler();
        const result = await handler.handle(baseRecord);
        expect(result.nextState).toBe('TASK_CREATING');
    });

    it('TaskCreatingHandler retries internally and succeeds', async () => {
        const post = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue('ok');
        const getNextTaskId = vi.fn().mockResolvedValue(7n);
        const arenaClient = { post, apply: vi.fn(), submit: vi.fn(), getNextTaskId };
        const factory = new DefaultArenaTaskFactory('judge1');
        const handler = new TaskCreatingHandler(arenaClient as any, factory);
        const result = await handler.handle({ ...baseRecord, status: 'TASK_CREATING' });
        expect(result.nextState).toBe('TASK_CREATED');
        expect(result.patch?.taskId).toBe('7');
        expect(post).toHaveBeenCalledTimes(2);
    });

    it('TaskCreatingHandler eventually fails', async () => {
        const post = vi.fn().mockRejectedValue(new Error('always fail'));
        const getNextTaskId = vi.fn().mockResolvedValue(7n);
        const arenaClient = { post, apply: vi.fn(), submit: vi.fn(), getNextTaskId };
        const factory = new DefaultArenaTaskFactory('judge1');
        const handler = new TaskCreatingHandler(arenaClient as any, factory);
        const result = await handler.handle({ ...baseRecord, status: 'TASK_CREATING' });
        expect(result.nextState).toBe('FAILED');
    });

    it('TaskCreatedHandler applies and sets agentId', async () => {
        const apply = vi.fn().mockResolvedValue('apply-tx');
        const arenaClient = { post: vi.fn(), apply, submit: vi.fn(), getNextTaskId: vi.fn() };
        const handler = new TaskCreatedHandler(arenaClient as any, { agentWallet: { publicKey: 'agent1' } } as any);
        const result = await handler.handle({ ...baseRecord, status: 'TASK_CREATED', taskId: '5' });
        expect(result.nextState).toBe('APPLIED');
        expect(result.patch?.agentId).toBe('agent1');
    });

    it('ApplyingHandler submits and moves to SUBMITTED', async () => {
        const submit = vi.fn().mockResolvedValue('submit-tx');
        const arenaClient = { post: vi.fn(), apply: vi.fn(), submit, getNextTaskId: vi.fn() };
        const handler = new ApplyingHandler(arenaClient as any);
        const result = await handler.handle({ ...baseRecord, status: 'APPLIED', taskId: '5' });
        expect(result.nextState).toBe('SUBMITTED');
    });

    it('ExecutingHandler runs and moves to SETTLING', async () => {
        const runAndSettle = vi.fn().mockResolvedValue('settle-tx');
        const handler = new ExecutingHandler({ runAndSettle } as any);
        const result = await handler.handle({ ...baseRecord, status: 'SUBMITTED', taskId: '5', agentId: 'agent1' });
        expect(result.nextState).toBe('SETTLING');
        expect(result.patch?.settlementTx).toBe('settle-tx');
    });

    it('SettlingHandler moves to SETTLED with score', async () => {
        const handler = new SettlingHandler();
        const result = await handler.handle({ ...baseRecord, status: 'SETTLING' });
        expect(result.nextState).toBe('SETTLED');
        expect(result.patch?.score).toBe(100);
    });
});
