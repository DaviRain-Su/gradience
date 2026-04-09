'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProfileCard, VersionList } from '@/components/profile';
import { ProfileForm } from '@/components/profile';
import { useAgentProfiles } from '@/hooks/useAgentProfiles';
import type { AgentProfile, ProfileDraft } from '@/types/profile';

const c = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
};

type ViewMode = 'list' | 'create' | 'edit';

export default function ProfilesPage() {
    const {
        profiles,
        loading,
        error,
        refreshProfiles,
        createProfile,
        updateProfile,
        updateProfileStatus,
        deleteProfile,
    } = useAgentProfiles();
    const [mode, setMode] = useState<ViewMode>('list');
    const [editingProfile, setEditingProfile] = useState<AgentProfile | null>(null);
    const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(
        null,
    );

    useEffect(() => {
        void refreshProfiles();
    }, [refreshProfiles]);

    useEffect(() => {
        if (error) {
            setToastMessage({ type: 'error', message: error });
        }
    }, [error]);

    // Auto-hide toast
    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    const selectedProfile = useMemo(() => editingProfile ?? profiles[0] ?? null, [editingProfile, profiles]);

    async function submitCreateOrEdit(draft: ProfileDraft) {
        try {
            if (mode === 'edit' && editingProfile) {
                await updateProfile(editingProfile.id, draft);
                setToastMessage({ type: 'success', message: 'Profile updated successfully.' });
            } else {
                await createProfile(draft);
                setToastMessage({ type: 'success', message: 'Profile created successfully.' });
            }
            setMode('list');
            setEditingProfile(null);
        } catch {
            setToastMessage({ type: 'error', message: 'Profile save failed.' });
        }
    }

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
                        ...(toastMessage.type === 'info' && { background: c.ink, color: c.surface }),
                    }}
                >
                    {toastMessage.message}
                </div>
            )}

            {/* Header */}
            <div style={{ borderBottom: `1.5px solid ${c.ink}`, background: c.surface }}>
                <div
                    style={{
                        maxWidth: '1200px',
                        margin: '0 auto',
                        padding: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '16px',
                    }}
                >
                    <div>
                        <h1
                            style={{
                                fontFamily: "'Oswald', sans-serif",
                                fontSize: '32px',
                                fontWeight: 700,
                                color: c.ink,
                                margin: 0,
                            }}
                        >
                            Agent Profiles
                        </h1>
                        <p style={{ fontSize: '14px', color: c.ink, opacity: 0.6, margin: '4px 0 0 0' }}>
                            Create and manage your AgentM profile versions
                        </p>
                    </div>
                    {mode === 'list' && (
                        <button
                            data-testid="create-profile-button"
                            onClick={() => {
                                setMode('create');
                                setEditingProfile(null);
                            }}
                            disabled={loading}
                            style={{
                                padding: '12px 24px',
                                background: c.ink,
                                color: c.surface,
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.5 : 1,
                                transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                                if (!loading) {
                                    e.currentTarget.style.background = '#2D2D33';
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = c.ink;
                            }}
                        >
                            Create Profile
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
                {loading && mode === 'list' && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
                        <span style={{ color: c.ink, opacity: 0.5 }}>Loading profiles...</span>
                    </div>
                )}

                {(mode === 'create' || mode === 'edit') && (
                    <div style={{ maxWidth: '800px' }}>
                        <ProfileForm
                            initialProfile={mode === 'edit' ? editingProfile : null}
                            submitting={loading}
                            onSubmit={submitCreateOrEdit}
                            onCancel={() => {
                                setMode('list');
                                setEditingProfile(null);
                            }}
                        />
                    </div>
                )}

                {mode === 'list' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {profiles.length === 0 && !loading && (
                                <div
                                    data-testid="profiles-empty-state"
                                    style={{
                                        background: c.surface,
                                        border: `1.5px solid ${c.ink}`,
                                        borderRadius: '24px',
                                        padding: '48px',
                                        textAlign: 'center',
                                    }}
                                >
                                    <p style={{ fontSize: '16px', color: c.ink, opacity: 0.6, margin: 0 }}>
                                        No profiles yet. Create your first one.
                                    </p>
                                </div>
                            )}
                            {profiles.map((profile) => (
                                <ProfileCard
                                    key={profile.id}
                                    profile={profile}
                                    onEdit={(candidate) => {
                                        setMode('edit');
                                        setEditingProfile(candidate);
                                    }}
                                    onPublish={async (candidate) => {
                                        try {
                                            await updateProfileStatus(candidate.id, 'published');
                                            setToastMessage({
                                                type: 'success',
                                                message: `Published ${candidate.name} v${candidate.version}`,
                                            });
                                        } catch {
                                            setToastMessage({
                                                type: 'error',
                                                message: `Failed to publish ${candidate.name}`,
                                            });
                                        }
                                    }}
                                    onDeprecate={async (candidate) => {
                                        try {
                                            await updateProfileStatus(candidate.id, 'deprecated');
                                            setToastMessage({
                                                type: 'info',
                                                message: `Deprecated ${candidate.name} v${candidate.version}`,
                                            });
                                        } catch {
                                            setToastMessage({
                                                type: 'error',
                                                message: `Failed to deprecate ${candidate.name}`,
                                            });
                                        }
                                    }}
                                    onDelete={async (candidate) => {
                                        try {
                                            await deleteProfile(candidate.id);
                                            setToastMessage({ type: 'info', message: `Deleted ${candidate.name}` });
                                        } catch {
                                            setToastMessage({
                                                type: 'error',
                                                message: `Failed to delete ${candidate.name}`,
                                            });
                                        }
                                    }}
                                    disabled={loading}
                                />
                            ))}
                        </div>
                        <VersionList selectedProfile={selectedProfile} relatedProfiles={profiles} />
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
