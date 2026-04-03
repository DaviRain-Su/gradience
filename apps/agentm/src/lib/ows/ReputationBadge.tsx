/**
 * ReputationBadge Component
 *
 * Displays an agent's reputation tier and score with visual indicators.
 * Integrates with OWS wallet and Chain Hub reputation data.
 *
 * @module lib/ows/ReputationBadge
 */

import type { ReputationData, ReputationTier, ReputationBadgeData } from './types.ts';
import { getTier, getTierConfig, formatWinRate, formatScore } from './useReputation.ts';

/**
 * Props for ReputationBadge component
 */
export interface ReputationBadgeProps {
    /** Reputation data to display */
    reputation: ReputationData | null;
    /** Visual size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Whether to show detailed stats */
    showDetails?: boolean;
    /** Whether to show loading skeleton */
    loading?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Click handler */
    onClick?: () => void;
}

/**
 * Tier label configuration
 */
const TIER_LABELS: Record<ReputationTier, string> = {
    legendary: 'Legendary',
    elite: 'Elite',
    expert: 'Expert',
    skilled: 'Skilled',
    novice: 'Novice',
    unknown: 'Unknown',
};

/**
 * Size configuration
 */
const SIZE_CONFIG = {
    sm: {
        badge: 'text-xs px-2 py-0.5 gap-1',
        icon: 'text-xs',
        details: 'text-[10px]',
    },
    md: {
        badge: 'text-sm px-3 py-1 gap-1.5',
        icon: 'text-sm',
        details: 'text-xs',
    },
    lg: {
        badge: 'text-base px-4 py-1.5 gap-2',
        icon: 'text-base',
        details: 'text-sm',
    },
};

/**
 * Compute badge data from reputation
 */
function computeBadgeData(reputation: ReputationData): ReputationBadgeData {
    const tier = getTier(reputation.globalAvgScore);
    const tierConfig = getTierConfig(tier);

    return {
        tier,
        score: formatScore(reputation.globalAvgScore),
        completedTasks: reputation.globalCompleted,
        winRate: formatWinRate(reputation.globalWinRate),
        color: tierConfig.color,
        icon: tierConfig.icon,
    };
}

/**
 * ReputationBadge - Visual reputation indicator
 *
 * Displays tier icon, label, and optionally detailed stats.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ReputationBadge reputation={reputationData} />
 *
 * // With details
 * <ReputationBadge reputation={reputationData} showDetails />
 *
 * // Different sizes
 * <ReputationBadge reputation={reputationData} size="lg" />
 * ```
 */
export function ReputationBadge({
    reputation,
    size = 'md',
    showDetails = false,
    loading = false,
    className = '',
    onClick,
}: ReputationBadgeProps) {
    const sizeConfig = SIZE_CONFIG[size];

    // Loading state
    if (loading) {
        return (
            <span
                className={`
                    inline-flex items-center rounded-full border
                    bg-gray-800/50 border-gray-700 animate-pulse
                    ${sizeConfig.badge}
                    ${className}
                `}
            >
                <span className={`${sizeConfig.icon} opacity-50`}>○</span>
                <span className="w-12 h-3 bg-gray-700 rounded" />
            </span>
        );
    }

    // No reputation data
    if (!reputation) {
        const unknownConfig = getTierConfig('unknown');
        return (
            <span
                className={`
                    inline-flex items-center rounded-full border font-medium
                    ${unknownConfig.color}
                    ${sizeConfig.badge}
                    ${onClick ? 'cursor-pointer hover:opacity-80 transition' : ''}
                    ${className}
                `}
                onClick={onClick}
                role={onClick ? 'button' : undefined}
                tabIndex={onClick ? 0 : undefined}
            >
                <span className={sizeConfig.icon}>?</span>
                <span>No Data</span>
            </span>
        );
    }

    const badge = computeBadgeData(reputation);

    return (
        <div className={`inline-flex flex-col ${className}`}>
            <span
                className={`
                    inline-flex items-center rounded-full border font-medium
                    ${badge.color}
                    ${sizeConfig.badge}
                    ${onClick ? 'cursor-pointer hover:opacity-80 transition' : ''}
                `}
                onClick={onClick}
                role={onClick ? 'button' : undefined}
                tabIndex={onClick ? 0 : undefined}
                title={`${TIER_LABELS[badge.tier]} - Score: ${badge.score}`}
            >
                <span className={sizeConfig.icon}>{badge.icon}</span>
                <span>{TIER_LABELS[badge.tier]}</span>
                <span className="opacity-75">({badge.score})</span>
            </span>

            {showDetails && (
                <div className={`mt-1 flex gap-2 text-gray-400 ${sizeConfig.details}`}>
                    <span title="Win Rate">🏆 {badge.winRate}</span>
                    <span title="Completed Tasks">✓ {badge.completedTasks}</span>
                </div>
            )}
        </div>
    );
}

/**
 * Props for ReputationBadgeCompact component
 */
export interface ReputationBadgeCompactProps {
    /** Reputation data to display */
    reputation: ReputationData | null;
    /** Whether to show loading state */
    loading?: boolean;
    /** Additional CSS classes */
    className?: string;
}

/**
 * ReputationBadgeCompact - Minimal reputation indicator
 *
 * Shows only the tier icon and score in a compact format.
 * Useful for lists and constrained spaces.
 *
 * @example
 * ```tsx
 * <ReputationBadgeCompact reputation={data} />
 * ```
 */
export function ReputationBadgeCompact({
    reputation,
    loading = false,
    className = '',
}: ReputationBadgeCompactProps) {
    if (loading) {
        return (
            <span className={`inline-flex items-center gap-1 text-gray-500 ${className}`}>
                <span className="animate-pulse">○</span>
                <span className="w-8 h-3 bg-gray-700 rounded animate-pulse" />
            </span>
        );
    }

    if (!reputation) {
        return (
            <span className={`inline-flex items-center gap-1 text-gray-500 ${className}`}>
                <span>?</span>
                <span>--</span>
            </span>
        );
    }

    const tier = getTier(reputation.globalAvgScore);
    const config = getTierConfig(tier);

    return (
        <span
            className={`inline-flex items-center gap-1 ${className}`}
            title={`${TIER_LABELS[tier]} - Score: ${formatScore(reputation.globalAvgScore)}`}
        >
            <span>{config.icon}</span>
            <span className={config.color.split(' ')[0]}>
                {formatScore(reputation.globalAvgScore)}
            </span>
        </span>
    );
}

/**
 * Props for ReputationCard component
 */
export interface ReputationCardProps {
    /** Reputation data to display */
    reputation: ReputationData | null;
    /** Loading state */
    loading?: boolean;
    /** Agent address for display */
    address?: string;
    /** Show category breakdown */
    showCategories?: boolean;
    /** Additional CSS classes */
    className?: string;
}

/**
 * ReputationCard - Full reputation display card
 *
 * Shows comprehensive reputation information including
 * tier, score, stats, and optional category breakdown.
 *
 * @example
 * ```tsx
 * <ReputationCard
 *   reputation={data}
 *   address="ABC123..."
 *   showCategories
 * />
 * ```
 */
export function ReputationCard({
    reputation,
    loading = false,
    address,
    showCategories = false,
    className = '',
}: ReputationCardProps) {
    if (loading) {
        return (
            <div
                className={`
                    p-4 rounded-lg border border-gray-700 bg-gray-800/50
                    animate-pulse ${className}
                `}
            >
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-700" />
                    <div className="flex-1">
                        <div className="w-24 h-4 bg-gray-700 rounded mb-2" />
                        <div className="w-16 h-3 bg-gray-700 rounded" />
                    </div>
                </div>
            </div>
        );
    }

    if (!reputation) {
        return (
            <div
                className={`
                    p-4 rounded-lg border border-gray-700 bg-gray-800/50
                    text-center text-gray-500 ${className}
                `}
            >
                <p>No reputation data available</p>
                {address && (
                    <p className="text-xs mt-1 text-gray-600 truncate">{address}</p>
                )}
            </div>
        );
    }

    const badge = computeBadgeData(reputation);

    return (
        <div
            className={`
                p-4 rounded-lg border bg-gray-800/50
                ${badge.color.replace('text-', 'border-').split(' ').slice(-1)[0]}
                ${className}
            `}
        >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div
                    className={`
                        w-12 h-12 rounded-full flex items-center justify-center
                        text-2xl ${badge.color}
                    `}
                >
                    {badge.icon}
                </div>
                <div>
                    <div className={`text-lg font-semibold ${badge.color.split(' ')[0]}`}>
                        {TIER_LABELS[badge.tier]}
                    </div>
                    <div className="text-sm text-gray-400">Score: {badge.score}</div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                    <div className="text-lg font-semibold text-white">
                        {badge.completedTasks}
                    </div>
                    <div className="text-xs text-gray-500">Completed</div>
                </div>
                <div>
                    <div className="text-lg font-semibold text-white">{badge.winRate}</div>
                    <div className="text-xs text-gray-500">Win Rate</div>
                </div>
                <div>
                    <div className="text-lg font-semibold text-white">
                        {reputation.globalTotalApplied}
                    </div>
                    <div className="text-xs text-gray-500">Applied</div>
                </div>
            </div>

            {/* Category Breakdown */}
            {showCategories && reputation.byCategory && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="text-xs text-gray-500 mb-2">By Category</div>
                    <div className="space-y-2">
                        {Object.entries(reputation.byCategory).map(([category, data]) => (
                            <div
                                key={category}
                                className="flex justify-between text-sm"
                            >
                                <span className="text-gray-400 capitalize">{category}</span>
                                <span className="text-white">
                                    {data.avgScore.toFixed(1)} ({data.completed} done)
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Address */}
            {address && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="text-xs text-gray-600 truncate" title={address}>
                        {address}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReputationBadge;
