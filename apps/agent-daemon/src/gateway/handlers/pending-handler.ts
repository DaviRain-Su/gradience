import type { StateHandler, StateTransitionResult } from './types.js';
import type { GatewayPurchaseRecord } from '../types.js';

export class PendingHandler implements StateHandler {
    async handle(_record: GatewayPurchaseRecord): Promise<StateTransitionResult> {
        return { nextState: 'TASK_CREATING' };
    }
}
