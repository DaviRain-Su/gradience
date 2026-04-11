/**
 * VelWorkflowExecutionClient — Gateway Execution Layer
 *
 * Bridges Gateway's ExecutionClient interface to VEL's DefaultVelOrchestrator.
 */

import { logger } from '../utils/logger.js';
import type { DefaultVelOrchestrator } from '../vel/orchestrator.js';
import type { TeeExecutionRequest } from '../vel/types.js';
import type { ExecutionClient } from './gateway.js';
import type { GatewayWorkflowResolver } from './resolvers/local-resolver.js';

export class VelWorkflowExecutionClient implements ExecutionClient {
    constructor(
        private readonly orchestrator: DefaultVelOrchestrator,
        private readonly workflowResolver: GatewayWorkflowResolver,
    ) {}

    async runAndSettle(request: {
        workflowId: string;
        workflowDefinition: { version: '1.0'; name: string; steps: any[] };
        inputs: Record<string, unknown>;
        taskId: number;
        executorAddress: string;
        timeoutMs: number;
    }): Promise<string> {
        // Resolve the real workflow definition (ignoring the stub definition passed in)
        const resolved = await this.workflowResolver.resolve(
            request.workflowId,
            request.executorAddress,
            request.inputs,
        );

        logger.info(
            { workflowId: request.workflowId, taskId: request.taskId, steps: resolved.steps.length },
            'Resolved workflow for execution',
        );

        const teeRequest: TeeExecutionRequest = {
            workflowId: request.workflowId,
            workflowDefinition: {
                version: '1.0',
                name: resolved.name,
                steps: resolved.steps,
            },
            inputs: resolved.inputs,
            taskId: request.taskId,
            executorAddress: request.executorAddress,
            timeoutMs: request.timeoutMs,
        };

        return this.orchestrator.runAndSettle(teeRequest);
    }
}

export function createVelWorkflowExecutionClient(
    orchestrator: DefaultVelOrchestrator,
    workflowResolver: GatewayWorkflowResolver,
): VelWorkflowExecutionClient {
    return new VelWorkflowExecutionClient(orchestrator, workflowResolver);
}
