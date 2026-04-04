'use client';

/**
 * TierProgressionBar Component
 *
 * Visualizes reputation tier progression showing current position
 * and upgrade path to next tier.
 *
 * @module components/wallet/reputation/TierProgressionBar
 */

import type { ReputationTier } from '@/types/reputation-wallet';
import { getReputationTier, getTierConfig, COLORS } from '@/types/reputation-wallet';

// ============================================================================
// Props
// ============================================================================

export interface TierProgressionBarProps {
  /** Current reputation score (0-100) */
  score: number;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Tier progression bar showing current position and upgrade path
 */
export function TierProgressionBar({ score }: TierProgressionBarProps) {
  const tiers: { name: ReputationTier; threshold: number }[] = [
    { name: 'bronze', threshold: 0 },
    { name: 'silver', threshold: 31 },
    { name: 'gold', threshold: 51 },
    { name: 'platinum', threshold: 81 },
  ];

  const currentTier = getReputationTier(score);
  const currentTierIndex = tiers.findIndex((t) => t.name === currentTier);
  const nextTier = currentTierIndex < tiers.length - 1 ? tiers[currentTierIndex + 1] : null;

  const progressInTier = nextTier
    ? ((score - tiers[currentTierIndex].threshold) /
        (nextTier.threshold - tiers[currentTierIndex].threshold)) *
      100
    : 100;

  const tierConfig = getTierConfig(currentTier);

  return (
    <div
      style={{
        background: `${COLORS.ink}08`,
        borderRadius: '12px',
        padding: '16px',
        border: `1px solid ${COLORS.ink}20`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <h4 style={{ fontSize: '14px', fontWeight: 500, color: COLORS.ink, opacity: 0.8, margin: 0 }}>
          Tier Progress
        </h4>
        {nextTier && (
          <span style={{ fontSize: '12px', color: COLORS.ink, opacity: 0.5 }}>
            {nextTier.threshold - score} points to {nextTier.name}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div
        style={{
          position: 'relative',
          height: '8px',
          background: `${COLORS.ink}15`,
          borderRadius: '9999px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '0',
            width: `${progressInTier}%`,
            background: tierConfig.progressColor,
            borderRadius: '9999px',
            transition: 'all 0.3s ease',
          }}
        />
      </div>

      {/* Tier markers */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
        {tiers.map((tier) => {
          const config = getTierConfig(tier.name);
          const isActive = score >= tier.threshold;
          const isCurrent = tier.name === currentTier;

          return (
            <div
              key={tier.name}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                opacity: isActive ? 1 : 0.5,
              }}
            >
              <span style={{ fontSize: '16px' }}>{config.icon}</span>
              <span
                style={{
                  fontSize: '12px',
                  color: isCurrent ? config.color : `${COLORS.ink}60`,
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                {tier.threshold}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TierProgressionBar;
