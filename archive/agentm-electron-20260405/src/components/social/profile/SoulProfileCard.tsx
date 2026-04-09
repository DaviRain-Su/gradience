/**
 * Soul Profile Card Component - Fixed Version
 *
 * Using inline styles to ensure colors render correctly
 */

import type { SoulProfile } from '@gradiences/soul-engine';

interface SoulProfileCardProps {
    profile: SoulProfile;
    onViewDetails?: () => void;
    onStartProbe?: () => void;
    showActions?: boolean;
}

export function SoulProfileCard({ profile, onViewDetails, onStartProbe, showActions = true }: SoulProfileCardProps) {
    const isAgent = profile.soulType === 'agent';

    return (
        <div
            style={{
                background: '#1a1a1a',
                borderRadius: '12px',
                padding: '24px',
                border: '1px solid #222',
                transition: 'all 0.3s ease',
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                {/* Avatar */}
                <div
                    style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        background: isAgent ? 'rgba(139, 92, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        color: isAgent ? '#a78bfa' : '#60a5fa',
                    }}
                >
                    {isAgent ? '🤖' : '👤'}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <h3
                            style={{
                                fontSize: '18px',
                                fontWeight: 600,
                                color: '#ffffff',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                margin: 0,
                            }}
                        >
                            {profile.identity.displayName}
                        </h3>
                        <span
                            style={{
                                fontSize: '10px',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                fontWeight: 500,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                background: isAgent ? 'rgba(139, 92, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                color: isAgent ? '#a78bfa' : '#60a5fa',
                                border: `1px solid ${isAgent ? 'rgba(139, 92, 246, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`,
                            }}
                        >
                            {profile.soulType}
                        </span>
                    </div>
                    <p
                        style={{
                            fontSize: '14px',
                            color: '#9ca3af',
                            lineHeight: 1.6,
                            margin: 0,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                        }}
                    >
                        {profile.identity.bio}
                    </p>
                </div>
            </div>

            {/* Tags */}
            <div style={{ marginTop: '16px' }}>
                {/* Core Values */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    {profile.values.core.slice(0, 3).map((value, i) => (
                        <span
                            key={i}
                            style={{
                                fontSize: '12px',
                                padding: '4px 10px',
                                background: '#222',
                                color: '#d1d5db',
                                borderRadius: '8px',
                                border: '1px solid #333',
                            }}
                        >
                            {value}
                        </span>
                    ))}
                    {profile.values.core.length > 3 && (
                        <span style={{ fontSize: '12px', padding: '4px 10px', color: '#6b7280' }}>
                            +{profile.values.core.length - 3}
                        </span>
                    )}
                </div>

                {/* Interests */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {profile.interests.topics.slice(0, 4).map((topic, i) => (
                        <span
                            key={i}
                            style={{
                                fontSize: '12px',
                                padding: '2px 8px',
                                color: '#9ca3af',
                            }}
                        >
                            #{topic}
                        </span>
                    ))}
                </div>
            </div>

            {/* Communication Style */}
            <div
                style={{
                    marginTop: '16px',
                    paddingTop: '16px',
                    borderTop: '1px solid #222',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#6b7280' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                            style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: 'rgba(59, 130, 246, 0.5)',
                            }}
                        />
                        <span style={{ textTransform: 'capitalize' }}>{profile.communication.tone}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                            style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: 'rgba(139, 92, 246, 0.5)',
                            }}
                        />
                        <span style={{ textTransform: 'capitalize' }}>{profile.communication.pace}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                            style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: 'rgba(34, 197, 94, 0.5)',
                            }}
                        />
                        <span style={{ textTransform: 'capitalize' }}>{profile.communication.depth}</span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            {showActions && (
                <div
                    style={{
                        display: 'flex',
                        gap: '8px',
                        marginTop: '16px',
                        paddingTop: '16px',
                        borderTop: '1px solid #222',
                    }}
                >
                    {onViewDetails && (
                        <button
                            onClick={onViewDetails}
                            style={{
                                flex: 1,
                                padding: '8px 16px',
                                background: '#222',
                                color: '#d1d5db',
                                border: '1px solid #333',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#333';
                                e.currentTarget.style.color = '#ffffff';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#222';
                                e.currentTarget.style.color = '#d1d5db';
                            }}
                        >
                            View Profile
                        </button>
                    )}
                    {onStartProbe && (
                        <button
                            onClick={onStartProbe}
                            style={{
                                flex: 1,
                                padding: '8px 16px',
                                background: '#2563eb',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#1d4ed8';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#2563eb';
                            }}
                        >
                            Start Probe
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
