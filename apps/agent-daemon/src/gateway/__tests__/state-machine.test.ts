import { describe, it, expect } from 'vitest';
import { canTransition, getNextStatus, transition } from '../state-machine.js';
import type { GatewayPurchaseRecord } from '../types.js';
import { GW_NOT_RETRYABLE } from '../errors.js';

function makeRecord(status: GatewayPurchaseRecord['status'], attempts = 0): GatewayPurchaseRecord {
  const now = new Date().toISOString();
  return {
    purchaseId: 'p1',
    buyer: 'b1',
    workflowId: 'wf1',
    amount: '100',
    txSignature: 'tx1',
    blockTime: 1,
    status,
    attempts,
    createdAt: now,
    updatedAt: now,
  };
}

describe('PurchaseStateMachine', () => {
  it('H2: should allow PENDING → TASK_CREATING transition', () => {
    expect(canTransition('PENDING', 'processPurchase')).toBe(true);
    expect(getNextStatus('PENDING', 'processPurchase')).toBe('TASK_CREATING');
  });

  it('H3: should allow TASK_CREATING → TASK_CREATED on success', () => {
    expect(getNextStatus('TASK_CREATING', 'postTaskSuccess')).toBe('TASK_CREATED');
  });

  it('E3: should reject illegal transition SETTLED → EXECUTING', () => {
    expect(canTransition('SETTLED', 'startExecution')).toBe(false);
    expect(() => transition(makeRecord('SETTLED'), 'startExecution', 3)).toThrow();
    try {
      transition(makeRecord('SETTLED'), 'startExecution', 3);
    } catch (e) {
      expect((e as Error).message).toContain('Invalid transition');
    }
  });

  it('B2: should allow FAILED → TASK_CREATING when retrying', () => {
    const next = transition(makeRecord('FAILED', 1), 'retry', 3);
    expect(next).toBe('TASK_CREATING');
  });

  it('E4: should reject retry when attempts exceed maxRetries', () => {
    expect(() => transition(makeRecord('FAILED', 3), 'retry', 3)).toThrow();
    try {
      transition(makeRecord('FAILED', 3), 'retry', 3);
    } catch (e) {
      expect((e as import('../errors').GatewayError).code).toBe(GW_NOT_RETRYABLE);
    }
  });

  it('should reject retry on non-failed status', () => {
    expect(() => transition(makeRecord('PENDING'), 'retry', 3)).toThrow();
  });
});
