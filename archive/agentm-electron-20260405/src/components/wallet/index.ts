/**
 * Wallet Components
 *
 * Reputation-powered wallet components for OWS sub-wallet management.
 *
 * @module components/wallet
 */

// Types
export type {
    ReputationTier,
    ReputationData,
    WalletPolicy,
    WalletInfo,
    WalletTransaction,
    ReputationHistoryEntry,
    TransactionCheckResult,
    PendingTransaction,
    ReputationWalletProps,
    ReputationGuardProps,
    WalletDashboardProps,
} from './types.ts';

// Utility functions
export { getReputationTier, getTierConfig, calculatePolicy, formatUsdCents, truncateAddress } from './types.ts';

// Components
export { ReputationWallet, ReputationWalletCompact } from './ReputationWallet.tsx';
export { ReputationGuard, ReputationGuardBadge } from './ReputationGuard.tsx';
export { WalletDashboard } from './WalletDashboard.tsx';
