import { createHmac } from 'node:crypto';

import type {
    ReputationInteropSignal,
    InteropRole,
    InteropOutboxEntry,
    IdentityDispatch,
    FeedbackDispatch,
} from './types.js';

export function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function signPayload(secret: string, timestamp: string, body: string): string {
    const value = `${timestamp}.${body}`;
    return createHmac('sha256', secret).update(value).digest('hex');
}

export function isIdentityDispatch(value: unknown): value is IdentityDispatch {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const dispatch = value as Partial<IdentityDispatch>;
    return (
        isReputationInteropSignal(dispatch.signal) && isInteropRole(dispatch.role) && typeof dispatch.agent === 'string'
    );
}

export function isFeedbackDispatch(value: unknown): value is FeedbackDispatch {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const dispatch = value as Partial<FeedbackDispatch>;
    return (
        isReputationInteropSignal(dispatch.signal) &&
        isInteropRole(dispatch.role) &&
        typeof dispatch.agent === 'string' &&
        typeof dispatch.roleScore === 'number'
    );
}

export function isInteropRole(value: unknown): value is InteropRole {
    return value === 'winner' || value === 'poster' || value === 'judge' || value === 'loser';
}

export function isReputationInteropSignal(value: unknown): value is ReputationInteropSignal {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const signal = value as Partial<ReputationInteropSignal>;
    return (
        typeof signal.taskId === 'number' &&
        typeof signal.category === 'number' &&
        typeof signal.winner === 'string' &&
        typeof signal.poster === 'string' &&
        typeof signal.judge === 'string' &&
        typeof signal.score === 'number' &&
        typeof signal.reward === 'number' &&
        typeof signal.reasonRef === 'string' &&
        typeof signal.chainTx === 'string' &&
        typeof signal.judgedAt === 'number' &&
        typeof signal.judgeMode === 'string' &&
        (typeof signal.participants === 'undefined' ||
            (Array.isArray(signal.participants) && signal.participants.every(value => typeof value === 'string')))
    );
}

export function isOutboxEntry(value: unknown): value is InteropOutboxEntry {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const entry = value as Partial<InteropOutboxEntry>;
    return (
        typeof entry.signal === 'object' &&
        isReputationInteropSignal(entry.signal) &&
        typeof entry.attempts === 'number' &&
        Number.isFinite(entry.attempts) &&
        entry.attempts >= 0 &&
        typeof entry.lastError === 'string' &&
        typeof entry.queuedAt === 'number' &&
        Number.isFinite(entry.queuedAt)
    );
}

export function asMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

export function parseBoolEnv(value: string | undefined, fallback: boolean): boolean {
    if (!value) {
        return fallback;
    }
    return !['0', 'false', 'False', 'FALSE', 'no', 'off'].includes(value);
}

export function judgeMethodToCode(judgeMode: string): number {
    if (judgeMode === 'pool') {
        return 1;
    }
    return 0;
}

export function clampScore(score: number): number {
    if (!Number.isFinite(score)) {
        return 0;
    }
    return Math.max(0, Math.min(100, Math.round(score)));
}
