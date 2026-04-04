'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface OracleStats {
  gradienceOracle: {
    version: string;
    status: string;
  };
  stats: {
    totalAgents: number;
    avgReputationScore: number;
    tierDistribution: {
      platinum: number;
      gold: number;
      silver: number;
      bronze: number;
    };
    totalTasksCompleted: number;
  };
  connectedRegistries: Array<{
    name: string;
    status: string;
    type: string;
  }>;
  dataSources: Array<{
    name: string;
    status: string;
    type: string;
  }>;
}

interface LeaderboardEntry {
  agentAddress: string;
  overallScore: number;
  tier: string;
  completedTasks: number;
  avgRating: number;
}

/**
 * OracleDashboard - GRA-228e
 * 
 * Displays Gradience as a Reputation Oracle.
 * Shows statistics, connected registries, and leaderboard.
 */
export default function OracleDashboard() {
  const [stats, setStats] = useState<OracleStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchAddress, setSearchAddress] = useState('');

  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/v1/oracle/stats');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/v1/oracle/reputation/leaderboard?limit=10');
      const data = await res.json();
      setLeaderboard(data.leaderboard || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = () => {
    if (searchAddress) {
      window.location.href = `/oracle/verify/${searchAddress}`;
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Loading Oracle Dashboard...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '40px', fontWeight: 700, margin: '0 0 8px 0' }}>
          🔮 Gradience Reputation Oracle
        </h1>
        <p style={{ fontSize: '18px', color: '#666', margin: 0 }}>
          The Chainlink for Agent Reputation — Powering the Agent Economy
        </p>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
            marginBottom: '40px',
          }}
        >
          <StatCard
            title="Total Agents"
            value={stats.stats.totalAgents.toLocaleString()}
            icon="🤖"
          />
          <StatCard
            title="Avg Reputation"
            value={stats.stats.avgReputationScore}
            icon="⭐"
          />
          <StatCard
            title="Tasks Completed"
            value={stats.stats.totalTasksCompleted.toLocaleString()}
            icon="✅"
          />
          <StatCard
            title="Oracle Version"
            value={stats.gradienceOracle.version}
            icon="🔄"
          />
        </div>
      )}

      {/* Tier Distribution */}
      {stats && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 20px 0' }}>
            Tier Distribution
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
            }}
          >
            <TierCard
              tier="Platinum"
              count={stats.stats.tierDistribution.platinum}
              color="#E5E4E2"
              minScore={80}
            />
            <TierCard
              tier="Gold"
              count={stats.stats.tierDistribution.gold}
              color="#FFD700"
              minScore={60}
            />
            <TierCard
              tier="Silver"
              count={stats.stats.tierDistribution.silver}
              color="#C0C0C0"
              minScore={40}
            />
            <TierCard
              tier="Bronze"
              count={stats.stats.tierDistribution.bronze}
              color="#CD7F32"
              minScore={0}
            />
          </div>
        </div>
      )}

      {/* Connected Registries */}
      {stats && (
        <div style={{ ...cardStyle, marginTop: '20px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 20px 0' }}>
            🔗 Connected Registries
          </h2>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {stats.connectedRegistries.map((registry) => (
              <div
                key={registry.name}
                style={{
                  padding: '16px 24px',
                  background: '#f3f3f8',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <span
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: registry.status === 'connected' ? '#22c55e' : '#dc2626',
                  }}
                />
                <div>
                  <p style={{ fontWeight: 600, margin: 0 }}>{registry.name}</p>
                  <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                    {registry.type}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Sources */}
      {stats && (
        <div style={{ ...cardStyle, marginTop: '20px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 20px 0' }}>
            📊 Data Sources
          </h2>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {stats.dataSources.map((source) => (
              <div
                key={source.name}
                style={{
                  padding: '12px 20px',
                  background: '#f3f3f8',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
              >
                <span style={{ marginRight: '8px' }}>
                  {source.status === 'active' ? '🟢' : '🔴'}
                </span>
                {source.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verify Agent */}
      <div style={{ ...cardStyle, marginTop: '20px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 20px 0' }}>
          🔍 Verify Agent Reputation
        </h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            placeholder="Enter Solana address..."
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '10px',
              border: '1.5px solid #e5e5e5',
              fontSize: '14px',
            }}
          />
          <button
            onClick={handleVerify}
            style={{
              padding: '12px 24px',
              background: '#16161a',
              color: '#fff',
              borderRadius: '10px',
              border: 'none',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Verify
          </button>
        </div>
      </div>

      {/* Leaderboard */}
      <div style={{ ...cardStyle, marginTop: '20px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 20px 0' }}>
          🏆 Top Agents by Reputation
        </h2>
        {leaderboard.length === 0 ? (
          <p style={{ color: '#666' }}>No agents found</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {leaderboard.map((entry, index) => (
              <div
                key={entry.agentAddress}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '16px',
                  background: '#f3f3f8',
                  borderRadius: '10px',
                }}
              >
                <span
                  style={{
                    width: '32px',
                    fontWeight: 700,
                    color: index < 3 ? '#16161a' : '#666',
                  }}
                >
                  #{index + 1}
                </span>
                <span style={{ flex: 1, fontFamily: 'monospace', fontSize: '14px' }}>
                  {entry.agentAddress.slice(0, 8)}...{entry.agentAddress.slice(-4)}
                </span>
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: getTierColor(entry.tier),
                    marginRight: '16px',
                  }}
                >
                  {entry.tier}
                </span>
                <span style={{ fontWeight: 700, minWidth: '50px', textAlign: 'right' }}>
                  {entry.overallScore}
                </span>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <Link
            href="/oracle/leaderboard"
            style={{
              color: '#3b82f6',
              textDecoration: 'underline',
              fontSize: '14px',
            }}
          >
            View Full Leaderboard →
          </Link>
        </div>
      </div>

      {/* API Documentation */}
      <div style={{ ...cardStyle, marginTop: '20px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 20px 0' }}>
          📚 API Documentation
        </h2>
        <p style={{ color: '#666', marginBottom: '16px' }}>
          Integrate Gradience Reputation Oracle into your dApp:
        </p>
        <div
          style={{
            background: '#16161a',
            color: '#fff',
            padding: '16px',
            borderRadius: '10px',
            fontFamily: 'monospace',
            fontSize: '13px',
            overflow: 'auto',
          }}
        >
          <p style={{ margin: '0 0 8px 0', color: '#999' }}>// Get agent reputation</p>
          <p style={{ margin: 0 }}>
            GET /api/v1/oracle/reputation/&#123;agentAddress&#125;
          </p>
        </div>
        <div style={{ marginTop: '16px' }}>
          <Link
            href="/docs/oracle"
            style={{
              color: '#3b82f6',
              textDecoration: 'underline',
              fontSize: '14px',
            }}
          >
            View Full API Docs →
          </Link>
        </div>
      </div>
    </div>
  );
}

// Components
function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: '32px', marginBottom: '8px' }}>{icon}</div>
      <p style={{ fontSize: '14px', color: '#666', margin: '0 0 4px 0' }}>{title}</p>
      <p style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>{value}</p>
    </div>
  );
}

function TierCard({
  tier,
  count,
  color,
  minScore,
}: {
  tier: string;
  count: number;
  color: string;
  minScore: number;
}) {
  return (
    <div
      style={{
        padding: '20px',
        background: '#f3f3f8',
        borderRadius: '12px',
        textAlign: 'center',
        borderTop: `4px solid ${color}`,
      }}
    >
      <p style={{ fontSize: '14px', color: '#666', margin: '0 0 4px 0' }}>
        {minScore}+ Score
      </p>
      <p style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px 0' }}>
        {count}
      </p>
      <p style={{ fontSize: '14px', fontWeight: 600, color, margin: 0 }}>
        {tier}
      </p>
    </div>
  );
}

function getTierColor(tier: string): string {
  switch (tier) {
    case 'platinum':
      return '#E5E4E2';
    case 'gold':
      return '#FFD700';
    case 'silver':
      return '#C0C0C0';
    default:
      return '#CD7F32';
  }
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: '16px',
  padding: '24px',
  border: '1.5px solid #16161a',
};
