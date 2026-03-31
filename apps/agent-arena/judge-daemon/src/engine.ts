import type { EventEnvelope, ProgramEvent, WorkflowRecord } from './types.js';
import type { WorkflowStore } from './store.js';

export interface AbsurdWorkflowEngineOptions {
    onWorkflowQueued?: (workflow: WorkflowRecord) => void | Promise<void>;
}

export class AbsurdWorkflowEngine {
    private onWorkflowQueued?: (workflow: WorkflowRecord) => void | Promise<void>;

    constructor(
        private readonly store: WorkflowStore,
        options: AbsurdWorkflowEngineOptions = {},
    ) {
        this.onWorkflowQueued = options.onWorkflowQueued;
    }

    setOnWorkflowQueued(
        handler: (workflow: WorkflowRecord) => void | Promise<void>,
    ): void {
        this.onWorkflowQueued = handler;
    }

    async initialize(): Promise<void> {
        await this.store.init();
    }

    async handleEvent(envelope: EventEnvelope): Promise<void> {
        const trigger = toTrigger(envelope.event);
        if (!trigger) {
            return;
        }
        const taskId = toTaskId(envelope.event);
        if (taskId === null) {
            return;
        }
        const record = await this.store.enqueue({
            taskId,
            trigger,
            slot: envelope.slot,
            timestamp: envelope.timestamp,
            agent: toAgent(envelope.event),
            dedupeKey: `${trigger}:${taskId}:${envelope.slot}`,
        });
        if (this.onWorkflowQueued) {
            await this.onWorkflowQueued(record);
        }
    }

    async listPending(limit = 100): Promise<WorkflowRecord[]> {
        return this.store.listPending(limit);
    }

    async markRunning(id: string): Promise<boolean> {
        return this.store.claimPending(id);
    }

    async markCompleted(id: string): Promise<void> {
        await this.store.updateStatus(id, 'completed');
    }

    async markFailed(id: string, error: string): Promise<void> {
        await this.store.updateStatus(id, 'failed', error);
    }

    async close(): Promise<void> {
        await this.store.close();
    }
}

function toTrigger(event: ProgramEvent): 'task_created' | 'submission_received' | null {
    if (event.event === 'task_created' || event.event === 'submission_received') {
        return event.event;
    }
    return null;
}

function toTaskId(event: ProgramEvent): number | null {
    const raw = event.task_id;
    if (typeof raw !== 'number' || Number.isNaN(raw)) {
        return null;
    }
    return raw;
}

function toAgent(event: ProgramEvent): string | null {
    if (event.event !== 'submission_received') {
        return null;
    }
    if (typeof event.agent === 'string') {
        return event.agent;
    }
    return null;
}
