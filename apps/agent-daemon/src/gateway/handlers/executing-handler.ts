import type { StateHandler, StateTransitionResult } from './types.js';
import type { GatewayPurchaseRecord } from '../types.js';
import type { ExecutionClient } from '../gateway.js';

export class ExecutingHandler implements StateHandler {
    constructor(private readonly executionClient: ExecutionClient) {}

    async handle(record: GatewayPurchaseRecord): Promise<StateTransitionResult> {
        try {
            const txSig = await this.executionClient.runAndSettle({
                workflowId: record.workflowId,
                workflowDefinition: {
                    version: '1.0',
                    name: `workflow-${record.workflowId}`,
                    steps: [{ type: 'swap', params: { inputMint: 'A', outputMint: 'B', amount: 100n } }],
                },
                inputs: {},
                taskId: Number(record.taskId ?? 0),
                executorAddress: record.agentId ?? '',
                timeoutMs: 15_000,
            });
            return {
                nextState: 'SETTLING',
                patch: { settlementTx: txSig },
            };
        } catch (err) {
            console.error('execution/settlement failed:', err);
            return { nextState: 'FAILED' };
        }
    }
}
