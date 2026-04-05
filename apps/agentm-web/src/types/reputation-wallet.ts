/**
 * Reputation Wallet Types
 *
 * Type definitions for reputation-powered wallet components.
 * Migrated from agentm Desktop.
 *
 * @module types/reputation-wallet
 */

// ============================================================================
// Color Constants (Project Color Scheme)
// ============================================================================

export const COLORS = {
  bg: '#F3F3F8',
  surface: '#FFFFFF',
  ink: '#16161A',
  lavender: '#C6BBFF',
  lime: '#CDFF4D',
  // Tier colors
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
  // Status colors
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#DC2626',
  info: '#3B82F6',
} as const;

// ============================================================================
// Reputation Types
// ============================================================================

/** Reputation tier levels */
export type ReputationTier = 'bronze' | 'silver' | 'gold' | 'platinum';

/** Reputation data from indexer */
export interface ReputationData {
  /** Overall score (0-100) */
  score: number;
  /** Number of completed tasks */
  completed: number;
  /** Total tasks applied to */
  totalApplied: number;
  /** Win rate percentage (0-1) */
  winRate: number;
  /** Total earned in lamports */
  totalEarned?: number;
}

// ============================================================================
// Wallet Policy Types
// ============================================================================

/** Wallet policy constraints based on reputation */
export interface WalletPolicy {
  /** Daily spending limit in USD cents */
  dailyLimit: number;
  /** Maximum single transaction in USD cents */
  maxTransaction: number;
  /** Whether manual approval is required */
  requireApproval: boolean;
  /** List of allowed blockchain chains */
  allowedChains: string[];
  /** List of allowed tokens (null = all tokens) */
  allowedTokens: string[] | null;
}

// ============================================================================
// Wallet Types
// ============================================================================

/** OWS Wallet information */
export interface WalletInfo {
  /** Unique wallet ID */
  id: string;
  /** Agent ID this wallet belongs to */
  agentId: string;
  /** Parent/master wallet address */
  parentWallet: string;
  /** Sub-wallet address (OWS) */
  address: string;
  /** Wallet name */
  name: string;
  /** Current reputation score */
  reputationScore: number;
  /** Current policy */
  policy: WalletPolicy;
  /** Created timestamp */
  createdAt: number;
  /** Last updated timestamp */
  updatedAt: number;
}

/** Transaction record */
export interface WalletTransaction {
  /** Transaction ID */
  id: string;
  /** Wallet ID */
  walletId: string;
  /** Agent ID */
  agentId: string;
  /** Transaction direction */
  type: 'incoming' | 'outgoing';
  /** Amount as string (for precision) */
  amount: string;
  /** Token symbol */
  token: string;
  /** On-chain transaction hash */
  txHash: string;
  /** Transaction status */
  status: 'pending' | 'confirmed' | 'failed';
  /** Created timestamp */
  createdAt: number;
  /** Confirmed timestamp */
  confirmedAt?: number;
}

/** Reputation history entry */
export interface ReputationHistoryEntry {
  /** Previous score */
  oldScore: number;
  /** New score */
  newScore: number;
  /** Reason for change */
  reason: string;
  /** When the change occurred */
  changedAt: number;
}

// ============================================================================
// Transaction Check Types
// ============================================================================

/** Result of a transaction limit check */
export interface TransactionCheckResult {
  /** Whether the transaction is allowed */
  allowed: boolean;
  /** Reason if not allowed */
  reason?: string;
  /** Whether approval is required */
  requiresApproval?: boolean;
}

/** Pending transaction for guard checking */
export interface PendingTransaction {
  /** Amount in USD cents */
  amountUsdCents: number;
  /** Target chain */
  chain: string;
  /** Token symbol */
  token: string;
  /** Optional recipient address */
  recipient?: string;
  /** Optional memo/note */
  memo?: string;
}

// ============================================================================
// Component Props Types
// ============================================================================

/** Props for ReputationWallet component */
export interface ReputationWalletProps {
  /** Wallet information */
  wallet: WalletInfo | null;
  /** Reputation data */
  reputation: ReputationData | null;
  /** Whether data is loading */
  loading?: boolean;
  /** Error message if any */
  error?: string | null;
  /** Callback to refresh wallet data */
  onRefresh?: () => void;
  /** Callback when wallet address is clicked */
  onAddressClick?: (address: string) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

/** Props for ReputationGuard component */
export interface ReputationGuardProps {
  /** Wallet information */
  wallet: WalletInfo | null;
  /** Pending transaction to check */
  transaction: PendingTransaction | null;
  /** Current daily spend in USD cents */
  currentDailySpend?: number;
  /** Callback when transaction is approved */
  onApprove?: (transaction: PendingTransaction) => void;
  /** Callback when transaction is rejected */
  onReject?: (reason: string) => void;
  /** Callback when approval is requested (for require approval cases) */
  onRequestApproval?: (transaction: PendingTransaction) => void;
  /** Whether checking is in progress */
  checking?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/** Props for ReputationDashboard component */
export interface ReputationDashboardProps {
  /** Wallet information */
  wallet: WalletInfo | null;
  /** Reputation data */
  reputation: ReputationData | null;
  /** Recent transactions */
  transactions?: WalletTransaction[];
  /** Reputation history */
  reputationHistory?: ReputationHistoryEntry[];
  /** Current daily spend in USD cents */
  currentDailySpend?: number;
  /** Whether data is loading */
  loading?: boolean;
  /** Error message if any */
  error?: string | null;
  /** Callback to refresh data */
  onRefresh?: () => void;
  /** Callback when transaction is clicked */
  onTransactionClick?: (transaction: WalletTransaction) => void;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get reputation tier from score
 */
export function getReputationTier(score: number): ReputationTier {
  if (score >= 81) return 'platinum';
  if (score >= 51) return 'gold';
  if (score >= 31) return 'silver';
  return 'bronze';
}

/**
 * Get tier display configuration
 */
export function getTierConfig(tier: ReputationTier): {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  progressColor: string;
} {
  const configs: Record<ReputationTier, ReturnType<typeof getTierConfig>> = {
    platinum: {
      label: 'Platinum',
      color: COLORS.platinum,
      bgColor: `${COLORS.platinum}20`,
      borderColor: `${COLORS.platinum}50`,
      icon: '💎',
      progressColor: COLORS.platinum,
    },
    gold: {
      label: 'Gold',
      color: COLORS.gold,
      bgColor: `${COLORS.gold}20`,
      borderColor: `${COLORS.gold}50`,
      icon: '🥇',
      progressColor: COLORS.gold,
    },
    silver: {
      label: 'Silver',
      color: COLORS.silver,
      bgColor: `${COLORS.silver}20`,
      borderColor: `${COLORS.silver}50`,
      icon: '🥈',
      progressColor: COLORS.silver,
    },
    bronze: {
      label: 'Bronze',
      color: COLORS.bronze,
      bgColor: `${COLORS.bronze}20`,
      borderColor: `${COLORS.bronze}50`,
      icon: '🥉',
      progressColor: COLORS.bronze,
    },
  };
  return configs[tier];
}

/**
 * Calculate wallet policy from reputation score
 * Mirrors ows-wallet-manager.ts calculatePolicy
 */
export function calculatePolicy(reputationScore: number): WalletPolicy {
  const score = Math.max(0, Math.min(100, reputationScore));

  if (score >= 81) {
    return {
      dailyLimit: score * 10,
      maxTransaction: score * 2,
      requireApproval: false,
      allowedChains: ['solana', 'ethereum', 'base', 'arbitrum'],
      allowedTokens: null,
    };
  } else if (score >= 51) {
    return {
      dailyLimit: score * 10,
      maxTransaction: score * 2,
      requireApproval: false,
      allowedChains: ['solana', 'ethereum', 'base'],
      allowedTokens: ['USDC', 'USDT', 'ETH', 'SOL'],
    };
  } else if (score >= 31) {
    return {
      dailyLimit: score * 10,
      maxTransaction: score * 2,
      requireApproval: true,
      allowedChains: ['solana', 'ethereum'],
      allowedTokens: ['USDC', 'USDT', 'ETH'],
    };
  } else {
    return {
      dailyLimit: Math.max(300, score * 10),
      maxTransaction: Math.max(60, score * 2),
      requireApproval: true,
      allowedChains: ['solana'],
      allowedTokens: ['USDC', 'USDT'],
    };
  }
}

/**
 * Format USD cents to display string
 */
export function formatUsdCents(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(dollars);
}

/**
 * Truncate wallet address for display
 */
export function truncateAddress(address: string, chars = 8): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
