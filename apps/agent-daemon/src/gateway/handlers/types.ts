import type { GatewayPurchaseRecord, PurchaseStatus } from '../types.js';

export interface StateTransitionResult {
    nextState: PurchaseStatus;
    patch?: Partial<GatewayPurchaseRecord>;
    delayMs?: number;
}

export interface StateHandler {
    handle(record: GatewayPurchaseRecord): Promise<StateTransitionResult>;
}
