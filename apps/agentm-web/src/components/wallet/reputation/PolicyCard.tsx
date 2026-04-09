'use client';

/**
 * PolicyCard Component
 *
 * Displays wallet policy details based on reputation tier.
 * Extracted from ReputationDashboard.
 *
 * @module components/wallet/reputation/PolicyCard
 */

import type { WalletInfo } from '@/types/reputation-wallet';
import { getReputationTier, getTierConfig, formatUsdCents, COLORS } from '@/types/reputation-wallet';

interface PolicyCardProps {
    /** Wallet information */
    wallet: WalletInfo;
}

/**
 * Policy details card showing current wallet policy based on reputation tier
 */
export function PolicyCard({ wallet }: PolicyCardProps) {
    const { policy } = wallet;
    const tier = getReputationTier(wallet.reputationScore);
    const tierConfig = getTierConfig(tier);

    return (
        <div
            style={{
                background: `${COLORS.ink}08`,
                borderRadius: '12px',
                padding: '16px',
                border: `1px solid ${COLORS.ink}20`,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                }}
            >
                <h4 style={{ fontSize: '14px', fontWeight: 500, color: COLORS.ink, opacity: 0.8, margin: 0 }}>
                    Current Policy
                </h4>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '14px', color: COLORS.ink, opacity: 0.6 }}>Daily Limit</span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: COLORS.ink }}>
                        {formatUsdCents(policy.dailyLimit)}
                    </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '14px', color: COLORS.ink, opacity: 0.6 }}>Max Transaction</span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: COLORS.ink }}>
                        {formatUsdCents(policy.maxTransaction)}
                    </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '14px', color: COLORS.ink, opacity: 0.6 }}>Approval Required</span>
                    <span
                        style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: policy.requireApproval ? COLORS.warning : COLORS.success,
                        }}
                    >
                        {policy.requireApproval ? 'Yes' : 'No'}
                    </span>
                </div>
                <div>
                    <span style={{ fontSize: '14px', color: COLORS.ink, opacity: 0.6 }}>Allowed Chains</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                        {policy.allowedChains.map((chain) => (
                            <span
                                key={chain}
                                style={{
                                    fontSize: '12px',
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
                <div>
                    <span style={{ fontSize: '14px', color: COLORS.ink, opacity: 0.6 }}>Allowed Tokens</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                        {policy.allowedTokens === null ? (
                            <span style={{ fontSize: '12px', color: COLORS.success, fontWeight: 500 }}>All tokens</span>
                        ) : (
                            policy.allowedTokens.map((token) => (
                                <span
                                    key={token}
                                    style={{
                                        fontSize: '12px',
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
        </div>
    );
}

export default PolicyCard;
