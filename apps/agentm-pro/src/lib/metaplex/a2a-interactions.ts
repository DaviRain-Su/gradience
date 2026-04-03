export interface MetaplexRegistryAgent {
    id: string;
    displayName: string;
    wallet: string;
    capabilities: string[];
    minSettlementAmount: number;
    token: 'MPLX' | 'SOL';
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

const METAPLEX_REGISTRY: MetaplexRegistryAgent[] = [
    {
        id: 'mplx-alpha',
        displayName: 'Metaplex Alpha Agent',
        wallet: 'F4v1A7qY1jYf2nn89mFn4QjTqD4Y9Za9zVn2C1xTa111',
        capabilities: ['asset pricing', 'metadata repair'],
        minSettlementAmount: 25,
        token: 'MPLX',
    },
    {
        id: 'mplx-beta',
        displayName: 'Metaplex Beta Agent',
        wallet: '5jVQxM7x7mG3gQqQe8fTQ5zB1nWfU7sW2u5W9h5wB222',
        capabilities: ['task execution', 'collection analytics'],
        minSettlementAmount: 40,
        token: 'MPLX',
    },
    {
        id: 'mplx-sol',
        displayName: 'Metaplex SOL Agent',
        wallet: '9rA2WcQ8p2eQxQ26n9tAqD5cK1Yf5x8zQe9wP7mTa333',
        capabilities: ['cross-chain routing', 'A2A relaying'],
        minSettlementAmount: 1,
        token: 'SOL',
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
        txRef: `metaplex-tx-${Math.random().toString(36).slice(2, 10)}`,
        settledAt: now,
    };
}
