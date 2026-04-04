/**
 * Profile Hooks
 * 
 * Hooks for fetching and managing Agent profiles from Daemon
 */

import { useState, useEffect, useCallback } from 'react';
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';

// Simple SoulProfile type definition
type SoulProfile = {
  soulType?: string;
  identity?: {
    displayName?: string;
    bio?: string;
  };
  values?: {
    core?: string[];
    priorities?: string[];
    dealBreakers?: string[];
  };
};

const DEFAULT_DAEMON_URL = 'http://localhost:7420';

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

/**
 * Hook to fetch an agent's profile from Daemon
 */
export function useProfile(addressOrDomain?: string) {
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { daemonUrl, isConnected } = useDaemonConnection();

  useEffect(() => {
    if (!addressOrDomain) {
      setProfile(null);
      return;
    }

    // Always try to fetch from daemon, even if not "connected" via WebSocket
    const url = daemonUrl || DEFAULT_DAEMON_URL;

    setLoading(true);
    setError(null);

    fetch(`${url}/api/profile/${addressOrDomain}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to fetch profile');
        return res.json();
      })
      .then((data: AgentProfile) => {
        setProfile(data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
        // API failed - don't fallback to mock for production
        setProfile(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [addressOrDomain, daemonUrl, isConnected]);

  const updateProfile = useCallback(async (updates: Partial<AgentProfile>) => {
    const url = daemonUrl || DEFAULT_DAEMON_URL;
    
    try {
      const res = await fetch(`${url}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      
      if (!res.ok) throw new Error('Failed to update profile');
      
      const updated = await res.json();
      setProfile((prev) => prev ? { ...prev, ...updated.profile } : null);
    } catch (err) {
      console.error('Update profile error:', err);
      // Optimistic update
      setProfile((prev) => prev ? { ...prev, ...updates } : null);
    }
  }, [daemonUrl, isConnected]);

  return {
    profile,
    loading,
    error,
    updateProfile,
  };
}

/**
 * Hook to fetch current user's profile
 */
export function useMyProfile() {
  // TODO: Get current user address from auth context
  const myAddress = 'demo';
  return useProfile(myAddress);
}

/**
 * Hook to update Soul Profile
 */
export function useUpdateSoulProfile() {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { daemonUrl, isConnected } = useDaemonConnection();

  const updateSoulProfile = useCallback(async (profile: Partial<SoulProfile>) => {
    const url = daemonUrl || DEFAULT_DAEMON_URL;
    
    setUpdating(true);
    setError(null);

    try {
      const res = await fetch(`${url}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soulProfile: profile }),
      });
      
      if (!res.ok) throw new Error('Failed to update profile');
      
      console.log('Soul profile updated:', profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      throw err;
    } finally {
      setUpdating(false);
    }
  }, [daemonUrl, isConnected]);

  return {
    updateSoulProfile,
    updating,
    error,
  };
}

export default useProfile;
