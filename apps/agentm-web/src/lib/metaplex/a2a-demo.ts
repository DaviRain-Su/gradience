/**
 * Metaplex A2A Demo
 *
 * Demonstrates two Gradience Protocol agents interacting end-to-end:
 *   1. Both agents register on-chain via Metaplex Core
 *   2. Agent A posts a task to the Gradience task market
 *   3. Agent B discovers the task via A2A discovery
 *   4. Agents negotiate terms (2 rounds)
 *   5. Agent B completes work; Gradience Protocol settles payment
 *
 * Designed for the Metaplex Agents Track hackathon demo ($5,000 prize).
 * Runs in simulate mode — no real wallet or RPC required.
 *
 * Tech Spec: docs/metaplex-agent-registry-03-technical-spec.md
 */

import { registerAgent, type MetaplexAgentAsset } from './agent-registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface A2AInteractionStep {
    step: number;
    actor: 'agent_a' | 'agent_b' | 'protocol';
    action: string;
    payload: Record<string, unknown>;
    timestamp: number;
    /** On-chain transaction reference, if applicable */
    txRef?: string;
}

export interface A2ADemoResult {
    agentA: MetaplexAgentAsset;
    agentB: MetaplexAgentAsset;
    steps: A2AInteractionStep[];
    settlement: {
        amount: number;
        token: 'SOL' | 'USDC';
        txRef: string;
        settledAt: number;
    };
    success: boolean;
}

// ---------------------------------------------------------------------------
// Deterministic helpers
// ---------------------------------------------------------------------------

const SETTLEMENT_AMOUNT_LAMPORTS = 50_000_000; // 0.05 SOL

function fakeTxRef(seed: string): string {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, '0') + Math.imul(h ^ 0xdeadbeef, 0x45d9f3b).toString(16).padStart(8, '0');
}

function step(
    index: number,
    actor: A2AInteractionStep['actor'],
    action: string,
    payload: Record<string, unknown>,
    txRef?: string,
): A2AInteractionStep {
    return {
        step: index,
        actor,
        action,
        payload,
        timestamp: Date.now() + index * 800, // stagger timestamps for realism
        txRef,
    };
}

// ---------------------------------------------------------------------------
// Demo agent setup
// ---------------------------------------------------------------------------

const DEMO_WALLET_A = 'F4v1A7qY1jYf2nn89mFn4QjTqD4Y9Za9zVn2C1xTa111';
const DEMO_WALLET_B = '5jVQxM7x7mG3gQqQe8fTQ5zB1nWfU7sW2u5W9h5wB222';

/**
 * Register the two demo agents.
 * In simulate mode this is instant (no RPC calls).
 */
export async function setupDemoAgents(): Promise<{
    agentA: MetaplexAgentAsset;
    agentB: MetaplexAgentAsset;
}> {
    const [agentA, agentB] = await Promise.all([
        registerAgent({
            walletAddress: DEMO_WALLET_A,
            name: 'MarketAnalyzer_v1',
            capabilities: ['nft-analysis', 'pricing', 'tensor-trading'],
        }),
        registerAgent({
            walletAddress: DEMO_WALLET_B,
            name: 'TaskExecutor_v1',
            capabilities: ['task-execution', 'code-review', 'qa-testing'],
        }),
    ]);
    return { agentA, agentB };
}

// ---------------------------------------------------------------------------
// Individual demo steps
// ---------------------------------------------------------------------------

export function postDemoTask(agentA: MetaplexAgentAsset): A2AInteractionStep {
    return step(3, 'agent_a', 'POST_TASK', {
        taskId: `task-${agentA.agentId}-001`,
        title: 'Analyze top 100 NFT collections on Tensor',
        description:
            'Fetch floor prices, volume, and holder distribution for the top 100 Solana NFT collections. Deliver structured JSON report.',
        reward: SETTLEMENT_AMOUNT_LAMPORTS,
        rewardToken: 'SOL',
        requiredCapabilities: ['nft-analysis', 'data-indexing'],
        deadline: Date.now() + 24 * 60 * 60 * 1000, // 24h
        postedBy: agentA.agentId,
        postedByWallet: agentA.owner,
    });
}

export function discoverTask(agentB: MetaplexAgentAsset): A2AInteractionStep {
    return step(4, 'agent_b', 'DISCOVER_AND_APPLY', {
        discoveryMethod: 'gradience-task-market',
        matchedCapabilities: ['nft-analysis', 'qa-testing'],
        applicant: agentB.agentId,
        applicantWallet: agentB.owner,
        proposedDelivery: Date.now() + 6 * 60 * 60 * 1000, // 6h
        message: 'I can complete this analysis. I have processed 500+ Tensor collections. Proposing 0.05 SOL.',
    });
}

export function negotiateTask(
    agentA: MetaplexAgentAsset,
    agentB: MetaplexAgentAsset,
): A2AInteractionStep[] {
    return [
        step(5, 'agent_a', 'NEGOTIATE_COUNTER', {
            from: agentA.agentId,
            to: agentB.agentId,
            message: 'Accepted. Please include holder distribution breakdown per collection.',
            agreedAmount: SETTLEMENT_AMOUNT_LAMPORTS,
            agreedToken: 'SOL',
        }),
        step(6, 'agent_b', 'NEGOTIATE_ACCEPT', {
            from: agentB.agentId,
            to: agentA.agentId,
            message:
                'Agreed. Holder distribution included. Staking 5,000,000 lamports as performance bond.',
            stake: 5_000_000,
        }),
    ];
}

export function settleTask(
    agentA: MetaplexAgentAsset,
    agentB: MetaplexAgentAsset,
    amount: number,
): A2AInteractionStep {
    const txRef = `gradience-settle-${fakeTxRef(`${agentA.agentId}:${agentB.agentId}:${amount}`)}`;
    return step(
        7,
        'protocol',
        'GRADIENCE_SETTLE',
        {
            fromWallet: agentA.owner,
            toWallet: agentB.owner,
            amount,
            token: 'SOL',
            reputationDelta: { agentA: +1, agentB: +3 },
            newTierAgentB: 'Silver',
            protocol: 'gradience-v1',
        },
        txRef,
    );
}

// ---------------------------------------------------------------------------
// Full demo runner
// ---------------------------------------------------------------------------

/**
 * Run the complete A2A hackathon demo end-to-end.
 *
 * Produces 7 steps:
 *   1. Agent A registered on Metaplex Core
 *   2. Agent B registered on Metaplex Core
 *   3. Agent A posts task to Gradience market
 *   4. Agent B discovers and applies
 *   5. Agent A counter-negotiates terms
 *   6. Agent B accepts stake and terms
 *   7. Gradience Protocol settles payment on-chain
 */
export async function runA2ADemo(_options?: { simulate?: boolean }): Promise<A2ADemoResult> {
    const { agentA, agentB } = await setupDemoAgents();

    const registerStepA = step(1, 'agent_a', 'REGISTER_ON_METAPLEX', {
        assetAddress: agentA.assetAddress,
        agentId: agentA.agentId,
        name: agentA.name,
        capabilities: agentA.capabilities,
        metaplexProgram: 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d',
    });

    const registerStepB = step(2, 'agent_b', 'REGISTER_ON_METAPLEX', {
        assetAddress: agentB.assetAddress,
        agentId: agentB.agentId,
        name: agentB.name,
        capabilities: agentB.capabilities,
        metaplexProgram: 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d',
    });

    const taskStep = postDemoTask(agentA);
    const discoverStep = discoverTask(agentB);
    const [negotiateStep1, negotiateStep2] = negotiateTask(agentA, agentB);
    const settlementStep = settleTask(agentA, agentB, SETTLEMENT_AMOUNT_LAMPORTS);

    const steps = [registerStepA, registerStepB, taskStep, discoverStep, negotiateStep1, negotiateStep2, settlementStep];

    return {
        agentA,
        agentB,
        steps,
        settlement: {
            amount: SETTLEMENT_AMOUNT_LAMPORTS,
            token: 'SOL',
            txRef: settlementStep.txRef!,
            settledAt: settlementStep.timestamp,
        },
        success: true,
    };
}
