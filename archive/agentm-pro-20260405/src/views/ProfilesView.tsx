import { useEffect, useMemo, useState } from 'react';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { VersionList } from '@/components/profile/VersionList';
import { useToast } from '@/components/ui/ToastProvider';
import { useProfile } from '@/hooks/useProfile';
import { useProStore } from '@/lib/store';
import type { AgentProfile } from '@/types';
import { ProfileCreateView } from './ProfileCreateView';
import { ProfileEditView } from './ProfileEditView';

export function ProfilesView({ owner }: { owner: string | null }) {
    const {
        profiles,
        loading,
        error,
        refreshProfiles,
        createProfile,
        updateProfile,
        updateProfileStatus,
        deleteProfile,
    } = useProfile(owner);
    const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
    const [editingProfile, setEditingProfile] = useState<AgentProfile | null>(null);
    const toast = useToast();
    const setCurrentProfile = useProStore((state) => state.setCurrentProfile);

    useEffect(() => {
        void refreshProfiles();
    }, [refreshProfiles]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error, toast]);

    const selectedProfile = useMemo(() => editingProfile ?? profiles[0] ?? null, [editingProfile, profiles]);

    async function submitCreateOrEdit(draft: Parameters<typeof createProfile>[0]) {
        try {
            if (mode === 'edit' && editingProfile) {
                await updateProfile(editingProfile.id, draft);
                toast.success('Profile updated.');
            } else {
                await createProfile(draft);
                toast.success('Profile created.');
            }
            setMode('list');
            setEditingProfile(null);
        } catch {
            toast.error('Profile save failed.');
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold">Profiles</h1>
                    <p className="text-gray-400">Create and manage your AgentM profile versions.</p>
                </div>
                {mode === 'list' && (
                    <button
                        data-testid="create-profile-button"
                        onClick={() => {
                            setMode('create');
                            setEditingProfile(null);
                        }}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Create Profile
                    </button>
                )}
            </div>

            {loading && <p className="text-sm text-gray-500">Syncing profiles...</p>}

            {(mode === 'create' || mode === 'edit') && (
                <>
                    {mode === 'create' && (
                        <ProfileCreateView
                            submitting={loading}
                            onSubmit={submitCreateOrEdit}
                            onCancel={() => {
                                setMode('list');
                                setEditingProfile(null);
                            }}
                        />
                    )}
                    {mode === 'edit' && editingProfile && (
                        <ProfileEditView
                            profile={editingProfile}
                            submitting={loading}
                            onSubmit={submitCreateOrEdit}
                            onCancel={() => {
                                setMode('list');
                                setEditingProfile(null);
                            }}
                        />
                    )}
                </>
            )}

            {mode === 'list' && (
                <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
                    <div className="space-y-3">
                        {loading && profiles.length === 0 && (
                            <>
                                <LoadingCard />
                                <LoadingCard />
                            </>
                        )}
                        {profiles.length === 0 && (
                            <div
                                data-testid="profiles-empty-state"
                                className="bg-gray-900 border border-gray-800 rounded-xl p-5"
                            >
                                <p className="text-sm text-gray-400">No profiles yet. Create your first one.</p>
                            </div>
                        )}
                        {profiles.map((profile) => (
                            <ProfileCard
                                key={profile.id}
                                profile={profile}
                                onEdit={(candidate) => {
                                    setMode('edit');
                                    setEditingProfile(candidate);
                                    setCurrentProfile(candidate);
                                }}
                                onPublish={async (candidate) => {
                                    try {
                                        await updateProfileStatus(candidate.id, 'published');
                                        toast.success(`Published ${candidate.name} v${candidate.version}.`);
                                    } catch {
                                        toast.error(`Failed to publish ${candidate.name}.`);
                                    }
                                }}
                                onDeprecate={async (candidate) => {
                                    try {
                                        await updateProfileStatus(candidate.id, 'deprecated');
                                        toast.info(`Deprecated ${candidate.name} v${candidate.version}.`);
                                    } catch {
                                        toast.error(`Failed to deprecate ${candidate.name}.`);
                                    }
                                }}
                                onDelete={async (candidate) => {
                                    try {
                                        await deleteProfile(candidate.id);
                                        toast.info(`Deleted ${candidate.name}.`);
                                    } catch {
                                        toast.error(`Failed to delete ${candidate.name}.`);
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
    );
}

function LoadingCard() {
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse space-y-3">
            <div className="h-5 bg-gray-800 rounded w-1/2" />
            <div className="h-4 bg-gray-800 rounded w-4/5" />
            <div className="h-9 bg-gray-800 rounded w-full" />
        </div>
    );
}
