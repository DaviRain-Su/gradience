import { describe, it, expect, beforeEach } from 'vitest';
import { GatewayStore } from '../store.js';
import type { GatewayPurchaseRecord } from '../types.js';

describe('GatewayStore', () => {
    let store: GatewayStore;

    beforeEach(() => {
        store = new GatewayStore(':memory:');
    });

    function makeRecord(purchaseId: string, status: GatewayPurchaseRecord['status']): GatewayPurchaseRecord {
        const now = new Date().toISOString();
        return {
            purchaseId,
            buyer: 'buyer1',
            workflowId: 'wf1',
            amount: '1000',
            txSignature: `tx-${purchaseId}`,
            blockTime: 1234567890,
            status,
            attempts: 0,
            createdAt: now,
            updatedAt: now,
        };
    }

    it('H1: should insert and retrieve a purchase record', () => {
        const record = makeRecord('p1', 'PENDING');
        store.insert(record);
        const found = store.getByPurchaseId('p1');
        expect(found).not.toBeNull();
        expect(found?.status).toBe('PENDING');
    });

    it('B1: should handle duplicate purchase_id gracefully', () => {
        const record = makeRecord('p1', 'PENDING');
        store.insert(record);
        expect(() => store.insert(record)).not.toThrow();
        const list = store.listByStatus('PENDING');
        expect(list).toHaveLength(1);
    });

    it('E1: should return null for unknown purchaseId', () => {
        expect(store.getByPurchaseId('unknown')).toBeNull();
    });

    it('E2: should list records by status', () => {
        store.insert(makeRecord('p1', 'PENDING'));
        store.insert(makeRecord('p2', 'SETTLED'));
        store.insert(makeRecord('p3', 'PENDING'));
        const pending = store.listByStatus('PENDING');
        expect(pending).toHaveLength(2);
    });

    it('should update fields correctly', () => {
        store.insert(makeRecord('p1', 'PENDING'));
        store.update('p1', { status: 'TASK_CREATING', taskId: '99' });
        const found = store.getByPurchaseId('p1');
        expect(found?.status).toBe('TASK_CREATING');
        expect(found?.taskId).toBe('99');
    });
});
