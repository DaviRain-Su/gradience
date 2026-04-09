/**
 * Agent Profile Types
 * Migrated from AgentM Pro
 */

export type ProfileStatus = 'draft' | 'published' | 'deprecated';
export type PricingModel = 'fixed' | 'per_call' | 'per_token';

export interface Capability {
    id: string;
    name: string;
    description: string;
}

export interface Pricing {
    model: PricingModel;
    amount: number;
    currency: 'SOL';
}

export interface AgentProfile {
    id: string;
    did: string;
    owner: string;
    name: string;
    description: string;
    version: string;
    capabilities: Capability[];
    pricing: Pricing;
    tags: string[];
    website?: string;
    createdAt: number;
    updatedAt: number;
    status: ProfileStatus;
    /** Optional on-chain EVM registration metadata */
    onChain?: {
        agentId: string;
        txHash: string;
        chain: string;
    };
}

export interface ProfileDraft {
    name: string;
    description: string;
    version: string;
    capabilities: Capability[];
    pricing: Pricing;
    tags: string[];
    website?: string;
}
