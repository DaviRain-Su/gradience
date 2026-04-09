'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';
import { useFollowing, useFollowingList } from '@/hooks/useFollowing';
import { useDiscoverAgents } from '@/hooks/useDiscoverAgents';
import { FollowButton } from '@/components/social/FollowButton';
import { Search, Users, Star, TrendingUp, Shield, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';
import Link from 'next/link';

const c = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
};

const styles = {
    container: {
        minHeight: '100vh',
        background: c.bg,
    },
    header: {
        borderBottom: `1.5px solid ${c.ink}`,
        background: c.surface,
    },
    headerContent: {
        maxWidth: '900px',
        margin: '0 auto',
        padding: '24px',
    },
    title: {
        fontFamily: "'Oswald', sans-serif",
        fontSize: '28px',
        fontWeight: 700,
        margin: 0,
        color: c.ink,
    },
    subtitle: {
        fontSize: '14px',
        color: c.ink,
        opacity: 0.6,
        marginTop: '4px',
    },
    content: {
        maxWidth: '900px',
        margin: '0 auto',
        padding: '24px',
    },
    searchCard: {
        background: c.surface,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px',
    },
    searchInputWrapper: {
        display: 'flex',
        gap: '12px',
    },
    searchInput: {
        flex: 1,
        padding: '14px 18px',
        fontSize: '15px',
        border: `1.5px solid ${c.ink}`,
        borderRadius: '12px',
        background: c.bg,
        color: c.ink,
        outline: 'none',
    },
    searchButton: {
        padding: '14px 24px',
        background: c.lime,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '12px',
        fontSize: '15px',
        fontWeight: 600,
        color: c.ink,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    section: {
        marginBottom: '32px',
    },
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
    },
    sectionTitle: {
        fontFamily: "'Oswald', sans-serif",
        fontSize: '20px',
        fontWeight: 700,
        margin: 0,
        color: c.ink,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    sectionDescription: {
        fontSize: '14px',
        color: c.ink,
        opacity: 0.6,
    },
    agentGrid: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '12px',
    },
    agentCard: {
        background: c.surface,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '16px',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
    },
    agentAvatar: {
        width: '56px',
        height: '56px',
        borderRadius: '16px',
        background: c.lavender,
        border: `1.5px solid ${c.ink}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Oswald', sans-serif",
        fontSize: '24px',
        fontWeight: 700,
        color: c.ink,
        flexShrink: 0,
    },
    agentInfo: {
        flex: 1,
        minWidth: 0,
    },
    agentName: {
        fontSize: '16px',
        fontWeight: 700,
        color: c.ink,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    agentAddress: {
        fontSize: '13px',
        color: c.ink,
        opacity: 0.5,
        fontFamily: 'monospace',
        marginTop: '2px',
    },
    agentBio: {
        fontSize: '14px',
        color: c.ink,
        opacity: 0.7,
        marginTop: '6px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap' as const,
    },
    agentStats: {
        display: 'flex',
        gap: '20px',
        alignItems: 'center',
    },
    agentStat: {
        textAlign: 'center' as const,
    },
    agentStatValue: {
        fontFamily: "'Oswald', sans-serif",
        fontSize: '18px',
        fontWeight: 700,
        color: c.ink,
    },
    agentStatLabel: {
        fontSize: '11px',
        color: c.ink,
        opacity: 0.5,
        textTransform: 'uppercase' as const,
        marginTop: '2px',
    },
    rankBadge: {
        width: '32px',
        height: '32px',
        borderRadius: '10px',
        background: c.lime,
        border: `1.5px solid ${c.ink}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Oswald', sans-serif",
        fontSize: '14px',
        fontWeight: 700,
        color: c.ink,
    },
    verifiedBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        background: c.lime,
        border: `1.5px solid ${c.ink}`,
    },
    emptyState: {
        textAlign: 'center' as const,
        padding: '48px 24px',
        color: c.ink,
        opacity: 0.5,
    },
    loadingState: {
        textAlign: 'center' as const,
        padding: '48px',
        color: c.ink,
        opacity: 0.5,
    },
    errorState: {
        textAlign: 'center' as const,
        padding: '48px 24px',
        background: c.surface,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '16px',
        marginBottom: '24px',
    },
    sourceTag: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        background: c.lavender,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 600,
        color: c.ink,
    },
    trustBadge: {
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 600,
    },
    refreshButton: {
        padding: '8px 16px',
        background: c.surface,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '8px',
        fontSize: '13px',
        fontWeight: 600,
        color: c.ink,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
    },
};

interface Agent {
    address: string;
    displayName: string;
    bio: string;
    reputation: number;
    followersCount: number;
    followingCount: number;
    trustScore: number;
    rank: number;
    verifiedBadge: boolean;
    interactionPolicy: 'allow' | 'review' | 'restricted';
}

export default function DiscoverPage() {
    // Add CSS animation for loading spinner
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    const { walletAddress } = useDaemonConnection();
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Agent[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const { following } = useFollowingList(walletAddress || '');
    const { follow, unfollow } = useFollowing();

    // Fetch real agents from Chain Hub Indexer
    const { agents, loading, error, refetch } = useDiscoverAgents();

    const handleSearch = useCallback(() => {
        if (!query.trim()) return;
        setHasSearched(true);

        // Search in real agents
        const results = agents.filter(
            (agent) =>
                agent.displayName.toLowerCase().includes(query.toLowerCase()) ||
                agent.address.toLowerCase().includes(query.toLowerCase()) ||
                agent.bio.toLowerCase().includes(query.toLowerCase()),
        );
        setSearchResults(results);
    }, [query, agents]);

    const isFollowing = useCallback(
        (address: string) => {
            return following.some((f) => f.address === address);
        },
        [following],
    );

    const handleFollow = async (address: string) => {
        await follow(address);
    };

    const handleUnfollow = async (address: string) => {
        await unfollow(address);
    };

    const getTrustStyle = (policy: string): React.CSSProperties => {
        const base: React.CSSProperties = { ...styles.trustBadge };
        switch (policy) {
            case 'allow':
                return { ...base, background: c.lime, color: c.ink };
            case 'review':
                return { ...base, background: '#FEF3C7', color: '#92400E' };
            case 'restricted':
                return { ...base, background: '#FEE2E2', color: '#991B1B' };
            default:
                return { ...base, background: '#FEF3C7', color: '#92400E' };
        }
    };

    const AgentCard = ({ agent, showRank = false }: { agent: Agent; showRank?: boolean }) => (
        <div style={styles.agentCard}>
            {showRank && <div style={styles.rankBadge}>{agent.rank}</div>}
            <Link href={`/profile/${agent.address}`} style={{ textDecoration: 'none' }}>
                <div style={styles.agentAvatar}>{agent.displayName[0]}</div>
            </Link>

            <div style={styles.agentInfo}>
                <Link href={`/profile/${agent.address}`} style={{ textDecoration: 'none' }}>
                    <div style={styles.agentName}>
                        {agent.displayName}
                        {agent.verifiedBadge && (
                            <div style={styles.verifiedBadge}>
                                <Shield size={10} color={c.ink} />
                            </div>
                        )}
                    </div>
                </Link>
                <div style={styles.agentAddress}>
                    {agent.address.slice(0, 8)}...{agent.address.slice(-4)}
                </div>
                <div style={styles.agentBio}>{agent.bio}</div>
            </div>

            <div style={styles.agentStats}>
                <div style={styles.agentStat}>
                    <div style={styles.agentStatValue}>{agent.reputation}</div>
                    <div style={styles.agentStatLabel}>Rep</div>
                </div>
                <div style={styles.agentStat}>
                    <div style={styles.agentStatValue}>{agent.followersCount}</div>
                    <div style={styles.agentStatLabel}>Followers</div>
                </div>
                <div style={styles.agentStat}>
                    <div style={styles.agentStatValue}>{agent.trustScore}</div>
                    <div style={styles.agentStatLabel}>Trust</div>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px', alignItems: 'flex-end' }}>
                <span style={getTrustStyle(agent.interactionPolicy)}>{agent.interactionPolicy}</span>
                <FollowButton
                    agentAddress={agent.address}
                    isFollowing={isFollowing(agent.address)}
                    onFollow={handleFollow}
                    onUnfollow={handleUnfollow}
                    size="md"
                />
            </div>
        </div>
    );

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerContent}>
                    <h1 style={styles.title}>Discover Agents</h1>
                    <p style={styles.subtitle}>Find and connect with AI agents across the network</p>
                </div>
            </div>

            {/* Content */}
            <div style={styles.content}>
                {/* Search */}
                <div style={styles.searchCard}>
                    <div style={styles.searchInputWrapper}>
                        <input
                            type="text"
                            placeholder="Search by name or address..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            style={styles.searchInput}
                            disabled={loading}
                        />
                        <button onClick={handleSearch} style={styles.searchButton} disabled={loading}>
                            <Search size={18} />
                            Search
                        </button>
                    </div>
                </div>

                {/* Error State */}
                {error && !loading && (
                    <div style={styles.errorState}>
                        <AlertCircle size={32} color={c.ink} style={{ marginBottom: '12px', opacity: 0.5 }} />
                        <p style={{ margin: 0, color: c.ink, fontSize: '14px' }}>{error}</p>
                        <button onClick={refetch} style={{ ...styles.refreshButton, marginTop: '16px' }}>
                            <RefreshCw size={14} />
                            Retry
                        </button>
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div style={styles.loadingState}>
                        <RefreshCw size={32} color={c.ink} style={{ animation: 'spin 1s linear infinite' }} />
                        <p style={{ marginTop: '16px', fontSize: '14px' }}>Loading agents from the network...</p>
                    </div>
                )}

                {/* Search Results */}
                {hasSearched && !loading && (
                    <div style={styles.section}>
                        <div style={styles.sectionHeader}>
                            <h2 style={styles.sectionTitle}>
                                <Search size={20} />
                                Search Results
                            </h2>
                            <span style={styles.sourceTag}>{searchResults.length} found</span>
                        </div>
                        {searchResults.length === 0 ? (
                            <div style={styles.emptyState}>No agents found matching &quot;{query}&quot;</div>
                        ) : (
                            <div style={styles.agentGrid}>
                                {searchResults.map((agent) => (
                                    <AgentCard key={agent.address} agent={agent} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Top Agents */}
                {!loading && agents.length > 0 && (
                    <div style={styles.section}>
                        <div style={styles.sectionHeader}>
                            <h2 style={styles.sectionTitle}>
                                <TrendingUp size={20} />
                                Top Reputation Agents
                            </h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={styles.sourceTag}>
                                    <Star size={12} />
                                    On-Chain Data
                                </span>
                                <button onClick={refetch} style={styles.refreshButton}>
                                    <RefreshCw size={14} />
                                    Refresh
                                </button>
                            </div>
                        </div>
                        <p style={{ ...styles.sectionDescription, marginBottom: '16px' }}>
                            Highest ranked agents based on reputation score, trust, and community standing
                        </p>
                        <div style={styles.agentGrid}>
                            {agents.map((agent) => (
                                <AgentCard key={agent.address} agent={agent} showRank />
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!loading && !error && agents.length === 0 && (
                    <div style={styles.section}>
                        <div style={styles.sectionHeader}>
                            <h2 style={styles.sectionTitle}>
                                <TrendingUp size={20} />
                                Top Reputation Agents
                            </h2>
                        </div>
                        <div
                            style={{
                                ...styles.emptyState,
                                background: c.surface,
                                border: `1.5px solid ${c.ink}`,
                                borderRadius: '16px',
                            }}
                        >
                            <Users size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                            <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>No agents found</p>
                            <p style={{ fontSize: '14px', opacity: 0.7 }}>
                                Agents will appear here once they register on the network.
                            </p>
                            <button onClick={refetch} style={{ ...styles.refreshButton, marginTop: '16px' }}>
                                <RefreshCw size={14} />
                                Refresh
                            </button>
                        </div>
                    </div>
                )}

                {/* Categories */}
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>
                        <h2 style={styles.sectionTitle}>
                            <Users size={20} />
                            Browse Categories
                        </h2>
                    </div>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '12px',
                        }}
                    >
                        {['DeFi', 'Analytics', 'Security', 'Social', 'Gaming', 'Infrastructure'].map((category) => (
                            <div
                                key={category}
                                style={{
                                    padding: '20px',
                                    background: c.surface,
                                    border: `1.5px solid ${c.ink}`,
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                }}
                            >
                                <span style={{ fontWeight: 600, color: c.ink }}>{category}</span>
                                <ChevronRight size={18} color={c.ink} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
