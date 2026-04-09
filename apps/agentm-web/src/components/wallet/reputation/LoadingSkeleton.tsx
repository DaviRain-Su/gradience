'use client';

/**
 * LoadingSkeleton Component
 *
 * Loading skeleton for reputation dashboard.
 *
 * @module components/wallet/reputation/LoadingSkeleton
 */

import { COLORS } from '@/types/reputation-wallet';

/**
 * Loading skeleton for dashboard
 */
export function LoadingSkeleton() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
                style={{
                    height: '96px',
                    background: `${COLORS.ink}10`,
                    borderRadius: '16px',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div
                    style={{
                        height: '128px',
                        background: `${COLORS.ink}10`,
                        borderRadius: '12px',
                        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    }}
                />
                <div
                    style={{
                        height: '128px',
                        background: `${COLORS.ink}10`,
                        borderRadius: '12px',
                        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    }}
                />
            </div>
            <div
                style={{
                    height: '192px',
                    background: `${COLORS.ink}10`,
                    borderRadius: '12px',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                }}
            />
        </div>
    );
}

export default LoadingSkeleton;
