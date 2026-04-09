/**
 * DynamicDashboard 组件
 *
 * 显示用户的 Dashboard 数据概览和可视化
 * 使用真实数据源：profiles, following, social activity
 */

'use client';

import React, { useState } from 'react';
import { BarChart3, TrendingUp, Users, FileText, MessageSquare, Search, Send } from 'lucide-react';
import type { DashboardStats } from '@/hooks/useDashboard';

const c = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
};

interface DynamicDashboardProps {
    stats: DashboardStats;
    className?: string;
}

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '20px',
    },
    querySection: {
        display: 'flex',
        gap: '12px',
        marginBottom: '16px',
    },
    queryInput: {
        flex: 1,
        padding: '12px 16px',
        border: `1.5px solid ${c.ink}`,
        borderRadius: '12px',
        fontSize: '14px',
        background: c.surface,
        outline: 'none',
    } as React.CSSProperties,
    queryButton: {
        padding: '12px 20px',
        background: c.lime,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: 600,
        color: c.ink,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    visualizationGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px',
    },
    vizCard: {
        background: c.bg,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '12px',
        padding: '20px',
    },
    vizHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '16px',
    },
    vizTitle: {
        fontFamily: "'Oswald', sans-serif",
        fontSize: '16px',
        fontWeight: 600,
        margin: 0,
        color: c.ink,
    },
    vizContent: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '12px',
    },
    progressBar: {
        height: '8px',
        background: `${c.ink}20`,
        borderRadius: '4px',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        background: c.lime,
        borderRadius: '4px',
        transition: 'width 0.3s ease',
    } as React.CSSProperties,
    statRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: `1px solid ${c.ink}15`,
    },
    statLabel: {
        fontSize: '13px',
        color: c.ink,
        opacity: 0.7,
    },
    statValue: {
        fontFamily: "'Oswald', sans-serif",
        fontSize: '16px',
        fontWeight: 600,
        color: c.ink,
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        textAlign: 'center' as const,
        color: c.ink,
        opacity: 0.5,
    },
    queryTags: {
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: '8px',
        marginTop: '12px',
    },
    queryTag: {
        padding: '6px 12px',
        background: c.surface,
        border: `1.5px solid ${c.ink}`,
        borderRadius: '8px',
        fontSize: '12px',
        color: c.ink,
        cursor: 'pointer',
    },
    chartPlaceholder: {
        height: '120px',
        background: `${c.lavender}40`,
        border: `1px dashed ${c.ink}`,
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '13px',
        color: c.ink,
        opacity: 0.6,
    },
};

export function DynamicDashboard({ stats }: DynamicDashboardProps) {
    const [query, setQuery] = useState('');
    const [activeView, setActiveView] = useState<'overview' | 'profiles' | 'social'>('overview');

    const handleQuerySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;
        // In the future, this could trigger AI-powered data analysis
        console.log('Query submitted:', query);
    };

    const publishedRatio = stats.totalProfiles > 0 ? (stats.publishedProfiles / stats.totalProfiles) * 100 : 0;

    return (
        <div style={styles.container}>
            {/* Query Input */}
            <form onSubmit={handleQuerySubmit} style={styles.querySection}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search
                        size={18}
                        style={{
                            position: 'absolute',
                            left: '14px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: c.ink,
                            opacity: 0.4,
                        }}
                    />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Ask about your data... (e.g., 'Show my profile stats')"
                        style={{
                            ...styles.queryInput,
                            paddingLeft: '42px',
                        }}
                    />
                </div>
                <button type="submit" style={styles.queryButton}>
                    <Send size={16} />
                    Query
                </button>
            </form>

            {/* Query Suggestions */}
            <div style={styles.queryTags}>
                {['Profile overview', 'Social metrics', 'Activity summary'].map((tag) => (
                    <button
                        key={tag}
                        onClick={() => {
                            setQuery(tag);
                            if (tag.includes('Profile')) setActiveView('profiles');
                            else if (tag.includes('Social')) setActiveView('social');
                            else setActiveView('overview');
                        }}
                        style={styles.queryTag}
                    >
                        {tag}
                    </button>
                ))}
            </div>

            {/* Visualizations */}
            <div style={styles.visualizationGrid}>
                {/* Profile Stats Card */}
                <div style={styles.vizCard}>
                    <div style={styles.vizHeader}>
                        <FileText size={18} color={c.ink} />
                        <h4 style={styles.vizTitle}>Profile Status</h4>
                    </div>
                    <div style={styles.vizContent}>
                        {stats.totalProfiles === 0 ? (
                            <div style={styles.emptyState}>
                                <p>No profiles yet</p>
                                <p style={{ fontSize: '12px', marginTop: '4px' }}>
                                    Create your first agent profile to see stats
                                </p>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            marginBottom: '8px',
                                        }}
                                    >
                                        <span style={styles.statLabel}>Published</span>
                                        <span style={styles.statValue}>
                                            {stats.publishedProfiles} / {stats.totalProfiles}
                                        </span>
                                    </div>
                                    <div style={styles.progressBar}>
                                        <div
                                            style={{
                                                ...styles.progressFill,
                                                width: `${publishedRatio}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                                <div style={styles.statRow}>
                                    <span style={styles.statLabel}>Draft Profiles</span>
                                    <span style={styles.statValue}>{stats.draftProfiles}</span>
                                </div>
                                <div style={styles.statRow}>
                                    <span style={styles.statLabel}>Publish Rate</span>
                                    <span style={styles.statValue}>{publishedRatio.toFixed(0)}%</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Social Stats Card */}
                <div style={styles.vizCard}>
                    <div style={styles.vizHeader}>
                        <Users size={18} color={c.ink} />
                        <h4 style={styles.vizTitle}>Social Network</h4>
                    </div>
                    <div style={styles.vizContent}>
                        <div style={styles.statRow}>
                            <span style={styles.statLabel}>Followers</span>
                            <span style={styles.statValue}>{stats.followersCount}</span>
                        </div>
                        <div style={styles.statRow}>
                            <span style={styles.statLabel}>Following</span>
                            <span style={styles.statValue}>{stats.followingCount}</span>
                        </div>
                        <div style={styles.statRow}>
                            <span style={styles.statLabel}>Posts</span>
                            <span style={styles.statValue}>{stats.postsCount}</span>
                        </div>
                        <div style={{ ...styles.statRow, borderBottom: 'none' }}>
                            <span style={styles.statLabel}>Network Ratio</span>
                            <span style={styles.statValue}>
                                {stats.followingCount > 0
                                    ? (stats.followersCount / stats.followingCount).toFixed(2)
                                    : 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Reputation Card */}
                <div style={styles.vizCard}>
                    <div style={styles.vizHeader}>
                        <TrendingUp size={18} color={c.ink} />
                        <h4 style={styles.vizTitle}>Reputation</h4>
                    </div>
                    <div style={styles.vizContent}>
                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <div
                                style={{
                                    width: '80px',
                                    height: '80px',
                                    borderRadius: '50%',
                                    background: stats.reputationScore > 0 ? c.lime : c.bg,
                                    border: `3px solid ${c.ink}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 12px',
                                }}
                            >
                                <span
                                    style={{
                                        fontFamily: "'Oswald', sans-serif",
                                        fontSize: '24px',
                                        fontWeight: 700,
                                        color: c.ink,
                                    }}
                                >
                                    {stats.reputationScore > 0 ? stats.reputationScore.toFixed(0) : '—'}
                                </span>
                            </div>
                            <p style={{ fontSize: '13px', color: c.ink, opacity: 0.7 }}>
                                {stats.reputationScore > 0 ? 'Reputation Score' : 'No reputation data'}
                            </p>
                        </div>
                        <div style={styles.chartPlaceholder}>
                            <BarChart3 size={20} style={{ marginRight: '8px' }} />
                            Trend visualization coming soon
                        </div>
                    </div>
                </div>

                {/* Activity Card */}
                <div style={styles.vizCard}>
                    <div style={styles.vizHeader}>
                        <MessageSquare size={18} color={c.ink} />
                        <h4 style={styles.vizTitle}>Activity Overview</h4>
                    </div>
                    <div style={styles.vizContent}>
                        {stats.recentActivity.length === 0 ? (
                            <div style={styles.emptyState}>
                                <p>No recent activity</p>
                                <p style={{ fontSize: '12px', marginTop: '4px' }}>
                                    Your recent actions will appear here
                                </p>
                            </div>
                        ) : (
                            stats.recentActivity.slice(0, 3).map((activity) => (
                                <div key={activity.id} style={styles.statRow}>
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: c.ink }}>
                                            {activity.title}
                                        </div>
                                        <div style={{ fontSize: '11px', color: c.ink, opacity: 0.5 }}>
                                            {new Date(activity.timestamp).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DynamicDashboard;
