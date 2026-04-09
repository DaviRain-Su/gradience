/**
 * Default OWS Policies for Gradience
 *
 * Pre-built policy templates that can be applied to agent wallets.
 *
 * @module wallet/default-policies
 */

import type { OWSPolicyDef } from './ows-sdk-bridge.js';

export const POLICY_SOLANA_DEVNET_ONLY: OWSPolicyDef = {
    id: 'gradience-solana-devnet',
    name: 'Solana Devnet Only',
    version: 1,
    created_at: new Date().toISOString(),
    rules: [
        {
            type: 'allowed_chains',
            chain_ids: ['solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'],
        },
    ],
    action: 'deny',
};

export const POLICY_CONSERVATIVE_AGENT: OWSPolicyDef = {
    id: 'gradience-conservative',
    name: 'Conservative Agent',
    version: 1,
    created_at: new Date().toISOString(),
    rules: [
        {
            type: 'allowed_chains',
            chain_ids: ['solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'],
        },
        {
            type: 'expires_at',
            timestamp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
    ],
    action: 'deny',
};

export const POLICY_TASK_RUNNER: OWSPolicyDef = {
    id: 'gradience-task-runner',
    name: 'Task Runner',
    version: 1,
    created_at: new Date().toISOString(),
    rules: [
        {
            type: 'allowed_chains',
            chain_ids: ['solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'],
        },
    ],
    action: 'deny',
};

export const DEFAULT_POLICIES: OWSPolicyDef[] = [
    POLICY_SOLANA_DEVNET_ONLY,
    POLICY_CONSERVATIVE_AGENT,
    POLICY_TASK_RUNNER,
];
