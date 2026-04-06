'use client';

/**
 * ReputationDashboard Component
 *
 * Comprehensive dashboard showing wallet status, reputation-based limits,
 * transaction history, and reputation progression.
 *
 * @module components/wallet/ReputationDashboard
 */

import { useState, useMemo } from 'react';
import type { ReputationDashboardProps } from '@/types/reputation-wallet';
import {
  getReputationTier,
  getTierConfig,
  COLORS,
} from '@/types/reputation-wallet';

// Import sub-components
import {
  TierProgressionBar,
  SpendingMeter,
  PolicyCard,
  UpgradeBenefits,
  TransactionItem,
  ReputationHistoryChart,
  LoadingSkeleton,
} from './reputation';

export function ReputationDashboard({
  wallet,
  reputation,
  transactions = [],
  reputationHistory = [],
  currentDailySpend = 0,
  loading = false,
  error = null,
  onRefresh,
  onTransactionClick,
  className = '',
}: ReputationDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'history'>('overview');

  // Computed values
  const score = useMemo(
    () => reputation?.score ?? wallet?.reputationScore ?? 0,
    [reputation, wallet]
  );
  const tier = useMemo(() => getReputationTier(score), [score]);
  const tierConfig = useMemo(() => getTierConfig(tier), [tier]);

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          background: COLORS.surface,
          border: `1.5px solid ${COLORS.ink}20`,
          borderRadius: '20px',
          padding: '20px',
        }}
        className={className}
      >
        <LoadingSkeleton />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          background: `${COLORS.danger}10`,
          border: `1.5px solid ${COLORS.danger}40`,
          borderRadius: '20px',
          padding: '20px',
          textAlign: 'center',
        }}
        className={className}
      >
        <p style={{ color: COLORS.danger, margin: '0 0 12px' }}>{error}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            style={{
              padding: '8px 16px',
              background: COLORS.info,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // Empty state
  if (!wallet) {
    return (
      <div
        style={{
          background: COLORS.surface,
          border: `1.5px solid ${COLORS.ink}20`,
          borderRadius: '20px',
          padding: '40px',
          textAlign: 'center',
        }}
        className={className}
      >
        <p style={{ color: `${COLORS.ink}80`, margin: 0 }}>No wallet connected</p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1.5px solid ${COLORS.ink}20`,
        borderRadius: '20px',
        padding: '20px',
      }}
      className={className}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: COLORS.ink,
              margin: '0 0 4px',
            }}
          >
            Reputation Dashboard
          </h2>
          <p style={{ fontSize: '14px', color: `${COLORS.ink}80`, margin: 0 }}>
            Tier: <span style={{ color: tierConfig.color }}>{tier}</span> • Score: {score}
          </p>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: `1.5px solid ${COLORS.ink}30`,
              borderRadius: '8px',
              color: COLORS.ink,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Refresh
          </button>
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          borderBottom: `1.5px solid ${COLORS.ink}15`,
          paddingBottom: '12px',
        }}
      >
        {(['overview', 'transactions', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              background: activeTab === tab ? COLORS.info : 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: activeTab === tab ? 'white' : COLORS.ink,
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === tab ? 500 : 400,
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <TierProgressionBar score={score} />
          <SpendingMeter
            current={currentDailySpend ?? 0}
            limit={wallet?.policy?.dailyLimit ?? 0}
          />
          <PolicyCard wallet={wallet} />
          <UpgradeBenefits currentScore={score} />
        </div>
      )}

      {activeTab === 'transactions' && (
        <div>
          {transactions.length === 0 ? (
            <p style={{ color: `${COLORS.ink}60`, textAlign: 'center', padding: '40px' }}>
              No transactions yet
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {transactions.map((tx) => (
                <TransactionItem
                  key={tx.id}
                  transaction={tx}
                  onClick={() => onTransactionClick?.(tx)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          {reputationHistory.length === 0 ? (
            <p style={{ color: `${COLORS.ink}60`, textAlign: 'center', padding: '40px' }}>
              No reputation history yet
            </p>
          ) : (
            <ReputationHistoryChart history={reputationHistory} />
          )}
        </div>
      )}
    </div>
  );
}

export default ReputationDashboard;
