'use client';

/**
 * ReputationHistoryChart Component
 *
 * Displays reputation history as a simplified bar visualization.
 *
 * @module components/wallet/reputation/ReputationHistoryChart
 */

import type { ReputationHistoryEntry } from '@/types/reputation-wallet';
import { COLORS } from '@/types/reputation-wallet';

/**
 * Props for ReputationHistoryChart component
 */
interface ReputationHistoryChartProps {
    /** Array of reputation history entries */
    history: ReputationHistoryEntry[];
}

/**
 * Reputation history chart (simplified bar visualization)
 */
export function ReputationHistoryChart({ history }: ReputationHistoryChartProps) {
    if (history.length === 0) {
        return (
            <p style={{ fontSize: '14px', color: COLORS.ink, opacity: 0.5, textAlign: 'center', padding: '16px 0' }}>
                No reputation history yet
            </p>
        );
    }

    // Show last 10 entries
    const recent = history.slice(0, 10).reverse();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recent.map((entry, index) => {
                const isPositive = entry.newScore > entry.oldScore;
                const change = entry.newScore - entry.oldScore;

                return (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                        <span style={{ color: COLORS.ink, opacity: 0.5, width: '80px' }}>
                            {new Date(entry.changedAt).toLocaleDateString()}
                        </span>
                        <span style={{ color: COLORS.ink, opacity: 0.7, width: '32px' }}>{entry.oldScore}</span>
                        <span style={{ color: COLORS.ink, opacity: 0.3 }}>→</span>
                        <span style={{ color: COLORS.ink, width: '32px', fontWeight: 600 }}>{entry.newScore}</span>
                        <span
                            style={{
                                width: '40px',
                                color: isPositive ? COLORS.success : COLORS.danger,
                                fontWeight: 500,
                            }}
                        >
                            {isPositive ? '+' : ''}
                            {change}
                        </span>
                        <span
                            style={{
                                color: COLORS.ink,
                                opacity: 0.5,
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                            title={entry.reason}
                        >
                            {entry.reason}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

export default ReputationHistoryChart;
