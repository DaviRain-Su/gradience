import type { DaemonPolicy } from './daemon-client';

/**
 * Reputation-Based Policy Engine
 * 
 * GRA-225: Connects reputation scores to wallet policies
 * Maps reputation tiers to signing permissions
 */

export type ReputationTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface ReputationPolicy {
  tier: ReputationTier;
  dailyLimitUsd: number;
  dailyLimitLamports: number;
  requireApprovalAboveUsd: number;
  requireApprovalAboveLamports: number;
  allowedChains: string[];
  allowedTokens: string[];
  autoApprove: boolean;
  description: string;
}

export interface ReputationData {
  score: number;
  tier: ReputationTier;
  completedTasks: number;
  avgRating: number;
  updatedAt: string;
}

// Reputation score ranges for each tier
const TIER_RANGES: Record<ReputationTier, { min: number; max: number }> = {
  bronze: { min: 0, max: 30 },
  silver: { min: 31, max: 50 },
  gold: { min: 51, max: 80 },
  platinum: { min: 81, max: 100 },
};

// Chain IDs
const CHAIN_IDS = {
  solanaDevnet: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  solanaMainnet: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  ethereum: 'eip155:1',
  base: 'eip155:8453',
};

/**
 * Calculate reputation tier from score
 */
export function getTierFromScore(score: number): ReputationTier {
  if (score >= 81) return 'platinum';
  if (score >= 51) return 'gold';
  if (score >= 31) return 'silver';
  return 'bronze';
}

/**
 * Get policy based on reputation score
 * GRA-225: Core function for reputation-to-policy mapping
 */
export function calculatePolicyFromReputation(score: number): ReputationPolicy {
  const tier = getTierFromScore(score);
  
  switch (tier) {
    case 'platinum':
      return {
        tier,
        dailyLimitUsd: 1000,
        dailyLimitLamports: 1_000_000_000_000, // 1000 SOL
        requireApprovalAboveUsd: 1000,
        requireApprovalAboveLamports: 1_000_000_000_000,
        allowedChains: [CHAIN_IDS.solanaDevnet, CHAIN_IDS.solanaMainnet, CHAIN_IDS.ethereum, CHAIN_IDS.base],
        allowedTokens: ['*'], // All tokens
        autoApprove: true,
        description: 'Platinum: Full trust, all chains, auto-approval up to $1000',
      };
      
    case 'gold':
      return {
        tier,
        dailyLimitUsd: 800,
        dailyLimitLamports: 800_000_000_000,
        requireApprovalAboveUsd: 500,
        requireApprovalAboveLamports: 500_000_000_000,
        allowedChains: [CHAIN_IDS.solanaDevnet, CHAIN_IDS.solanaMainnet, CHAIN_IDS.base],
        allowedTokens: ['SOL', 'USDC', 'USDT'],
        autoApprove: true,
        description: 'Gold: High trust, Solana + Base, auto-approval up to $500',
      };
      
    case 'silver':
      return {
        tier,
        dailyLimitUsd: 500,
        dailyLimitLamports: 500_000_000_000,
        requireApprovalAboveUsd: 100,
        requireApprovalAboveLamports: 100_000_000_000,
        allowedChains: [CHAIN_IDS.solanaDevnet, CHAIN_IDS.solanaMainnet],
        allowedTokens: ['SOL', 'USDC'],
        autoApprove: false,
        description: 'Silver: Medium trust, Solana only, manual approval above $100',
      };
      
    case 'bronze':
    default:
      return {
        tier,
        dailyLimitUsd: 30,
        dailyLimitLamports: 30_000_000_000,
        requireApprovalAboveUsd: 10,
        requireApprovalAboveLamports: 10_000_000_000,
        allowedChains: [CHAIN_IDS.solanaDevnet], // Devnet only for safety
        allowedTokens: ['SOL'],
        autoApprove: false,
        description: 'Bronze: New agent, Solana devnet only, manual approval above $10',
      };
  }
}

/**
 * Convert reputation policy to daemon policy format
 */
export function convertToDaemonPolicy(policy: ReputationPolicy): Partial<DaemonPolicy> {
  const rules: Array<{ type: string; [key: string]: unknown }> = [
    { type: 'allowed_chains', chain_ids: policy.allowedChains },
    { type: 'daily_spend_limit', lamports: policy.dailyLimitLamports },
    { type: 'require_approval_above', lamports: policy.requireApprovalAboveLamports },
  ];
  
  if (policy.allowedTokens.length > 0 && policy.allowedTokens[0] !== '*') {
    rules.push({ type: 'allowed_tokens', tokens: policy.allowedTokens });
  }
  
  return {
    name: `Reputation-Derived: ${policy.tier.toUpperCase()}`,
    rules,
  };
}

/**
 * Calculate aggregate reputation from multiple agent wallets
 * GRA-225: Master wallet reputation = weighted average of agents
 */
export function calculateAggregateReputation(
  agentReputations: Array<{ score: number; completedTasks: number }>
): { score: number; tier: ReputationTier } {
  if (agentReputations.length === 0) {
    return { score: 0, tier: 'bronze' };
  }
  
  // Weight by completed tasks (more tasks = more weight)
  const totalWeight = agentReputations.reduce((sum, r) => sum + Math.max(r.completedTasks, 1), 0);
  
  const weightedScore = agentReputations.reduce((sum, r) => {
    const weight = Math.max(r.completedTasks, 1) / totalWeight;
    return sum + r.score * weight;
  }, 0);
  
  const score = Math.round(weightedScore);
  const tier = getTierFromScore(score);
  
  return { score, tier };
}

/**
 * Check if a transaction is allowed by policy
 */
export function isTransactionAllowed(
  policy: ReputationPolicy,
  params: {
    chain: string;
    amountLamports: number;
    token: string;
    dailySpentLamports: number;
  }
): { allowed: boolean; reason?: string } {
  // Check chain
  if (!policy.allowedChains.includes(params.chain)) {
    return { allowed: false, reason: `Chain ${params.chain} not allowed for ${policy.tier} tier` };
  }
  
  // Check token
  if (policy.allowedTokens[0] !== '*' && !policy.allowedTokens.includes(params.token)) {
    return { allowed: false, reason: `Token ${params.token} not allowed for ${policy.tier} tier` };
  }
  
  // Check daily limit
  const newDailyTotal = params.dailySpentLamports + params.amountLamports;
  if (newDailyTotal > policy.dailyLimitLamports) {
    return { 
      allowed: false, 
      reason: `Daily limit exceeded: ${newDailyTotal / 1e9} SOL > ${policy.dailyLimitLamports / 1e9} SOL` 
    };
  }
  
  // Check approval requirement
  if (!policy.autoApprove && params.amountLamports > policy.requireApprovalAboveLamports) {
    return { 
      allowed: false, 
      reason: `Amount ${params.amountLamports / 1e9} SOL requires manual approval for ${policy.tier} tier` 
    };
  }
  
  return { allowed: true };
}

/**
 * Format reputation for display
 */
export function formatReputation(score: number): {
  score: number;
  tier: ReputationTier;
  emoji: string;
  label: string;
  color: string;
} {
  const tier = getTierFromScore(score);
  
  const tierInfo = {
    bronze: { emoji: '🥉', label: 'Bronze', color: '#CD7F32' },
    silver: { emoji: '🥈', label: 'Silver', color: '#C0C0C0' },
    gold: { emoji: '🥇', label: 'Gold', color: '#FFD700' },
    platinum: { emoji: '💎', label: 'Platinum', color: '#E5E4E2' },
  };
  
  return {
    score,
    tier,
    ...tierInfo[tier],
  };
}
