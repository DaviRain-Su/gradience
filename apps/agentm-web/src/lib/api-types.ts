// Types re-exported for hooks that reference api-server types

export interface AttestationSummary {
    taskId: number;
    score: number;
    category: number;
    completedAt: number;
    credential: string;
    schema: string;
}
