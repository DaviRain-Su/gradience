import type { IdentityDispatch, FeedbackDispatch } from '../types.js';

export function toErc8004RegistrationPayload(payload: unknown): unknown {
    if (!isIdentityDispatch(payload)) {
        throw new Error('invalid identity dispatch payload');
    }
    const { signal, role, agent } = payload;
    return {
        type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
        agentPubkey: agent,
        name: agent,
        description: 'Agent participating in Gradience Protocol',
        services: [
            {
                name: 'gradience',
                endpoint: 'solana:gradience',
                version: '0.3',
            },
            {
                name: 'a2a',
                endpoint: 'a2a:gradience',
                version: '0.1',
            },
        ],
        supportedTrust: ['reputation', 'crypto-economic'],
        registrations: [
            {
                agentId: agent,
                agentRegistry: 'solana:101:metaplex',
            },
        ],
        gradience: {
            role,
            firstTaskId: signal.taskId,
            firstJudgeTx: signal.chainTx,
        },
    };
}

export function toErc8004FeedbackPayload(payload: unknown): unknown {
    if (!isFeedbackDispatch(payload)) {
        throw new Error('invalid feedback dispatch payload');
    }
    const { signal, role, agent, roleScore } = payload;
    return {
        agentPubkey: agent,
        tag1: 'taskScore',
        tag2: `category-${signal.category}`,
        tag3: `role-${role}`,
        value: roleScore,
        valueDecimals: 0,
        endpoint: 'solana:gradience',
        feedbackURI: signal.reasonRef,
        gradience: {
            taskId: signal.taskId,
            feedbackRole: role,
            feedbackAgent: agent,
            winner: signal.winner,
            poster: signal.poster,
            judge: signal.judge,
            participants: signal.participants ?? [],
            reward: signal.reward,
            reasonRef: signal.reasonRef,
            chainTx: signal.chainTx,
            judgedAt: signal.judgedAt,
        },
    };
}

function isIdentityDispatch(value: unknown): value is IdentityDispatch {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const dispatch = value as Partial<IdentityDispatch>;
    return (
        isReputationInteropSignal(dispatch.signal) && isInteropRole(dispatch.role) && typeof dispatch.agent === 'string'
    );
}

function isFeedbackDispatch(value: unknown): value is FeedbackDispatch {
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

function isInteropRole(value: unknown): value is 'winner' | 'poster' | 'judge' | 'loser' {
    return value === 'winner' || value === 'poster' || value === 'judge' || value === 'loser';
}

function isReputationInteropSignal(value: unknown): value is {
    taskId: number;
    category: number;
    winner: string;
    poster: string;
    judge: string;
    score: number;
    reward: number;
    reasonRef: string;
    chainTx: string;
    judgedAt: number;
    judgeMode: string;
    participants?: string[];
} {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const signal = value as Partial<{
        taskId: number;
        category: number;
        winner: string;
        poster: string;
        judge: string;
        score: number;
        reward: number;
        reasonRef: string;
        chainTx: string;
        judgedAt: number;
        judgeMode: string;
        participants?: string[];
    }>;
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
            (Array.isArray(signal.participants) && signal.participants.every(p => typeof p === 'string')))
    );
}
