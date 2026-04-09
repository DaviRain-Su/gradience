'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';
import type { AgentProfile, ProfileDraft } from '@/types/profile';

const PROFILE_STORAGE_KEY = 'agentm-web:profiles:v1';

interface UseAgentProfilesResult {
    profiles: AgentProfile[];
    loading: boolean;
    error: string | null;
    refreshProfiles: () => Promise<void>;
    createProfile: (draft: ProfileDraft) => Promise<AgentProfile | null>;
    updateProfile: (id: string, updates: Partial<AgentProfile>) => Promise<AgentProfile | null>;
    updateProfileStatus: (id: string, status: AgentProfile['status']) => Promise<boolean>;
    deleteProfile: (id: string) => Promise<boolean>;
}

function readProfilesFromStorage(owner: string): AgentProfile[] {
    if (typeof window === 'undefined') {
        return [];
    }
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((profile: AgentProfile) => profile.owner === owner);
    } catch {
        return [];
    }
}

function writeProfilesToStorage(profiles: AgentProfile[]) {
    if (typeof window === 'undefined') {
        return;
    }
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
}

export function useAgentProfiles(): UseAgentProfilesResult {
    const { walletAddress } = useDaemonConnection();
    const [profiles, setProfiles] = useState<AgentProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refreshProfiles = useCallback(async () => {
        if (!walletAddress) {
            setProfiles([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const stored = readProfilesFromStorage(walletAddress);
            setProfiles(stored);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load profiles');
        } finally {
            setLoading(false);
        }
    }, [walletAddress]);

    const createProfile = useCallback(
        async (draft: ProfileDraft): Promise<AgentProfile | null> => {
            if (!walletAddress) return null;

            try {
                const newProfile: AgentProfile = {
                    id: `profile-${Date.now()}`,
                    did: `did:sol:${walletAddress}`,
                    owner: walletAddress,
                    name: draft.name,
                    description: draft.description,
                    version: draft.version || '1.0.0',
                    capabilities: draft.capabilities || [],
                    pricing: draft.pricing || { model: 'fixed', amount: 0, currency: 'SOL' },
                    tags: draft.tags || [],
                    website: draft.website,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    status: 'draft',
                };

                const allProfiles = readProfilesFromStorage(walletAddress);
                allProfiles.push(newProfile);
                writeProfilesToStorage(allProfiles);

                setProfiles((prev) => [...prev, newProfile]);
                return newProfile;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to create profile');
                return null;
            }
        },
        [walletAddress],
    );

    const updateProfile = useCallback(
        async (id: string, updates: Partial<AgentProfile>): Promise<AgentProfile | null> => {
            if (!walletAddress) return null;

            try {
                const allProfiles = readProfilesFromStorage(walletAddress);
                const index = allProfiles.findIndex((p) => p.id === id);

                if (index === -1) return null;

                const updated = {
                    ...allProfiles[index],
                    ...updates,
                    updatedAt: Date.now(),
                };

                allProfiles[index] = updated;
                writeProfilesToStorage(allProfiles);

                setProfiles((prev) => prev.map((p) => (p.id === id ? updated : p)));
                return updated;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to update profile');
                return null;
            }
        },
        [walletAddress],
    );

    const updateProfileStatus = useCallback(
        async (id: string, status: AgentProfile['status']): Promise<boolean> => {
            const result = await updateProfile(id, { status });
            return result !== null;
        },
        [updateProfile],
    );

    const deleteProfile = useCallback(
        async (id: string): Promise<boolean> => {
            if (!walletAddress) return false;

            try {
                const allProfiles = readProfilesFromStorage(walletAddress);
                const filtered = allProfiles.filter((p) => p.id !== id);
                writeProfilesToStorage(filtered);

                setProfiles((prev) => prev.filter((p) => p.id !== id));
                return true;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to delete profile');
                return false;
            }
        },
        [walletAddress],
    );

    useEffect(() => {
        refreshProfiles();
    }, [refreshProfiles]);

    return {
        profiles,
        loading,
        error,
        refreshProfiles,
        createProfile,
        updateProfile,
        updateProfileStatus,
        deleteProfile,
    };
}

export default useAgentProfiles;
