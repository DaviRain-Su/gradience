'use client';

import { useMemo } from 'react';
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';
import { useDashboard } from '@/hooks/useDashboard';
import { BarChart3, TrendingUp, Award, DollarSign, Users, Activity, RefreshCw, Wallet } from 'lucide-react';

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
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  refreshButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    background: c.lime,
    border: `1.5px solid ${c.ink}`,
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 600,
    color: c.ink,
    cursor: 'pointer',
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px',
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  metricCard: {
    background: c.surface,
    border: `1.5px solid ${c.ink}`,
    borderRadius: '16px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  metricIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: c.lavender,
    border: `1.5px solid ${c.ink}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: '13px',
    color: c.ink,
    opacity: 0.6,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  metricValue: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: '28px',
    fontWeight: 700,
    color: c.ink,
    margin: '4px 0 0 0',
  },
  card: {
    background: c.surface,
    border: `1.5px solid ${c.ink}`,
    borderRadius: '16px',
    overflow: 'hidden',
    marginBottom: '24px',
  },
  cardHeader: {
    padding: '20px 24px',
    borderBottom: `1.5px solid ${c.ink}`,
  },
  cardTitle: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: '18px',
    fontWeight: 700,
    margin: 0,
    color: c.ink,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  cardDescription: {
    fontSize: '14px',
    color: c.ink,
    opacity: 0.6,
    marginTop: '4px',
  },
  cardContent: {
    padding: '24px',
  },
  reputationBar: {
    height: '24px',
    background: c.bg,
    border: `1.5px solid ${c.ink}`,
    borderRadius: '12px',
    overflow: 'hidden',
    marginBottom: '16px',
  },
  reputationFill: {
    height: '100%',
    background: c.lime,
    borderRight: `1.5px solid ${c.ink}`,
    transition: 'width 0.3s ease',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
  },
  statBox: {
    textAlign: 'center' as const,
    padding: '16px',
    background: c.bg,
    border: `1.5px solid ${c.ink}`,
    borderRadius: '12px',
  },
  statValue: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: '24px',
    fontWeight: 700,
    color: c.ink,
  },
  statLabel: {
    fontSize: '12px',
    color: c.ink,
    opacity: 0.6,
    marginTop: '4px',
    textTransform: 'uppercase' as const,
  },
  chartPlaceholder: {
    height: '200px',
    background: c.bg,
    border: `1.5px dashed ${c.ink}`,
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  placeholderText: {
    fontSize: '14px',
    color: c.ink,
    opacity: 0.5,
  },
  walletPrompt: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 24px',
    textAlign: 'center' as const,
    background: c.surface,
    border: `1.5px solid ${c.ink}`,
    borderRadius: '16px',
  },
  walletIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '20px',
    background: c.lavender,
    border: `1.5px solid ${c.ink}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  loadingState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 24px',
    color: c.ink,
    opacity: 0.6,
  },
  errorState: {
    padding: '40px 24px',
    textAlign: 'center' as const,
    color: '#DC2626',
  },
  retryButton: {
    marginTop: '16px',
    padding: '10px 20px',
    background: c.lime,
    border: `1.5px solid ${c.ink}`,
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  activityItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px',
    background: c.bg,
    border: `1.5px solid ${c.ink}`,
    borderRadius: '12px',
  },
  activityIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: c.lavender,
    border: `1.5px solid ${c.ink}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: c.ink,
  },
  activityDesc: {
    fontSize: '13px',
    color: c.ink,
    opacity: 0.6,
    marginTop: '2px',
  },
  activityTime: {
    fontSize: '12px',
    color: c.ink,
    opacity: 0.4,
    marginTop: '4px',
  },
};

export default function StatsPage() {
  const { walletAddress } = useDaemonConnection();
  const { stats, loading, error, refresh } = useDashboard();

  const reputationPercent = useMemo(() => {
    if (stats.reputationScore > 0) {
      return Math.min(100, Math.max(0, stats.reputationScore * 10));
    }
    return 0;
  }, [stats.reputationScore]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div>
            <h1 style={styles.title}>Statistics</h1>
            <p style={styles.subtitle}>
              Your performance metrics and reputation overview
            </p>
          </div>
          {walletAddress && (
            <button onClick={refresh} style={styles.refreshButton} disabled={loading}>
              <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {!walletAddress ? (
          <div style={styles.walletPrompt}>
            <div style={styles.walletIcon}>
              <Wallet size={32} color={c.ink} />
            </div>
            <h3 style={{ ...styles.title, fontSize: '20px', marginBottom: '8px' }}>
              Connect Your Wallet
            </h3>
            <p style={{ fontSize: '14px', color: c.ink, opacity: 0.6, maxWidth: '400px' }}>
              Connect your wallet to view your statistics, reputation, and activity metrics
            </p>
          </div>
        ) : loading ? (
          <div style={styles.loadingState}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginRight: '12px' }} />
            Loading stats...
          </div>
        ) : error ? (
          <div style={styles.errorState}>
            <p>Error: {error}</p>
            <button onClick={refresh} style={styles.retryButton}>
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Metric Cards */}
            <div style={styles.metricGrid}>
              <div style={styles.metricCard}>
                <div style={styles.metricIcon}>
                  <Award size={24} color={c.ink} />
                </div>
                <div>
                  <div style={styles.metricLabel}>Reputation Score</div>
                  <h3 style={styles.metricValue}>
                    {stats.reputationScore > 0 ? stats.reputationScore.toFixed(1) : 'N/A'}
                  </h3>
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricIcon}>
                  <BarChart3 size={24} color={c.ink} />
                </div>
                <div>
                  <div style={styles.metricLabel}>Total Profiles</div>
                  <h3 style={styles.metricValue}>{stats.totalProfiles}</h3>
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricIcon}>
                  <Users size={24} color={c.ink} />
                </div>
                <div>
                  <div style={styles.metricLabel}>Followers</div>
                  <h3 style={styles.metricValue}>{formatNumber(stats.followersCount)}</h3>
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricIcon}>
                  <Activity size={24} color={c.ink} />
                </div>
                <div>
                  <div style={styles.metricLabel}>Following</div>
                  <h3 style={styles.metricValue}>{formatNumber(stats.followingCount)}</h3>
                </div>
              </div>
            </div>

            {/* Reputation Card */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>
                  <TrendingUp size={20} />
                  Reputation Overview
                </h2>
                <p style={styles.cardDescription}>
                  Your standing in the AgentM network
                </p>
              </div>
              <div style={styles.cardContent}>
                <div style={styles.reputationBar}>
                  <div 
                    style={{ ...styles.reputationFill, width: `${reputationPercent}%` }} 
                  />
                </div>
                <div style={styles.statsRow}>
                  <div style={styles.statBox}>
                    <div style={styles.statValue}>{stats.publishedProfiles}</div>
                    <div style={styles.statLabel}>Published</div>
                  </div>
                  <div style={styles.statBox}>
                    <div style={styles.statValue}>{stats.draftProfiles}</div>
                    <div style={styles.statLabel}>Drafts</div>
                  </div>
                  <div style={styles.statBox}>
                    <div style={styles.statValue}>{stats.postsCount}</div>
                    <div style={styles.statLabel}>Posts</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Card */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>
                  <Activity size={20} />
                  Recent Activity
                </h2>
                <p style={styles.cardDescription}>
                  Your latest actions and updates
                </p>
              </div>
              <div style={styles.cardContent}>
                {stats.recentActivity.length === 0 ? (
                  <div style={styles.chartPlaceholder}>
                    <Activity size={32} color={c.ink} style={{ opacity: 0.3 }} />
                    <span style={styles.placeholderText}>No recent activity</span>
                  </div>
                ) : (
                  <div style={styles.activityList}>
                    {stats.recentActivity.map((activity) => (
                      <div key={activity.id} style={styles.activityItem}>
                        <div style={styles.activityIcon}>
                          <Activity size={18} color={c.ink} />
                        </div>
                        <div style={styles.activityContent}>
                          <div style={styles.activityTitle}>{activity.title}</div>
                          <div style={styles.activityDesc}>{activity.description}</div>
                          <div style={styles.activityTime}>
                            {new Date(activity.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Revenue Chart Placeholder */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>
                  <DollarSign size={20} />
                  Revenue Overview
                </h2>
                <p style={styles.cardDescription}>
                  Earnings from completed tasks and services
                </p>
              </div>
              <div style={styles.cardContent}>
                <div style={styles.chartPlaceholder}>
                  <BarChart3 size={48} color={c.ink} style={{ opacity: 0.2 }} />
                  <span style={styles.placeholderText}>
                    Revenue tracking coming soon
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
