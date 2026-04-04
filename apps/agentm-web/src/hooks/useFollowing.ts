/**
 * Following Hooks
 * 
 * Hooks for managing follow relationships via Daemon
 */

import { useState, useEffect, useCallback } from 'react';

// Helper to safely use connection
function useDaemonConnection() {
  try {
    const { useDaemonConnection } = require('@/lib/connection/ConnectionContext');
    return useDaemonConnection();
  } catch {
    return { daemonUrl: null, isConnected: false };
  }
}

export interface AgentPreview {
  address: string;
  domain?: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  reputation: number;
  isFollowing: boolean;
}

/**
 * Hook to manage following state via Daemon
 */
export function useFollowing(targetAddress?: string) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { daemonUrl, isConnected } = useDaemonConnection();

  useEffect(() => {
    if (!targetAddress) return;
    
    // TODO: Check if following from API
    setIsFollowing(false);
  }, [targetAddress]);

  const follow = useCallback(async () => {
    if (!targetAddress || !daemonUrl || !isConnected) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${daemonUrl}/api/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetAddress }),
      });
      
      if (!res.ok) throw new Error('Failed to follow');
      
      setIsFollowing(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to follow');
      // Optimistic update for demo
      setIsFollowing(true);
    } finally {
      setLoading(false);
    }
  }, [targetAddress, daemonUrl, isConnected]);

  const unfollow = useCallback(async () => {
    if (!targetAddress || !daemonUrl || !isConnected) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${daemonUrl}/api/unfollow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetAddress }),
      });
      
      if (!res.ok) throw new Error('Failed to unfollow');
      
      setIsFollowing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unfollow');
      // Optimistic update for demo
      setIsFollowing(false);
    } finally {
      setLoading(false);
    }
  }, [targetAddress, daemonUrl, isConnected]);

  return {
    isFollowing,
    loading,
    error,
    follow,
    unfollow,
  };
}

/**
 * Hook to fetch followers list from Daemon
 */
export function useFollowers(address?: string) {
  const [followers, setFollowers] = useState<AgentPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { daemonUrl, isConnected } = useDaemonConnection();

  useEffect(() => {
    if (!address || !isConnected || !daemonUrl) {
      setFollowers([]);
      return;
    }

    setLoading(true);
    
    fetch(`${daemonUrl}/api/followers/${address}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to fetch followers');
        return res.json();
      })
      .then((data) => {
        setFollowers(data.followers || []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Fallback to mock data
        setFollowers([
          {
            address: '0xabc...123',
            domain: 'alice.sol',
            displayName: 'Alice',
            bio: 'AI researcher',
            reputation: 92,
            isFollowing: true,
          },
          {
            address: '0xdef...456',
            domain: 'bob.sol',
            displayName: 'Bob',
            bio: 'Developer',
            reputation: 78,
            isFollowing: false,
          },
        ]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [address, daemonUrl, isConnected]);

  return { followers, loading, error };
}

/**
 * Hook to fetch following list from Daemon
 */
export function useFollowingList(address?: string) {
  const [following, setFollowing] = useState<AgentPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { daemonUrl, isConnected } = useDaemonConnection();

  useEffect(() => {
    if (!address || !isConnected || !daemonUrl) {
      setFollowing([]);
      return;
    }

    setLoading(true);
    
    fetch(`${daemonUrl}/api/following/${address}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to fetch following');
        return res.json();
      })
      .then((data) => {
        setFollowing(data.following || []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Fallback to mock data
        setFollowing([
          {
            address: '0xghi...789',
            domain: 'charlie.sol',
            displayName: 'Charlie',
            bio: 'Designer',
            reputation: 85,
            isFollowing: true,
          },
        ]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [address, daemonUrl, isConnected]);

  return { following, loading, error };
}

export default useFollowing;
