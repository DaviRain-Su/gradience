export interface AgentTokenDistribution {
    community: number;
    team: number;
    treasury: number;
    liquidity: number;
}

export interface AgentTokenLaunchPlan {
    name: string;
    symbol: string;
    metadataUri: string;
    totalSupply: number;
    decimals: number;
    distribution: AgentTokenDistribution;
    utility: {
        stakingBoostMaxBps: number;
        serviceFeeDiscountBps: number;
        governanceWeightPerToken: number;
    };
}

export interface AgentTokenLaunchResult {
    mintAddress: string;
    txRef: string;
    launchedAt: number;
    plan: AgentTokenLaunchPlan;
}

const DEFAULT_DISTRIBUTION: AgentTokenDistribution = {
    community: 40,
    team: 20,
    treasury: 25,
    liquidity: 15,
};

export function buildAgentTokenLaunchPlan(input?: {
    name?: string;
    symbol?: string;
    metadataUri?: string;
    totalSupply?: number;
    decimals?: number;
    distribution?: Partial<AgentTokenDistribution>;
}): AgentTokenLaunchPlan {
    return {
        name: input?.name?.trim() || 'Gradience Agent Token',
        symbol: input?.symbol?.trim().toUpperCase() || 'GAT',
        metadataUri: input?.metadataUri?.trim() || 'https://gradience.xyz/token-metadata.json',
        totalSupply: input?.totalSupply ?? 100_000_000,
        decimals: input?.decimals ?? 9,
        distribution: {
            ...DEFAULT_DISTRIBUTION,
            ...input?.distribution,
        },
        utility: {
            stakingBoostMaxBps: 3_000,
            serviceFeeDiscountBps: 500,
            governanceWeightPerToken: 1,
        },
    };
}

export function validateDistribution(distribution: AgentTokenDistribution): {
    valid: boolean;
    total: number;
} {
    const total =
        distribution.community +
        distribution.team +
        distribution.treasury +
        distribution.liquidity;
    return { valid: total === 100, total };
}

export function simulateAgentTokenLaunch(
    plan: AgentTokenLaunchPlan,
    authorityAddress: string
): AgentTokenLaunchResult {
    const seed = `${authorityAddress}:${plan.name}:${plan.symbol}:${Date.now()}`;
    return {
        mintAddress: `mint_${hash(seed).slice(0, 24)}`,
        txRef: `metaplex_genesis_${hash(`${seed}:tx`).slice(0, 20)}`,
        launchedAt: Date.now(),
        plan,
    };
}

export function calculateStakingReputationWeight(
    stakedAmount: number,
    totalStaked: number,
    stakingBoostMaxBps = 3_000
): number {
    if (stakedAmount <= 0 || totalStaked <= 0) return 1;
    const share = Math.min(1, stakedAmount / totalStaked);
    const boost = (share * stakingBoostMaxBps) / 10_000;
    return Number((1 + boost).toFixed(4));
}

export function estimateServiceFeeWithToken(
    baseFeeLamports: number,
    serviceFeeDiscountBps = 500
): number {
    const effectiveDiscount = Math.max(0, Math.min(9_000, serviceFeeDiscountBps));
    return Math.floor((baseFeeLamports * (10_000 - effectiveDiscount)) / 10_000);
}

export function calculateGovernanceVotingPower(
    walletBalance: number,
    stakedAmount: number,
    governanceWeightPerToken = 1
): number {
    if (walletBalance <= 0 && stakedAmount <= 0) return 0;
    return Math.floor((walletBalance + stakedAmount * 1.5) * governanceWeightPerToken);
}

function hash(input: string): string {
    let value = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
        value ^= input.charCodeAt(index);
        value = Math.imul(value, 16777619);
    }
    return Math.abs(value >>> 0).toString(16).padStart(8, '0');
}
