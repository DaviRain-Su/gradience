export interface MetaplexRegistryAgent {
    id: string;
    displayName: string;
    wallet: string;
    /** Metaplex Core Asset address (base58) — on-chain identity */
    assetAddress: string;
    capabilities: string[];
    minSettlementAmount: number;
    token: 'MPLX' | 'SOL';
    /** Reputation tier derived from completed tasks */
    reputationTier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
    /** Number of completed A2A tasks */
    completedTasks: number;
}

export interface A2ADelegation {
    id: string;
    fromAgent: string;
    toAgentId: string;
    toWallet: string;
    taskTitle: string;
    createdAt: number;
    token: 'MPLX' | 'SOL';
    amount: number;
    status: 'pending' | 'in_progress' | 'settled';
}

export interface A2AMessage {
    id: string;
    delegationId: string;
    from: string;
    to: string;
    content: string;
    createdAt: number;
}

export interface A2ASettlement {
    id: string;
    delegationId: string;
    fromWallet: string;
    toWallet: string;
    token: 'MPLX' | 'SOL';
    amount: number;
    txRef: string;
    settledAt: number;
}

/**
 * Static demo registry mirroring agents registered on Metaplex Core.
 *
 * TODO (T49): At registration time, generate ERC-8004 registration JSON so
 * agents appear at 8004scan.io:
 *   {
 *     "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
 *     "agentId": "mplx-agent:...",
 *     "capabilities": [...],
 *     "wallets": { "solana": "..." }
 *   }
 *
 * TODO (T49): Replace static array with on-chain fetch:
 *   // import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
 *   // import { fetchAssetsByOwner, mplCore } from '@metaplex-foundation/mpl-core'
 *   // const umi = createUmi(SOLANA_RPC).use(mplCore())
 *   // const assets = await fetchAssetsByOwner(umi, GRADIENCE_AUTHORITY_KEY)
 */
const METAPLEX_REGISTRY: MetaplexRegistryAgent[] = [
    {
        id: 'mplx-agent:7xkxmnpq',
        displayName: 'MarketAnalyzer_v1',
        wallet: 'F4v1A7qY1jYf2nn89mFn4QjTqD4Y9Za9zVn2C1xTa111',
        assetAddress: '7xKxMnPqR9YzF4v1A7qY1jYf2nn89mFn4QjTqD4Y9Yz1',
        capabilities: ['nft-analysis', 'pricing', 'tensor-trading'],
        minSettlementAmount: 25_000_000, // 0.025 SOL in lamports
        token: 'SOL',
        reputationTier: 'Silver',
        completedTasks: 14,
    },
    {
        id: 'mplx-agent:4fqr2mn8',
        displayName: 'TaskExecutor_v1',
        wallet: '5jVQxM7x7mG3gQqQe8fTQ5zB1nWfU7sW2u5W9h5wB222',
        assetAddress: '4FqR2MN8xbWPp1Ck5jVQxM7x7mG3gQqQe8fTQ5zB1nW2',
        capabilities: ['task-execution', 'code-review', 'qa-testing'],
        minSettlementAmount: 40_000_000, // 0.04 SOL in lamports
        token: 'SOL',
        reputationTier: 'Gold',
        completedTasks: 31,
    },
    {
        id: 'mplx-agent:9bwp1ck5',
        displayName: 'DataIndexer_v1',
        wallet: '9rA2WcQ8p2eQxQ26n9tAqD5cK1Yf5x8zQe9wP7mTa333',
        assetAddress: '9BWp1CK5rA2WcQ8p2eQxQ26n9tAqD5cK1Yf5x8zQe9w3',
        capabilities: ['data-indexing', 'collection-analytics', 'metadata-repair'],
        minSettlementAmount: 10_000_000, // 0.01 SOL in lamports
        token: 'SOL',
        reputationTier: 'Bronze',
        completedTasks: 5,
    },
];

export function listMetaplexRegistryAgents(): MetaplexRegistryAgent[] {
    return METAPLEX_REGISTRY;
}

export function createA2ADelegation(input: {
    fromAgent: string;
    toAgent: MetaplexRegistryAgent;
    taskTitle: string;
    amount: number;
}): A2ADelegation {
    const now = Date.now();
    const normalizedAmount = Math.max(input.amount, input.toAgent.minSettlementAmount);
    return {
        id: `dlg-${now}`,
        fromAgent: input.fromAgent,
        toAgentId: input.toAgent.id,
        toWallet: input.toAgent.wallet,
        taskTitle: input.taskTitle.trim(),
        createdAt: now,
        token: input.toAgent.token,
        amount: normalizedAmount,
        status: 'in_progress',
    };
}

export function createA2AMessage(input: {
    delegationId: string;
    from: string;
    to: string;
    content: string;
}): A2AMessage {
    const now = Date.now();
    return {
        id: `msg-${now}-${Math.random().toString(36).slice(2, 6)}`,
        delegationId: input.delegationId,
        from: input.from,
        to: input.to,
        content: input.content.trim(),
        createdAt: now,
    };
}

export function settleA2ADelegation(input: {
    delegation: A2ADelegation;
    fromWallet: string;
}): A2ASettlement {
    const now = Date.now();
    return {
        id: `settle-${now}`,
        delegationId: input.delegation.id,
        fromWallet: input.fromWallet,
        toWallet: input.delegation.toWallet,
        token: input.delegation.token,
        amount: input.delegation.amount,
        // txRef format: gradience-settle-<hex> for Gradience Protocol settlements
        // TODO (T50): After settlement, submit reputation feedback to 8004 Reputation Registry
        //   POST https://api.8004scan.io/v1/feedback
        //   { agentId: toAgent.id, score: 85, taskId: delegation.id, proof: txRef }
        txRef: `gradience-settle-${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 10)}`,
        settledAt: now,
    };
}
