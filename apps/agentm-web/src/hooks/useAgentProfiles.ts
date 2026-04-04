'use client';

import { useCallback, useMemo, useState } from 'react';
import type { AgentProfile, ProfileDraft, ProfileStatus } from '@/types/profile';
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';

const PROFILE_STORAGE_KEY = 'agentm-web:profiles:v1';
const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;

interface UseAgentProfilesResult {
  profiles: AgentProfile[];
  loading: boolean;
  error: string | null;
  refreshProfiles: () => Promise<void>;
  createProfile: (draft: ProfileDraft) => Promise<AgentProfile>;
  updateProfile: (id: string, updates: Partial<ProfileDraft>) => Promise<AgentProfile>;
  updateProfileStatus: (id: string, status: ProfileStatus) => Promise<AgentProfile>;
  deleteProfile: (id: string) => Promise<void>;
}

export function useAgentProfiles(): UseAgentProfilesResult {
  const { walletAddress } = useDaemonConnection();
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stableOwner = useMemo(() => walletAddress ?? 'demo-owner', [walletAddress]);

  const refreshProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = readProfilesFromStorage();
      const mine = all
        .filter((profile) => profile.owner === stableOwner)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      setProfiles(mine);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  }, [stableOwner]);

  const createProfile = useCallback(
    async (draft: ProfileDraft) => {
      setLoading(true);
      setError(null);
      try {
        validateProfileDraft(draft);
        const all = readProfilesFromStorage();
        const now = Date.now();
        const profile: AgentProfile = {
          ...draft,
          id: generateId(),
          did: `did:gradience:${stableOwner}`,
          owner: stableOwner,
          createdAt: now,
          updatedAt: now,
          status: 'draft',
        };
        all.push(profile);
        writeProfilesToStorage(all);
        await refreshProfiles();
        return profile;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Failed to create profile';
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [refreshProfiles, stableOwner]
  );

  const updateProfile = useCallback(
    async (id: string, updates: Partial<ProfileDraft>) => {
      setLoading(true);
      setError(null);
      try {
        const all = readProfilesFromStorage();
        const index = all.findIndex((profile) => profile.id === id && profile.owner === stableOwner);
        if (index < 0) {
          throw new Error('Profile not found');
        }
        const merged = { ...all[index], ...updates, updatedAt: Date.now() };
        validateProfileDraft({
          name: merged.name,
          description: merged.description,
          version: merged.version,
          capabilities: merged.capabilities,
          pricing: merged.pricing,
          tags: merged.tags,
          website: merged.website,
        });
        all[index] = merged;
        writeProfilesToStorage(all);
        await refreshProfiles();
        return merged;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Failed to update profile';
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [refreshProfiles, stableOwner]
  );

  const updateProfileStatus = useCallback(
    async (id: string, status: ProfileStatus) => {
      setLoading(true);
      setError(null);
      let updated: AgentProfile | null = null;
      try {
        const all = readProfilesFromStorage();
        const index = all.findIndex((profile) => profile.id === id && profile.owner === stableOwner);
        if (index < 0) {
          throw new Error('Profile not found');
        }
        updated = { ...all[index], status, updatedAt: Date.now() };
        all[index] = updated;
        writeProfilesToStorage(all);
        await refreshProfiles();
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Failed to update profile status';
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
      if (!updated) {
        throw new Error('Profile not found');
      }
      return updated;
    },
    [refreshProfiles, stableOwner]
  );

  const deleteProfile = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        const all = readProfilesFromStorage();
        const filtered = all.filter((profile) => !(profile.id === id && profile.owner === stableOwner));
        writeProfilesToStorage(filtered);
        await refreshProfiles();
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Failed to delete profile';
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [refreshProfiles, stableOwner]
  );

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

function validateProfileDraft(draft: ProfileDraft) {
  if (draft.name.trim().length < 3 || draft.name.trim().length > 50) {
    throw new Error('Name must be between 3 and 50 characters');
  }
  if (draft.description.trim().length < 10 || draft.description.trim().length > 500) {
    throw new Error('Description must be between 10 and 500 characters');
  }
  if (!SEMVER_REGEX.test(draft.version.trim())) {
    throw new Error('Version must use semver format, e.g. 1.0.0');
  }
  if (draft.capabilities.length < 1 || draft.capabilities.length > 10) {
    throw new Error('Profile needs at least one capability and at most ten');
  }
  if (draft.pricing.amount <= 0) {
    throw new Error('Pricing amount must be positive');
  }
  if (draft.tags.length > 5) {
    throw new Error('At most five tags are allowed');
  }
}

function readProfilesFromStorage(): AgentProfile[] {
  if (typeof window === 'undefined') {
    return [];
  }
  const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AgentProfile[]) : [];
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

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
