import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    evaluateT58InteropAudit,
} from './t58-interop-audit.ts';
import type { InteropDrillResult } from './drill-interop-e2e.ts';

function makeDrillResult(overrides: Partial<InteropDrillResult> = {}): InteropDrillResult {
    const drill = {
        agent: 'winner-agent',
        taskId: 999,
        participants: ['winner-agent', 'loser-agent'],
        identityRecipients: ['winner-agent', 'poster-agent', 'judge-agent', 'loser-agent'],
        feedbackDispatches: [
            { role: 'winner' as const, agent: 'winner-agent' },
            { role: 'poster' as const, agent: 'poster-agent' },
            { role: 'judge' as const, agent: 'judge-agent' },
            { role: 'loser' as const, agent: 'loser-agent' },
        ],
        relayStatus: { success: 4, failed: 0 },
        erc8004Status: {
            identitySuccess: 4,
            feedbackSuccess: 4,
            knownAgents: 4,
        },
        agentImStatusByAgent: {
            'winner-agent': {
                identityRegistered: true,
                erc8004FeedbackCount: 1,
                evmReputationCount: 1,
            },
            'poster-agent': {
                identityRegistered: true,
                erc8004FeedbackCount: 1,
                evmReputationCount: 1,
            },
            'judge-agent': {
                identityRegistered: true,
                erc8004FeedbackCount: 1,
                evmReputationCount: 1,
            },
            'loser-agent': {
                identityRegistered: true,
                erc8004FeedbackCount: 1,
                evmReputationCount: 1,
            },
        },
    };
    return { ...drill, ...overrides };
}

test('evaluateT58InteropAudit passes for complete multi-role drill', () => {
    const checks = evaluateT58InteropAudit(makeDrillResult());
    assert.equal(checks.length, 4);
    assert.ok(checks.every((entry) => entry.success));
});

test('evaluateT58InteropAudit fails when erc8004 status is missing', () => {
    const checks = evaluateT58InteropAudit(
        makeDrillResult({
            erc8004Status: null,
        }),
    );
    assert.ok(checks.some((entry) => entry.id === 'erc8004_status' && !entry.success));
});

test('evaluateT58InteropAudit fails when agent-im counters are below expected', () => {
    const checks = evaluateT58InteropAudit(
        makeDrillResult({
            agentImStatusByAgent: {
                'winner-agent': {
                    identityRegistered: true,
                    erc8004FeedbackCount: 1,
                    evmReputationCount: 1,
                },
                'poster-agent': {
                    identityRegistered: true,
                    erc8004FeedbackCount: 0,
                    evmReputationCount: 0,
                },
                'judge-agent': {
                    identityRegistered: true,
                    erc8004FeedbackCount: 1,
                    evmReputationCount: 1,
                },
                'loser-agent': {
                    identityRegistered: true,
                    erc8004FeedbackCount: 1,
                    evmReputationCount: 1,
                },
            },
        }),
    );
    assert.ok(checks.some((entry) => entry.id === 'agent_im_sync' && !entry.success));
});
