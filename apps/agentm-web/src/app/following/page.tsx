'use client';

import { useState } from 'react';
import { useFollowers, useFollowingList } from '@/hooks/useFollowing';
import { FollowButton } from '@/components/social/FollowButton';
import { DomainBadge } from '@/components/social/DomainBadge';
import Link from 'next/link';

const c = {
  bg: '#F3F3F8', surface: '#FFFFFF', ink: '#16161A',
  lavender: '#C6BBFF', lime: '#CDFF4D',
};

// TODO: Get from auth context
const CURRENT_USER = '0x1234...5678';

export default function FollowingPage() {
  const [activeTab, setActiveTab] = useState<'following' | 'followers'>('following');
  const { following, loading: followingLoading } = useFollowingList(CURRENT_USER);
  const { followers, loading: followersLoading } = useFollowers(CURRENT_USER);

  const loading = activeTab === 'following' ? followingLoading : followersLoading;
  const list = activeTab === 'following' ? following : followers;

  return (
    <div style={{ minHeight: '100vh', background: c.bg }}>
      {/* Header */}
      <div style={{ borderBottom: `1.5px solid ${c.ink}`, background: c.surface }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px 24px' }}>
          <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '24px', fontWeight: 700, margin: 0, color: c.ink }}>Connections</h1>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: `1.5px solid ${c.ink}`, background: c.surface }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 24px', display: 'flex', gap: '24px' }}>
          {(['following', 'followers'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '14px 0', fontSize: '14px', fontWeight: 600, background: 'none', cursor: 'pointer',
              border: 'none', borderBottom: activeTab === tab ? `2px solid ${c.ink}` : '2px solid transparent',
              color: activeTab === tab ? c.ink : `${c.ink}80`,
            }}>
              {tab === 'following' ? `Following (${following.length})` : `Followers (${followers.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: c.ink, opacity: 0.5 }}>Loading...</div>
        ) : list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: c.ink, opacity: 0.4 }}>
            {activeTab === 'following' ? 'You are not following anyone yet' : 'No followers yet'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {list.map(agent => (
              <div key={agent.address} style={{
                background: c.surface, borderRadius: '16px', padding: '16px 20px',
                border: `1.5px solid ${c.ink}`, display: 'flex', alignItems: 'center', gap: '16px',
              }}>
                <Link href={`/profile/${agent.address}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '16px',
                    background: c.lavender, border: `1.5px solid ${c.ink}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Oswald', sans-serif", fontSize: '20px', fontWeight: 700, color: c.ink,
                  }}>
                    {agent.displayName[0]}
                  </div>
                </Link>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/profile/${agent.address}`} style={{ textDecoration: 'none', color: c.ink, fontWeight: 700, fontSize: '15px' }}>
                    {agent.displayName}
                  </Link>
                  {agent.domain && <div style={{ marginTop: '4px' }}><DomainBadge domain={agent.domain} size="sm" /></div>}
                  {agent.bio && <p style={{ fontSize: '13px', color: c.ink, opacity: 0.6, marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.bio}</p>}
                </div>

                <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '16px', color: c.ink }}>{agent.reputation}</div>
                    <div style={{ fontSize: '10px', color: c.ink, opacity: 0.5, textTransform: 'uppercase' }}>Rep</div>
                  </div>
                  <FollowButton agentAddress={agent.address} isFollowing={agent.isFollowing} onFollow={async () => {}} onUnfollow={async () => {}} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
