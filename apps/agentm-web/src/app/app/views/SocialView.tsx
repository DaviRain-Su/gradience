'use client';

import { useState, useMemo } from 'react';
import { SoulProfileCard } from '../../../components/social/SoulProfileCard';
import { demoProfiles } from '../../../lib/demo-profiles';
import { calculateCompatibility, type MatchResult } from '../../../lib/mocks/soul-engine';
import { useMatches, useDiscover, type MatchProfile } from '../../../hooks/useMatches';
import type { SoulProfile } from '../../../types/soul';

type SocialTab = 'discover' | 'matches' | 'probes';

const colors = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
};

const MY_PROFILE = demoProfiles[0];

export function SocialView({ address }: { address: string | null }) {
    const [activeTab, setActiveTab] = useState<SocialTab>('discover');
    const [selectedMatch, setSelectedMatch] = useState<MatchProfile | null>(null);
    const [selectedDemoProfile, setSelectedDemoProfile] = useState<SoulProfile | null>(null);
    const [selectedDemoMatch, setSelectedDemoMatch] = useState<MatchResult | null>(null);

    // Server-side data (privacy-filtered)
    const { matches: serverMatches, loading: matchesLoading } = useMatches();
    const { profiles: serverProfiles, loading: discoverLoading } = useDiscover();
    const hasServerData = serverMatches.length > 0 || serverProfiles.length > 0;

    // Demo fallback (client-side) -- only used when no server data
    const otherDemoProfiles = useMemo(() => demoProfiles.filter(p => p.id !== MY_PROFILE.id), []);
    const demoMatches = useMemo(() => {
        if (hasServerData) return [];
        return otherDemoProfiles
            .map(profile => ({ profile, result: calculateCompatibility(MY_PROFILE, profile) }))
            .sort((a, b) => b.result.score - a.result.score);
    }, [otherDemoProfiles, hasServerData]);

    const matchCount = hasServerData ? serverMatches.length : demoMatches.length;
    const avgScore = hasServerData
        ? (serverMatches.length > 0 ? Math.round(serverMatches.reduce((s, m) => s + m.score, 0) / serverMatches.length) : 0)
        : (demoMatches.length > 0 ? Math.round(demoMatches.reduce((s, m) => s + m.result.score, 0) / demoMatches.length) : 0);
    const topScore = hasServerData
        ? (serverMatches[0] ? `${Math.round(serverMatches[0].score)}%` : '-')
        : (demoMatches[0] ? `${Math.round(demoMatches[0].result.score)}%` : '-');
    const sharedCount = hasServerData
        ? serverMatches.reduce((s, m) => s + (m.sharedValues?.length || 0), 0)
        : demoMatches.reduce((s, m) => s + m.result.sharedValues.length, 0);

    const discoverCount = hasServerData ? serverProfiles.length : otherDemoProfiles.length;

    const handleViewServerMatch = (m: MatchProfile) => {
        setSelectedMatch(m);
        setSelectedDemoProfile(null);
        setSelectedDemoMatch(null);
    };

    const handleViewDemoProfile = (profile: SoulProfile) => {
        const match = demoMatches.find(m => m.profile.id === profile.id);
        setSelectedDemoProfile(profile);
        setSelectedDemoMatch(match?.result ?? null);
        setSelectedMatch(null);
    };

    const closeModal = () => {
        setSelectedMatch(null);
        setSelectedDemoProfile(null);
        setSelectedDemoMatch(null);
    };

    return (
        <div style={{ display: 'flex', height: '100%', background: colors.bg, padding: '24px', gap: '24px' }}>
            {/* Left Sidebar */}
            <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: colors.lavender, borderRadius: '24px', padding: '24px', border: `1.5px solid ${colors.ink}` }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>My Soul Profile</span>
                    <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '28px', fontWeight: 700, margin: '8px 0 0 0', color: colors.ink }}>
                        {MY_PROFILE.identity.displayName}
                    </h2>
                    <p style={{ fontSize: '13px', opacity: 0.8, marginTop: '8px', lineHeight: 1.4 }}>
                        {MY_PROFILE.identity.bio.slice(0, 80)}...
                    </p>
                    {!hasServerData && (
                        <div style={{ marginTop: '12px', padding: '8px 12px', background: `${colors.ink}10`, borderRadius: '8px', fontSize: '11px', opacity: 0.7 }}>
                            Demo mode -- create your Soul Profile on the server to enable privacy-aware matching
                        </div>
                    )}
                </div>

                <div style={{ background: colors.surface, borderRadius: '24px', padding: '20px', border: `1.5px solid ${colors.ink}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px dashed ${colors.ink}`, paddingBottom: '12px', marginBottom: '12px' }}>
                        <div>
                            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.6 }}>Matches</div>
                            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '32px', fontWeight: 700, lineHeight: 1 }}>{matchCount}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.6 }}>Avg Score</div>
                            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '32px', fontWeight: 700, lineHeight: 1 }}>{avgScore}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[{ icon: '\ud83c\udfaf', label: 'Top Match', value: topScore, bg: colors.lime },
                          { icon: '\ud83d\udc8e', label: 'Shared Values', value: `${sharedCount}`, bg: colors.lavender },
                        ].map(item => (
                            <div key={item.label} style={{ flex: 1, background: colors.bg, border: `1.5px solid ${colors.ink}`, borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                                <div style={{ width: '28px', height: '28px', background: item.bg, borderRadius: '50%', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>{item.icon}</div>
                                <div style={{ fontWeight: 700, fontSize: '14px' }}>{item.value}</div>
                                <div style={{ fontSize: '10px', opacity: 0.7 }}>{item.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: colors.surface, borderRadius: '16px', padding: '8px', border: `1.5px solid ${colors.ink}` }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {[
                            { id: 'discover' as SocialTab, label: '\ud83d\udd0d Discover', count: discoverCount },
                            { id: 'matches' as SocialTab, label: '\ud83d\udc95 Matches', count: matchCount },
                            { id: 'probes' as SocialTab, label: '\ud83d\udcac Probes', count: 0 },
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                                padding: '10px 20px', borderRadius: '12px', fontWeight: 600, fontSize: '14px',
                                background: activeTab === tab.id ? colors.ink : 'transparent',
                                color: activeTab === tab.id ? colors.surface : colors.ink,
                                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                            }}>
                                {tab.label}
                                {tab.count > 0 && <span style={{ padding: '2px 8px', background: colors.lavender, borderRadius: '999px', fontSize: '11px', color: colors.ink }}>{tab.count}</span>}
                            </button>
                        ))}
                    </div>
                    {hasServerData && (
                        <div style={{ padding: '6px 12px', background: `${colors.lime}40`, borderRadius: '8px', fontSize: '11px', fontWeight: 600, border: `1px solid ${colors.ink}` }}>
                            Privacy-aware matching active
                        </div>
                    )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                    {activeTab === 'discover' && (
                        <div>
                            {(discoverLoading || matchesLoading) && <LoadingState />}
                            {hasServerData ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                                    {serverProfiles.map(p => (
                                        <DiscoverCard key={p.address} profile={p} onClick={() => {
                                            const m = serverMatches.find(sm => sm.address === p.address);
                                            if (m) handleViewServerMatch(m);
                                        }} />
                                    ))}
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                                    {otherDemoProfiles.map(profile => (
                                        <SoulProfileCard key={profile.id} profile={profile as any}
                                            onViewDetails={() => handleViewDemoProfile(profile)}
                                            onStartProbe={() => handleViewDemoProfile(profile)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'matches' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {hasServerData ? (
                                serverMatches.map(m => (
                                    <ServerMatchCard key={m.address} match={m} onClick={() => handleViewServerMatch(m)} />
                                ))
                            ) : (
                                demoMatches.map(({ profile, result }) => (
                                    <DemoMatchCard key={profile.id} profile={profile} result={result} onClick={() => handleViewDemoProfile(profile)} />
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'probes' && (
                        <EmptyState icon="\ud83d\udcac" title="No Active Probes" description="Start a probe from Discover or Matches to begin a compatibility conversation" />
                    )}
                </div>
            </div>

            {/* Modals */}
            {selectedMatch && <ServerMatchModal match={selectedMatch} onClose={closeModal} />}
            {selectedDemoProfile && <DemoProfileModal profile={selectedDemoProfile} match={selectedDemoMatch} onClose={closeModal} />}
        </div>
    );
}

// u2500u2500 Server-side cards (privacy-aware) u2500u2500

function DiscoverCard({ profile, onClick }: { profile: { address: string; soulType: string; displayName: string; bio?: string; privacyLevel: string; interests?: { topics: string[] }; communication?: { tone: string; pace: string; depth: string } }; onClick: () => void }) {
    const isPrivate = profile.privacyLevel === 'private';
    return (
        <div onClick={onClick} style={{
            background: colors.surface, borderRadius: '24px', padding: '24px', border: `1.5px solid ${colors.ink}`,
            cursor: 'pointer', transition: 'transform 0.15s',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ padding: '4px 10px', background: colors.lavender, borderRadius: '999px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', border: `1px solid ${colors.ink}` }}>
                    {profile.soulType === 'agent' ? 'AI Agent' : 'Human'}
                </span>
                <PrivacyBadge level={profile.privacyLevel} />
            </div>
            <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '22px', fontWeight: 700, margin: '0 0 8px 0' }}>
                {profile.displayName}
            </h3>
            {!isPrivate && profile.bio && (
                <p style={{ fontSize: '13px', opacity: 0.7, lineHeight: 1.5, margin: '0 0 12px 0' }}>
                    {profile.bio.slice(0, 100)}...
                </p>
            )}
            {!isPrivate && profile.interests?.topics && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {profile.interests.topics.slice(0, 4).map(t => (
                        <span key={t} style={{ padding: '4px 8px', background: colors.bg, borderRadius: '6px', fontSize: '11px', border: `1px solid ${colors.ink}` }}>#{t}</span>
                    ))}
                </div>
            )}
            {isPrivate && (
                <p style={{ fontSize: '12px', opacity: 0.5, fontStyle: 'italic' }}>This profile is private. Match to see compatibility score only.</p>
            )}
        </div>
    );
}

function ServerMatchCard({ match, onClick }: { match: MatchProfile; onClick: () => void }) {
    const scoreColor = match.score >= 60 ? colors.lime : match.score >= 35 ? '#FFD700' : '#FF6B6B';
    return (
        <div onClick={onClick} style={{
            background: colors.surface, borderRadius: '16px', padding: '20px', border: `1.5px solid ${colors.ink}`,
            display: 'flex', alignItems: 'center', gap: '20px', cursor: 'pointer',
        }}>
            <div style={{
                width: '64px', height: '64px', borderRadius: '16px', background: colors.lavender,
                border: `1.5px solid ${colors.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Oswald', sans-serif", fontSize: '24px', fontWeight: 700,
            }}>
                {match.displayName[0]}
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '16px' }}>{match.displayName}</span>
                    <PrivacyBadge level={match.privacyLevel} />
                </div>
                {match.bio && <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '4px' }}>{match.bio.slice(0, 60)}...</div>}
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {(match.sharedValues || []).slice(0, 3).map(v => (
                        <span key={v} style={{ padding: '2px 8px', background: colors.lavender, borderRadius: '999px', fontSize: '10px', fontWeight: 600 }}>{v}</span>
                    ))}
                    {(match.sharedInterests || []).slice(0, 2).map(v => (
                        <span key={v} style={{ padding: '2px 8px', background: colors.bg, borderRadius: '999px', fontSize: '10px', border: `1px solid ${colors.ink}` }}>#{v}</span>
                    ))}
                    {match.privacyLevel === 'private' && (
                        <span style={{ padding: '2px 8px', background: '#f3f3f8', borderRadius: '999px', fontSize: '10px', fontStyle: 'italic', opacity: 0.6 }}>Details hidden</span>
                    )}
                </div>
            </div>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '36px', fontWeight: 700 }}>{Math.round(match.score)}</div>
                <div style={{ fontSize: '10px', fontWeight: 600, opacity: 0.6 }}>MATCH</div>
                <div style={{ width: '60px', height: '4px', background: colors.bg, borderRadius: '2px', marginTop: '6px' }}>
                    <div style={{ width: `${match.score}%`, height: '100%', background: scoreColor, borderRadius: '2px' }} />
                </div>
            </div>
        </div>
    );
}

function ServerMatchModal({ match, onClose }: { match: MatchProfile; onClose: () => void }) {
    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, background: 'rgba(243,243,248,0.85)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px',
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: colors.surface, borderRadius: '32px', maxWidth: '900px', width: '100%', maxHeight: '85vh',
                overflowY: 'auto', border: `2px solid ${colors.ink}`, boxShadow: '0 40px 80px -20px rgba(0,0,0,0.15)',
                display: 'grid', gridTemplateColumns: '380px 1fr',
            }}>
                {/* Left */}
                <div style={{ background: colors.bg, borderRight: `2px solid ${colors.ink}`, padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ padding: '6px 12px', background: colors.lavender, borderRadius: '999px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', border: `1.5px solid ${colors.ink}` }}>
                            {match.soulType === 'agent' ? 'AI Agent' : 'Human'}
                        </span>
                        <PrivacyBadge level={match.privacyLevel} />
                    </div>
                    <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '48px', fontWeight: 700, color: colors.ink, margin: 0 }}>
                        {match.displayName}
                    </h2>

                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.6, marginBottom: '8px' }}>Compatibility Score</div>
                        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '64px', fontWeight: 700, color: colors.ink }}>
                            {Math.round(match.score)}<span style={{ fontSize: '24px' }}>%</span>
                        </div>
                    </div>

                    {/* Breakdown -- only for public */}
                    {match.breakdown && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {[
                                { label: 'Values', score: match.breakdown.values, color: colors.lavender },
                                { label: 'Interests', score: match.breakdown.interests, color: colors.lime },
                                { label: 'Communication', score: match.breakdown.communication, color: '#FFD700' },
                            ].map(item => (
                                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '80px', fontSize: '11px', fontWeight: 600, opacity: 0.7 }}>{item.label}</div>
                                    <div style={{ flex: 1, height: '8px', background: `${colors.ink}15`, borderRadius: '4px' }}>
                                        <div style={{ width: `${item.score}%`, height: '100%', background: item.color, borderRadius: '4px' }} />
                                    </div>
                                    <div style={{ width: '30px', fontSize: '12px', fontWeight: 700, textAlign: 'right' }}>{item.score}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {(match.sharedValues?.length ?? 0) > 0 && (
                        <div style={{ padding: '16px', background: `${colors.lime}30`, borderRadius: '12px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.6, marginBottom: '6px' }}>Shared Values</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {match.sharedValues!.map(v => <span key={v} style={{ padding: '4px 10px', background: colors.lime, borderRadius: '999px', fontSize: '11px', fontWeight: 600 }}>{v}</span>)}
                            </div>
                        </div>
                    )}

                    {(match.conflictAreas?.length ?? 0) > 0 && (
                        <div style={{ padding: '16px', background: '#FEE2E230', borderRadius: '12px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.6, marginBottom: '6px' }}>Potential Conflicts</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {match.conflictAreas!.map(v => <span key={v} style={{ padding: '4px 10px', background: '#FEE2E2', borderRadius: '999px', fontSize: '11px', fontWeight: 600, color: '#DC2626' }}>{v}</span>)}
                            </div>
                        </div>
                    )}

                    {match.privacyLevel !== 'public' && !match.breakdown && (
                        <div style={{ padding: '16px', background: `${colors.ink}08`, borderRadius: '12px' }}>
                            <div style={{ fontSize: '12px', opacity: 0.6 }}>
                                {match.privacyLevel === 'private'
                                    ? 'This user\'s profile is private. Only the compatibility score is visible.'
                                    : 'This user uses selective disclosure. Detailed breakdown is not available.'}
                            </div>
                        </div>
                    )}

                    <button onClick={onClose} style={{
                        padding: '16px 24px', background: colors.ink, color: colors.surface, border: 'none',
                        borderRadius: '16px', fontSize: '16px', fontWeight: 600, cursor: 'pointer', marginTop: 'auto',
                    }}>Close</button>
                </div>

                {/* Right */}
                <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
                    <button onClick={onClose} style={{
                        position: 'absolute', top: '24px', right: '24px', width: '48px', height: '48px', borderRadius: '50%',
                        border: `2px solid ${colors.ink}`, background: colors.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '20px',
                    }}>\u2715</button>

                    {match.bio && (
                        <Section title="About">
                            <p style={{ color: colors.ink, opacity: 0.8, lineHeight: 1.6 }}>{match.bio}</p>
                        </Section>
                    )}

                    {match.values?.core && (
                        <Section title="Core Values">
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {match.values.core.map((v, i) => {
                                    const isShared = match.sharedValues?.map(s => s.toLowerCase()).includes(v.toLowerCase());
                                    return <span key={i} style={{ padding: '8px 16px', background: isShared ? colors.lime : colors.lavender, borderRadius: '999px', fontSize: '13px', fontWeight: 600, border: `1.5px solid ${colors.ink}` }}>{v}{isShared ? ' \u2714' : ''}</span>;
                                })}
                            </div>
                        </Section>
                    )}

                    {match.interests?.topics && (
                        <Section title="Interests">
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {match.interests.topics.map((t, i) => {
                                    const isShared = match.sharedInterests?.map(s => s.toLowerCase()).includes(t.toLowerCase());
                                    return <span key={i} style={{ padding: '6px 12px', background: isShared ? `${colors.lime}60` : colors.bg, borderRadius: '8px', fontSize: '12px', border: `1.5px solid ${colors.ink}` }}>#{t}{isShared ? ' \u2714' : ''}</span>;
                                })}
                            </div>
                        </Section>
                    )}

                    {match.communication && (
                        <Section title="Communication Style">
                            <div style={{ display: 'flex', gap: '16px' }}>
                                {[{ label: 'Tone', value: match.communication.tone, bg: colors.lavender },
                                  { label: 'Pace', value: match.communication.pace, bg: colors.lime },
                                  { label: 'Depth', value: match.communication.depth, bg: colors.surface },
                                ].map(item => (
                                    <div key={item.label} style={{ flex: 1, padding: '16px', background: colors.bg, borderRadius: '12px', border: `1.5px solid ${colors.ink}` }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.bg, marginBottom: '8px' }} />
                                        <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.6 }}>{item.label}</div>
                                        <div style={{ fontSize: '14px', fontWeight: 700, textTransform: 'capitalize', marginTop: '4px' }}>{item.value}</div>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {match.privacyLevel === 'private' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center', opacity: 0.5 }}>
                            <div style={{ fontSize: '48px', marginBottom: '12px' }}>\ud83d\udd12</div>
                            <p>This user's profile details are private.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// u2500u2500 Demo fallback cards (same as before) u2500u2500

function DemoMatchCard({ profile, result, onClick }: { profile: SoulProfile; result: MatchResult; onClick: () => void }) {
    const scoreColor = result.score >= 60 ? colors.lime : result.score >= 35 ? '#FFD700' : '#FF6B6B';
    return (
        <div onClick={onClick} style={{
            background: colors.surface, borderRadius: '16px', padding: '20px', border: `1.5px solid ${colors.ink}`,
            display: 'flex', alignItems: 'center', gap: '20px', cursor: 'pointer',
        }}>
            <div style={{
                width: '64px', height: '64px', borderRadius: '16px', background: colors.lavender,
                border: `1.5px solid ${colors.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Oswald', sans-serif", fontSize: '24px', fontWeight: 700,
            }}>
                {profile.identity.displayName[0]}
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '16px' }}>{profile.identity.displayName}</div>
                <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '4px' }}>
                    {profile.soulType === 'agent' ? 'AI Agent' : 'Human'} \u00b7 {profile.identity.bio.slice(0, 60)}...
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {result.sharedValues.slice(0, 3).map(v => (
                        <span key={v} style={{ padding: '2px 8px', background: colors.lavender, borderRadius: '999px', fontSize: '10px', fontWeight: 600 }}>{v}</span>
                    ))}
                </div>
            </div>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '36px', fontWeight: 700 }}>{Math.round(result.score)}</div>
                <div style={{ fontSize: '10px', fontWeight: 600, opacity: 0.6 }}>MATCH</div>
                <div style={{ width: '60px', height: '4px', background: colors.bg, borderRadius: '2px', marginTop: '6px' }}>
                    <div style={{ width: `${result.score}%`, height: '100%', background: scoreColor, borderRadius: '2px' }} />
                </div>
            </div>
        </div>
    );
}

function DemoProfileModal({ profile, match, onClose }: { profile: SoulProfile; match: MatchResult | null; onClose: () => void }) {
    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, background: 'rgba(243,243,248,0.85)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px',
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: colors.surface, borderRadius: '32px', maxWidth: '900px', width: '100%', maxHeight: '85vh',
                overflowY: 'auto', border: `2px solid ${colors.ink}`, boxShadow: '0 40px 80px -20px rgba(0,0,0,0.15)',
                display: 'grid', gridTemplateColumns: '380px 1fr',
            }}>
                <div style={{ background: colors.bg, borderRight: `2px solid ${colors.ink}`, padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <span style={{ display: 'inline-block', padding: '6px 12px', background: colors.lavender, borderRadius: '999px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', border: `1.5px solid ${colors.ink}`, alignSelf: 'flex-start' }}>
                        {profile.soulType === 'agent' ? 'AI Agent' : 'Human'}
                    </span>
                    <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '48px', fontWeight: 700, color: colors.ink, margin: 0 }}>
                        {profile.identity.displayName}
                    </h2>
                    {match && (
                        <>
                            <div>
                                <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.6, marginBottom: '8px' }}>Compatibility Score</div>
                                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '64px', fontWeight: 700, color: colors.ink }}>
                                    {Math.round(match.score)}<span style={{ fontSize: '24px' }}>%</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {[{ label: 'Values', score: match.breakdown.values, color: colors.lavender },
                                  { label: 'Interests', score: match.breakdown.interests, color: colors.lime },
                                  { label: 'Communication', score: match.breakdown.communication, color: '#FFD700' },
                                ].map(item => (
                                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '80px', fontSize: '11px', fontWeight: 600, opacity: 0.7 }}>{item.label}</div>
                                        <div style={{ flex: 1, height: '8px', background: `${colors.ink}15`, borderRadius: '4px' }}>
                                            <div style={{ width: `${item.score}%`, height: '100%', background: item.color, borderRadius: '4px' }} />
                                        </div>
                                        <div style={{ width: '30px', fontSize: '12px', fontWeight: 700, textAlign: 'right' }}>{item.score}</div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                    <button onClick={onClose} style={{ padding: '16px 24px', background: colors.ink, color: colors.surface, border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 600, cursor: 'pointer', marginTop: 'auto' }}>Close</button>
                </div>
                <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
                    <button onClick={onClose} style={{ position: 'absolute', top: '24px', right: '24px', width: '48px', height: '48px', borderRadius: '50%', border: `2px solid ${colors.ink}`, background: colors.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '20px' }}>\u2715</button>
                    <Section title="About"><p style={{ color: colors.ink, opacity: 0.8, lineHeight: 1.6 }}>{profile.identity.bio}</p></Section>
                    <Section title="Core Values">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {profile.values.core.map((v, i) => <span key={i} style={{ padding: '8px 16px', background: colors.lavender, borderRadius: '999px', fontSize: '13px', fontWeight: 600, border: `1.5px solid ${colors.ink}` }}>{v}</span>)}
                        </div>
                    </Section>
                    <Section title="Interests">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {profile.interests.topics.map((t, i) => <span key={i} style={{ padding: '6px 12px', background: colors.bg, borderRadius: '8px', fontSize: '12px', border: `1.5px solid ${colors.ink}` }}>#{t}</span>)}
                        </div>
                    </Section>
                    <Section title="Communication Style">
                        <div style={{ display: 'flex', gap: '16px' }}>
                            {[{ label: 'Tone', value: profile.communication.tone, bg: colors.lavender }, { label: 'Pace', value: profile.communication.pace, bg: colors.lime }, { label: 'Depth', value: profile.communication.depth, bg: colors.surface }].map(item => (
                                <div key={item.label} style={{ flex: 1, padding: '16px', background: colors.bg, borderRadius: '12px', border: `1.5px solid ${colors.ink}` }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.6 }}>{item.label}</div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, textTransform: 'capitalize', marginTop: '4px' }}>{item.value}</div>
                                </div>
                            ))}
                        </div>
                    </Section>
                </div>
            </div>
        </div>
    );
}

// u2500u2500 Shared components u2500u2500

function PrivacyBadge({ level }: { level: string }) {
    const config = level === 'private'
        ? { label: 'Private', bg: '#FEE2E2', color: '#DC2626' }
        : level === 'zk-selective'
        ? { label: 'Selective', bg: '#FEF3C7', color: '#92400E' }
        : { label: 'Public', bg: `${colors.lime}60`, color: colors.ink };
    return (
        <span style={{ padding: '3px 8px', background: config.bg, color: config.color, borderRadius: '999px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
            {config.label}
        </span>
    );
}

function LoadingState() {
    return <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>Loading...</div>;
}

function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', textAlign: 'center', background: colors.surface, borderRadius: '24px', border: `1.5px solid ${colors.ink}`,
        }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>{icon}</div>
            <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '24px', fontWeight: 700, color: colors.ink, marginBottom: '8px' }}>{title}</h3>
            <p style={{ color: colors.ink, opacity: 0.6, maxWidth: '400px' }}>{description}</p>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', borderBottom: `1.5px solid ${colors.ink}`, paddingBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</h3>
            {children}
        </div>
    );
}
