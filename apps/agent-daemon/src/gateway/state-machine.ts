/**
 * Purchase State Machine
 */

import type { GatewayPurchaseRecord, PurchaseStatus } from './types.js';
import { GatewayError, GW_NOT_RETRYABLE } from './errors.js';

export type StateAction =
    | 'processPurchase'
    | 'postTaskSuccess'
    | 'postTaskFail'
    | 'autoApplySuccess'
    | 'autoApplyFail'
    | 'submitSuccess'
    | 'submitFail'
    | 'startExecution'
    | 'executionSuccess'
    | 'executionFail'
    | 'settlementSuccess'
    | 'settlementFail'
    | 'retry';

const TRANSITIONS: Record<PurchaseStatus, Partial<Record<StateAction, PurchaseStatus>>> = {
    PENDING: {
        processPurchase: 'TASK_CREATING',
    },
    TASK_CREATING: {
        postTaskSuccess: 'TASK_CREATED',
        postTaskFail: 'FAILED',
    },
    TASK_CREATED: {
        autoApplySuccess: 'APPLIED',
        autoApplyFail: 'FAILED',
    },
    APPLIED: {
        submitSuccess: 'SUBMITTED',
        submitFail: 'FAILED',
    },
    SUBMITTING: {
        submitSuccess: 'SUBMITTED',
        submitFail: 'FAILED',
    },
    SUBMITTED: {
        startExecution: 'EXECUTING',
    },
    EXECUTING: {
        executionSuccess: 'SETTLING',
        executionFail: 'FAILED',
    },
    SETTLING: {
        settlementSuccess: 'SETTLED',
        settlementFail: 'FAILED',
    },
    SETTLED: {},
    FAILED: {
        retry: 'TASK_CREATING',
    },
};

export function canTransition(currentStatus: PurchaseStatus, action: StateAction): boolean {
    return TRANSITIONS[currentStatus]?.[action] !== undefined;
}

export function getNextStatus(currentStatus: PurchaseStatus, action: StateAction): PurchaseStatus | null {
    return TRANSITIONS[currentStatus]?.[action] ?? null;
}

export function transition(record: GatewayPurchaseRecord, action: StateAction, maxRetries: number): PurchaseStatus {
    if (action === 'retry') {
        if (record.status !== 'FAILED') {
            throw new GatewayError(
                GW_NOT_RETRYABLE,
                `Cannot retry purchase ${record.purchaseId} from status ${record.status}`,
            );
        }
        if (record.attempts >= maxRetries) {
            throw new GatewayError(
                GW_NOT_RETRYABLE,
                `Purchase ${record.purchaseId} has exceeded max retries (${maxRetries})`,
            );
        }
    }

    const next = getNextStatus(record.status, action);
    if (!next) {
        throw new GatewayError(GW_NOT_RETRYABLE, `Invalid transition: ${record.status} → ${action}`);
    }

    return next;
}
