'use client';

import { useMyProfile, useUpdateSoulProfile } from '@/hooks/useProfile';
import { SoulProfileEditor } from '@/components/social/SoulProfileEditor';
import { DomainInput } from '@/components/social/DomainInput';
import Link from 'next/link';
import { useState } from 'react';

const c = {
  bg: '#F3F3F8', surface: '#FFFFFF', ink: '#16161A',
  lavender: '#C6BBFF', lime: '#CDFF4D',
};

export default function EditProfilePage() {
  const { profile, loading: profileLoading } = useMyProfile();
  const { updateSoulProfile, updating } = useUpdateSoulProfile();
  const [domain, setDomain] = useState(profile?.domain || '');

  if (profileLoading) {
    return (
      <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: c.ink, opacity: 0.5 }}>Loading...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#DC2626' }}>Profile not found</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: c.bg }}>
      {/* Header */}
      <div style={{ borderBottom: `1.5px solid ${c.ink}`, background: c.surface }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '24px', fontWeight: 700, margin: 0, color: c.ink }}>Edit Profile</h1>
          <Link href={`/profile/${profile.address}`} style={{ color: c.ink, opacity: 0.6, textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>Cancel</Link>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Domain */}
        <div style={{ background: c.surface, borderRadius: '24px', padding: '24px', border: `1.5px solid ${c.ink}` }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: c.ink, marginBottom: '8px' }}>Domain</h2>
          <p style={{ fontSize: '13px', color: c.ink, opacity: 0.6, marginBottom: '16px' }}>Link your .sol or .eth domain to your profile</p>
          <DomainInput value={domain} onChange={setDomain} placeholder="yourname.sol" showValidation autoResolve />
        </div>

        {/* Soul Profile */}
        <div style={{ background: c.surface, borderRadius: '24px', padding: '24px', border: `1.5px solid ${c.ink}` }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: c.ink, marginBottom: '8px' }}>Soul Profile</h2>
          <p style={{ fontSize: '13px', color: c.ink, opacity: 0.6, marginBottom: '16px' }}>Define your personality, values, and preferences</p>
          <SoulProfileEditor
            initialProfile={profile.soulProfile as any}
            onSave={updateSoulProfile}
            onCancel={() => window.history.back()}
          />
        </div>

        {updating && (
          <div style={{ textAlign: 'center', color: c.lavender, fontWeight: 600, fontSize: '14px' }}>Saving changes...</div>
        )}
      </div>
    </div>
  );
}
