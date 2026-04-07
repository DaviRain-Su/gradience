'use client';

import { useMyProfile, useUpdateSoulProfile } from '@/hooks/useProfile';
import { useAgentProfiles } from '@/hooks/useAgentProfiles';
import { SoulProfileEditor } from '@/components/social/SoulProfileEditor';
import { ProfileForm } from '@/components/profile';
import { DomainInput } from '@/components/social/DomainInput';
import Link from 'next/link';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useState, useEffect } from 'react';
import { createAgentEVM, isUserRegisteredEVM, registerUserEVM } from '@/lib/evm/agent-registry';
import type { ProfileDraft } from '@/types/profile';

const c = {
  bg: '#F3F3F8',
  surface: '#FFFFFF',
  ink: '#16161A',
  lavender: '#C6BBFF',
  lime: '#CDFF4D',
};

type EditSection = 'domain' | 'soul' | 'agent';

function EVMProfileRegistrationCard({
  domain,
  displayName,
  bio,
  onRegistered,
}: {
  domain: string;
  displayName: string;
  bio?: string;
  onRegistered?: () => void;
}) {
  const { primaryWallet } = useDynamicContext();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState<boolean | null>(null);

  useEffect(() => {
    if (!primaryWallet?.address) return;
    isUserRegisteredEVM(primaryWallet.address as `0x${string}`).then((exists) => setRegistered(exists));
  }, [primaryWallet?.address]);

  const handleRegister = async () => {
    if (!primaryWallet?.address || !username.trim()) return;
    const account = primaryWallet.address as `0x${string}`;
    const provider = (primaryWallet as any).connector;
    const metadataURI = `data:application/json;base64,${typeof btoa !== 'undefined' ? btoa(JSON.stringify({ name: displayName, bio: bio || '', domain })) : Buffer.from(JSON.stringify({ name: displayName, bio: bio || '', domain })).toString('base64')}`;
    setLoading(true);
    try {
      await registerUserEVM({
        ethereumProvider: provider,
        account,
        username: username.trim(),
        metadataURI,
        ensName: domain.endsWith('.eth') ? domain : '',
      });
      setRegistered(true);
      onRegistered?.();
    } catch (err) {
      console.error('EVM registration failed:', err);
      alert('Registration failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: `1px solid ${c.ink}` }}>
      <h3 style={{ fontSize: '16px', fontWeight: 700, color: c.ink, marginBottom: '8px' }}>EVM Profile Registration</h3>
      {registered === true ? (
        <p style={{ fontSize: '13px', color: '#10B981', fontWeight: 600 }}>✅ You are registered on EVM</p>
      ) : (
        <>
          <p style={{ fontSize: '13px', color: c.ink, opacity: 0.7, marginBottom: '12px' }}>
            Register a Gradience username on-chain so you can publish agents to EVM.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              style={{
                flex: 1,
                minWidth: '200px',
                padding: '10px 14px',
                background: c.bg,
                border: `1.5px solid ${c.ink}`,
                borderRadius: '10px',
                fontSize: '14px',
              }}
            />
            <button
              onClick={handleRegister}
              disabled={loading || username.trim().length < 3}
              style={{
                padding: '10px 20px',
                background: c.ink,
                color: c.surface,
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading || username.trim().length < 3 ? 'not-allowed' : 'pointer',
                opacity: loading || username.trim().length < 3 ? 0.6 : 1,
              }}
            >
              {loading ? 'Registering...' : 'Register on EVM'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function EditProfilePage() {
  const { profile, loading: profileLoading } = useMyProfile();
  const { updateSoulProfile, updating: soulUpdating } = useUpdateSoulProfile();
  const {
    profiles,
    loading: profilesLoading,
    createProfile,
    updateProfile,
    refreshProfiles,
  } = useAgentProfiles();
  const { primaryWallet } = useDynamicContext();
  const [domain, setDomain] = useState(profile?.domain || '');
  const [activeSection, setActiveSection] = useState<EditSection>('domain');
  const [editingAgentProfile, setEditingAgentProfile] = useState<(typeof profiles)[0] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isEvmWalletConnected =
    (primaryWallet?.chain as string | undefined)?.toLowerCase?.() === 'evm' ||
    (primaryWallet?.connector as any)?.name?.toLowerCase?.().includes('evm') ||
    false;

  useEffect(() => {
    void refreshProfiles();
  }, [refreshProfiles]);

  useEffect(() => {
    if (profile?.domain) {
      setDomain(profile.domain);
    }
  }, [profile?.domain]);

  // Auto-hide toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const loading = profileLoading || profilesLoading;

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: c.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: c.ink, opacity: 0.5 }}>Loading...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: c.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: '#DC2626' }}>Profile not found</span>
      </div>
    );
  }

  const handleAgentProfileSubmit = async (draft: ProfileDraft) => {
    setSubmitting(true);
    try {
      let onChainResult: { agentId: string; txHash: string; chain: string } | undefined;

      if (isEvmWalletConnected && primaryWallet?.address) {
        const account = primaryWallet.address as `0x${string}`;
        const provider = (primaryWallet as any).connector;
        try {
          const registered = await isUserRegisteredEVM(account);
          if (!registered) {
            setToastMessage({ type: 'error', message: 'Please register your Gradience profile on EVM first (Domain tab).' });
            setSubmitting(false);
            return;
          }
          const metadataURI = `data:application/json;base64,${typeof btoa !== 'undefined' ? btoa(JSON.stringify(draft)) : Buffer.from(JSON.stringify(draft)).toString('base64')}`;
          const { agentId, txHash } = await createAgentEVM({
            ethereumProvider: provider,
            account,
            metadataURI,
          });
          onChainResult = { agentId: agentId.toString(), txHash, chain: 'ethereum' };
        } catch (evmErr) {
          console.error('EVM publish failed:', evmErr);
          setToastMessage({ type: 'error', message: 'EVM publish failed, profile saved locally only.' });
        }
      }

      if (editingAgentProfile) {
        await updateProfile(editingAgentProfile.id, { ...draft, onChain: onChainResult });
        setToastMessage({ type: 'success', message: onChainResult ? 'Agent profile updated and published to EVM' : 'Agent profile updated successfully' });
      } else {
        await createProfile({ ...draft, onChain: onChainResult } as ProfileDraft);
        setToastMessage({ type: 'success', message: onChainResult ? 'Agent profile created and published to EVM' : 'Agent profile created successfully' });
      }
      setEditingAgentProfile(null);
      setActiveSection('domain');
    } catch {
      setToastMessage({ type: 'error', message: 'Failed to save agent profile' });
    } finally {
      setSubmitting(false);
    }
  };

  const sectionButtonStyle = (section: EditSection): React.CSSProperties => ({
    padding: '12px 20px',
    background: activeSection === section ? c.ink : 'transparent',
    color: activeSection === section ? c.surface : c.ink,
    border: `1.5px solid ${c.ink}`,
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  });

  return (
    <div style={{ minHeight: '100vh', background: c.bg }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            padding: '16px 24px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 600,
            zIndex: 1000,
            animation: 'slideIn 0.3s ease',
            ...(toastMessage.type === 'success' && { background: '#10B981', color: '#FFFFFF' }),
            ...(toastMessage.type === 'error' && { background: '#DC2626', color: '#FFFFFF' }),
          }}
        >
          {toastMessage.message}
        </div>
      )}

      {/* Header */}
      <div style={{ borderBottom: `1.5px solid ${c.ink}`, background: c.surface }}>
        <div
          style={{
            maxWidth: '900px',
            margin: '0 auto',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h1
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontSize: '24px',
              fontWeight: 700,
              margin: 0,
              color: c.ink,
            }}
          >
            Edit Profile
          </h1>
          <Link
            href={`/profile/${profile.address}`}
            style={{
              color: c.ink,
              opacity: 0.6,
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            Cancel
          </Link>
        </div>
      </div>

      {/* Section Navigation */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 24px 0' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveSection('domain')} style={sectionButtonStyle('domain')}>
            Domain
          </button>
          <button onClick={() => setActiveSection('soul')} style={sectionButtonStyle('soul')}>
            Soul Profile
          </button>
          <button onClick={() => setActiveSection('agent')} style={sectionButtonStyle('agent')}>
            Agent Profiles ({profiles.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Domain Section */}
        {activeSection === 'domain' && (
          <div
            style={{
              background: c.surface,
              borderRadius: '24px',
              padding: '24px',
              border: `1.5px solid ${c.ink}`,
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: c.ink, marginBottom: '8px' }}>Domain</h2>
            <p style={{ fontSize: '13px', color: c.ink, opacity: 0.6, marginBottom: '16px' }}>
              Link your .sol or .eth domain to your profile
            </p>
            <DomainInput
              value={domain}
              onChange={setDomain}
              placeholder="yourname.sol"
              showValidation
              autoResolve
            />

            {isEvmWalletConnected && (
              <EVMProfileRegistrationCard
                domain={domain}
                displayName={profile.displayName}
                bio={profile.bio}
                onRegistered={() => setToastMessage({ type: 'success', message: 'EVM profile registered successfully' })}
              />
            )}
          </div>
        )}

        {/* Soul Profile Section */}
        {activeSection === 'soul' && (
          <div
            style={{
              background: c.surface,
              borderRadius: '24px',
              padding: '24px',
              border: `1.5px solid ${c.ink}`,
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: c.ink, marginBottom: '8px' }}>Soul Profile</h2>
            <p style={{ fontSize: '13px', color: c.ink, opacity: 0.6, marginBottom: '16px' }}>
              Define your personality, values, and preferences
            </p>
            <SoulProfileEditor
              initialProfile={profile.soulProfile as any}
              onSave={async (soulProfile) => {
                try {
                  await updateSoulProfile(soulProfile);
                  setToastMessage({ type: 'success', message: 'Soul profile updated successfully' });
                } catch {
                  setToastMessage({ type: 'error', message: 'Failed to update soul profile' });
                }
              }}
              onCancel={() => window.history.back()}
            />
          </div>
        )}

        {/* Agent Profiles Section */}
        {activeSection === 'agent' && (
          <>
            {editingAgentProfile === null && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setEditingAgentProfile({} as any)}
                  style={{
                    padding: '12px 24px',
                    background: c.ink,
                    color: c.surface,
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#2D2D33';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = c.ink;
                  }}
                >
                  Create New Agent Profile
                </button>
              </div>
            )}

            {editingAgentProfile !== null ? (
              <ProfileForm
                initialProfile={editingAgentProfile.id ? editingAgentProfile : null}
                submitting={submitting}
                onSubmit={handleAgentProfileSubmit}
                onCancel={() => setEditingAgentProfile(null)}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {profiles.length === 0 && (
                  <div
                    style={{
                      background: c.surface,
                      border: `1.5px solid ${c.ink}`,
                      borderRadius: '24px',
                      padding: '48px',
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ fontSize: '16px', color: c.ink, opacity: 0.6, margin: 0 }}>
                      No agent profiles yet. Create your first one.
                    </p>
                  </div>
                )}
                {profiles.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      background: c.surface,
                      border: `1.5px solid ${c.ink}`,
                      borderRadius: '16px',
                      padding: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '16px',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: c.ink, margin: 0, marginBottom: '4px' }}>
                        {p.name}
                      </h3>
                      <p
                        style={{
                          fontSize: '13px',
                          color: c.ink,
                          opacity: 0.6,
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.description}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            background: c.bg,
                            border: `1px solid ${c.ink}`,
                            borderRadius: '6px',
                          }}
                        >
                          v{p.version}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            background:
                              p.status === 'published'
                                ? '#ECFDF5'
                                : p.status === 'deprecated'
                                  ? '#FFFBEB'
                                  : c.bg,
                            color:
                              p.status === 'published' ? '#10B981' : p.status === 'deprecated' ? '#F59E0B' : c.ink,
                            border: `1px solid ${
                              p.status === 'published' ? '#10B981' : p.status === 'deprecated' ? '#F59E0B' : c.ink
                            }`,
                            borderRadius: '6px',
                            textTransform: 'uppercase',
                          }}
                        >
                          {p.status}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setEditingAgentProfile(p)}
                      style={{
                        padding: '8px 16px',
                        background: c.bg,
                        color: c.ink,
                        border: `1.5px solid ${c.ink}`,
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = c.lavender;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = c.bg;
                      }}
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {(soulUpdating || submitting) && (
          <div style={{ textAlign: 'center', color: c.lavender, fontWeight: 600, fontSize: '14px' }}>
            Saving changes...
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
