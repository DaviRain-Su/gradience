import { useState, useEffect, useCallback } from 'react';
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';

type SoulProfile = {
  soulType?: string;
  identity?: { displayName?: string; bio?: string };
  values?: { core?: string[]; priorities?: string[]; dealBreakers?: string[] };
};

export interface AgentProfile {
  address: string;
  domain?: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  reputation: number;
  followers: number;
  following: number;
  soulProfile?: SoulProfile;
  createdAt: string;
}

function authHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export function useProfile(addressOrDomain?: string) {
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { daemonUrl, sessionToken } = useDaemonConnection();

  useEffect(() => {
    if (!addressOrDomain) { setProfile(null); return; }
    setLoading(true);
    setError(null);

    fetch(`${daemonUrl}/api/profile/${addressOrDomain}`, { headers: authHeaders(sessionToken) })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to fetch profile');
        return res.json();
      })
      .then((data: AgentProfile) => setProfile(data))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setProfile(null);
      })
      .finally(() => setLoading(false));
  }, [addressOrDomain, daemonUrl, sessionToken]);

  const updateProfile = useCallback(async (updates: Partial<AgentProfile>) => {
    try {
      const res = await fetch(`${daemonUrl}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(sessionToken) },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      setProfile(prev => prev ? { ...prev, ...updates } : null);
    } catch (err) {
      console.error('Update profile error:', err);
      setProfile(prev => prev ? { ...prev, ...updates } : null);
    }
  }, [daemonUrl, sessionToken]);

  return { profile, loading, error, updateProfile };
}

export function useMyProfile() {
  const { walletAddress } = useDaemonConnection();
  const result = useProfile(walletAddress || undefined);
  return result;
}

export function useUpdateSoulProfile() {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { daemonUrl, sessionToken } = useDaemonConnection();

  const updateSoulProfile = useCallback(async (profile: Partial<SoulProfile>) => {
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`${daemonUrl}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(sessionToken) },
        body: JSON.stringify({ metadata: { soulProfile: profile } }),
      });
      if (!res.ok) throw new Error('Failed to update profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      throw err;
    } finally {
      setUpdating(false);
    }
  }, [daemonUrl, sessionToken]);

  return { updateSoulProfile, updating, error };
}

export default useProfile;
