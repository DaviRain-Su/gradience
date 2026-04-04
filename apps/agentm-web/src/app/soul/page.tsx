'use client';
/**
 * Soul Page
 * 
 * Complete social matching interface - Soul Profiles, Discovery, Probing, Reports
 */

import { useState, useEffect } from 'react';
import { SoulProfileCard } from '@/components/social/SoulProfileCard';
import { SoulProfileEditor } from '@/components/social/SoulProfileEditor';
import { ProbeChat } from '@/components/social/probe';
import { useSoulProfile } from '@/hooks/useSoulProfile';
import { useSoulMatching } from '@/hooks/useSoulMatching';
import { demoProfiles, getOtherDemoProfiles } from '@/lib/demo-profiles';
import type { SoulProfile, ProbeSession, MatchingReport } from '@/types/soul';

// Simple Matching Report View Component
function MatchingReportView({ 
  report, 
  onClose 
}: { 
  report: MatchingReport; 
  onClose: () => void;
}) {
  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#059669';
    if (score >= 60) return '#D97706';
    if (score >= 40) return '#DC2626';
    return '#991B1B';
  };

  const getScoreBg = (score: number): string => {
    if (score >= 80) return '#D1FAE5';
    if (score >= 60) return '#FEF3C7';
    if (score >= 40) return '#FEE2E2';
    return '#FEE2E2';
  };

  return (
    <div style={{
      maxWidth: '900px',
      margin: '0 auto',
      padding: '32px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '32px',
      }}>
        <div>
          <h2 style={{
            fontSize: '32px',
            fontWeight: 700,
            margin: 0,
            color: '#16161A',
          fontFamily: "Oswald, sans-serif",
          }}>Compatibility Report</h2>
          <p style={{
            fontSize: '14px',
            color: '#16161A',
            opacity: 0.6,
            margin: '8px 0 0 0',
          }}>
            Generated {new Date(report.generatedAt).toLocaleString()}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '12px 24px',
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
          Close
        </button>
      </div>

      {/* Overall Score */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '24px',
        padding: '48px',
        border: '1.5px solid #16161A',
        textAlign: 'center',
        marginBottom: '32px',
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: 500,
          color: '#16161A',
          opacity: 0.6,
          margin: '0 0 16px 0',
        }}>Overall Compatibility</h3>
        <div style={{
          fontSize: '80px',
          fontWeight: 700,
          color: getScoreColor(report.compatibilityScore),
          fontFamily: "Oswald, sans-serif",
        }}>
          {report.compatibilityScore}
          <span style={{
            fontSize: '36px',
            color: '#16161A',
            opacity: 0.3,
          }}>/100</span>
        </div>

        {/* Score Bar */}
        <div style={{
          marginTop: '24px',
          height: '16px',
          background: '#F3F3F8',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1.5px solid #16161A',
        }}>
          <div style={{
            height: '100%',
            background: getScoreColor(report.compatibilityScore),
            transition: 'width 0.5s ease',
            width: `${report.compatibilityScore}%`,
          }} />
        </div>

        <p style={{
          marginTop: '24px',
          fontSize: '16px',
          color: '#16161A',
          lineHeight: 1.6,
        }}>{report.analysis.assessment}</p>
      </div>

      {/* Dimensions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px',
        marginBottom: '32px',
      }}>
        {Object.entries(report.analysis.dimensions).map(([key, dim]) => (
          <div
            key={key}
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              padding: '24px',
              border: '1.5px solid #16161A',
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}>
              <h4 style={{
                fontSize: '16px',
                fontWeight: 600,
                margin: 0,
                textTransform: 'capitalize',
                color: '#16161A',
              }}>{key}</h4>
              <span style={{
                fontSize: '28px',
                fontWeight: 700,
                color: getScoreColor(dim.score),
                fontFamily: "Oswald, sans-serif",
              }}>{dim.score}</span>
            </div>
            <p style={{
              fontSize: '14px',
              color: '#16161A',
              opacity: 0.7,
              margin: 0,
            }}>{dim.summary}</p>
          </div>
        ))}
      </div>

      {/* Recommended Topics */}
      {report.analysis.recommendedTopics.length > 0 && (
        <div style={{
          background: '#D1FAE5',
          borderRadius: '16px',
          padding: '24px',
          border: '1.5px solid #16161A',
          marginBottom: '16px',
        }}>
          <h4 style={{
            fontSize: '16px',
            fontWeight: 600,
            margin: '0 0 12px 0',
            color: '#065F46',
          }}>🌟 Recommended Topics</h4>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
          }}>
            {report.analysis.recommendedTopics.map((topic, i) => (
              <span
                key={i}
                style={{
                  padding: '8px 16px',
                  background: '#FFFFFF',
                  border: '1.5px solid #16161A',
                  borderRadius: '12px',
                  fontSize: '14px',
                  color: '#065F46',
                }}
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type SoulTab = 'profile' | 'discover' | 'matches' | 'sessions';

export default function SoulPage() {
  const [activeTab, setActiveTab] = useState<SoulTab>('profile');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [selectedReport, setSelectedReport] = useState<MatchingReport | null>(null);
  const [activeProbeSession, setActiveProbeSession] = useState<ProbeSession | null>(null);
  const [matchReports, setMatchReports] = useState<MatchingReport[]>([]);
  const [discoveredProfiles, setDiscoveredProfiles] = useState<SoulProfile[]>([]);

  // Hooks
  const { profile, loading: profileLoading, save: saveProfile } = useSoulProfile({ autoLoad: true });
  const { initialized: matchingReady, analyzeMatch, loading: matchingLoading } = useSoulMatching({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || '',
    provider: 'openai',
    model: 'gpt-4',
  });

  // Load demo profiles
  useEffect(() => {
    if (discoveredProfiles.length === 0) {
      const demos = getOtherDemoProfiles(profile?.id || '');
      setDiscoveredProfiles(demos.length > 0 ? demos : demoProfiles);
    }
  }, [profile?.id, discoveredProfiles.length]);

  const handleSaveProfile = async (partial: Partial<SoulProfile>) => {
    await saveProfile(partial);
    setIsEditingProfile(false);
  };

  const handleStartProbe = (targetProfile: SoulProfile) => {
    const session: ProbeSession = {
      id: `probe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
    if (!profile) return;

    const report = await analyzeMatch(profile, targetProfile, session);
    if (report) {
      setMatchReports(prev => [...prev, report]);
      setSelectedReport(report);
      setActiveTab('matches');
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!activeProbeSession) return;

    const message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      turn: Math.floor(activeProbeSession.conversation.length / 2),
      role: 'prober' as const,
      content,
      timestamp: Date.now(),
    };

    const updatedSession = {
      ...activeProbeSession,
      conversation: [...activeProbeSession.conversation, message],
    };

    setActiveProbeSession(updatedSession);
  };

  const handleEndProbe = () => {
    if (!activeProbeSession) return;

    const completedSession = {
      ...activeProbeSession,
      status: 'completed' as const,
      completedAt: Date.now(),
    };

    setActiveProbeSession(completedSession);

    // Generate report
    const targetProfile = discoveredProfiles.find(
      p => p.id === activeProbeSession.targetId
    );
    if (targetProfile && profile) {
      void handleGenerateReport(targetProfile, completedSession);
    }
  };

  const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '12px 20px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: '1.5px solid #16161A',
    background: isActive ? '#16161A' : '#FFFFFF',
    color: isActive ? '#FFFFFF' : '#16161A',
  });

  const containerStyle: React.CSSProperties = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '32px 24px',
    minHeight: 'calc(100vh - 80px)',
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{
        marginBottom: '32px',
      }}>
        <h1 style={{
          fontSize: '48px',
          fontWeight: 700,
          margin: '0 0 8px 0',
          color: '#16161A',
          fontFamily: "Oswald, sans-serif",
        }}>Soul</h1>
        <p style={{
          fontSize: '18px',
          color: '#16161A',
          opacity: 0.6,
          margin: 0,
        }}>Discover compatible souls through AI-powered matching</p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '32px',
        flexWrap: 'wrap',
      }}>
        {[
          { id: 'profile', label: '👤 My Profile', count: profile ? 1 : 0 },
          { id: 'discover', label: '🔍 Discover', count: discoveredProfiles.length },
          { id: 'matches', label: '💕 Matches', count: matchReports.length },
          { id: 'sessions', label: '💬 Sessions', count: activeProbeSession ? 1 : 0 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as SoulTab)}
            style={tabButtonStyle(activeTab === tab.id)}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.background = '#F3F3F8';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.background = '#FFFFFF';
              }
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                marginLeft: '8px',
                padding: '2px 8px',
                background: activeTab === tab.id ? 'rgba(255,255,255,0.2)' : '#F3F3F8',
                borderRadius: '9999px',
                fontSize: '12px',
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {activeTab === 'profile' && (
          <div>
            {!profile && !isEditingProfile ? (
              <div style={{
                textAlign: 'center',
                padding: '80px 24px',
                background: '#FFFFFF',
                borderRadius: '24px',
                border: '1.5px solid #16161A',
              }}>
                <div style={{ fontSize: '64px', marginBottom: '24px' }}>👤</div>
                <h3 style={{
                  fontSize: '28px',
                  fontWeight: 700,
                  margin: '0 0 12px 0',
                  color: '#16161A',
                  fontFamily: "Oswald, sans-serif",
                }}>Create Your Soul Profile</h3>
                <p style={{
                  fontSize: '16px',
                  color: '#16161A',
                  opacity: 0.6,
                  margin: '0 0 32px 0',
                  maxWidth: '500px',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}>
                  A Soul Profile helps you find compatible agents and humans to collaborate with.
                  Share your values, interests, and communication style.
                </p>
                <button
                  onClick={() => setIsEditingProfile(true)}
                  style={{
                    padding: '16px 32px',
                    background: '#16161A',
                    color: '#FFFFFF',
                    border: '1.5px solid #16161A',
                    borderRadius: '12px',
                    fontSize: '16px',
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
                  Create Profile
                </button>
              </div>
            ) : isEditingProfile ? (
              <div style={{
                background: '#FFFFFF',
                borderRadius: '24px',
                border: '1.5px solid #16161A',
                padding: '32px',
              }}>
                <SoulProfileEditor
                  initialProfile={profile || undefined}
                  onSave={handleSaveProfile}
                  onCancel={() => setIsEditingProfile(false)}
                />
              </div>
            ) : profile ? (
              <div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginBottom: '16px',
                }}>
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    style={{
                      padding: '12px 24px',
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
                    Edit Profile
                  </button>
                </div>
                <SoulProfileCard 
                  profile={profile} 
                  showActions={false}
                />
              </div>
            ) : null}
          </div>
        )}

        {activeTab === 'discover' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{
                fontSize: '24px',
                fontWeight: 700,
                margin: '0 0 8px 0',
                color: '#16161A',
                fontFamily: "Oswald, sans-serif",
              }}>Discover Compatible Souls</h2>
              <p style={{
                fontSize: '16px',
                color: '#16161A',
                opacity: 0.6,
                margin: 0,
              }}>
                Find agents and humans with similar values and interests
              </p>
            </div>

            {!profile ? (
              <div style={{
                textAlign: 'center',
                padding: '48px 24px',
                background: '#FFFFFF',
                borderRadius: '24px',
                border: '1.5px solid #16161A',
              }}>
                <p style={{
                  fontSize: '16px',
                  color: '#16161A',
                  opacity: 0.6,
                  margin: '0 0 16px 0',
                }}>Create your Soul Profile first to discover matches</p>
                <button
                  onClick={() => setActiveTab('profile')}
                  style={{
                    padding: '12px 24px',
                    background: '#16161A',
                    color: '#FFFFFF',
                    border: '1.5px solid #16161A',
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
                  Create Profile
                </button>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: '24px',
              }}>
                {discoveredProfiles.map((discovered) => (
                  <SoulProfileCard
                    key={discovered.id}
                    profile={discovered}
                    onStartProbe={() => handleStartProbe(discovered)}
                  />
                ))}

                {discoveredProfiles.length === 0 && (
                  <div style={{
                    gridColumn: '1 / -1',
                    textAlign: 'center',
                    padding: '48px 24px',
                    color: '#16161A',
                    opacity: 0.5,
                  }}>
                    <p style={{ marginBottom: '8px' }}>No Soul Profiles discovered yet</p>
                    <p style={{ fontSize: '14px' }}>Agents will appear here as they broadcast their Soul Profiles</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'matches' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{
                fontSize: '24px',
                fontWeight: 700,
                margin: '0 0 8px 0',
                  color: '#16161A',
                fontFamily: "Oswald, sans-serif",
              }}>Compatibility Reports</h2>
              <p style={{
                fontSize: '16px',
                color: '#16161A',
                opacity: 0.6,
                margin: 0,
              }}>
                AI-powered compatibility analysis
              </p>
            </div>

            {selectedReport ? (
              <MatchingReportView
                report={selectedReport}
                onClose={() => setSelectedReport(null)}
              />
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: '24px',
              }}>
                {matchReports.map((report) => (
                  <div
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '16px',
                      padding: '24px',
                      border: '1.5px solid #16161A',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '4px 4px 0 #16161A';
                      e.currentTarget.style.transform = 'translate(-2px, -2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.transform = 'translate(0, 0)';
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '16px',
                    }}>
                      <div>
                        <h4 style={{
                          fontSize: '18px',
                          fontWeight: 700,
                          margin: 0,
                          color: '#16161A',
                        }}>Compatibility Report</h4>
                        <p style={{
                          fontSize: '14px',
                          color: '#16161A',
                          opacity: 0.5,
                          margin: '4px 0 0 0',
                        }}>
                          {new Date(report.generatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div style={{
                        fontSize: '36px',
                        fontWeight: 700,
                        color: report.compatibilityScore >= 60 ? '#059669' : '#DC2626',
                        fontFamily: "Oswald, sans-serif",
                      }}>
                        {report.compatibilityScore}
                      </div>
                    </div>
                    <p style={{
                      fontSize: '14px',
                      color: '#16161A',
                      opacity: 0.7,
                      margin: 0,
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>{report.analysis.assessment}</p>
                  </div>
                ))}

                {matchReports.length === 0 && (
                  <div style={{
                    gridColumn: '1 / -1',
                    textAlign: 'center',
                    padding: '48px 24px',
                    background: '#FFFFFF',
                    borderRadius: '24px',
                    border: '1.5px solid #16161A',
                    color: '#16161A',
                    opacity: 0.5,
                  }}>
                    <p style={{ marginBottom: '8px' }}>No compatibility reports yet</p>
                    <p style={{ fontSize: '14px' }}>Start a probe to generate your first report</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'sessions' && (
          <div style={{
            background: '#FFFFFF',
            borderRadius: '24px',
            border: '1.5px solid #16161A',
            minHeight: '600px',
          }}>
            {activeProbeSession ? (
              <ProbeChat
                session={activeProbeSession}
                onSendMessage={handleSendMessage}
                onEndProbe={handleEndProbe}
                onCancel={() => setActiveProbeSession(null)}
                isProber={true}
              />
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '600px',
                textAlign: 'center',
                padding: '48px',
              }}>
                <div>
                  <div style={{ fontSize: '64px', marginBottom: '24px' }}>💬</div>
                  <h3 style={{
                    fontSize: '28px',
                    fontWeight: 700,
                    margin: '0 0 12px 0',
                    color: '#16161A',
                    fontFamily: "Oswald, sans-serif",
                  }}>No Active Sessions</h3>
                  <p style={{
                    fontSize: '16px',
                    color: '#16161A',
                    opacity: 0.6,
                    margin: '0 0 32px 0',
                    maxWidth: '400px',
                  }}>
                    Start a probe from the Discover tab to begin a compatibility conversation
                  </p>
                  <button
                    onClick={() => setActiveTab('discover')}
                    style={{
                      padding: '16px 32px',
                      background: '#16161A',
                      color: '#FFFFFF',
                      border: '1.5px solid #16161A',
                      borderRadius: '12px',
                      fontSize: '16px',
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
                    Discover Souls
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
