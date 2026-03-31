export interface TaskCreatedEvent {
    event: 'task_created';
    task_id: number;
    poster?: string;
    judge?: string;
    reward?: number;
    category?: number;
    deadline?: number;
}

export interface SubmissionReceivedEvent {
    event: 'submission_received';
    task_id: number;
    agent?: string;
    result_ref?: string;
    trace_ref?: string;
    submission_slot?: number;
}

export interface GenericProgramEvent {
    event: string;
    [key: string]: unknown;
}

export type ProgramEvent = TaskCreatedEvent | SubmissionReceivedEvent | GenericProgramEvent;

export interface EventEnvelope {
    slot: number;
    timestamp: number;
    event: ProgramEvent;
}

export type WorkflowTrigger = 'task_created' | 'submission_received';
export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface WorkflowRecord {
    id: string;
    taskId: number;
    trigger: WorkflowTrigger;
    slot: number;
    timestamp: number;
    agent: string | null;
    status: WorkflowStatus;
    dedupeKey: string;
    error: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface EnqueueWorkflowInput {
    taskId: number;
    trigger: WorkflowTrigger;
    slot: number;
    timestamp: number;
    agent: string | null;
    dedupeKey: string;
}
