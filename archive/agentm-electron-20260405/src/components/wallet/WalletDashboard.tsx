/**
 * WalletDashboard Component
 *
 * Comprehensive dashboard showing wallet status, reputation-based limits,
 * transaction history, and reputation progression.
 *
 * @module components/wallet/WalletDashboard
 */

import { useState, useMemo } from 'react';
import type {
    WalletDashboardProps,
    WalletInfo,
    ReputationData,
    WalletTransaction,
    ReputationHistoryEntry,
    ReputationTier,
} from './types.ts';
import { getReputationTier, getTierConfig, formatUsdCents, truncateAddress, calculatePolicy } from './types.ts';

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Tier progression bar showing current position and upgrade path
 */
function TierProgressionBar({ score }: { score: number }) {
    const tiers: { name: ReputationTier; threshold: number }[] = [
        { name: 'bronze', threshold: 0 },
        { name: 'silver', threshold: 31 },
        { name: 'gold', threshold: 51 },
        { name: 'platinum', threshold: 81 },
    ];

    const currentTier = getReputationTier(score);
    const currentTierIndex = tiers.findIndex((t) => t.name === currentTier);
    const nextTier = currentTierIndex < tiers.length - 1 ? tiers[currentTierIndex + 1] : null;

    const progressInTier = nextTier
        ? ((score - tiers[currentTierIndex].threshold) / (nextTier.threshold - tiers[currentTierIndex].threshold)) * 100
        : 100;

    return (
        <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-300">Tier Progress</h4>
                {nextTier && (
                    <span className="text-xs text-gray-500">
                        {nextTier.threshold - score} points to {nextTier.name}
                    </span>
                )}
            </div>

            {/* Progress bar */}
            <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                    className={`absolute inset-y-0 left-0 ${getTierConfig(currentTier).bgColor.replace('/20', '/60')} rounded-full transition-all`}
                    style={{ width: `${progressInTier}%` }}
                />
            </div>

            {/* Tier markers */}
            <div className="flex justify-between mt-2">
                {tiers.map((tier) => {
                    const config = getTierConfig(tier.name);
                    const isActive = score >= tier.threshold;
                    const isCurrent = tier.name === currentTier;

                    return (
                        <div key={tier.name} className={`flex flex-col items-center ${isActive ? '' : 'opacity-50'}`}>
                            <span className="text-sm">{config.icon}</span>
                            <span className={`text-xs ${isCurrent ? config.color : 'text-gray-500'}`}>
                                {tier.threshold}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Daily spending meter
 */
function SpendingMeter({ current, limit }: { current: number; limit: number }) {
    const percentage = Math.min((current / limit) * 100, 100);
    const isWarning = percentage >= 75;
    const isDanger = percentage >= 90;

    const colorClass = isDanger ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-emerald-500';

    return (
        <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-300">Today's Spending</h4>
                <span className="text-xs text-gray-500">
                    {formatUsdCents(current)} / {formatUsdCents(limit)}
                </span>
            </div>

            <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                    className={`absolute inset-y-0 left-0 ${colorClass} rounded-full transition-all`}
                    style={{ width: `${percentage}%` }}
                />
            </div>

            {isDanger && <p className="text-xs text-red-400 mt-2">⚠️ Approaching daily limit</p>}
        </div>
    );
}

/**
 * Policy details card
 */
function PolicyCard({ wallet }: { wallet: WalletInfo }) {
    const { policy } = wallet;
    const tier = getReputationTier(wallet.reputationScore);
    const tierConfig = getTierConfig(tier);

    return (
        <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-gray-300">Current Policy</h4>
                <span
                    className={`
                        text-xs px-2 py-0.5 rounded-full
                        ${tierConfig.bgColor} ${tierConfig.color}
                    `}
                >
                    {tierConfig.icon} {tierConfig.label}
                </span>
            </div>

            <div className="space-y-3">
                <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Daily Limit</span>
                    <span className="text-sm font-medium text-white">{formatUsdCents(policy.dailyLimit)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Max Transaction</span>
                    <span className="text-sm font-medium text-white">{formatUsdCents(policy.maxTransaction)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Approval Required</span>
                    <span
                        className={`text-sm font-medium ${
                            policy.requireApproval ? 'text-yellow-400' : 'text-emerald-400'
                        }`}
                    >
                        {policy.requireApproval ? 'Yes' : 'No'}
                    </span>
                </div>
                <div>
                    <span className="text-sm text-gray-400">Allowed Chains</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {policy.allowedChains.map((chain) => (
                            <span key={chain} className="text-xs px-1.5 py-0.5 bg-blue-600/20 text-blue-400 rounded">
                                {chain}
                            </span>
                        ))}
                    </div>
                </div>
                <div>
                    <span className="text-sm text-gray-400">Allowed Tokens</span>
                    <div className="flex flex-wrap gap-1 mt-1">
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
        </div>
    );
}

/**
 * Upgrade benefits preview
 */
function UpgradeBenefits({ currentScore }: { currentScore: number }) {
    const currentTier = getReputationTier(currentScore);
    const tiers: ReputationTier[] = ['bronze', 'silver', 'gold', 'platinum'];
    const currentIndex = tiers.indexOf(currentTier);

    if (currentIndex === tiers.length - 1) {
        return (
            <div className="bg-purple-600/10 border border-purple-600/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">💎</span>
                    <h4 className="text-sm font-medium text-purple-300">Platinum Status</h4>
                </div>
                <p className="text-xs text-gray-400">
                    You've reached the highest tier! Enjoy maximum limits and all tokens.
                </p>
            </div>
        );
    }

    const nextTier = tiers[currentIndex + 1];
    const nextPolicy = calculatePolicy(nextTier === 'silver' ? 31 : nextTier === 'gold' ? 51 : 81);
    const currentPolicy = calculatePolicy(currentScore);
    const nextConfig = getTierConfig(nextTier);

    return (
        <div className={`${nextConfig.bgColor} border ${nextConfig.borderColor} rounded-lg p-4`}>
            <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{nextConfig.icon}</span>
                <h4 className={`text-sm font-medium ${nextConfig.color}`}>Upgrade to {nextConfig.label}</h4>
            </div>

            <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                    <span className="text-gray-400">Daily Limit</span>
                    <span>
                        <span className="text-gray-500">{formatUsdCents(currentPolicy.dailyLimit)}</span>
                        <span className="mx-1">→</span>
                        <span className={nextConfig.color}>{formatUsdCents(nextPolicy.dailyLimit)}</span>
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Max TX</span>
                    <span>
                        <span className="text-gray-500">{formatUsdCents(currentPolicy.maxTransaction)}</span>
                        <span className="mx-1">→</span>
                        <span className={nextConfig.color}>{formatUsdCents(nextPolicy.maxTransaction)}</span>
                    </span>
                </div>
                {currentPolicy.requireApproval && !nextPolicy.requireApproval && (
                    <div className="flex justify-between">
                        <span className="text-gray-400">Approval</span>
                        <span className={nextConfig.color}>Auto-approved ✓</span>
                    </div>
                )}
                {nextPolicy.allowedChains.length > currentPolicy.allowedChains.length && (
                    <div className="flex justify-between">
                        <span className="text-gray-400">+Chains</span>
                        <span className={nextConfig.color}>
                            {nextPolicy.allowedChains
                                .filter((c) => !currentPolicy.allowedChains.includes(c))
                                .join(', ')}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Transaction list item
 */
function TransactionItem({
    transaction,
    onClick,
}: {
    transaction: WalletTransaction;
    onClick?: (transaction: WalletTransaction) => void;
}) {
    const isIncoming = transaction.type === 'incoming';
    const statusColors = {
        pending: 'text-yellow-400',
        confirmed: 'text-emerald-400',
        failed: 'text-red-400',
    };

    return (
        <div
            className={`
                flex items-center justify-between p-3 bg-gray-800/30 rounded-lg
                ${onClick ? 'cursor-pointer hover:bg-gray-800/50 transition' : ''}
            `}
            onClick={() => onClick?.(transaction)}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
        >
            <div className="flex items-center gap-3">
                <div
                    className={`
                        w-8 h-8 rounded-full flex items-center justify-center
                        ${isIncoming ? 'bg-emerald-600/20' : 'bg-blue-600/20'}
                    `}
                >
                    <span className={isIncoming ? 'text-emerald-400' : 'text-blue-400'}>{isIncoming ? '↓' : '↑'}</span>
                </div>
                <div>
                    <p className="text-sm text-white">
                        {isIncoming ? 'Received' : 'Sent'} {transaction.token}
                    </p>
                    <p className="text-xs text-gray-500">{new Date(transaction.createdAt).toLocaleString()}</p>
                </div>
            </div>

            <div className="text-right">
                <p className={`text-sm font-medium ${isIncoming ? 'text-emerald-400' : 'text-white'}`}>
                    {isIncoming ? '+' : '-'}
                    {transaction.amount} {transaction.token}
                </p>
                <p className={`text-xs ${statusColors[transaction.status]}`}>{transaction.status}</p>
            </div>
        </div>
    );
}

/**
 * Reputation history chart (simplified bar visualization)
 */
function ReputationHistoryChart({ history }: { history: ReputationHistoryEntry[] }) {
    if (history.length === 0) {
        return <p className="text-sm text-gray-500 text-center py-4">No reputation history yet</p>;
    }

    // Show last 10 entries
    const recent = history.slice(0, 10).reverse();

    return (
        <div className="space-y-2">
            {recent.map((entry, index) => {
                const isPositive = entry.newScore > entry.oldScore;
                const change = entry.newScore - entry.oldScore;

                return (
                    <div key={index} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500 w-20 truncate">
                            {new Date(entry.changedAt).toLocaleDateString()}
                        </span>
                        <span className="text-gray-400 w-8">{entry.oldScore}</span>
                        <span className="text-gray-600">→</span>
                        <span className="text-white w-8">{entry.newScore}</span>
                        <span className={`w-10 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isPositive ? '+' : ''}
                            {change}
                        </span>
                        <span className="text-gray-500 flex-1 truncate" title={entry.reason}>
                            {entry.reason}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Loading skeleton for dashboard
 */
function LoadingSkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            <div className="h-24 bg-gray-800 rounded-xl" />
            <div className="grid grid-cols-2 gap-4">
                <div className="h-32 bg-gray-800 rounded-lg" />
                <div className="h-32 bg-gray-800 rounded-lg" />
            </div>
            <div className="h-48 bg-gray-800 rounded-lg" />
        </div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * WalletDashboard - Comprehensive wallet and reputation dashboard
 *
 * Features:
 * - Tier progression visualization
 * - Daily spending tracker
 * - Current policy details
 * - Upgrade benefits preview
 * - Transaction history
 * - Reputation history chart
 */
export function WalletDashboard({
    wallet,
    reputation,
    transactions = [],
    reputationHistory = [],
    currentDailySpend = 0,
    loading = false,
    error = null,
    onRefresh,
    onTransactionClick,
    className = '',
}: WalletDashboardProps) {
    const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'history'>('overview');

    // Computed values
    const score = useMemo(() => reputation?.score ?? wallet?.reputationScore ?? 0, [reputation, wallet]);
    const tier = useMemo(() => getReputationTier(score), [score]);
    const tierConfig = useMemo(() => getTierConfig(tier), [tier]);

    // Loading state
    if (loading) {
        return (
            <div className={`bg-gray-900 border border-gray-800 rounded-xl p-4 ${className}`}>
                <LoadingSkeleton />
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className={`bg-red-900/20 border border-red-800 rounded-xl p-6 ${className}`}>
                <p className="text-red-400 text-center mb-2">{error}</p>
                {onRefresh && (
                    <button
                        type="button"
                        onClick={onRefresh}
                        className="block mx-auto text-sm text-red-300 hover:text-red-200 underline"
                    >
                        Retry
                    </button>
                )}
            </div>
        );
    }

    // No wallet state
    if (!wallet) {
        return (
            <div className={`bg-gray-900 border border-gray-800 rounded-xl p-6 ${className}`}>
                <p className="text-gray-400 text-center mb-2">No wallet connected</p>
                <p className="text-sm text-gray-500 text-center">Connect a wallet to view your reputation dashboard</p>
            </div>
        );
    }

    return (
        <div className={`bg-gray-900 border border-gray-800 rounded-xl ${className}`}>
            {/* Header */}
            <div className="p-4 border-b border-gray-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div
                            className={`
                                w-12 h-12 rounded-full flex items-center justify-center
                                ${tierConfig.bgColor} ${tierConfig.borderColor} border-2
                            `}
                        >
                            <span className={`text-xl font-bold ${tierConfig.color}`}>{score}</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Reputation Wallet</h2>
                            <p className="text-sm text-gray-500 font-mono">{truncateAddress(wallet.address)}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span
                            className={`
                                px-3 py-1 rounded-full
                                ${tierConfig.bgColor} ${tierConfig.color} ${tierConfig.borderColor} border
                            `}
                        >
                            {tierConfig.icon} {tierConfig.label}
                        </span>
                        {onRefresh && (
                            <button
                                type="button"
                                onClick={onRefresh}
                                className="p-2 text-gray-500 hover:text-gray-400 transition"
                                title="Refresh"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mt-4">
                    {(['overview', 'transactions', 'history'] as const).map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`
                                text-sm px-3 py-1 rounded-lg transition
                                ${activeTab === tab ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-400'}
                            `}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {activeTab === 'overview' && (
                    <div className="space-y-4">
                        {/* Tier progression */}
                        <TierProgressionBar score={score} />

                        {/* Spending and Policy row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <SpendingMeter current={currentDailySpend} limit={wallet.policy.dailyLimit} />
                            <PolicyCard wallet={wallet} />
                        </div>

                        {/* Upgrade benefits */}
                        <UpgradeBenefits currentScore={score} />

                        {/* Reputation stats */}
                        {reputation && (
                            <div className="bg-gray-800/50 rounded-lg p-4">
                                <h4 className="text-sm font-medium text-gray-300 mb-3">Reputation Stats</h4>
                                <div className="grid grid-cols-4 gap-4 text-center">
                                    <div>
                                        <p className="text-xl font-bold text-white">{score}</p>
                                        <p className="text-xs text-gray-500">Score</p>
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold text-white">{reputation.completed}</p>
                                        <p className="text-xs text-gray-500">Completed</p>
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold text-white">
                                            {(reputation.winRate * 100).toFixed(0)}%
                                        </p>
                                        <p className="text-xs text-gray-500">Win Rate</p>
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold text-white">{reputation.totalApplied}</p>
                                        <p className="text-xs text-gray-500">Applied</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'transactions' && (
                    <div className="space-y-2">
                        {transactions.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-8">No transactions yet</p>
                        ) : (
                            transactions.map((tx) => (
                                <TransactionItem key={tx.id} transaction={tx} onClick={onTransactionClick} />
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="bg-gray-800/50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-300 mb-3">Reputation History</h4>
                        <ReputationHistoryChart history={reputationHistory} />
                    </div>
                )}
            </div>
        </div>
    );
}

export default WalletDashboard;
