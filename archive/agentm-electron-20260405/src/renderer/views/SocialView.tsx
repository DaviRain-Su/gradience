/**
 * Social View
 * 
 * Complete social matching interface - Soul Profiles, Discovery, Probing, Reports
 */

import { useState, useEffect } from 'react';
import { SoulProfileEditor, SoulProfileCard, SoulProfileView, MatchingReportView, MatchingReportCard } from '../../components/social';
import { ProbeChat, ProbeInvitation } from '../../components/social';
import { useSoulProfile } from '../hooks/useSoulProfile.ts';
import { useSoulMatching } from '../hooks/useSoulMatching.ts';
import { useAppStore } from '../hooks/useAppStore.ts';
import { useA2A } from '../hooks/useA2A.ts';
import { demoProfiles, getOtherDemoProfiles } from '../lib/demo-profiles.ts';
import type { SoulProfile, MatchingReport, ProbeSession } from '@gradiences/soul-engine';

type SocialTab = 'profile' | 'discover' | 'matches' | 'sessions';

export function SocialView() {
    const [activeTab, setActiveTab] = useState<SocialTab>('profile');
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<SoulProfile | null>(null);
    const [selectedReport, setSelectedReport] = useState<MatchingReport | null>(null);
    const [activeProbeSession, setActiveProbeSession] = useState<ProbeSession | null>(null);
    
    // Hooks
    const { profile, loading: profileLoading, save: saveProfile } = useSoulProfile({ autoLoad: true });
    const { initialized: matchingReady, analyzeMatch, findMatches, loading: matchingLoading } = useSoulMatching({
        apiKey: (import.meta as any).env?.VITE_OPENAI_API_KEY || '',
        provider: 'openai',
        model: 'gpt-4',
    });
    const { agents } = useA2A({ autoInit: true, enableNostr: true });
    
    // Demo data - use demo profiles for discovered agents
    const [discoveredProfiles, setDiscoveredProfiles] = useState<SoulProfile[]>([]);
    const [matchReports, setMatchReports] = useState<MatchingReport[]>([]);
    
    useEffect(() => {
        // Load demo profiles for discovery
        // In production, fetch Soul Profiles from agents via Nostr
        if (discoveredProfiles.length === 0) {
            // Show all demo profiles except if user has a matching one
            const demos = getOtherDemoProfiles(profile?.id || '');
            setDiscoveredProfiles(demos.length > 0 ? demos : demoProfiles);
        }
    }, [profile?.id]);
    
    const handleSaveProfile = async (partial: Partial<SoulProfile>) => {
        await saveProfile(partial);
        setIsEditingProfile(false);
    };
    
    const handleStartProbe = (targetProfile: SoulProfile) => {
        // Create mock probe session
        const session: ProbeSession = {
            id: `probe-${crypto.randomUUID()}`,
            proberId: profile?.id || 'me',
            targetId: targetProfile.id,
            protocol: 'xmtp',
            status: 'probing',
            conversation: [],
            config: {
                depth: 'light',
                maxTurns: 5,
                timeoutMs: 30000,
            },
            boundaries: {
                prober: profile?.boundaries || {
                    forbiddenTopics: [],
                    maxConversationLength: 15,
                    privacyLevel: 'public',
                },
                target: targetProfile.boundaries,
            },
            startedAt: Date.now(),
        };
        
        setActiveProbeSession(session);
        setActiveTab('sessions');
    };
    
    const handleGenerateReport = async (targetProfile: SoulProfile, session?: ProbeSession) => {
        if (!profile || !matchingReady) return;
        
        const report = await analyzeMatch(profile, targetProfile, session);
        if (report) {
            setMatchReports([...matchReports, report]);
            setSelectedReport(report);
            setActiveTab('matches');
        }
    };
    
    return (
        <div className="h-full flex flex-col bg-gray-900">
            {/* Header Tabs */}
            <div className="flex items-center gap-1 p-2 bg-gray-800 border-b border-gray-700">
                {[
                    { id: 'profile', label: '👤 My Profile', count: profile ? 1 : 0 },
                    { id: 'discover', label: '🔍 Discover', count: discoveredProfiles.length },
                    { id: 'matches', label: '💕 Matches', count: matchReports.length },
                    { id: 'sessions', label: '💬 Sessions', count: activeProbeSession ? 1 : 0 },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as SocialTab)}
                        className={`px-4 py-2 rounded-lg font-medium transition ${
                            activeTab === tab.id
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-400 hover:text-white hover:bg-gray-700'
                        }`}
                    >
                        {tab.label}
                        {tab.count > 0 && (
                            <span className="ml-2 px-2 py-0.5 bg-gray-900/30 rounded text-xs">
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'profile' && (
                    <div className="max-w-6xl mx-auto">
                        {!profile && !isEditingProfile ? (
                            <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center px-4">
                                <div className="text-6xl mb-4">👤</div>
                                <h3 className="text-2xl font-bold mb-2">Create Your Soul Profile</h3>
                                <p className="text-gray-400 mb-6 max-w-md">
                                    A Soul Profile helps you find compatible agents and humans to collaborate with.
                                    Share your values, interests, and communication style.
                                </p>
                                <button
                                    onClick={() => setIsEditingProfile(true)}
                                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-lg transition"
                                >
                                    Create Profile
                                </button>
                            </div>
                        ) : isEditingProfile ? (
                            <SoulProfileEditor
                                initialProfile={profile || undefined}
                                onSave={handleSaveProfile}
                                onCancel={() => setIsEditingProfile(false)}
                            />
                        ) : profile ? (
                            <div className="p-6">
                                <div className="flex justify-end mb-4">
                                    <button
                                        onClick={() => setIsEditingProfile(true)}
                                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition"
                                    >
                                        Edit Profile
                                    </button>
                                </div>
                                <SoulProfileView profile={profile} />
                            </div>
                        ) : null}
                    </div>
                )}
                
                {activeTab === 'discover' && (
                    <div className="max-w-6xl mx-auto p-6">
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold mb-2">Discover Compatible Souls</h2>
                            <p className="text-gray-400">
                                Find agents and humans with similar values and interests
                            </p>
                        </div>
                        
                        {!profile ? (
                            <div className="text-center py-12">
                                <p className="text-gray-400 mb-4">Create your Soul Profile first to discover matches</p>
                                <button
                                    onClick={() => setActiveTab('profile')}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
                                >
                                    Create Profile
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {discoveredProfiles.map((discovered) => (
                                    <SoulProfileCard
                                        key={discovered.id}
                                        profile={discovered}
                                        onViewDetails={() => setSelectedProfile(discovered)}
                                        onStartProbe={() => handleStartProbe(discovered)}
                                    />
                                ))}
                                
                                {discoveredProfiles.length === 0 && (
                                    <div className="col-span-2 text-center py-12 text-gray-500">
                                        <p className="mb-2">No Soul Profiles discovered yet</p>
                                        <p className="text-sm">Agents will appear here as they broadcast their Soul Profiles</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                
                {activeTab === 'matches' && (
                    <div className="max-w-6xl mx-auto p-6">
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold mb-2">Compatibility Reports</h2>
                            <p className="text-gray-400">
                                AI-powered compatibility analysis
                            </p>
                        </div>
                        
                        {selectedReport ? (
                            <MatchingReportView
                                report={selectedReport}
                                onClose={() => setSelectedReport(null)}
                            />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {matchReports.map((report) => (
                                    <MatchingReportCard
                                        key={report.id}
                                        report={report}
                                        onClick={() => setSelectedReport(report)}
                                    />
                                ))}
                                
                                {matchReports.length === 0 && (
                                    <div className="col-span-2 text-center py-12 text-gray-500">
                                        <p className="mb-2">No compatibility reports yet</p>
                                        <p className="text-sm">Start a probe to generate your first report</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                
                {activeTab === 'sessions' && (
                    <div className="h-full">
                        {activeProbeSession ? (
                            <ProbeChat
                                session={activeProbeSession}
                                onSendMessage={async (content: string) => {
                                    // Mock: Add message to conversation
                                    const message = {
                                        id: crypto.randomUUID(),
                                        turn: Math.floor(activeProbeSession.conversation.length / 2),
                                        role: 'prober' as const,
                                        content,
                                        timestamp: Date.now(),
                                    };
                                    activeProbeSession.conversation.push(message);
                                    setActiveProbeSession({ ...activeProbeSession });
                                }}
                                onEndProbe={() => {
                                    activeProbeSession.status = 'completed';
                                    activeProbeSession.completedAt = Date.now();
                                    setActiveProbeSession({ ...activeProbeSession });
                                    
                                    // Generate report
                                    const targetProfile = discoveredProfiles.find(
                                        p => p.id === activeProbeSession.targetId
                                    );
                                    if (targetProfile && profile) {
                                        void handleGenerateReport(targetProfile, activeProbeSession);
                                    }
                                }}
                                onCancel={() => setActiveProbeSession(null)}
                                isProber={true}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-center px-4">
                                <div>
                                    <div className="text-6xl mb-4">💬</div>
                                    <h3 className="text-2xl font-bold mb-2">No Active Sessions</h3>
                                    <p className="text-gray-400 mb-6">
                                        Start a probe from the Discover tab to begin a compatibility conversation
                                    </p>
                                    <button
                                        onClick={() => setActiveTab('discover')}
                                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
                                    >
                                        Discover Agents
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {/* Profile Modal */}
            {selectedProfile && activeTab !== 'profile' && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <SoulProfileView
                            profile={selectedProfile}
                            onClose={() => setSelectedProfile(null)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper function to create mock profiles
function createMockProfile(name: string, index: number): SoulProfile {
    const types: ('human' | 'agent')[] = ['agent', 'human', 'agent'];
    const tones: ('friendly' | 'technical' | 'formal')[] = ['friendly', 'technical', 'formal'];
    
    return {
        id: `mock-${index}`,
        version: '1.0',
        soulType: types[index],
        createdAt: Date.now() - 86400000 * index,
        updatedAt: Date.now(),
        identity: {
            displayName: name,
            bio: `I'm ${name}, interested in AI and blockchain collaboration.`,
        },
        values: {
            core: ['innovation', 'collaboration', 'integrity'],
            priorities: ['learning', 'building', 'connecting'],
            dealBreakers: ['dishonesty', 'closed-mindedness'],
        },
        interests: {
            topics: ['AI', 'blockchain', 'DeFi', 'philosophy'],
            skills: ['coding', 'research', 'writing'],
            goals: ['build impactful products', 'learn continuously'],
        },
        communication: {
            tone: tones[index],
            pace: 'moderate',
            depth: 'moderate',
        },
        boundaries: {
            forbiddenTopics: ['politics'],
            maxConversationLength: 15,
            privacyLevel: 'public',
        },
        storage: {
            contentHash: '',
            embeddingHash: '',
            storageType: 'ipfs',
            cid: `mock-cid-${index}`,
        },
    };
}
