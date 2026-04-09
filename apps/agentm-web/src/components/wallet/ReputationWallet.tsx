'use client';

/**
 * ReputationWallet Component
 *
 * Displays wallet information with integrated reputation score.
 * Shows tier status, limits, and allowed operations based on reputation.
 *
 * @module components/wallet/ReputationWallet
 */

import type { ReputationWalletProps, WalletInfo, ReputationData, ReputationTier } from '@/types/reputation-wallet';
import { getReputationTier, getTierConfig, formatUsdCents, truncateAddress, COLORS } from '@/types/reputation-wallet';

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Reputation score circle with tier indicator
 */
function ReputationScoreCircle({
    score,
    tier,
    size = 'md',
}: {
    score: number;
    tier: ReputationTier;
    size?: 'sm' | 'md' | 'lg';
}) {
    const tierConfig = getTierConfig(tier);
    const sizeConfig = {
        sm: { outer: 64, inner: 48, text: '16px', icon: '12px' },
        md: { outer: 96, inner: 80, text: '24px', icon: '14px' },
        lg: { outer: 128, inner: 112, text: '32px', icon: '16px' },
    }[size];

    // Calculate stroke dash for progress ring
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const progress = (score / 100) * circumference;

    return (
        <div
            style={{
                position: 'relative',
                width: sizeConfig.outer,
                height: sizeConfig.outer,
                flexShrink: 0,
            }}
        >
            {/* Progress ring */}
            <svg
                style={{
                    position: 'absolute',
                    inset: 0,
                    transform: 'rotate(-90deg)',
                }}
                viewBox="0 0 100 100"
            >
                <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={COLORS.ink}
                    strokeOpacity={0.1}
                    strokeWidth="6"
                />
                <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={tierConfig.progressColor}
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - progress}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                />
            </svg>

            {/* Center content */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: sizeConfig.inner,
                    height: sizeConfig.inner,
                    margin: 'auto',
                    borderRadius: '50%',
                    background: tierConfig.bgColor,
                    border: `1.5px solid ${tierConfig.borderColor}`,
                }}
            >
                <span style={{ fontSize: sizeConfig.text, fontWeight: 700, color: tierConfig.color }}>{score}</span>
                <span style={{ fontSize: sizeConfig.icon }}>{tierConfig.icon}</span>
            </div>
        </div>
    );
}

/**
 * Wallet address display with copy functionality
 */
function WalletAddress({
    address,
    name,
    onClick,
}: {
    address: string;
    name?: string;
    onClick?: (address: string) => void;
}) {
    const handleClick = () => {
        onClick?.(address);
    };

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(address);
        } catch {
            // Clipboard API not available
        }
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
                type="button"
                onClick={handleClick}
                style={{
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    color: COLORS.ink,
                    opacity: 0.6,
                    background: 'none',
                    border: 'none',
                    cursor: onClick ? 'pointer' : 'default',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '200px',
                    padding: 0,
                }}
                title={address}
            >
                {truncateAddress(address)}
            </button>
            <button
                type="button"
                onClick={handleCopy}
                style={{
                    padding: '4px',
                    color: COLORS.ink,
                    opacity: 0.4,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    borderRadius: '6px',
                    transition: 'opacity 0.2s ease',
                }}
                title="Copy address"
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.4')}
            >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                </svg>
            </button>
            {name && (
                <span
                    style={{
                        fontSize: '12px',
                        color: COLORS.ink,
                        opacity: 0.5,
                        padding: '2px 8px',
                        background: `${COLORS.ink}10`,
                        borderRadius: '6px',
                    }}
                >
                    {name}
                </span>
            )}
        </div>
    );
}

/**
 * Policy limits display
 */
function PolicyLimits({ wallet, compact = false }: { wallet: WalletInfo; compact?: boolean }) {
    const { policy } = wallet;

    if (compact) {
        return (
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    fontSize: '12px',
                    color: COLORS.ink,
                    opacity: 0.6,
                }}
            >
                <span>
                    Daily:{' '}
                    <span style={{ color: COLORS.ink, fontWeight: 600, opacity: 1 }}>
                        {formatUsdCents(policy.dailyLimit)}
                    </span>
                </span>
                <span>
                    Max TX:{' '}
                    <span style={{ color: COLORS.ink, fontWeight: 600, opacity: 1 }}>
                        {formatUsdCents(policy.maxTransaction)}
                    </span>
                </span>
                {policy.requireApproval && (
                    <span style={{ color: COLORS.warning, fontWeight: 500 }}>⚠️ Approval required</span>
                )}
            </div>
        );
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div
                style={{
                    background: `${COLORS.ink}08`,
                    borderRadius: '10px',
                    padding: '12px',
                    border: `1px solid ${COLORS.ink}15`,
                }}
            >
                <p style={{ fontSize: '12px', color: COLORS.ink, opacity: 0.5, margin: '0 0 4px 0' }}>Daily Limit</p>
                <p style={{ fontSize: '18px', fontWeight: 700, color: COLORS.ink, margin: 0 }}>
                    {formatUsdCents(policy.dailyLimit)}
                </p>
            </div>
            <div
                style={{
                    background: `${COLORS.ink}08`,
                    borderRadius: '10px',
                    padding: '12px',
                    border: `1px solid ${COLORS.ink}15`,
                }}
            >
                <p style={{ fontSize: '12px', color: COLORS.ink, opacity: 0.5, margin: '0 0 4px 0' }}>
                    Max Transaction
                </p>
                <p style={{ fontSize: '18px', fontWeight: 700, color: COLORS.ink, margin: 0 }}>
                    {formatUsdCents(policy.maxTransaction)}
                </p>
            </div>
            <div
                style={{
                    background: `${COLORS.ink}08`,
                    borderRadius: '10px',
                    padding: '12px',
                    border: `1px solid ${COLORS.ink}15`,
                }}
            >
                <p style={{ fontSize: '12px', color: COLORS.ink, opacity: 0.5, margin: '0 0 8px 0' }}>Allowed Chains</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {policy.allowedChains.map((chain) => (
                        <span
                            key={chain}
                            style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                background: `${COLORS.info}20`,
                                color: COLORS.info,
                                borderRadius: '6px',
                                fontWeight: 500,
                            }}
                        >
                            {chain}
                        </span>
                    ))}
                </div>
            </div>
            <div
                style={{
                    background: `${COLORS.ink}08`,
                    borderRadius: '10px',
                    padding: '12px',
                    border: `1px solid ${COLORS.ink}15`,
                }}
            >
                <p style={{ fontSize: '12px', color: COLORS.ink, opacity: 0.5, margin: '0 0 8px 0' }}>Allowed Tokens</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {policy.allowedTokens === null ? (
                        <span style={{ fontSize: '12px', color: COLORS.success, fontWeight: 500 }}>All tokens</span>
                    ) : (
                        policy.allowedTokens.map((token) => (
                            <span
                                key={token}
                                style={{
                                    fontSize: '11px',
                                    padding: '2px 8px',
                                    background: `${COLORS.success}20`,
                                    color: COLORS.success,
                                    borderRadius: '6px',
                                    fontWeight: 500,
                                }}
                            >
                                {token}
                            </span>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Reputation stats display
 */
function ReputationStats({ reputation }: { reputation: ReputationData }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
            <div>
                <p style={{ fontSize: '20px', fontWeight: 700, color: COLORS.ink, margin: 0 }}>
                    {reputation.completed}
                </p>
                <p style={{ fontSize: '12px', color: COLORS.ink, opacity: 0.5, margin: '4px 0 0 0' }}>Completed</p>
            </div>
            <div>
                <p style={{ fontSize: '20px', fontWeight: 700, color: COLORS.ink, margin: 0 }}>
                    {(reputation.winRate * 100).toFixed(0)}%
                </p>
                <p style={{ fontSize: '12px', color: COLORS.ink, opacity: 0.5, margin: '4px 0 0 0' }}>Win Rate</p>
            </div>
            <div>
                <p style={{ fontSize: '20px', fontWeight: 700, color: COLORS.ink, margin: 0 }}>
                    {reputation.totalApplied}
                </p>
                <p style={{ fontSize: '12px', color: COLORS.ink, opacity: 0.5, margin: '4px 0 0 0' }}>Applied</p>
            </div>
        </div>
    );
}

/**
 * Loading skeleton
 */
function LoadingSkeleton({ size }: { size: 'sm' | 'md' | 'lg' }) {
    const sizeConfig = {
        sm: { height: 128, circle: 64 },
        md: { height: 192, circle: 96 },
        lg: { height: 256, circle: 128 },
    }[size];

    return (
        <div
            style={{
                height: sizeConfig.height,
                background: COLORS.surface,
                border: `1.5px solid ${COLORS.ink}20`,
                borderRadius: '20px',
                padding: '16px',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div
                    style={{
                        width: sizeConfig.circle,
                        height: sizeConfig.circle,
                        background: `${COLORS.ink}10`,
                        borderRadius: '50%',
                    }}
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ height: 24, background: `${COLORS.ink}10`, borderRadius: 6, width: 128 }} />
                    <div style={{ height: 16, background: `${COLORS.ink}10`, borderRadius: 6, width: 192 }} />
                    <div style={{ height: 16, background: `${COLORS.ink}10`, borderRadius: 6, width: 160 }} />
                </div>
            </div>
        </div>
    );
}

/**
 * Error state display
 */
function ErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
    return (
        <div
            style={{
                background: `${COLORS.danger}10`,
                border: `1.5px solid ${COLORS.danger}40`,
                borderRadius: '20px',
                padding: '20px',
                textAlign: 'center',
            }}
        >
            <p style={{ color: COLORS.danger, marginBottom: onRetry ? '12px' : 0, marginTop: 0 }}>{error}</p>
            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    style={{
                        fontSize: '14px',
                        color: COLORS.danger,
                        textDecoration: 'underline',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 500,
                    }}
                >
                    Retry
                </button>
            )}
        </div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * ReputationWallet - Displays wallet with integrated reputation score
 *
 * Features:
 * - Reputation score circle with tier indicator
 * - Wallet address with copy functionality
 * - Policy limits based on reputation tier
 * - Reputation statistics
 * - Loading and error states
 */
export function ReputationWallet({
    wallet,
    reputation,
    loading = false,
    error = null,
    onRefresh,
    onAddressClick,
    size = 'md',
    className = '',
}: ReputationWalletProps) {
    // Loading state
    if (loading) {
        return <LoadingSkeleton size={size} />;
    }

    // Error state
    if (error) {
        return <ErrorState error={error} onRetry={onRefresh} />;
    }

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
            >
                <p style={{ color: COLORS.ink, opacity: 0.6, marginBottom: '8px', marginTop: 0 }}>
                    No wallet connected
                </p>
                <p style={{ fontSize: '14px', color: COLORS.ink, opacity: 0.4, margin: 0 }}>
                    Connect a wallet to view reputation-based limits
                </p>
            </div>
        );
    }

    const score = reputation?.score ?? wallet.reputationScore;
    const tier = getReputationTier(score);
    const tierConfig = getTierConfig(tier);

    const sizeConfig = {
        sm: { padding: '12px', gap: '12px', title: '16px' },
        md: { padding: '16px', gap: '16px', title: '18px' },
        lg: { padding: '24px', gap: '24px', title: '24px' },
    }[size];

    return (
        <div
            style={{
                background: COLORS.surface,
                border: `1.5px solid ${COLORS.ink}20`,
                borderRadius: '20px',
                padding: sizeConfig.padding,
            }}
            className={className}
        >
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: sizeConfig.gap,
                }}
            >
                {/* Reputation circle */}
                <ReputationScoreCircle score={score} tier={tier} size={size} />

                {/* Wallet info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '8px',
                        }}
                    >
                        <h3
                            style={{
                                fontFamily: "'Oswald', sans-serif",
                                fontSize: sizeConfig.title,
                                fontWeight: 700,
                                color: COLORS.ink,
                                margin: 0,
                            }}
                        >
                            Reputation Wallet
                        </h3>
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
                            {tierConfig.icon} {tierConfig.label}
                        </span>
                    </div>

                    <WalletAddress address={wallet.address} name={wallet.name} onClick={onAddressClick} />

                    {/* Compact policy display */}
                    {size === 'sm' && (
                        <div style={{ marginTop: '8px' }}>
                            <PolicyLimits wallet={wallet} compact />
                        </div>
                    )}

                    {/* Refresh button */}
                    {onRefresh && (
                        <button
                            type="button"
                            onClick={onRefresh}
                            style={{
                                marginTop: '8px',
                                fontSize: '12px',
                                color: COLORS.ink,
                                opacity: 0.4,
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: 0,
                                transition: 'opacity 0.2s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.4')}
                        >
                            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                            </svg>
                            Refresh
                        </button>
                    )}
                </div>
            </div>

            {/* Approval warning */}
            {wallet.policy.requireApproval && (
                <div
                    style={{
                        marginTop: '16px',
                        padding: '12px',
                        background: `${COLORS.warning}10`,
                        border: `1.5px solid ${COLORS.warning}30`,
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}
                >
                    <span style={{ color: COLORS.warning }}>⚠️</span>
                    <p style={{ fontSize: '14px', color: COLORS.warning, margin: 0, fontWeight: 500 }}>
                        Manual approval required for all transactions
                    </p>
                </div>
            )}

            {/* Policy limits (md and lg sizes) */}
            {size !== 'sm' && (
                <div style={{ marginTop: '16px' }}>
                    <h4
                        style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: COLORS.ink,
                            opacity: 0.8,
                            margin: '0 0 12px 0',
                        }}
                    >
                        Spending Limits
                    </h4>
                    <PolicyLimits wallet={wallet} />
                </div>
            )}

            {/* Reputation stats (lg size only) */}
            {size === 'lg' && reputation && (
                <div
                    style={{
                        marginTop: '16px',
                        paddingTop: '16px',
                        borderTop: `1px solid ${COLORS.ink}15`,
                    }}
                >
                    <h4
                        style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: COLORS.ink,
                            opacity: 0.8,
                            margin: '0 0 12px 0',
                        }}
                    >
                        Reputation Stats
                    </h4>
                    <ReputationStats reputation={reputation} />
                </div>
            )}
        </div>
    );
}

/**
 * Compact wallet card for list displays
 */
export function ReputationWalletCompact({
    wallet,
    onClick,
    className = '',
}: {
    wallet: WalletInfo;
    onClick?: () => void;
    className?: string;
}) {
    const tier = getReputationTier(wallet.reputationScore);
    const tierConfig = getTierConfig(tier);

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                background: COLORS.surface,
                border: `1.5px solid ${COLORS.ink}20`,
                borderRadius: '14px',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'border-color 0.2s ease',
            }}
            onClick={onClick}
            onMouseEnter={(e) => {
                if (onClick) e.currentTarget.style.borderColor = `${COLORS.ink}40`;
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `${COLORS.ink}20`;
            }}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            className={className}
        >
            <div
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: tierConfig.bgColor,
                    border: `1.5px solid ${tierConfig.borderColor}`,
                }}
            >
                <span style={{ fontSize: '14px', fontWeight: 700, color: tierConfig.color }}>
                    {wallet.reputationScore}
                </span>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <p
                    style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: COLORS.ink,
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {wallet.name}
                </p>
                <p
                    style={{
                        fontSize: '12px',
                        color: COLORS.ink,
                        opacity: 0.5,
                        fontFamily: 'monospace',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {truncateAddress(wallet.address, 6)}
                </p>
            </div>

            <span
                style={{
                    fontSize: '12px',
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    background: tierConfig.bgColor,
                    color: tierConfig.color,
                    fontWeight: 600,
                }}
            >
                {tierConfig.icon}
            </span>
        </div>
    );
}

export default ReputationWallet;
