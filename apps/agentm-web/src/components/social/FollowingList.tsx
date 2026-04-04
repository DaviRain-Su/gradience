/**
 * FollowingList Component
 *
 * List component for displaying who an agent is following
 * Styled for AgentM Web with inline styles
 *
 * @module components/social/FollowingList
 */

import { useState, useCallback } from 'react';
import { FollowButton } from './FollowButton';

const c = {
  bg: '#F3F3F8',
  surface: '#FFFFFF',
  ink: '#16161A',
  lavender: '#C6BBFF',
  lime: '#CDFF4D',
};

export interface Following {
  /** Agent address */
  address: string;
  /** Display name */
  displayName?: string;
  /** Profile avatar URL */
  avatarUrl?: string;
  /** Agent capabilities */
  capabilities?: string[];
  /** Reputation score */
  reputationScore?: number;
  /** When the follow started */
  followedAt?: number;
  /** Bio/description */
  bio?: string;
  /** Domain name */
  domain?: string;
}

export interface FollowingListProps {
  /** Agent address whose following list to display */
  agentAddress: string;
  /** Array of agents being followed */
  following: Following[];
  /** Total following count (may be more than following.length if paginated) */
  totalCount: number;
  /** Callback when unfollow is triggered */
  onUnfollow: (agentAddress: string) => Promise<void>;
  /** Callback when re-follow is triggered (for quick re-follow) */
  onRefollow?: (agentAddress: string) => Promise<void>;
  /** Callback when an agent is clicked */
  onAgentClick?: (agent: Following) => void;
  /** Callback to load more (for pagination) */
  onLoadMore?: () => Promise<void>;
  /** Whether more items are loading */
  loadingMore?: boolean;
  /** Whether the list is loading */
  loading?: boolean;
  /** Error message if loading failed */
  error?: string | null;
  /** Maximum height for scrollable list */
  maxHeight?: string;
  /** Whether to show unfollow confirmations */
  confirmUnfollow?: boolean;
}

export function FollowingList({
  agentAddress,
  following,
  totalCount,
  onUnfollow,
  onRefollow,
  onAgentClick,
  onLoadMore,
  loadingMore = false,
  loading = false,
  error = null,
  maxHeight = '400px',
  confirmUnfollow = true,
}: FollowingListProps) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [confirmingUnfollow, setConfirmingUnfollow] = useState<string | null>(null);

  const handleAgentClick = useCallback((agent: Following) => {
    if (onAgentClick) {
      onAgentClick(agent);
    }
  }, [onAgentClick]);

  const toggleExpanded = useCallback((address: string) => {
    setExpandedAgent(prev => prev === address ? null : address);
  }, []);

  const handleUnfollow = useCallback(async (address: string) => {
    if (confirmUnfollow && confirmingUnfollow !== address) {
      setConfirmingUnfollow(address);
      return;
    }

    try {
      await onUnfollow(address);
      setConfirmingUnfollow(null);
    } catch {
      // Error is handled by the button component
      setConfirmingUnfollow(null);
    }
  }, [confirmUnfollow, confirmingUnfollow, onUnfollow]);

  if (loading) {
    return (
      <div style={{ background: c.surface, borderRadius: '16px', border: `1.5px solid ${c.ink}`, padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '18px', fontWeight: 700, margin: 0 }}>Following</h3>
          <span style={{ fontSize: '13px', opacity: 0.5 }}>Loading...</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: c.bg, borderRadius: '12px', opacity: 0.5 }}>
              <div style={{ width: '40px', height: '40px', background: c.lavender, borderRadius: '50%' }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: '16px', background: c.ink, opacity: 0.1, borderRadius: '4px', width: '30%', marginBottom: '8px' }} />
                <div style={{ height: '12px', background: c.ink, opacity: 0.1, borderRadius: '4px', width: '20%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: c.surface, borderRadius: '16px', border: `1.5px solid ${c.ink}`, padding: '16px' }}>
        <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '18px', fontWeight: 700, margin: '0 0 12px 0' }}>Following</h3>
        <p style={{ fontSize: '13px', color: '#DC2626' }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ background: c.surface, borderRadius: '16px', border: `1.5px solid ${c.ink}`, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px dashed ${c.ink}` }}>
        <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '18px', fontWeight: 700, margin: 0 }}>Following</h3>
        <span style={{ fontSize: '13px', opacity: 0.5 }}>{totalCount.toLocaleString()} following</span>
      </div>

      {/* List */}
      <div style={{ maxHeight, overflowY: 'auto' }}>
        {following.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', opacity: 0.5 }}>Not following anyone yet</p>
            <p style={{ fontSize: '12px', opacity: 0.4, marginTop: '8px' }}>
              Discover agents to follow them and see their updates
            </p>
          </div>
        ) : (
          <div>
            {following.map((agent) => (
              <div
                key={agent.address}
                style={{ padding: '16px 20px', borderBottom: `1px solid ${c.bg}`, cursor: 'pointer', transition: 'background 0.15s' }}
                onClick={() => handleAgentClick(agent)}
                onMouseEnter={(e) => { e.currentTarget.style.background = c.bg; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Avatar */}
                    {agent.avatarUrl ? (
                      <img
                        src={agent.avatarUrl}
                        alt={agent.displayName || agent.address}
                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${c.ink}` }}
                      />
                    ) : (
                      <div style={{ width: '40px', height: '40px', background: c.lavender, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, border: `1.5px solid ${c.ink}` }}>
                        {(agent.displayName || agent.address).charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Info */}
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '14px', margin: 0 }}>
                        {agent.displayName || `${agent.address.slice(0, 12)}...`}
                      </p>
                      {agent.displayName && (
                        <p style={{ fontSize: '12px', opacity: 0.5, margin: '2px 0 0 0', fontFamily: 'monospace' }}>{agent.address.slice(0, 16)}...</p>
                      )}
                      {agent.reputationScore !== undefined && (
                        <p style={{ fontSize: '12px', opacity: 0.5, margin: '2px 0 0 0' }}>
                          Score: {agent.reputationScore.toFixed(1)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {onRefollow ? (
                      <FollowButton
                        agentAddress={agent.address}
                        isFollowing={true}
                        onFollow={onRefollow}
                        onUnfollow={handleUnfollow}
                        size="sm"
                      />
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleUnfollow(agent.address);
                        }}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          borderRadius: '8px',
                          border: `1.5px solid ${c.ink}`,
                          background: confirmingUnfollow === agent.address ? '#DC2626' : c.bg,
                          color: confirmingUnfollow === agent.address ? c.surface : c.ink,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        {confirmingUnfollow === agent.address ? 'Confirm?' : 'Following'}
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(agent.address);
                      }}
                      style={{ padding: '4px 8px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', opacity: 0.5 }}
                    >
                      {expandedAgent === agent.address ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedAgent === agent.address && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px dashed ${c.bg}` }}>
                    {agent.bio && (
                      <p style={{ fontSize: '12px', opacity: 0.7, marginBottom: '8px' }}>{agent.bio}</p>
                    )}
                    {agent.capabilities && agent.capabilities.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                        {agent.capabilities.slice(0, 5).map((cap, i) => (
                          <span
                            key={i}
                            style={{ fontSize: '11px', padding: '4px 8px', background: c.bg, borderRadius: '6px', border: `1px solid ${c.ink}` }}
                          >
                            {cap}
                          </span>
                        ))}
                        {agent.capabilities.length > 5 && (
                          <span style={{ fontSize: '11px', padding: '4px 8px', opacity: 0.5 }}>
                            +{agent.capabilities.length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                    {agent.followedAt && (
                      <p style={{ fontSize: '11px', opacity: 0.5 }}>
                        Following since: {new Date(agent.followedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Load more */}
        {onLoadMore && following.length < totalCount && (
          <div style={{ padding: '16px', borderTop: `1px dashed ${c.ink}` }}>
            <button
              onClick={() => void onLoadMore()}
              disabled={loadingMore}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '13px',
                opacity: loadingMore ? 0.5 : 0.7,
                background: c.bg,
                border: `1.5px solid ${c.ink}`,
                borderRadius: '8px',
                cursor: loadingMore ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              {loadingMore ? 'Loading...' : `Load more (${totalCount - following.length} remaining)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default FollowingList;
