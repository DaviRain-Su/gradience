'use client';

/**
 * UpgradeBenefits Component
 *
 * Displays upgrade benefits preview showing current tier vs next tier comparison.
 *
 * @module components/wallet/reputation/UpgradeBenefits
 */

import type { ReputationTier } from '@/types/reputation-wallet';
import { getReputationTier, getTierConfig, formatUsdCents, calculatePolicy, COLORS } from '@/types/reputation-wallet';

interface UpgradeBenefitsProps {
    currentScore: number;
}

/**
 * Upgrade benefits preview
 */
export function UpgradeBenefits({ currentScore }: UpgradeBenefitsProps) {
    const currentTier = getReputationTier(currentScore);
    const tiers: ReputationTier[] = ['bronze', 'silver', 'gold', 'platinum'];
    const currentIndex = tiers.indexOf(currentTier);

    if (currentIndex === tiers.length - 1) {
        return (
            <div
                style={{
                    background: `${COLORS.lavender}30`,
                    border: `1.5px solid ${COLORS.lavender}50`,
                    borderRadius: '12px',
                    padding: '16px',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '20px' }}>💎</span>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, color: COLORS.ink, margin: 0 }}>Platinum Status</h4>
                </div>
                <p style={{ fontSize: '12px', color: COLORS.ink, opacity: 0.6, margin: 0 }}>
                    You&apos;ve reached the highest tier! Enjoy maximum limits and all tokens.
                </p>
            </div>
        );
    }

    const nextTier = tiers[currentIndex + 1];
    const nextPolicy = calculatePolicy(nextTier === 'silver' ? 31 : nextTier === 'gold' ? 51 : 81);
    const currentPolicy = calculatePolicy(currentScore);
    const nextConfig = getTierConfig(nextTier);

    return (
        <div
            style={{
                background: nextConfig.bgColor,
                border: `1.5px solid ${nextConfig.borderColor}`,
                borderRadius: '12px',
                padding: '16px',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '20px' }}>{nextConfig.icon}</span>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: nextConfig.color, margin: 0 }}>
                    Upgrade to {nextConfig.label}
                </h4>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: COLORS.ink, opacity: 0.6 }}>Daily Limit</span>
                    <span>
                        <span style={{ color: COLORS.ink, opacity: 0.4 }}>
                            {formatUsdCents(currentPolicy.dailyLimit)}
                        </span>
                        <span style={{ margin: '0 4px', color: COLORS.ink, opacity: 0.4 }}>→</span>
                        <span style={{ color: nextConfig.color, fontWeight: 600 }}>
                            {formatUsdCents(nextPolicy.dailyLimit)}
                        </span>
                    </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: COLORS.ink, opacity: 0.6 }}>Max TX</span>
                    <span>
                        <span style={{ color: COLORS.ink, opacity: 0.4 }}>
                            {formatUsdCents(currentPolicy.maxTransaction)}
                        </span>
                        <span style={{ margin: '0 4px', color: COLORS.ink, opacity: 0.4 }}>→</span>
                        <span style={{ color: nextConfig.color, fontWeight: 600 }}>
                            {formatUsdCents(nextPolicy.maxTransaction)}
                        </span>
                    </span>
                </div>
                {currentPolicy.requireApproval && !nextPolicy.requireApproval && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: COLORS.ink, opacity: 0.6 }}>Approval</span>
                        <span style={{ color: COLORS.success, fontWeight: 500 }}>Auto-approved ✓</span>
                    </div>
                )}
                {nextPolicy.allowedChains.length > currentPolicy.allowedChains.length && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: COLORS.ink, opacity: 0.6 }}>+Chains</span>
                        <span style={{ color: nextConfig.color, fontWeight: 500 }}>
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

export default UpgradeBenefits;
