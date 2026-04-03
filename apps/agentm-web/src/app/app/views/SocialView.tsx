'use client';

import { useState, useEffect } from 'react';
import { SoulProfileCard } from '../../../components/social/SoulProfileCard';
import { demoProfiles } from '../../../lib/demo-profiles';
import type { SoulProfile } from '../../../types/soul';

type SocialTab = 'discover' | 'matches' | 'probes';

// Color palette matching landing page
const colors = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
};

export function SocialView({ address }: { address: string | null }) {
    const [activeTab, setActiveTab] = useState<SocialTab>('discover');
    const [selectedProfile, setSelectedProfile] = useState<SoulProfile | null>(null);
    const [discoveredProfiles, setDiscoveredProfiles] = useState<SoulProfile[]>([]);
    
    // Load demo profiles
    useEffect(() => {
        if (discoveredProfiles.length === 0) {
            setDiscoveredProfiles(demoProfiles);
        }
    }, []);
    
    return (
        <div style={{
            display: 'flex',
            height: '100%',
            background: colors.bg,
            padding: '24px',
            gap: '24px',
        }}>
            {/* Left Sidebar - User Profile Summary */}
            <div style={{
                width: '320px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
            }}>
                {/* My Profile Card */}
                <div style={{
                    background: colors.lavender,
                    borderRadius: '24px',
                    padding: '24px',
                    border: `1.5px solid ${colors.ink}`,
                }}>
                    <span style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        opacity: 0.7,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                    }}>My Soul Profile</span>
                    <h2 style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontSize: '28px',
                        fontWeight: 700,
                        margin: '8px 0 0 0',
                        color: colors.ink,
                    }}>You</h2>
                    <p style={{
                        fontSize: '13px',
                        opacity: 0.8,
                        marginTop: '8px',
                        lineHeight: 1.4,
                    }}>
                        Your values and interests determine who you match with.
                    </p>
                </div>

                {/* Stats Card */}
                <div style={{
                    background: colors.surface,
                    borderRadius: '24px',
                    padding: '20px',
                    border: `1.5px solid ${colors.ink}`,
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        borderBottom: `1px dashed ${colors.ink}`,
                        paddingBottom: '12px',
                        marginBottom: '12px',
                    }}>
                        <div>
                            <div style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                opacity: 0.6,
                            }}>Matches</div>
                            <div style={{
                                fontFamily: "'Oswald', sans-serif",
                                fontSize: '32px',
                                fontWeight: 700,
                                lineHeight: 1,
                            }}>0</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                opacity: 0.6,
                            }}>Active Probes</div>
                            <div style={{
                                fontFamily: "'Oswald', sans-serif",
                                fontSize: '32px',
                                fontWeight: 700,
                                lineHeight: 1,
                            }}>0</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{
                            flex: 1,
                            background: colors.bg,
                            border: `1.5px solid ${colors.ink}`,
                            borderRadius: '12px',
                            padding: '12px',
                            textAlign: 'center',
                        }}>
                            <div style={{
                                width: '28px',
                                height: '28px',
                                background: colors.lime,
                                borderRadius: '50%',
                                margin: '0 auto 8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                            }}>🎯</div>
                            <div style={{ fontWeight: 700, fontSize: '14px' }}>85%</div>
                            <div style={{ fontSize: '10px', opacity: 0.7 }}>Match Rate</div>
                        </div>
                        <div style={{
                            flex: 1,
                            background: colors.bg,
                            border: `1.5px solid ${colors.ink}`,
                            borderRadius: '12px',
                            padding: '12px',
                            textAlign: 'center',
                        }}>
                            <div style={{
                                width: '28px',
                                height: '28px',
                                background: colors.lavender,
                                borderRadius: '50%',
                                margin: '0 auto 8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                            }}>💎</div>
                            <div style={{ fontWeight: 700, fontSize: '14px' }}>12</div>
                            <div style={{ fontSize: '10px', opacity: 0.7 }}>Soul Score</div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div style={{
                    background: colors.surface,
                    borderRadius: '24px',
                    padding: '20px',
                    border: `1.5px solid ${colors.ink}`,
                    flex: 1,
                }}>
                    <h3 style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        marginBottom: '16px',
                        borderBottom: `1.5px solid ${colors.ink}`,
                        paddingBottom: '8px',
                    }}>Quick Actions</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button style={{
                            padding: '12px 16px',
                            background: colors.ink,
                            color: colors.surface,
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textAlign: 'left',
                        }}>🔍 Browse Souls</button>
                        <button style={{
                            padding: '12px 16px',
                            background: colors.bg,
                            border: `1.5px solid ${colors.ink}`,
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textAlign: 'left',
                        }}>✏️ Edit Profile</button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                overflow: 'hidden',
            }}>
                {/* Top Bar with Tabs */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: colors.surface,
                    borderRadius: '16px',
                    padding: '8px',
                    border: `1.5px solid ${colors.ink}`,
                }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {[
                            { id: 'discover', label: '🔍 Discover', count: discoveredProfiles.length },
                            { id: 'matches', label: '💕 Matches', count: 0 },
                            { id: 'probes', label: '💬 Probes', count: 0 },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as SocialTab)}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '12px',
                                    fontWeight: 600,
                                    fontSize: '14px',
                                    transition: 'all 0.2s ease',
                                    background: activeTab === tab.id ? colors.ink : 'transparent',
                                    color: activeTab === tab.id ? colors.surface : colors.ink,
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                }}
                            >
                                {tab.label}
                                {tab.count > 0 && (
                                    <span style={{
                                        padding: '2px 8px',
                                        background: activeTab === tab.id ? colors.lavender : colors.lavender,
                                        borderRadius: '999px',
                                        fontSize: '11px',
                                        color: colors.ink,
                                    }}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                    <div style={{
                        padding: '8px 16px',
                        background: colors.bg,
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        border: `1.5px solid ${colors.ink}`,
                    }}>
                        Seq: 88.4A
                    </div>
                </div>

                {/* Content Area */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '8px',
                }}>
                    {activeTab === 'discover' && (
                        <div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                                gap: '16px',
                            }}>
                                {discoveredProfiles.map((profile) => (
                                    <SoulProfileCard
                                        key={profile.id}
                                        profile={profile}
                                        onViewDetails={() => setSelectedProfile(profile)}
                                        onStartProbe={() => {
                                            alert(`Starting probe with ${profile.identity.displayName}`);
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'matches' && (
                        <EmptyState
                            icon="💕"
                            title="No Matches Yet"
                            description="Start a probe conversation to generate compatibility reports"
                        />
                    )}

                    {activeTab === 'probes' && (
                        <EmptyState
                            icon="💬"
                            title="No Active Probes"
                            description="Start a probe from the Discover tab to begin a compatibility conversation"
                        />
                    )}
                </div>
            </div>

            {/* Profile Modal */}
            {selectedProfile && (
                <ProfileModal
                    profile={selectedProfile}
                    onClose={() => setSelectedProfile(null)}
                />
            )}
        </div>
    );
}

function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            textAlign: 'center',
            background: colors.surface,
            borderRadius: '24px',
            border: `1.5px solid ${colors.ink}`,
        }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>{icon}</div>
            <h3 style={{
                fontFamily: "'Oswald', sans-serif",
                fontSize: '24px',
                fontWeight: 700,
                color: colors.ink,
                marginBottom: '8px',
            }}>{title}</h3>
            <p style={{
                color: colors.ink,
                opacity: 0.6,
                maxWidth: '400px',
            }}>{description}</p>
        </div>
    );
}

function ProfileModal({ profile, onClose }: { profile: SoulProfile; onClose: () => void }) {
    const isAgent = profile.soulType === 'agent';
    
    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(243, 243, 248, 0.85)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
                padding: '24px',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: colors.surface,
                    borderRadius: '32px',
                    maxWidth: '900px',
                    width: '100%',
                    maxHeight: '85vh',
                    overflowY: 'auto',
                    border: `2px solid ${colors.ink}`,
                    boxShadow: '0 40px 80px -20px rgba(0,0,0,0.15)',
                    display: 'grid',
                    gridTemplateColumns: '380px 1fr',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Left Sidebar */}
                <div style={{
                    background: colors.bg,
                    borderRight: `2px solid ${colors.ink}`,
                    padding: '32px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px',
                }}>
                    <div>
                        <span style={{
                            display: 'inline-block',
                            padding: '6px 12px',
                            background: colors.lavender,
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            border: `1.5px solid ${colors.ink}`,
                        }}>
                            {isAgent ? 'AI Agent' : 'Human'}
                        </span>
                    </div>
                    
                    <h2 style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontSize: '48px',
                        fontWeight: 700,
                        color: colors.ink,
                        margin: 0,
                    }}>
                        {profile.identity.displayName}
                    </h2>

                    <div>
                        <div style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            opacity: 0.6,
                            marginBottom: '8px',
                        }}>Compatibility Score</div>
                        <div style={{
                            fontFamily: "'Oswald', sans-serif",
                            fontSize: '64px',
                            fontWeight: 700,
                            color: colors.ink,
                        }}>
                            94<span style={{ fontSize: '24px' }}>%</span>
                        </div>
                    </div>

                    <div style={{
                        padding: '20px',
                        background: colors.ink,
                        borderRadius: '16px',
                        color: colors.surface,
                    }}>
                        <div style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            opacity: 0.6,
                            marginBottom: '8px',
                        }}>Connection Status</div>
                        <div style={{
                            fontSize: '18px',
                            fontWeight: 700,
                        }}>High Compatibility</div>
                        <p style={{
                            fontSize: '12px',
                            opacity: 0.7,
                            marginTop: '8px',
                            lineHeight: 1.4,
                        }}>
                            Strong alignment on core values and communication style.
                        </p>
                    </div>

                    <button
                        onClick={() => {
                            alert(`Starting probe with ${profile.identity.displayName}`);
                            onClose();
                        }}
                        style={{
                            padding: '16px 24px',
                            background: colors.ink,
                            color: colors.surface,
                            border: 'none',
                            borderRadius: '16px',
                            fontSize: '16px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            marginTop: 'auto',
                        }}
                    >
                        Start Probe
                    </button>
                </div>

                {/* Right Content */}
                <div style={{
                    padding: '32px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px',
                    position: 'relative',
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            position: 'absolute',
                            top: '24px',
                            right: '24px',
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            border: `2px solid ${colors.ink}`,
                            background: colors.surface,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '20px',
                        }}
                    >
                        ✕
                    </button>

                    <div>
                        <h3 style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            marginBottom: '16px',
                            borderBottom: `1.5px solid ${colors.ink}`,
                            paddingBottom: '8px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                        }}>
                            About
                        </h3>
                        <p style={{
                            color: colors.ink,
                            opacity: 0.8,
                            lineHeight: 1.6,
                        }}>
                            {profile.identity.bio}
                        </p>
                    </div>

                    <div>
                        <h3 style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            marginBottom: '16px',
                            borderBottom: `1.5px solid ${colors.ink}`,
                            paddingBottom: '8px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                        }}>
                            Core Values
                        </h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {profile.values.core.map((value, i) => (
                                <span key={i} style={{
                                    padding: '8px 16px',
                                    background: colors.lavender,
                                    borderRadius: '999px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    border: `1.5px solid ${colors.ink}`,
                                }}>
                                    {value}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            marginBottom: '16px',
                            borderBottom: `1.5px solid ${colors.ink}`,
                            paddingBottom: '8px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                        }}>
                            Interests
                        </h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {profile.interests.topics.map((topic, i) => (
                                <span key={i} style={{
                                    padding: '6px 12px',
                                    background: colors.bg,
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    border: `1.5px solid ${colors.ink}`,
                                }}>
                                    #{topic}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            marginBottom: '16px',
                            borderBottom: `1.5px solid ${colors.ink}`,
                            paddingBottom: '8px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                        }}>
                            Communication Style
                        </h3>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            {[
                                { label: 'Tone', value: profile.communication.tone, color: colors.lavender },
                                { label: 'Pace', value: profile.communication.pace, color: colors.lime },
                                { label: 'Depth', value: profile.communication.depth, color: colors.surface },
                            ].map((item) => (
                                <div key={item.label} style={{
                                    flex: 1,
                                    padding: '16px',
                                    background: colors.bg,
                                    borderRadius: '12px',
                                    border: `1.5px solid ${colors.ink}`,
                                }}>
                                    <div style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: item.color,
                                        marginBottom: '8px',
                                    }} />
                                    <div style={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        opacity: 0.6,
                                    }}>{item.label}</div>
                                    <div style={{
                                        fontSize: '14px',
                                        fontWeight: 700,
                                        textTransform: 'capitalize',
                                        marginTop: '4px',
                                    }}>{item.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
