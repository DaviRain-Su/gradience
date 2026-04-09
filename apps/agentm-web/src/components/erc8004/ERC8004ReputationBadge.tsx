'use client';

import { useEffect, useState } from 'react';
import { useERC8004, type ERC8004Reputation } from '@/hooks/useERC8004';

interface ERC8004ReputationBadgeProps {
    agentId: string;
    showHistory?: boolean;
}

/**
 * ERC8004ReputationBadge - GRA-227b
 *
 * Displays ERC-8004 on-chain reputation with visual indicator.
 */
export function ERC8004ReputationBadge({ agentId, showHistory = false }: ERC8004ReputationBadgeProps) {
    const { getReputation, loading, error } = useERC8004();
    const [reputation, setReputation] = useState<ERC8004Reputation | null>(null);

    useEffect(() => {
        const fetch = async () => {
            const rep = await getReputation(agentId);
            setReputation(rep);
        };
        fetch();
    }, [agentId, getReputation]);

    if (loading) {
        return (
            <div style={badgeStyle}>
                <span style={{ fontSize: '12px', color: '#666' }}>Loading...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ ...badgeStyle, borderColor: '#dc2626' }}>
                <span style={{ fontSize: '12px', color: '#dc2626' }}>Error</span>
            </div>
        );
    }

    if (!reputation) {
        return (
            <div style={{ ...badgeStyle, background: '#f3f3f8' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>Not registered</span>
            </div>
        );
    }

    // Calculate display value
    const displayValue = (reputation.value / Math.pow(10, reputation.decimals)).toFixed(2);

    // Determine color based on value
    const getColor = (val: number) => {
        if (val >= 80) return '#22c55e'; // Green
        if (val >= 50) return '#3b82f6'; // Blue
        if (val >= 20) return '#f59e0b'; // Yellow
        return '#dc2626'; // Red
    };

    const color = getColor(reputation.value);

    return (
        <div style={containerStyle}>
            <div style={{ ...badgeStyle, borderColor: color }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>🔗</span>
                    <div>
                        <p style={{ fontSize: '11px', color: '#666', margin: '0 0 2px 0' }}>ERC-8004 Reputation</p>
                        <p style={{ fontSize: '18px', fontWeight: 700, color, margin: 0 }}>{displayValue}</p>
                    </div>
                </div>
            </div>

            {showHistory && (
                <div style={historyStyle}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#16161a', margin: '0 0 8px 0' }}>
                        Reputation Stats
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: '#666' }}>Feedback Count:</span>
                        <span style={{ color: '#16161a', fontWeight: 600 }}>{reputation.feedbackCount}</span>
                    </div>
                    <div
                        style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '4px' }}
                    >
                        <span style={{ color: '#666' }}>Raw Value:</span>
                        <span style={{ color: '#16161a', fontFamily: 'monospace', fontSize: '11px' }}>
                            {reputation.rawValue}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
};

const badgeStyle: React.CSSProperties = {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '12px 16px',
    border: '2px solid #16161a',
};

const historyStyle: React.CSSProperties = {
    background: '#f3f3f8',
    borderRadius: '8px',
    padding: '12px',
};
