'use client';

import { useOWSDaemon } from '@/hooks/useOWSDaemon';
import { formatReputation, type ReputationTier } from '@/lib/ows/reputation-policy';

interface AgentWalletListProps {
  masterWallet: string | null;
  activeWalletId: string | null;
  onSelectWallet: (walletId: string | null) => void;
}

/**
 * AgentWalletList - GRA-225d
 * 
 * Displays list of agent wallets with their reputation scores
 * and derived policies.
 */
export function AgentWalletList({
  masterWallet,
  activeWalletId,
  onSelectWallet,
}: AgentWalletListProps) {
  const { wallets, loading, error } = useOWSDaemon();

  if (!masterWallet) {
    return (
      <div style={cardStyle}>
        <p style={{ fontSize: '14px', color: '#666' }}>
          Connect wallet to view agent wallets
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={cardStyle}>
        <p style={{ fontSize: '14px', color: '#666' }}>Loading wallets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={cardStyle}>
        <p style={{ fontSize: '14px', color: '#dc2626' }}>{error}</p>
      </div>
    );
  }

  // Mock reputation data - in real implementation, this would come from API
  const walletsWithReputation = wallets.map((w) => ({
    ...w,
    reputationScore: Math.floor(Math.random() * 40) + 30, // Mock: 30-70 range
    completedTasks: Math.floor(Math.random() * 50),
  }));

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#16161A', margin: 0 }}>
          Agent Wallets
        </h3>
        <span style={{ fontSize: '12px', color: '#666' }}>
          {walletsWithReputation.length} wallets
        </span>
      </div>

      {walletsWithReputation.length === 0 ? (
        <p style={{ fontSize: '14px', color: '#666' }}>No agent wallets created yet</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {walletsWithReputation.map((wallet) => {
            const formatted = formatReputation(wallet.reputationScore);
            const isActive = wallet.id === activeWalletId;

            return (
              <button
                key={wallet.id}
                onClick={() => onSelectWallet(wallet.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  background: isActive ? '#C6BBFF' : '#F3F3F8',
                  border: `1.5px solid ${isActive ? '#16161A' : '#E5E5E5'}`,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                {/* Tier Emoji */}
                <span style={{ fontSize: '24px' }}>{formatted.emoji}</span>

                {/* Wallet Info */}
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#16161A',
                      margin: '0 0 2px 0',
                    }}
                  >
                    {wallet.name}
                  </p>
                  <p
                    style={{
                      fontSize: '11px',
                      color: '#666',
                      margin: 0,
                      fontFamily: 'monospace',
                    }}
                  >
                    {wallet.solanaAddress?.slice(0, 8)}...
                    {wallet.solanaAddress?.slice(-4)}
                  </p>
                </div>

                {/* Reputation */}
                <div style={{ textAlign: 'right' }}>
                  <p
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: formatted.color,
                      margin: '0 0 2px 0',
                    }}
                  >
                    {wallet.reputationScore}
                  </p>
                  <p style={{ fontSize: '10px', color: '#666', margin: 0 }}>
                    {wallet.completedTasks} tasks
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid #E5E5E5',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <TierLegend emoji="💎" label="Platinum (81-100)" color="#E5E4E2" />
        <TierLegend emoji="🥇" label="Gold (51-80)" color="#FFD700" />
        <TierLegend emoji="🥈" label="Silver (31-50)" color="#C0C0C0" />
        <TierLegend emoji="🥉" label="Bronze (0-30)" color="#CD7F32" />
      </div>
    </div>
  );
}

function TierLegend({
  emoji,
  label,
  color,
}: {
  emoji: string;
  label: string;
  color: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ fontSize: '12px' }}>{emoji}</span>
      <span style={{ fontSize: '10px', color: '#666' }}>{label}</span>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: '16px',
  padding: '20px',
  border: '1.5px solid #16161A',
};
