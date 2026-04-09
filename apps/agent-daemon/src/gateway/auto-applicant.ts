/**
 * Agent Auto Applicant
 *
 * Future extension: actively monitor new Arena tasks and auto-apply.
 * For v0.1, the apply logic is inlined inside WorkflowExecutionGateway.drive().
 */

import type { ArenaTaskClient } from './gateway.js';

export interface AgentAutoApplicant {
    apply(taskId: bigint): Promise<string>;
}

export class DefaultAgentAutoApplicant implements AgentAutoApplicant {
    constructor(private readonly arenaClient: ArenaTaskClient) {}

    async apply(taskId: bigint): Promise<string> {
        return this.arenaClient.apply(taskId);
    }
}
