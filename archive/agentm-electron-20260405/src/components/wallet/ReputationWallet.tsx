/**
 * ReputationWallet Component
 *
 * Displays wallet information with integrated reputation score.
 * Shows tier status, limits, and allowed operations based on reputation.
 *
 * @module components/wallet/ReputationWallet
 */

import type { ReputationWalletProps, WalletInfo, ReputationData, ReputationTier } from './types.ts';
import { getReputationTier, getTierConfig, formatUsdCents, truncateAddress } from './types.ts';

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
        sm: { outer: 'w-16 h-16', inner: 'w-12 h-12', text: 'text-lg', icon: 'text-xs' },
        md: { outer: 'w-24 h-24', inner: 'w-20 h-20', text: 'text-2xl', icon: 'text-sm' },
        lg: { outer: 'w-32 h-32', inner: 'w-28 h-28', text: 'text-3xl', icon: 'text-base' },
    }[size];

    // Calculate stroke dash for progress ring
    const circumference = 2 * Math.PI * 45; // radius = 45
    const progress = (score / 100) * circumference;

    return (
        <div className={`relative ${sizeConfig.outer} flex-shrink-0`}>
            {/* Progress ring */}
            <svg className="absolute inset-0 transform -rotate-90" viewBox="0 0 100 100">
                <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-gray-700"
                />
                <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - progress}
                    strokeLinecap="round"
                    className={tierConfig.color}
                />
            </svg>

            {/* Center content */}
            <div
                className={`
                    absolute inset-0 flex flex-col items-center justify-center
                    ${sizeConfig.inner} m-auto rounded-full
                    ${tierConfig.bgColor} ${tierConfig.borderColor} border
                `}
            >
                <span className={`${sizeConfig.text} font-bold ${tierConfig.color}`}>{score}</span>
                <span className={sizeConfig.icon}>{tierConfig.icon}</span>
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
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={handleClick}
                className="font-mono text-sm text-gray-400 hover:text-white transition truncate"
                title={address}
            >
                {truncateAddress(address)}
            </button>
            <button
                type="button"
                onClick={handleCopy}
                className="p-1 text-gray-500 hover:text-gray-300 transition"
                title="Copy address"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                </svg>
            </button>
            {name && <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-800 rounded">{name}</span>}
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
            <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>
                    Daily: <span className="text-white">{formatUsdCents(policy.dailyLimit)}</span>
                </span>
                <span>
                    Max TX: <span className="text-white">{formatUsdCents(policy.maxTransaction)}</span>
                </span>
                {policy.requireApproval && <span className="text-yellow-400">⚠️ Approval required</span>}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Daily Limit</p>
                <p className="text-lg font-semibold text-white">{formatUsdCents(policy.dailyLimit)}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Max Transaction</p>
                <p className="text-lg font-semibold text-white">{formatUsdCents(policy.maxTransaction)}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Allowed Chains</p>
                <div className="flex flex-wrap gap-1">
                    {policy.allowedChains.map((chain) => (
                        <span key={chain} className="text-xs px-1.5 py-0.5 bg-blue-600/20 text-blue-400 rounded">
                            {chain}
                        </span>
                    ))}
                </div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Allowed Tokens</p>
                <div className="flex flex-wrap gap-1">
                    {policy.allowedTokens === null ? (
                        <span className="text-xs text-emerald-400">All tokens</span>
                    ) : (
                        policy.allowedTokens.map((token) => (
                            <span
                                key={token}
                                className="text-xs px-1.5 py-0.5 bg-emerald-600/20 text-emerald-400 rounded"
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
        <div className="grid grid-cols-3 gap-2 text-center">
            <div>
                <p className="text-lg font-semibold text-white">{reputation.completed}</p>
                <p className="text-xs text-gray-500">Completed</p>
            </div>
            <div>
                <p className="text-lg font-semibold text-white">{(reputation.winRate * 100).toFixed(0)}%</p>
                <p className="text-xs text-gray-500">Win Rate</p>
            </div>
            <div>
                <p className="text-lg font-semibold text-white">{reputation.totalApplied}</p>
                <p className="text-xs text-gray-500">Applied</p>
            </div>
        </div>
    );
}

/**
 * Loading skeleton
 */
function LoadingSkeleton({ size }: { size: 'sm' | 'md' | 'lg' }) {
    const sizeConfig = {
        sm: 'h-32',
        md: 'h-48',
        lg: 'h-64',
    }[size];

    return (
        <div className={`${sizeConfig} bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse`}>
            <div className="flex items-start gap-4">
                <div className="w-24 h-24 bg-gray-800 rounded-full" />
                <div className="flex-1 space-y-3">
                    <div className="h-6 bg-gray-800 rounded w-32" />
                    <div className="h-4 bg-gray-800 rounded w-48" />
                    <div className="h-4 bg-gray-800 rounded w-40" />
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
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-center">
            <p className="text-red-400 mb-2">{error}</p>
            {onRetry && (
                <button type="button" onClick={onRetry} className="text-sm text-red-300 hover:text-red-200 underline">
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
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
                <p className="text-gray-400 mb-2">No wallet connected</p>
                <p className="text-sm text-gray-500">Connect a wallet to view reputation-based limits</p>
            </div>
        );
    }

    const score = reputation?.score ?? wallet.reputationScore;
    const tier = getReputationTier(score);
    const tierConfig = getTierConfig(tier);

    const sizeConfig = {
        sm: { padding: 'p-3', gap: 'gap-3', title: 'text-base' },
        md: { padding: 'p-4', gap: 'gap-4', title: 'text-lg' },
        lg: { padding: 'p-6', gap: 'gap-6', title: 'text-xl' },
    }[size];

    return (
        <div
            className={`
                bg-gray-900 border border-gray-800 rounded-xl
                ${sizeConfig.padding}
                ${className}
            `}
        >
            {/* Header */}
            <div className={`flex items-start ${sizeConfig.gap}`}>
                {/* Reputation circle */}
                <ReputationScoreCircle score={score} tier={tier} size={size} />

                {/* Wallet info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className={`${sizeConfig.title} font-bold text-white`}>Reputation Wallet</h3>
                        <span
                            className={`
                                text-xs px-2 py-1 rounded-full
                                ${tierConfig.bgColor} ${tierConfig.color} ${tierConfig.borderColor} border
                            `}
                        >
                            {tierConfig.icon} {tierConfig.label}
                        </span>
                    </div>

                    <WalletAddress address={wallet.address} name={wallet.name} onClick={onAddressClick} />

                    {/* Compact policy display */}
                    {size === 'sm' && (
                        <div className="mt-2">
                            <PolicyLimits wallet={wallet} compact />
                        </div>
                    )}

                    {/* Refresh button */}
                    {onRefresh && (
                        <button
                            type="button"
                            onClick={onRefresh}
                            className="mt-2 text-xs text-gray-500 hover:text-gray-400 transition flex items-center gap-1"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <div className="mt-4 p-3 bg-yellow-600/10 border border-yellow-600/20 rounded-lg flex items-center gap-2">
                    <span className="text-yellow-400">⚠️</span>
                    <p className="text-sm text-yellow-300">Manual approval required for all transactions</p>
                </div>
            )}

            {/* Policy limits (md and lg sizes) */}
            {size !== 'sm' && (
                <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Spending Limits</h4>
                    <PolicyLimits wallet={wallet} />
                </div>
            )}

            {/* Reputation stats (lg size only) */}
            {size === 'lg' && reputation && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Reputation Stats</h4>
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
            className={`
                flex items-center gap-3 p-3 bg-gray-900 border border-gray-800 rounded-lg
                ${onClick ? 'cursor-pointer hover:border-gray-700 transition' : ''}
                ${className}
            `}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
        >
            <div
                className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    ${tierConfig.bgColor} ${tierConfig.borderColor} border
                `}
            >
                <span className={`text-lg font-bold ${tierConfig.color}`}>{wallet.reputationScore}</span>
            </div>

            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{wallet.name}</p>
                <p className="text-xs text-gray-500 font-mono truncate">{truncateAddress(wallet.address, 6)}</p>
            </div>

            <span
                className={`
                    text-xs px-2 py-0.5 rounded-full
                    ${tierConfig.bgColor} ${tierConfig.color}
                `}
            >
                {tierConfig.icon}
            </span>
        </div>
    );
}

export default ReputationWallet;
