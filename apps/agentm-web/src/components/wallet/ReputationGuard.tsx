'use client';

/**
 * ReputationGuard Component
 *
 * Pre-transaction reputation check component that validates transactions
 * against wallet policy limits before execution.
 *
 * @module components/wallet/ReputationGuard
 */

import { useMemo } from 'react';
import type {
    ReputationGuardProps,
    WalletInfo,
    PendingTransaction,
    TransactionCheckResult,
} from '@/types/reputation-wallet';
import { getReputationTier, getTierConfig, formatUsdCents, COLORS } from '@/types/reputation-wallet';

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
            color: COLORS.success,
            bg: `${COLORS.success}20`,
            border: `${COLORS.success}40`,
            label: 'Allowed',
        },
        blocked: {
            icon: '✗',
            color: COLORS.danger,
            bg: `${COLORS.danger}20`,
            border: `${COLORS.danger}40`,
            label: 'Blocked',
        },
        approval: {
            icon: '⏳',
            color: COLORS.warning,
            bg: `${COLORS.warning}20`,
            border: `${COLORS.warning}40`,
            label: 'Approval Required',
        },
        checking: {
            icon: '...',
            color: COLORS.info,
            bg: `${COLORS.info}20`,
            border: `${COLORS.info}40`,
            label: 'Checking',
        },
    }[status];

    return (
        <div
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '9999px',
                background: config.bg,
                border: `1.5px solid ${config.border}`,
            }}
        >
            <span style={{ fontSize: '16px', color: config.color }}>{config.icon}</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: config.color }}>{config.label}</span>
        </div>
    );
}

/**
 * Transaction summary display
 */
function TransactionSummary({ transaction }: { transaction: PendingTransaction }) {
    return (
        <div
            style={{
                background: `${COLORS.ink}08`,
                borderRadius: '12px',
                padding: '16px',
                border: `1px solid ${COLORS.ink}20`,
            }}
        >
            <h4
                style={{
                    fontSize: '12px',
                    color: COLORS.ink,
                    opacity: 0.5,
                    margin: '0 0 12px 0',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                }}
            >
                Transaction Details
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                    <p style={{ fontSize: '12px', color: COLORS.ink, opacity: 0.5, margin: '0 0 4px 0' }}>Amount</p>
                    <p style={{ fontSize: '18px', fontWeight: 700, color: COLORS.ink, margin: 0 }}>
                        {formatUsdCents(transaction.amountUsdCents)}
                    </p>
                </div>
                <div>
                    <p style={{ fontSize: '12px', color: COLORS.ink, opacity: 0.5, margin: '0 0 4px 0' }}>Token</p>
                    <p style={{ fontSize: '18px', fontWeight: 700, color: COLORS.ink, margin: 0 }}>
                        {transaction.token}
                    </p>
                </div>
                <div>
                    <p style={{ fontSize: '12px', color: COLORS.ink, opacity: 0.5, margin: '0 0 4px 0' }}>Chain</p>
                    <span
                        style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            background: `${COLORS.info}20`,
                            color: COLORS.info,
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 500,
                        }}
                    >
                        {transaction.chain}
                    </span>
                </div>
                {transaction.recipient && (
                    <div>
                        <p style={{ fontSize: '12px', color: COLORS.ink, opacity: 0.5, margin: '0 0 4px 0' }}>
                            Recipient
                        </p>
                        <p
                            style={{
                                fontSize: '13px',
                                color: COLORS.ink,
                                opacity: 0.8,
                                fontFamily: 'monospace',
                                margin: 0,
                            }}
                        >
                            {transaction.recipient.slice(0, 8)}...{transaction.recipient.slice(-8)}
                        </p>
                    </div>
                )}
            </div>
            {transaction.memo && (
                <div
                    style={{
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: `1px solid ${COLORS.ink}15`,
                    }}
                >
                    <p style={{ fontSize: '12px', color: COLORS.ink, opacity: 0.5, margin: '0 0 4px 0' }}>Memo</p>
                    <p style={{ fontSize: '13px', color: COLORS.ink, opacity: 0.8, margin: 0 }}>{transaction.memo}</p>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Amount checks */}
            {checks.map((check) => (
                <div
                    key={check.label}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                    <div>
                        <p style={{ fontSize: '14px', color: COLORS.ink, opacity: 0.8, margin: 0 }}>{check.label}</p>
                        {check.note && (
                            <p style={{ fontSize: '12px', color: COLORS.ink, opacity: 0.4, margin: '2px 0 0 0' }}>
                                {check.note}
                            </p>
                        )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ color: check.passed ? COLORS.success : COLORS.danger, fontWeight: 600 }}>
                            {formatUsdCents(check.current)}
                        </span>
                        <span style={{ color: COLORS.ink, opacity: 0.3, margin: '0 4px' }}>/</span>
                        <span style={{ color: COLORS.ink, opacity: 0.5 }}>{formatUsdCents(check.limit)}</span>
                        <span style={{ marginLeft: '8px' }}>{check.passed ? '✓' : '✗'}</span>
                    </div>
                </div>
            ))}

            {/* Chain check */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: '14px', color: COLORS.ink, opacity: 0.8, margin: 0 }}>Chain Allowed</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                        style={{
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 500,
                            background: chainAllowed ? `${COLORS.success}20` : `${COLORS.danger}20`,
                            color: chainAllowed ? COLORS.success : COLORS.danger,
                        }}
                    >
                        {transaction.chain}
                    </span>
                    <span>{chainAllowed ? '✓' : '✗'}</span>
                </div>
            </div>

            {/* Token check */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: '14px', color: COLORS.ink, opacity: 0.8, margin: 0 }}>Token Allowed</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                        style={{
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 500,
                            background: tokenAllowed ? `${COLORS.success}20` : `${COLORS.danger}20`,
                            color: tokenAllowed ? COLORS.success : COLORS.danger,
                        }}
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
    const buttonBase = {
        padding: '10px 16px',
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        border: 'none',
        transition: 'all 0.2s ease',
    };

    if (!checkResult.allowed) {
        return (
            <button
                type="button"
                onClick={() => onReject?.(checkResult.reason ?? 'Transaction not allowed')}
                style={{
                    ...buttonBase,
                    width: '100%',
                    background: `${COLORS.danger}20`,
                    color: COLORS.danger,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = `${COLORS.danger}30`)}
                onMouseLeave={(e) => (e.currentTarget.style.background = `${COLORS.danger}20`)}
            >
                Cancel
            </button>
        );
    }

    if (checkResult.requiresApproval) {
        return (
            <div style={{ display: 'flex', gap: '12px' }}>
                <button
                    type="button"
                    onClick={() => onReject?.('Transaction cancelled')}
                    style={{
                        ...buttonBase,
                        flex: 1,
                        background: `${COLORS.ink}10`,
                        color: `${COLORS.ink}80`,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = `${COLORS.ink}15`)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = `${COLORS.ink}10`)}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => onRequestApproval?.(transaction)}
                    style={{
                        ...buttonBase,
                        flex: 1,
                        background: `${COLORS.warning}20`,
                        color: COLORS.warning,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = `${COLORS.warning}30`)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = `${COLORS.warning}20`)}
                >
                    Request Approval
                </button>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', gap: '12px' }}>
            <button
                type="button"
                onClick={() => onReject?.('Transaction cancelled')}
                style={{
                    ...buttonBase,
                    flex: 1,
                    background: `${COLORS.ink}10`,
                    color: `${COLORS.ink}80`,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = `${COLORS.ink}15`)}
                onMouseLeave={(e) => (e.currentTarget.style.background = `${COLORS.ink}10`)}
            >
                Cancel
            </button>
            <button
                type="button"
                onClick={() => onApprove?.(transaction)}
                style={{
                    ...buttonBase,
                    flex: 1,
                    background: COLORS.success,
                    color: COLORS.surface,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#059669')}
                onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.success)}
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
            <div
                style={{
                    background: COLORS.surface,
                    border: `1.5px solid ${COLORS.ink}20`,
                    borderRadius: '20px',
                    padding: '24px',
                    textAlign: 'center',
                }}
                className={className}
            >
                <p style={{ color: COLORS.ink, opacity: 0.6, margin: 0 }}>No wallet connected</p>
            </div>
        );
    }

    // No transaction state
    if (!transaction) {
        return (
            <div
                style={{
                    background: COLORS.surface,
                    border: `1.5px solid ${COLORS.ink}20`,
                    borderRadius: '20px',
                    padding: '24px',
                    textAlign: 'center',
                }}
                className={className}
            >
                <p style={{ color: COLORS.ink, opacity: 0.6, margin: 0 }}>No pending transaction</p>
            </div>
        );
    }

    // Checking state
    if (checking) {
        return (
            <div
                style={{
                    background: COLORS.surface,
                    border: `1.5px solid ${COLORS.ink}20`,
                    borderRadius: '20px',
                    padding: '24px',
                }}
                className={className}
            >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <StatusIndicator status="checking" />
                    <p style={{ color: COLORS.ink, opacity: 0.6, margin: 0 }}>Validating transaction...</p>
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
        <div
            style={{
                background: COLORS.surface,
                border: `1.5px solid ${COLORS.ink}20`,
                borderRadius: '20px',
                padding: '20px',
            }}
            className={className}
        >
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                }}
            >
                <h3
                    style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontSize: '18px',
                        fontWeight: 700,
                        color: COLORS.ink,
                        margin: 0,
                    }}
                >
                    Transaction Check
                </h3>
                <StatusIndicator status={status} />
            </div>

            {/* Wallet tier badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '14px', color: COLORS.ink, opacity: 0.5 }}>Wallet Tier:</span>
                <span
                    style={{
                        fontSize: '12px',
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        background: tierConfig.bgColor,
                        color: tierConfig.color,
                        border: `1.5px solid ${tierConfig.borderColor}`,
                        fontWeight: 600,
                    }}
                >
                    {tierConfig.icon} {tierConfig.label} ({wallet.reputationScore})
                </span>
            </div>

            {/* Transaction summary */}
            <TransactionSummary transaction={transaction} />

            {/* Policy comparison */}
            <div style={{ marginTop: '16px' }}>
                <h4
                    style={{
                        fontSize: '12px',
                        color: COLORS.ink,
                        opacity: 0.5,
                        margin: '0 0 12px 0',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                    }}
                >
                    Policy Checks
                </h4>
                <PolicyComparison wallet={wallet} transaction={transaction} currentDailySpend={currentDailySpend} />
            </div>

            {/* Error message */}
            {!checkResult?.allowed && checkResult?.reason && (
                <div
                    style={{
                        marginTop: '16px',
                        padding: '12px',
                        background: `${COLORS.danger}10`,
                        border: `1.5px solid ${COLORS.danger}30`,
                        borderRadius: '10px',
                    }}
                >
                    <p style={{ fontSize: '14px', color: COLORS.danger, margin: 0 }}>{checkResult.reason}</p>
                </div>
            )}

            {/* Approval required message */}
            {checkResult?.allowed && checkResult.requiresApproval && (
                <div
                    style={{
                        marginTop: '16px',
                        padding: '12px',
                        background: `${COLORS.warning}10`,
                        border: `1.5px solid ${COLORS.warning}30`,
                        borderRadius: '10px',
                    }}
                >
                    <p style={{ fontSize: '14px', color: COLORS.warning, margin: 0 }}>
                        Your reputation tier requires manual approval for transactions. Increase your reputation score
                        to {tier === 'bronze' ? 31 : 51}+ to enable automatic transactions.
                    </p>
                </div>
            )}

            {/* Action buttons */}
            <div
                style={{
                    marginTop: '16px',
                    paddingTop: '16px',
                    borderTop: `1px solid ${COLORS.ink}15`,
                }}
            >
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
        allowed: { icon: '✓', color: COLORS.success, bg: `${COLORS.success}20` },
        blocked: { icon: '✗', color: COLORS.danger, bg: `${COLORS.danger}20` },
        approval: { icon: '⏳', color: COLORS.warning, bg: `${COLORS.warning}20` },
    }[status];

    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '8px',
                background: config.bg,
                color: config.color,
                border: 'none',
                cursor: onClick ? 'pointer' : 'default',
                fontSize: '13px',
                fontWeight: 500,
                transition: 'opacity 0.2s ease',
            }}
            title={checkResult?.reason ?? (status === 'approval' ? 'Approval required' : 'Transaction allowed')}
            onMouseEnter={(e) => {
                if (onClick) e.currentTarget.style.opacity = '0.8';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
            }}
            className={className}
        >
            <span>{config.icon}</span>
            <span>{formatUsdCents(transaction.amountUsdCents)}</span>
        </button>
    );
}

export default ReputationGuard;
