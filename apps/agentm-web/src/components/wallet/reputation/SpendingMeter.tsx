'use client';

/**
 * SpendingMeter Component
 *
 * Displays daily spending progress with visual indicators for
 * warning and danger thresholds.
 *
 * @module components/wallet/reputation/SpendingMeter
 */

import { COLORS, formatUsdCents } from '@/types/reputation-wallet';

/**
 * Props for SpendingMeter component
 */
export interface SpendingMeterProps {
    /** Current spending amount in USD cents */
    current: number;
    /** Daily spending limit in USD cents */
    limit: number;
}

/**
 * Daily spending meter with visual progress bar
 *
 * Features:
 * - Visual progress bar showing spending vs limit
 * - Color-coded warnings (green → yellow → red)
 * - Warning message when approaching limit
 */
export function SpendingMeter({ current, limit }: SpendingMeterProps) {
    const percentage = Math.min((current / limit) * 100, 100);
    const isWarning = percentage >= 75;
    const isDanger = percentage >= 90;

    const barColor = isDanger ? COLORS.danger : isWarning ? COLORS.warning : COLORS.success;

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
                    marginBottom: '8px',
                }}
            >
                <h4 style={{ fontSize: '14px', fontWeight: 500, color: COLORS.ink, opacity: 0.8, margin: 0 }}>
                    Today&apos;s Spending
                </h4>
                <span style={{ fontSize: '12px', color: COLORS.ink, opacity: 0.5 }}>
                    {formatUsdCents(current)} / {formatUsdCents(limit)}
                </span>
            </div>

            <div
                style={{
                    position: 'relative',
                    height: '12px',
                    background: `${COLORS.ink}10`,
                    borderRadius: '9999px',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        inset: '0',
                        width: `${percentage}%`,
                        background: barColor,
                        borderRadius: '9999px',
                        transition: 'all 0.3s ease',
                    }}
                />
            </div>

            {isDanger && (
                <p style={{ fontSize: '12px', color: COLORS.danger, marginTop: '8px', marginBottom: 0 }}>
                    ⚠️ Approaching daily limit
                </p>
            )}
        </div>
    );
}

export default SpendingMeter;
