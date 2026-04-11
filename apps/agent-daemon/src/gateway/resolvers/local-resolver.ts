/**
 * Local Workflow Resolver — Gateway Execution Layer
 *
 * Maps workflowId to a real workflow definition for local development/testing.
 * In production this is replaced by an on-chain or IPFS resolver.
 */

import { GatewayError, GW_WORKFLOW_NOT_FOUND } from '../errors.js';
import type { GradienceWorkflow, WorkflowStep } from '@gradiences/workflow-engine';

export interface ResolvedWorkflow {
    workflowId: string;
    version: '1.0';
    name: string;
    steps: any[];
    inputs: Record<string, unknown>;
}

export interface GatewayWorkflowResolver {
    resolve(workflowId: string, buyer: string, purchaseInputs?: Record<string, unknown>): Promise<ResolvedWorkflow>;
}

// Hardcoded demo workflows for development
const DEMO_WORKFLOWS: Record<string, GradienceWorkflow> = {
    'swap-demo': {
        id: 'swap-demo',
        name: 'Simple SOL-USDC Swap',
        description: 'Swap SOL to USDC via Jupiter',
        author: 'gradience',
        version: '1.0',
        steps: [
            {
                id: 'step-1',
                name: 'swap',
                chain: 'solana',
                action: 'swap',
                params: {
                    inputMint: 'So11111111111111111111111111111111111111112',
                    outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                    amount: '{{amount}}',
                    slippageBps: 50,
                },
            } as WorkflowStep,
        ],
        pricing: { model: 'free' },
        revenueShare: { creator: 0, user: 0, agent: 9500, protocol: 200, judge: 300 },
        requirements: {},
        isPublic: true,
        isTemplate: false,
        tags: ['swap', 'demo'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        contentHash: '',
        signature: '',
    },
    'transfer-demo': {
        id: 'transfer-demo',
        name: 'Simple Transfer',
        description: 'Transfer tokens to a recipient',
        author: 'gradience',
        version: '1.0',
        steps: [
            {
                id: 'step-1',
                name: 'transfer',
                chain: 'solana',
                action: 'transfer',
                params: {
                    recipient: '{{recipient}}',
                    mint: 'So11111111111111111111111111111111111111112',
                    amount: '{{amount}}',
                },
            } as WorkflowStep,
        ],
        pricing: { model: 'free' },
        revenueShare: { creator: 0, user: 0, agent: 9500, protocol: 200, judge: 300 },
        requirements: {},
        isPublic: true,
        isTemplate: false,
        tags: ['transfer', 'demo'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        contentHash: '',
        signature: '',
    },
    'stake-demo': {
        id: 'stake-demo',
        name: 'Stake SOL',
        description: 'Stake SOL to a validator',
        author: 'gradience',
        version: '1.0',
        steps: [
            {
                id: 'step-1',
                name: 'stake',
                chain: 'solana',
                action: 'stake',
                params: {
                    validatorVoteAccount: '{{validator}}',
                    amount: '{{amount}}',
                },
            } as WorkflowStep,
        ],
        pricing: { model: 'free' },
        revenueShare: { creator: 0, user: 0, agent: 9500, protocol: 200, judge: 300 },
        requirements: {},
        isPublic: true,
        isTemplate: false,
        tags: ['stake', 'demo'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        contentHash: '',
        signature: '',
    },
};

export class LocalWorkflowResolver implements GatewayWorkflowResolver {
    async resolve(
        workflowId: string,
        _buyer: string,
        purchaseInputs?: Record<string, unknown>,
    ): Promise<ResolvedWorkflow> {
        const workflow = DEMO_WORKFLOWS[workflowId];
        if (!workflow) {
            throw new GatewayError(GW_WORKFLOW_NOT_FOUND, `Workflow ${workflowId} not found`);
        }

        // Inject purchase inputs into step params
        const inputs = purchaseInputs ?? {};
        const steps = workflow.steps.map((step) => ({
            ...step,
            params: interpolateParams(step.params, inputs),
        }));

        return {
            workflowId: workflow.id,
            version: '1.0',
            name: workflow.name,
            steps,
            inputs,
        };
    }
}

function interpolateParams(params: Record<string, unknown>, inputs: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
            const inputKey = value.slice(2, -2);
            result[key] = inputs[inputKey] != null ? inputs[inputKey] : value;
        } else {
            result[key] = value;
        }
    }
    return result;
}

export function createLocalWorkflowResolver(): LocalWorkflowResolver {
    return new LocalWorkflowResolver();
}
