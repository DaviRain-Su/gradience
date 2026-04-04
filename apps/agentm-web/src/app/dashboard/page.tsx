"use client";

import React from "react";
import { DynamicDashboard } from "@/components/dashboard/DynamicDashboard";
import { useDashboard } from "@/hooks/useDashboard";
import { useDaemonConnection } from "@/lib/connection/useDaemonConnection";
import { Users, FileText, Award, Activity, RefreshCw, Wallet } from "lucide-react";

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
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  } as React.CSSProperties,
  metricValue: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: '28px',
    fontWeight: 700,
    color: c.ink,
    margin: '4px 0 0 0',
  },
  dashboardCard: {
    background: c.surface,
    border: `1.5px solid ${c.ink}`,
    borderRadius: '16px',
    overflow: 'hidden',
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
  guideGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '16px',
    marginTop: '24px',
  },
  guideCard: {
    background: c.surface,
    border: `1.5px solid ${c.ink}`,
    borderRadius: '16px',
    overflow: 'hidden',
  },
  guideList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  guideItem: {
    padding: '10px 0',
    fontSize: '14px',
    color: c.ink,
    opacity: 0.7,
    borderBottom: `1px solid ${c.bg}`,
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
};

export default function DashboardPage() {
  const { walletAddress } = useDaemonConnection();
  const { stats, loading, error, refresh } = useDashboard();

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div>
            <h1 style={styles.title}>Dashboard</h1>
            <p style={styles.subtitle}>
              Overview of your AgentM activity and metrics
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
              Connect your wallet to view your dashboard metrics, profiles, and social activity
            </p>
          </div>
        ) : loading ? (
          <div style={styles.loadingState}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginRight: '12px' }} />
            Loading dashboard data...
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
              {/* Profiles */}
              <div style={styles.metricCard}>
                <div style={styles.metricIcon}>
                  <FileText size={24} color={c.ink} />
                </div>
                <div>
                  <div style={styles.metricLabel}>Total Profiles</div>
                  <h3 style={styles.metricValue}>{stats.totalProfiles}</h3>
                </div>
              </div>

              {/* Published */}
              <div style={styles.metricCard}>
                <div style={styles.metricIcon}>
                  <Award size={24} color={c.ink} />
                </div>
                <div>
                  <div style={styles.metricLabel}>Published</div>
                  <h3 style={styles.metricValue}>{stats.publishedProfiles}</h3>
                </div>
              </div>

              {/* Followers */}
              <div style={styles.metricCard}>
                <div style={styles.metricIcon}>
                  <Users size={24} color={c.ink} />
                </div>
                <div>
                  <div style={styles.metricLabel}>Followers</div>
                  <h3 style={styles.metricValue}>{stats.followersCount}</h3>
                </div>
              </div>

              {/* Following */}
              <div style={styles.metricCard}>
                <div style={styles.metricIcon}>
                  <Activity size={24} color={c.ink} />
                </div>
                <div>
                  <div style={styles.metricLabel}>Following</div>
                  <h3 style={styles.metricValue}>{stats.followingCount}</h3>
                </div>
              </div>
            </div>

            {/* Dynamic Dashboard */}
            <div style={styles.dashboardCard}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>
                  <Activity size={20} />
                  Data Query
                </h2>
                <p style={styles.cardDescription}>
                  Enter a query to get a custom data view
                </p>
              </div>
              <div style={styles.cardContent}>
                <DynamicDashboard stats={stats} />
              </div>
            </div>

            {/* Guide Cards */}
            <div style={styles.guideGrid}>
              <div style={styles.guideCard}>
                <div style={styles.cardHeader}>
                  <h3 style={{ ...styles.cardTitle, fontSize: '16px' }}>Quick Stats</h3>
                </div>
                <div style={styles.cardContent}>
                  <ul style={styles.guideList}>
                    <li style={styles.guideItem}>
                      <strong>Reputation Score:</strong> {stats.reputationScore > 0 ? stats.reputationScore.toFixed(1) : 'N/A'}
                    </li>
                    <li style={styles.guideItem}>
                      <strong>Draft Profiles:</strong> {stats.draftProfiles}
                    </li>
                    <li style={styles.guideItem}>
                      <strong>Posts:</strong> {stats.postsCount}
                    </li>
                    <li style={{ ...styles.guideItem, borderBottom: 'none' }}>
                      <strong>Wallet:</strong> {walletAddress?.slice(0, 8)}...{walletAddress?.slice(-4)}
                    </li>
                  </ul>
                </div>
              </div>

              <div style={styles.guideCard}>
                <div style={styles.cardHeader}>
                  <h3 style={{ ...styles.cardTitle, fontSize: '16px' }}>Recent Activity</h3>
                </div>
                <div style={styles.cardContent}>
                  {stats.recentActivity.length === 0 ? (
                    <p style={{ fontSize: '14px', color: c.ink, opacity: 0.5 }}>
                      No recent activity
                    </p>
                  ) : (
                    <ul style={styles.guideList}>
                      {stats.recentActivity.map((activity, index) => (
                        <li
                          key={activity.id}
                          style={{
                            ...styles.guideItem,
                            borderBottom: index === stats.recentActivity.length - 1 ? 'none' : styles.guideItem.borderBottom,
                          }}
                        >
                          <strong>{activity.title}:</strong> {activity.description}
                          <div style={{ fontSize: '12px', opacity: 0.5, marginTop: '4px' }}>
                            {new Date(activity.timestamp).toLocaleDateString()}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
