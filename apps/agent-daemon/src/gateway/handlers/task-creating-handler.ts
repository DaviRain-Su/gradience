import type { StateHandler, StateTransitionResult } from './types.js';
import type { GatewayPurchaseRecord } from '../types.js';
import type { ArenaTaskClient } from '../gateway.js';
import { DefaultArenaTaskFactory } from '../arena-factory.js';

export class TaskCreatingHandler implements StateHandler {
    constructor(
        private readonly arenaClient: ArenaTaskClient,
        private readonly factory: DefaultArenaTaskFactory,
    ) {}

    async handle(record: GatewayPurchaseRecord): Promise<StateTransitionResult> {
        let lastError: unknown;
        const maxInternalRetries = 2;
        for (let attempt = 0; attempt <= maxInternalRetries; attempt++) {
            try {
                const nextTaskId = await this.arenaClient.getNextTaskId();
                const postParams = this.factory.buildPostTaskParams(record, nextTaskId);
                await this.arenaClient.post(postParams);
                return {
                    nextState: 'TASK_CREATED',
                    patch: { taskId: nextTaskId.toString() },
                };
            } catch (err) {
                lastError = err;
                if (attempt < maxInternalRetries) {
                    const jitter = Math.random() * 1000;
                    await new Promise((r) => setTimeout(r, 2000 + jitter));
                }
            }
        }
        console.error('post_task failed after retries:', lastError);
        return { nextState: 'FAILED' };
    }
}
