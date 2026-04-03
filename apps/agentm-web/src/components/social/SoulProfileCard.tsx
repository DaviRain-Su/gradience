'use client';

import type { SoulProfile } from '../../types/soul';

interface SoulProfileCardProps {
    profile: SoulProfile;
    onViewDetails?: () => void;
    onStartProbe?: () => void;
    showActions?: boolean;
}

export function SoulProfileCard({ profile, onViewDetails, onStartProbe, showActions = true }: SoulProfileCardProps) {
    const isAgent = profile.soulType === 'agent';
    
    return (
        <div style={{
            background: '#FFFFFF',
            borderRadius: '24px',
            padding: '24px',
            border: '1.5px solid #16161A',
            transition: 'all 0.3s ease',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                {/* Avatar */}
                <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    background: isAgent ? '#C6BBFF' : '#CDFF4D',
                    border: '1.5px solid #16161A',
                }}>
                    {isAgent ? '🤖' : '👤'}
                </div>
                
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <h3 style={{
                            fontSize: '18px',
                            fontWeight: 700,
                            color: '#16161A',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            margin: 0,
                            fontFamily: "'Oswald', sans-serif",
                        }}>
                            {profile.identity.displayName}
                        </h3>
                        <span style={{
                            fontSize: '10px',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            background: isAgent ? '#C6BBFF' : '#CDFF4D',
                            color: '#16161A',
                            border: '1.5px solid #16161A',
                        }}>
                            {profile.soulType}
                        </span>
                    </div>
                    <p style={{
                        fontSize: '14px',
                        color: '#16161A',
                        opacity: 0.7,
                        lineHeight: 1.6,
                        margin: 0,
                    }}>
                        {profile.identity.bio}
                    </p>
                </div>
            </div>
            
            {/* Tags */}
            <div style={{ marginTop: '16px' }}>
                {/* Core Values */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    {profile.values.core.slice(0, 3).map((value, i) => (
                        <span key={i} style={{
                            fontSize: '12px',
                            padding: '4px 10px',
                            background: '#F3F3F8',
                            color: '#16161A',
                            borderRadius: '8px',
                            border: '1.5px solid #16161A',
                            fontWeight: 500,
                        }}>
                            {value}
                        </span>
                    ))}
                    {profile.values.core.length > 3 && (
                        <span style={{ fontSize: '12px', padding: '4px 10px', color: '#16161A', opacity: 0.5 }}>
                            +{profile.values.core.length - 3}
                        </span>
                    )}
                </div>
                
                {/* Interests */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {profile.interests.topics.slice(0, 4).map((topic, i) => (
                        <span key={i} style={{
                            fontSize: '12px',
                            padding: '2px 8px',
                            color: '#16161A',
                            opacity: 0.6,
                        }}>
                            #{topic}
                        </span>
                    ))}
                </div>
            </div>
            
            {/* Communication Style */}
            <div style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px dashed #16161A',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#16161A', opacity: 0.6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: '#C6BBFF',
                        }} />
                        <span style={{ textTransform: 'capitalize' }}>{profile.communication.tone}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: '#CDFF4D',
                        }} />
                        <span style={{ textTransform: 'capitalize' }}>{profile.communication.pace}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: '#16161A',
                        }} />
                        <span style={{ textTransform: 'capitalize' }}>{profile.communication.depth}</span>
                    </div>
                </div>
            </div>
            
            {/* Actions */}
            {showActions && (
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginTop: '16px',
                    paddingTop: '16px',
                    borderTop: '1px dashed #16161A',
                }}>
                    {onViewDetails && (
                        <button
                            onClick={onViewDetails}
                            style={{
                                flex: 1,
                                padding: '10px 16px',
                                background: '#F3F3F8',
                                color: '#16161A',
                                border: '1.5px solid #16161A',
                                borderRadius: '12px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#E8E8ED';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#F3F3F8';
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
                                padding: '10px 16px',
                                background: '#16161A',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#000000';
                                e.currentTarget.style.transform = 'scale(0.98)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#16161A';
                                e.currentTarget.style.transform = 'scale(1)';
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
