import { logger } from '../../utils/logger.js';
import type { StateHandler, StateTransitionResult } from './types.js';
import type { GatewayPurchaseRecord } from '../types.js';
import type { ExecutionClient } from '../gateway.js';

export class ExecutingHandler implements StateHandler {
    constructor(private readonly executionClient: ExecutionClient) {}

    async handle(record: GatewayPurchaseRecord): Promise<StateTransitionResult> {
        try {
            // The real workflow definition will be resolved inside VelWorkflowExecutionClient
            // via the GatewayWorkflowResolver. We pass the workflowId and any purchase inputs.
            const txSig = await this.executionClient.runAndSettle({
                workflowId: record.workflowId,
                workflowDefinition: {
                    version: '1.0',
                    name: `workflow-${record.workflowId}`,
                    steps: [], // will be overridden by resolver
                },
                inputs: record.preferredAgent ? { preferredAgent: record.preferredAgent } : {},
                taskId: Number(record.taskId ?? 0),
                executorAddress: record.agentId ?? '',
                timeoutMs: 60_000,
            });
            return {
                nextState: 'SETTLING',
                patch: { settlementTx: txSig },
            };
        } catch (err) {
            logger.error({ err, purchaseId: record.purchaseId }, 'Execution/settlement failed');
            return {
                nextState: 'FAILED',
                patch: { error: err instanceof Error ? err.message : 'Execution failed' },
            };
        }
    }
}
