import type { StateHandler, StateTransitionResult } from './types.js';
import type { GatewayPurchaseRecord } from '../types.js';

export class SettlingHandler implements StateHandler {
    async handle(_record: GatewayPurchaseRecord): Promise<StateTransitionResult> {
        // Settlement bridge already invoked by execution client in current architecture.
        return {
            nextState: 'SETTLED',
            patch: { score: 100 },
        };
    }
}
