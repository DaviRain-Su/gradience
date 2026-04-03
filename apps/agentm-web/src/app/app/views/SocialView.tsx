'use client';

import { useState, useEffect } from 'react';
import { SoulProfileCard } from '../../../components/social/SoulProfileCard';
import { demoProfiles, getOtherDemoProfiles } from '../../../lib/demo-profiles';
import type { SoulProfile } from '@gradiences/soul-engine';

type SocialTab = 'discover' | 'matches' | 'probes';

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
            flexDirection: 'column',
            height: '100%',
            background: '#0a0a0a',
        }}>
            {/* Header Tabs */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 16px',
                background: '#111',
                borderBottom: '1px solid #222',
            }}>
                {[
                    { id: 'discover', label: '🔍 Discover', count: discoveredProfiles.length },
                    { id: 'matches', label: '💕 Matches', count: 0 },
                    { id: 'probes', label: '💬 Probes', count: 0 },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as SocialTab)}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            fontWeight: 500,
                            fontSize: '14px',
                            transition: 'all 0.2s ease',
                            background: activeTab === tab.id ? '#2563eb' : 'transparent',
                            color: activeTab === tab.id ? '#ffffff' : '#9ca3af',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        {tab.label}
                        {tab.count > 0 && (
                            <span style={{
                                marginLeft: '8px',
                                padding: '2px 6px',
                                background: 'rgba(0,0,0,0.3)',
                                borderRadius: '4px',
                                fontSize: '12px',
                            }}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>
            
            {/* Content */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px',
            }}>
                {activeTab === 'discover' && (
                    <div>
                        <div style={{ marginBottom: '24px' }}>
                            <h2 style={{
                                fontSize: '24px',
                                fontWeight: 700,
                                color: '#ffffff',
                                marginBottom: '8px',
                            }}>
                                Discover Compatible Souls
                            </h2>
                            <p style={{
                                color: '#9ca3af',
                                fontSize: '14px',
                            }}>
                                Find agents and humans with similar values and interests
                            </p>
                        </div>
                        
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                            gap: '16px',
                        }}>
                            {discoveredProfiles.map((profile) => (
                                <SoulProfileCard
                                    key={profile.id}
                                    profile={profile}
                                    onViewDetails={() => setSelectedProfile(profile)}
                                    onStartProbe={() => {
                                        // TODO: Implement probe
                                        alert(`Starting probe with ${profile.identity.displayName}`);
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}
                
                {activeTab === 'matches' && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        textAlign: 'center',
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>💕</div>
                        <h3 style={{
                            fontSize: '20px',
                            fontWeight: 600,
                            color: '#ffffff',
                            marginBottom: '8px',
                        }}>
                            No Matches Yet
                        </h3>
                        <p style={{
                            color: '#9ca3af',
                            maxWidth: '400px',
                        }}>
                            Start a probe conversation to generate compatibility reports
                        </p>
                    </div>
                )}
                
                {activeTab === 'probes' && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        textAlign: 'center',
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
                        <h3 style={{
                            fontSize: '20px',
                            fontWeight: 600,
                            color: '#ffffff',
                            marginBottom: '8px',
                        }}>
                            No Active Probes
                        </h3>
                        <p style={{
                            color: '#9ca3af',
                            maxWidth: '400px',
                        }}>
                            Start a probe from the Discover tab to begin a compatibility conversation
                        </p>
                    </div>
                )}
            </div>
            
            {/* Profile Modal */}
            {selectedProfile && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 50,
                        padding: '16px',
                    }}
                    onClick={() => setSelectedProfile(null)}
                >
                    <div
                        style={{
                            background: '#111',
                            borderRadius: '16px',
                            maxWidth: '600px',
                            width: '100%',
                            maxHeight: '80vh',
                            overflowY: 'auto',
                            border: '1px solid #222',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ padding: '24px' }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                marginBottom: '24px',
                            }}>
                                <h2 style={{
                                    fontSize: '24px',
                                    fontWeight: 700,
                                    color: '#ffffff',
                                }}>
                                    Soul Profile
                                </h2>
                                <button
                                    onClick={() => setSelectedProfile(null)}
                                    style={{
                                        padding: '8px 16px',
                                        background: 'transparent',
                                        color: '#9ca3af',
                                        border: 'none',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Close
                                </button>
                            </div>
                            
                            {/* Profile Details */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                                <div style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '32px',
                                    background: selectedProfile.soulType === 'agent' 
                                        ? 'rgba(139, 92, 246, 0.1)' 
                                        : 'rgba(59, 130, 246, 0.1)',
                                }}>
                                    {selectedProfile.soulType === 'agent' ? '🤖' : '👤'}
                                </div>
                                <div>
                                    <h3 style={{
                                        fontSize: '20px',
                                        fontWeight: 600,
                                        color: '#ffffff',
                                    }}>
                                        {selectedProfile.identity.displayName}
                                    </h3>
                                    <span style={{
                                        fontSize: '12px',
                                        padding: '4px 12px',
                                        borderRadius: '9999px',
                                        background: selectedProfile.soulType === 'agent'
                                            ? 'rgba(139, 92, 246, 0.1)'
                                            : 'rgba(59, 130, 246, 0.1)',
                                        color: selectedProfile.soulType === 'agent' ? '#a78bfa' : '#60a5fa',
                                    }}>
                                        {selectedProfile.soulType === 'agent' ? '🤖 AI Agent' : '👤 Human'}
                                    </span>
                                </div>
                            </div>
                            
                            <p style={{
                                color: '#9ca3af',
                                lineHeight: 1.6,
                                marginBottom: '24px',
                            }}>
                                {selectedProfile.identity.bio}
                            </p>
                            
                            {/* Values */}
                            <div style={{ marginBottom: '24px' }}>
                                <h4 style={{
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: '#6b7280',
                                    marginBottom: '12px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                }}>
                                    Core Values
                                </h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {selectedProfile.values.core.map((value, i) => (
                                        <span key={i} style={{
                                            padding: '6px 12px',
                                            background: '#222',
                                            color: '#d1d5db',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                        }}>
                                            {value}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Interests */}
                            <div style={{ marginBottom: '24px' }}>
                                <h4 style={{
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: '#6b7280',
                                    marginBottom: '12px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                }}>
                                    Interests
                                </h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {selectedProfile.interests.topics.map((topic, i) => (
                                        <span key={i} style={{
                                            padding: '6px 12px',
                                            background: '#1e3a5f',
                                            color: '#60a5fa',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                        }}>
                                            {topic}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Communication Style */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: '16px',
                                padding: '16px',
                                background: '#1a1a1a',
                                borderRadius: '12px',
                                marginBottom: '24px',
                            }}>
                                <div>
                                    <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Tone</p>
                                    <p style={{ fontSize: '16px', color: '#ffffff', textTransform: 'capitalize' }}>
                                        {selectedProfile.communication.tone}
                                    </p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Pace</p>
                                    <p style={{ fontSize: '16px', color: '#ffffff', textTransform: 'capitalize' }}>
                                        {selectedProfile.communication.pace}
                                    </p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Depth</p>
                                    <p style={{ fontSize: '16px', color: '#ffffff', textTransform: 'capitalize' }}>
                                        {selectedProfile.communication.depth}
                                    </p>
                                </div>
                            </div>
                            
                            {/* Action Button */}
                            <button
                                onClick={() => {
                                    setSelectedProfile(null);
                                    alert(`Starting probe with ${selectedProfile.identity.displayName}`);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '12px 24px',
                                    background: '#2563eb',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '16px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                Start Probe
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
