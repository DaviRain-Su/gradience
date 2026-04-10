import type { StateHandler, StateTransitionResult } from './types.js';
import type { GatewayPurchaseRecord } from '../types.js';
import type { ArenaTaskClient } from '../gateway.js';

export class ApplyingHandler implements StateHandler {
    constructor(private readonly arenaClient: ArenaTaskClient) {}

    async handle(record: GatewayPurchaseRecord): Promise<StateTransitionResult> {
        if (!record.taskId) {
            return { nextState: 'FAILED' };
        }
        try {
            await this.arenaClient.submit(BigInt(record.taskId), {
                resultRef: `ipfs://result-${record.purchaseId}`,
                traceRef: `ipfs://trace-${record.purchaseId}`,
                runtimeEnv: { provider: 'gateway-e2e', model: 'gpt-4', runtime: 'node', version: '1.0' },
            });
            return { nextState: 'SUBMITTED' };
        } catch (err) {
            console.error('submit failed:', err);
            return { nextState: 'FAILED' };
        }
    }
}
