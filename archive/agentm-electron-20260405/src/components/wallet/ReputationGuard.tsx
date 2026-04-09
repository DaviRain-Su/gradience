/**
 * ReputationGuard Component
 *
 * Pre-transaction reputation check component that validates transactions
 * against wallet policy limits before execution.
 *
 * @module components/wallet/ReputationGuard
 */

import { useMemo } from 'react';
import type { ReputationGuardProps, WalletInfo, PendingTransaction, TransactionCheckResult } from './types.ts';
import { getReputationTier, getTierConfig, formatUsdCents } from './types.ts';

// ============================================================================
// Transaction Check Logic
// ============================================================================

/**
 * Check if a transaction is within policy limits
 */
function checkTransactionLimits(
    wallet: WalletInfo,
    transaction: PendingTransaction,
    currentDailySpend: number,
): TransactionCheckResult {
    const { policy } = wallet;

    // Check chain
    if (!policy.allowedChains.includes(transaction.chain)) {
        return {
            allowed: false,
            reason: `Chain "${transaction.chain}" is not allowed. Allowed chains: ${policy.allowedChains.join(', ')}`,
        };
    }

    // Check token
    if (policy.allowedTokens !== null && !policy.allowedTokens.includes(transaction.token)) {
        return {
            allowed: false,
            reason: `Token "${transaction.token}" is not allowed. Allowed tokens: ${policy.allowedTokens.join(', ')}`,
        };
    }

    // Check max transaction
    if (transaction.amountUsdCents > policy.maxTransaction) {
        return {
            allowed: false,
            reason: `Amount ${formatUsdCents(transaction.amountUsdCents)} exceeds maximum transaction limit of ${formatUsdCents(policy.maxTransaction)}`,
        };
    }

    // Check daily limit
    const projectedDailySpend = currentDailySpend + transaction.amountUsdCents;
    if (projectedDailySpend > policy.dailyLimit) {
        return {
            allowed: false,
            reason: `Transaction would exceed daily limit. Current: ${formatUsdCents(currentDailySpend)}, Limit: ${formatUsdCents(policy.dailyLimit)}`,
        };
    }

    // Transaction is within limits
    return {
        allowed: true,
        requiresApproval: policy.requireApproval,
    };
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Status indicator with icon
 */
function StatusIndicator({ status }: { status: 'allowed' | 'blocked' | 'approval' | 'checking' }) {
    const config = {
        allowed: {
            icon: '✓',
            color: 'text-emerald-400',
            bg: 'bg-emerald-600/20',
            border: 'border-emerald-600/30',
            label: 'Allowed',
        },
        blocked: {
            icon: '✗',
            color: 'text-red-400',
            bg: 'bg-red-600/20',
            border: 'border-red-600/30',
            label: 'Blocked',
        },
        approval: {
            icon: '⏳',
            color: 'text-yellow-400',
            bg: 'bg-yellow-600/20',
            border: 'border-yellow-600/30',
            label: 'Approval Required',
        },
        checking: {
            icon: '...',
            color: 'text-blue-400',
            bg: 'bg-blue-600/20',
            border: 'border-blue-600/30',
            label: 'Checking',
        },
    }[status];

    return (
        <div
            className={`
                inline-flex items-center gap-2 px-3 py-1.5 rounded-full
                ${config.bg} ${config.border} border
            `}
        >
            <span className={`text-lg ${config.color}`}>{config.icon}</span>
            <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
        </div>
    );
}

/**
 * Transaction summary display
 */
function TransactionSummary({ transaction }: { transaction: PendingTransaction }) {
    return (
        <div className="bg-gray-800/50 rounded-lg p-4">
            <h4 className="text-xs text-gray-500 mb-3 uppercase tracking-wide">Transaction Details</h4>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <p className="text-xs text-gray-500">Amount</p>
                    <p className="text-lg font-semibold text-white">{formatUsdCents(transaction.amountUsdCents)}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500">Token</p>
                    <p className="text-lg font-semibold text-white">{transaction.token}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500">Chain</p>
                    <span className="inline-block px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded text-sm">
                        {transaction.chain}
                    </span>
                </div>
                {transaction.recipient && (
                    <div>
                        <p className="text-xs text-gray-500">Recipient</p>
                        <p className="text-sm text-gray-300 font-mono truncate">{transaction.recipient}</p>
                    </div>
                )}
            </div>
            {transaction.memo && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                    <p className="text-xs text-gray-500">Memo</p>
                    <p className="text-sm text-gray-300">{transaction.memo}</p>
                </div>
            )}
        </div>
    );
}

/**
 * Policy limits comparison
 */
function PolicyComparison({
    wallet,
    transaction,
    currentDailySpend,
}: {
    wallet: WalletInfo;
    transaction: PendingTransaction;
    currentDailySpend: number;
}) {
    const { policy } = wallet;
    const projectedDailySpend = currentDailySpend + transaction.amountUsdCents;

    const checks = [
        {
            label: 'Transaction Amount',
            current: transaction.amountUsdCents,
            limit: policy.maxTransaction,
            passed: transaction.amountUsdCents <= policy.maxTransaction,
        },
        {
            label: 'Daily Spending',
            current: projectedDailySpend,
            limit: policy.dailyLimit,
            passed: projectedDailySpend <= policy.dailyLimit,
            note: `Current: ${formatUsdCents(currentDailySpend)}`,
        },
    ];

    const chainAllowed = policy.allowedChains.includes(transaction.chain);
    const tokenAllowed = policy.allowedTokens === null || policy.allowedTokens.includes(transaction.token);

    return (
        <div className="space-y-3">
            {/* Amount checks */}
            {checks.map((check) => (
                <div key={check.label} className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-300">{check.label}</p>
                        {check.note && <p className="text-xs text-gray-500">{check.note}</p>}
                    </div>
                    <div className="text-right">
                        <span className={check.passed ? 'text-emerald-400' : 'text-red-400'}>
                            {formatUsdCents(check.current)}
                        </span>
                        <span className="text-gray-500 mx-1">/</span>
                        <span className="text-gray-400">{formatUsdCents(check.limit)}</span>
                        <span className="ml-2">{check.passed ? '✓' : '✗'}</span>
                    </div>
                </div>
            ))}

            {/* Chain check */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-300">Chain Allowed</p>
                <div className="flex items-center gap-2">
                    <span
                        className={`px-2 py-0.5 rounded text-sm ${
                            chainAllowed ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400'
                        }`}
                    >
                        {transaction.chain}
                    </span>
                    <span>{chainAllowed ? '✓' : '✗'}</span>
                </div>
            </div>

            {/* Token check */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-300">Token Allowed</p>
                <div className="flex items-center gap-2">
                    <span
                        className={`px-2 py-0.5 rounded text-sm ${
                            tokenAllowed ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400'
                        }`}
                    >
                        {transaction.token}
                    </span>
                    <span>{tokenAllowed ? '✓' : '✗'}</span>
                </div>
            </div>
        </div>
    );
}

/**
 * Action buttons for approval/rejection
 */
function ActionButtons({
    checkResult,
    transaction,
    onApprove,
    onReject,
    onRequestApproval,
}: {
    checkResult: TransactionCheckResult;
    transaction: PendingTransaction;
    onApprove?: (transaction: PendingTransaction) => void;
    onReject?: (reason: string) => void;
    onRequestApproval?: (transaction: PendingTransaction) => void;
}) {
    if (!checkResult.allowed) {
        return (
            <button
                type="button"
                onClick={() => onReject?.(checkResult.reason ?? 'Transaction not allowed')}
                className="w-full py-2 px-4 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition"
            >
                Cancel
            </button>
        );
    }

    if (checkResult.requiresApproval) {
        return (
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={() => onReject?.('Transaction cancelled')}
                    className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => onRequestApproval?.(transaction)}
                    className="flex-1 py-2 px-4 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 rounded-lg transition"
                >
                    Request Approval
                </button>
            </div>
        );
    }

    return (
        <div className="flex gap-3">
            <button
                type="button"
                onClick={() => onReject?.('Transaction cancelled')}
                className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition"
            >
                Cancel
            </button>
            <button
                type="button"
                onClick={() => onApprove?.(transaction)}
                className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition"
            >
                Confirm
            </button>
        </div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * ReputationGuard - Pre-transaction reputation check component
 *
 * Features:
 * - Validates transaction against wallet policy limits
 * - Shows clear pass/fail status
 * - Displays policy comparison for transparency
 * - Handles approval workflow for restricted tiers
 * - Provides actionable feedback when blocked
 */
export function ReputationGuard({
    wallet,
    transaction,
    currentDailySpend = 0,
    onApprove,
    onReject,
    onRequestApproval,
    checking = false,
    className = '',
}: ReputationGuardProps) {
    // Check transaction against policy
    const checkResult = useMemo<TransactionCheckResult | null>(() => {
        if (!wallet || !transaction) return null;
        return checkTransactionLimits(wallet, transaction, currentDailySpend);
    }, [wallet, transaction, currentDailySpend]);

    // No wallet state
    if (!wallet) {
        return (
            <div className={`bg-gray-900 border border-gray-800 rounded-xl p-6 ${className}`}>
                <p className="text-gray-400 text-center">No wallet connected</p>
            </div>
        );
    }

    // No transaction state
    if (!transaction) {
        return (
            <div className={`bg-gray-900 border border-gray-800 rounded-xl p-6 ${className}`}>
                <p className="text-gray-400 text-center">No pending transaction</p>
            </div>
        );
    }

    // Checking state
    if (checking) {
        return (
            <div className={`bg-gray-900 border border-gray-800 rounded-xl p-6 ${className}`}>
                <div className="flex flex-col items-center gap-4">
                    <StatusIndicator status="checking" />
                    <p className="text-gray-400">Validating transaction...</p>
                </div>
            </div>
        );
    }

    // Determine status
    const status: 'allowed' | 'blocked' | 'approval' = checkResult?.allowed
        ? checkResult.requiresApproval
            ? 'approval'
            : 'allowed'
        : 'blocked';

    const tier = getReputationTier(wallet.reputationScore);
    const tierConfig = getTierConfig(tier);

    return (
        <div className={`bg-gray-900 border border-gray-800 rounded-xl p-4 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Transaction Check</h3>
                <StatusIndicator status={status} />
            </div>

            {/* Wallet tier badge */}
            <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-gray-500">Wallet Tier:</span>
                <span
                    className={`
                        text-xs px-2 py-0.5 rounded-full
                        ${tierConfig.bgColor} ${tierConfig.color} ${tierConfig.borderColor} border
                    `}
                >
                    {tierConfig.icon} {tierConfig.label} ({wallet.reputationScore})
                </span>
            </div>

            {/* Transaction summary */}
            <TransactionSummary transaction={transaction} />

            {/* Policy comparison */}
            <div className="mt-4">
                <h4 className="text-xs text-gray-500 mb-3 uppercase tracking-wide">Policy Checks</h4>
                <PolicyComparison wallet={wallet} transaction={transaction} currentDailySpend={currentDailySpend} />
            </div>

            {/* Error message */}
            {!checkResult?.allowed && checkResult?.reason && (
                <div className="mt-4 p-3 bg-red-600/10 border border-red-600/20 rounded-lg">
                    <p className="text-sm text-red-300">{checkResult.reason}</p>
                </div>
            )}

            {/* Approval required message */}
            {checkResult?.allowed && checkResult.requiresApproval && (
                <div className="mt-4 p-3 bg-yellow-600/10 border border-yellow-600/20 rounded-lg">
                    <p className="text-sm text-yellow-300">
                        Your reputation tier requires manual approval for transactions. Increase your reputation score
                        to {tier === 'bronze' ? 31 : 51}+ to enable automatic transactions.
                    </p>
                </div>
            )}

            {/* Action buttons */}
            <div className="mt-4 pt-4 border-t border-gray-800">
                <ActionButtons
                    checkResult={checkResult!}
                    transaction={transaction}
                    onApprove={onApprove}
                    onReject={onReject}
                    onRequestApproval={onRequestApproval}
                />
            </div>
        </div>
    );
}

/**
 * Inline guard badge for quick status checks
 */
export function ReputationGuardBadge({
    wallet,
    transaction,
    currentDailySpend = 0,
    onClick,
    className = '',
}: {
    wallet: WalletInfo | null;
    transaction: PendingTransaction | null;
    currentDailySpend?: number;
    onClick?: () => void;
    className?: string;
}) {
    const checkResult = useMemo<TransactionCheckResult | null>(() => {
        if (!wallet || !transaction) return null;
        return checkTransactionLimits(wallet, transaction, currentDailySpend);
    }, [wallet, transaction, currentDailySpend]);

    if (!wallet || !transaction) {
        return null;
    }

    const status: 'allowed' | 'blocked' | 'approval' = checkResult?.allowed
        ? checkResult.requiresApproval
            ? 'approval'
            : 'allowed'
        : 'blocked';

    const config = {
        allowed: { icon: '✓', color: 'text-emerald-400', bg: 'bg-emerald-600/20' },
        blocked: { icon: '✗', color: 'text-red-400', bg: 'bg-red-600/20' },
        approval: { icon: '⏳', color: 'text-yellow-400', bg: 'bg-yellow-600/20' },
    }[status];

    return (
        <button
            type="button"
            onClick={onClick}
            className={`
                inline-flex items-center gap-1 px-2 py-1 rounded
                ${config.bg} ${config.color}
                hover:opacity-80 transition
                ${className}
            `}
            title={checkResult?.reason ?? (status === 'approval' ? 'Approval required' : 'Transaction allowed')}
        >
            <span>{config.icon}</span>
            <span className="text-xs font-medium">{formatUsdCents(transaction.amountUsdCents)}</span>
        </button>
    );
}

export default ReputationGuard;
