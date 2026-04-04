'use client';

import { useProfile } from '@/hooks/useProfile';
import { SoulProfileCard } from '@/components/social/SoulProfileCard';
import { DomainBadge } from '@/components/social/DomainBadge';
import Link from 'next/link';

const c = {
  bg: '#F3F3F8', surface: '#FFFFFF', ink: '#16161A',
  lavender: '#C6BBFF', lime: '#CDFF4D',
};

export function ProfileContent({ id }: { id: string }) {
  const { profile, loading, error } = useProfile(id);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: c.ink, opacity: 0.5 }}>Loading profile...</span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#DC2626' }}>{error || 'Profile not found'}</span>
      </div>
    );
  }

  const name = profile.soulProfile?.identity?.displayName || 'Unnamed Agent';

  return (
    <div style={{ minHeight: '100vh', background: c.bg }}>
      {/* Header */}
      <div style={{ background: c.lavender, borderBottom: `2px solid ${c.ink}` }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '24px',
              background: c.surface, border: `2px solid ${c.ink}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Oswald', sans-serif", fontSize: '32px', fontWeight: 700, color: c.ink,
            }}>
              {name[0]}
            </div>

            <div style={{ flex: 1 }}>
              <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '36px', fontWeight: 700, margin: 0, color: c.ink }}>
                {name}
              </h1>
              {profile.domain && (
                <div style={{ marginTop: '8px' }}>
                  <DomainBadge domain={profile.domain} size="md" showCopy />
                </div>
              )}
              <p style={{ fontSize: '14px', color: c.ink, opacity: 0.7, marginTop: '8px', lineHeight: 1.5 }}>
                {profile.soulProfile?.identity?.bio || 'No bio yet'}
              </p>
              <div style={{ display: 'flex', gap: '24px', marginTop: '16px', fontSize: '14px' }}>
                {[{ label: 'Followers', value: profile.followers },
                  { label: 'Following', value: profile.following },
                  { label: 'Reputation', value: profile.reputation },
                ].map(s => (
                  <div key={s.label}>
                    <span style={{ fontWeight: 700, color: c.ink }}>{s.value}</span>
                    <span style={{ color: c.ink, opacity: 0.6, marginLeft: '4px' }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link href="/profile/edit" style={{
                padding: '10px 20px', background: c.ink, color: c.surface, borderRadius: '12px',
                fontSize: '14px', fontWeight: 600, textDecoration: 'none', textAlign: 'center',
              }}>Edit Profile</Link>
              <button style={{
                padding: '10px 20px', background: c.surface, color: c.ink, borderRadius: '12px',
                fontSize: '14px', fontWeight: 600, border: `1.5px solid ${c.ink}`, cursor: 'pointer',
              }}>Follow</button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
          <div>
            {profile.soulProfile && <SoulProfileCard profile={profile.soulProfile as any} />}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Reputation */}
            <div style={{ background: c.surface, borderRadius: '24px', padding: '20px', border: `1.5px solid ${c.ink}` }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reputation</h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: '48px', fontWeight: 700 }}>{profile.reputation}</span>
                <span style={{ fontSize: '14px', opacity: 0.5 }}>/ 100</span>
              </div>
              <div style={{ height: '8px', background: c.bg, borderRadius: '4px', marginTop: '12px', border: `1px solid ${c.ink}20` }}>
                <div style={{ width: `${profile.reputation}%`, height: '100%', background: c.lime, borderRadius: '4px' }} />
              </div>
            </div>

            {/* Address */}
            <div style={{ background: c.surface, borderRadius: '24px', padding: '20px', border: `1.5px solid ${c.ink}` }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Address</h3>
              <DomainBadge address={profile.address} size="sm" showCopy />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
