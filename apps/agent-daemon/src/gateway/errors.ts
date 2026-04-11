/**
 * Workflow Execution Gateway — Error Definitions
 */

export class GatewayError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly cause?: unknown,
    ) {
        super(message);
        this.name = 'GatewayError';
    }
}

export const GW_PURCHASE_EXISTS = 'GW_0001';
export const GW_PURCHASE_NOT_FOUND = 'GW_0002';
export const GW_INVALID_EVENT = 'GW_0003';
export const GW_POST_TASK_FAILED = 'GW_0004';
export const GW_APPLY_FAILED = 'GW_0005';
export const GW_EXECUTION_FAILED = 'GW_0006';
export const GW_SETTLEMENT_FAILED = 'GW_0007';
export const GW_NOT_RETRYABLE = 'GW_0008';
export const GW_STORE_ERROR = 'GW_0009';
export const GW_TASK_ID_UNAVAILABLE = 'GW_0010';
export const GW_WORKFLOW_NOT_FOUND = 'GW_0011';
