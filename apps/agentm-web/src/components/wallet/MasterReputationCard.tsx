'use client';

import { useAggregatedReputation } from '@/hooks/useAggregatedReputation';
import { formatReputation } from '@/lib/ows/reputation-policy';

interface MasterReputationCardProps {
  masterWallet: string | null;
}

/**
 * MasterReputationCard - GRA-225d
 * 
 * Displays aggregated reputation for the master wallet,
 * including all agent wallets and their combined reputation score.
 */
export function MasterReputationCard({ masterWallet }: MasterReputationCardProps) {
  const { aggregated, loading, error } = useAggregatedReputation(masterWallet);

  if (!masterWallet) {
    return (
      <div style={cardStyle}>
        <p style={{ fontSize: '14px', color: '#666' }}>
          Connect your wallet to view reputation
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={cardStyle}>
        <p style={{ fontSize: '14px', color: '#666' }}>Loading reputation...</p>
      </div>
    );
  }

  if (error || !aggregated) {
    return (
      <div style={cardStyle}>
        <p style={{ fontSize: '14px', color: '#dc2626' }}>
          {error || 'Failed to load reputation'}
        </p>
      </div>
    );
  }

  const formatted = formatReputation(aggregated.aggregateScore);

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <span style={{ fontSize: '32px' }}>{formatted.emoji}</span>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#16161A', margin: 0 }}>
            {formatted.label}
          </h3>
          <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 0 0' }}>
            Master Wallet Reputation
          </p>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <p style={{ fontSize: '28px', fontWeight: 700, color: formatted.color, margin: 0 }}>
            {aggregated.aggregateScore}
          </p>
          <p style={{ fontSize: '11px', color: '#666', margin: 0 }}>/ 100</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        marginBottom: '16px',
      }}>
        <StatBox
          label="Agents"
          value={aggregated.agentCount}
          color="#16161A"
        />
        <StatBox
          label="Tasks Done"
          value={aggregated.totalCompletedTasks}
          color="#16161A"
        />
        <StatBox
          label="Daily Limit"
          value={`$${aggregated.derivedPolicy.dailyLimitUsd}`}
          color="#22c55e"
        />
      </div>

      {/* Permissions */}
      <div style={{ background: '#F3F3F8', borderRadius: '8px', padding: '12px' }}>
        <p style={{ fontSize: '12px', fontWeight: 600, color: '#16161A', margin: '0 0 8px 0' }}>
          Permissions
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <PermissionRow
            label="Auto-approval"
            value={aggregated.derivedPolicy.autoApprove ? 'Enabled' : 'Disabled'}
            active={aggregated.derivedPolicy.autoApprove}
          />
          <PermissionRow
            label="Allowed Chains"
            value={aggregated.derivedPolicy.allowedChains.join(', ')}
            active={true}
          />
        </div>
      </div>

      {/* Agent Breakdown */}
      {aggregated.agents.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: '#16161A', margin: '0 0 8px 0' }}>
            Agent Breakdown
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {aggregated.agents.slice(0, 3).map((agent) => {
              const agentFormatted = formatReputation(agent.score);
              return (
                <div
                  key={agent.walletId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: '#F3F3F8',
                    borderRadius: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>{agentFormatted.emoji}</span>
                    <span style={{ fontSize: '13px', color: '#16161A' }}>
                      {agent.handle}
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: agentFormatted.color }}>
                    {agent.score}
                  </span>
                </div>
              );
            })}
            {aggregated.agents.length > 3 && (
              <p style={{ fontSize: '11px', color: '#666', textAlign: 'center', margin: '4px 0 0 0' }}>
                +{aggregated.agents.length - 3} more agents
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '12px', background: '#F3F3F8', borderRadius: '8px' }}>
      <p style={{ fontSize: '18px', fontWeight: 700, color, margin: '0 0 4px 0' }}>
        {value}
      </p>
      <p style={{ fontSize: '11px', color: '#666', margin: 0 }}>{label}</p>
    </div>
  );
}

function PermissionRow({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '12px', color: '#666' }}>{label}</span>
      <span
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: active ? '#22c55e' : '#dc2626',
        }}
      >
        {value}
      </span>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: '16px',
  padding: '24px',
  border: '1.5px solid #16161A',
};
