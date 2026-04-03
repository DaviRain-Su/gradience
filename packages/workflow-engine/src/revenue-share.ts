/**
 * Revenue Distribution Module
 *
 * Handles revenue sharing for Workflow executions
 * Fixed rates: Protocol 2%, Judge 3%
 * Configurable: Creator, User, Agent
 *
 * @module workflow-engine/revenue-share
 */

import type { TokenAmount, RevenueShare, GradienceWorkflow } from './schema/types.js';

// ============ Constants ============

/** Fixed protocol share in basis points (2%) */
export const PROTOCOL_SHARE_BPS = 200;

/** Fixed judge share in basis points (3%) */
export const JUDGE_SHARE_BPS = 300;

/** Total basis points (100%) */
export const TOTAL_BPS = 10000;

/** Default revenue share configuration */
export const DEFAULT_REVENUE_SHARE: RevenueShare = {
  creator: 3000,  // 30%
  user: 6000,     // 60%
  agent: 500,     // 5%
  protocol: PROTOCOL_SHARE_BPS,
  judge: JUDGE_SHARE_BPS,
};

// ============ Types ============

/** Revenue distribution recipient */
export interface RevenueRecipient {
  /** Recipient type */
  type: 'creator' | 'user' | 'agent' | 'protocol' | 'judge';
  /** Recipient address */
  address: string;
  /** Share amount */
  amount: string;
  /** Share in basis points */
  shareBps: number;
}

/** Revenue distribution result */
export interface RevenueDistribution {
  /** Total revenue amount */
  totalRevenue: TokenAmount;
  /** Distribution timestamp */
  timestamp: number;
  /** Individual distributions */
  distributions: RevenueRecipient[];
  /** Execution ID that generated this revenue */
  executionId: string;
  /** Workflow ID */
  workflowId: string;
}

/** Revenue distribution options */
export interface DistributionOptions {
  /** Creator wallet address */
  creatorAddress: string;
  /** User wallet address (who triggered the execution) */
  userAddress: string;
  /** Agent wallet address (who executed the workflow) */
  agentAddress: string;
  /** Protocol treasury address */
  protocolAddress: string;
  /** Judge pool address */
  judgeAddress: string;
  /** Custom revenue share config (optional) */
  customShare?: Partial<Omit<RevenueShare, 'protocol' | 'judge'>>;
}

/** Validation result for revenue share config */
export interface RevenueShareValidation {
  valid: boolean;
  error?: string;
  totalBps?: number;
}

// ============ Validation ============

/**
 * Validate revenue share configuration
 * Total must equal 10000 bps (100%)
 * Protocol and Judge shares are fixed
 */
export function validateRevenueShare(
  share: Partial<RevenueShare> & { protocol?: number; judge?: number }
): RevenueShareValidation {
  // Protocol and judge are fixed
  const protocol = PROTOCOL_SHARE_BPS;
  const judge = JUDGE_SHARE_BPS;

  // Get configurable shares with defaults
  const creator = share.creator ?? DEFAULT_REVENUE_SHARE.creator;
  const user = share.user ?? DEFAULT_REVENUE_SHARE.user;
  const agent = share.agent ?? DEFAULT_REVENUE_SHARE.agent;

  // Calculate total
  const total = creator + user + agent + protocol + judge;

  if (total !== TOTAL_BPS) {
    return {
      valid: false,
      error: `Revenue share total must equal ${TOTAL_BPS} bps (100%), got ${total}. ` +
             `Creator: ${creator}, User: ${user}, Agent: ${agent}, ` +
             `Protocol: ${protocol} (fixed), Judge: ${judge} (fixed)`,
      totalBps: total,
    };
  }

  // Validate individual shares are non-negative
  if (creator < 0 || user < 0 || agent < 0) {
    return {
      valid: false,
      error: 'Revenue shares cannot be negative',
    };
  }

  return { valid: true, totalBps: total };
}

/**
 * Create a valid revenue share config with defaults
 */
export function createRevenueShare(
  overrides?: Partial<Omit<RevenueShare, 'protocol' | 'judge'>>
): RevenueShare {
  const share: RevenueShare = {
    creator: overrides?.creator ?? DEFAULT_REVENUE_SHARE.creator,
    user: overrides?.user ?? DEFAULT_REVENUE_SHARE.user,
    agent: overrides?.agent ?? DEFAULT_REVENUE_SHARE.agent,
    protocol: PROTOCOL_SHARE_BPS,
    judge: JUDGE_SHARE_BPS,
  };

  const validation = validateRevenueShare(share);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  return share;
}

// ============ Distribution Calculation ============

/**
 * Calculate revenue distribution amounts
 * Uses BigInt for precision to avoid floating point errors
 */
export function calculateDistribution(
  totalRevenue: TokenAmount,
  revenueShare: RevenueShare,
  options: DistributionOptions
): RevenueDistribution {
  const totalAmount = BigInt(totalRevenue.amount);
  const timestamp = Date.now();

  // Calculate amounts using BigInt for precision
  // amount = (total * shareBps) / 10000
  const calculateAmount = (shareBps: number): string => {
    return ((totalAmount * BigInt(shareBps)) / BigInt(TOTAL_BPS)).toString();
  };

  const distributions: RevenueRecipient[] = [
    {
      type: 'creator',
      address: options.creatorAddress,
      amount: calculateAmount(revenueShare.creator),
      shareBps: revenueShare.creator,
    },
    {
      type: 'user',
      address: options.userAddress,
      amount: calculateAmount(revenueShare.user),
      shareBps: revenueShare.user,
    },
    {
      type: 'agent',
      address: options.agentAddress,
      amount: calculateAmount(revenueShare.agent),
      shareBps: revenueShare.agent,
    },
    {
      type: 'protocol',
      address: options.protocolAddress,
      amount: calculateAmount(PROTOCOL_SHARE_BPS),
      shareBps: PROTOCOL_SHARE_BPS,
    },
    {
      type: 'judge',
      address: options.judgeAddress,
      amount: calculateAmount(JUDGE_SHARE_BPS),
      shareBps: JUDGE_SHARE_BPS,
    },
  ];

  return {
    totalRevenue,
    timestamp,
    distributions,
    executionId: '', // Will be set by caller
    workflowId: '', // Will be set by caller
  };
}

/**
 * Calculate distribution for a workflow execution
 * Convenience function that extracts config from workflow
 */
export function calculateWorkflowRevenue(
  workflow: GradienceWorkflow,
  totalRevenue: TokenAmount,
  executionId: string,
  options: Omit<DistributionOptions, 'customShare'>
): RevenueDistribution {
  const distribution = calculateDistribution(
    totalRevenue,
    workflow.revenueShare,
    options
  );

  distribution.executionId = executionId;
  distribution.workflowId = workflow.id;

  return distribution;
}

// ============ Distribution Execution ============

/**
 * Revenue distributor interface
 * Implementations can be on-chain (Solana) or off-chain
 */
export interface RevenueDistributor {
  /** Execute the distribution */
  distribute(distribution: RevenueDistribution): Promise<DistributionResult>;
  /** Get distributor name/type */
  readonly name: string;
}

/** Distribution execution result */
export interface DistributionResult {
  success: boolean;
  distribution: RevenueDistribution;
  txHash?: string;
  error?: string;
  completedAt: number;
}

/**
 * Mock revenue distributor for testing
 */
export class MockRevenueDistributor implements RevenueDistributor {
  readonly name = 'MockDistributor';

  async distribute(distribution: RevenueDistribution): Promise<DistributionResult> {
    console.log('[MockRevenueDistributor] Distributing revenue:', {
      total: distribution.totalRevenue.amount,
      recipients: distribution.distributions.length,
    });

    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      success: true,
      distribution,
      txHash: `mock_tx_${Date.now()}`,
      completedAt: Date.now(),
    };
  }
}

/**
 * Solana revenue distributor
 * Would integrate with Solana programs for actual token transfers
 */
export class SolanaRevenueDistributor implements RevenueDistributor {
  readonly name = 'SolanaDistributor';
  private connection: unknown; // Would be Connection from @solana/web3.js
  private programId: string;

  constructor(config: { connection: unknown; programId: string }) {
    this.connection = config.connection;
    this.programId = config.programId;
  }

  async distribute(distribution: RevenueDistribution): Promise<DistributionResult> {
    try {
      console.log('[SolanaRevenueDistributor] Executing on-chain distribution:', {
        programId: this.programId,
        total: distribution.totalRevenue.amount,
      });

      // TODO: Implement actual Solana program invocation
      // This would:
      // 1. Create a distribution instruction
      // 2. Sign with the authority
      // 3. Send and confirm transaction
      // 4. Return transaction signature

      throw new Error('Solana distribution not yet implemented');
    } catch (error) {
      return {
        success: false,
        distribution,
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: Date.now(),
      };
    }
  }
}

// ============ Revenue Tracker ============

/** Revenue tracking entry */
export interface RevenueEntry {
  distribution: RevenueDistribution;
  result: DistributionResult;
  workflowId: string;
  executionId: string;
}

/**
 * Simple in-memory revenue tracker
 * For production, this should be backed by a database
 */
export class RevenueTracker {
  private entries: Map<string, RevenueEntry> = new Map();

  /**
   * Track a revenue distribution
   */
  track(entry: RevenueEntry): void {
    const key = `${entry.executionId}_${entry.distribution.timestamp}`;
    this.entries.set(key, entry);
  }

  /**
   * Get entry by key
   */
  get(key: string): RevenueEntry | undefined {
    return this.entries.get(key);
  }

  /**
   * Get all entries for a workflow
   */
  getByWorkflow(workflowId: string): RevenueEntry[] {
    return Array.from(this.entries.values()).filter(
      (e) => e.workflowId === workflowId
    );
  }

  /**
   * Get all entries for a recipient
   */
  getByRecipient(address: string): RevenueEntry[] {
    return Array.from(this.entries.values()).filter((e) =>
      e.distribution.distributions.some((d) => d.address === address)
    );
  }

  /**
   * Calculate total revenue for a recipient
   */
  getTotalRevenueForRecipient(
    address: string,
    mint?: string
  ): { amount: string; count: number } {
    const entries = this.getByRecipient(address);
    let total = BigInt(0);

    for (const entry of entries) {
      // Filter by mint if specified
      if (mint && entry.distribution.totalRevenue.mint !== mint) {
        continue;
      }

      const recipientDist = entry.distribution.distributions.find(
        (d) => d.address === address
      );
      if (recipientDist) {
        total += BigInt(recipientDist.amount);
      }
    }

    return {
      amount: total.toString(),
      count: entries.length,
    };
  }

  /**
   * Get all entries
   */
  getAll(): RevenueEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
  }
}

// ============ Convenience Exports ============

/**
 * Create a complete revenue distribution system
 */
export function createRevenueSystem(config?: {
  distributor?: RevenueDistributor;
  tracker?: RevenueTracker;
}) {
  const distributor = config?.distributor ?? new MockRevenueDistributor();
  const tracker = config?.tracker ?? new RevenueTracker();

  return {
    distributor,
    tracker,
    validate: validateRevenueShare,
    calculate: calculateDistribution,
    calculateForWorkflow: calculateWorkflowRevenue,
    createShare: createRevenueShare,
  };
}

export default createRevenueSystem;
