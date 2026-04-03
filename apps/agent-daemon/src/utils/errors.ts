export const ErrorCodes = {
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    AUTH_INVALID: 'AUTH_INVALID',
    TASK_NOT_FOUND: 'TASK_NOT_FOUND',
    TASK_NOT_CANCELLABLE: 'TASK_NOT_CANCELLABLE',
    AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
    AGENT_ALREADY_EXISTS: 'AGENT_ALREADY_EXISTS',
    AGENT_ALREADY_RUNNING: 'AGENT_ALREADY_RUNNING',
    AGENT_LIMIT_REACHED: 'AGENT_LIMIT_REACHED',
    SEND_FAILED: 'SEND_FAILED',
    KEY_LOCKED: 'KEY_LOCKED',
    KEY_NOT_FOUND: 'KEY_NOT_FOUND',
    CONNECTION_LOST: 'CONNECTION_LOST',
    INVALID_REQUEST: 'INVALID_REQUEST',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export class DaemonError extends Error {
    constructor(
        public readonly code: ErrorCode,
        message: string,
        public readonly statusCode: number = 500,
    ) {
        super(message);
        this.name = 'DaemonError';
    }
}
