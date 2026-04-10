import type { StateHandler, StateTransitionResult } from './types.js';
import type { GatewayPurchaseRecord } from '../types.js';
import type { ArenaTaskClient } from '../gateway.js';
import type { GatewayConfig } from '../types.js';

export class TaskCreatedHandler implements StateHandler {
    constructor(
        private readonly arenaClient: ArenaTaskClient,
        private readonly config: GatewayConfig,
    ) {}

    async handle(record: GatewayPurchaseRecord): Promise<StateTransitionResult> {
        if (!record.taskId) {
            return { nextState: 'FAILED' };
        }
        try {
            await this.arenaClient.apply(BigInt(record.taskId));
            return {
                nextState: 'APPLIED',
                patch: { agentId: this.config.agentWallet.publicKey },
            };
        } catch (err) {
            console.error('apply failed:', err);
            return { nextState: 'FAILED' };
        }
    }
}
