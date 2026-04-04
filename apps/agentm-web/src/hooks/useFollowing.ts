import { useState, useEffect, useCallback } from 'react';
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';

export interface AgentPreview {
  address: string;
  domain?: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  reputation: number;
  isFollowing: boolean;
}

function authHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export function useFollowing(targetAddress?: string) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { daemonUrl, sessionToken } = useDaemonConnection();

  const follow = useCallback(async () => {
    if (!targetAddress || !sessionToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${daemonUrl}/api/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(sessionToken) },
        body: JSON.stringify({ targetAddress }),
      });
      if (!res.ok) throw new Error('Failed to follow');
      setIsFollowing(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setIsFollowing(true);
    } finally {
      setLoading(false);
    }
  }, [targetAddress, daemonUrl, sessionToken]);

  const unfollow = useCallback(async () => {
    if (!targetAddress || !sessionToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${daemonUrl}/api/unfollow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(sessionToken) },
        body: JSON.stringify({ targetAddress }),
      });
      if (!res.ok) throw new Error('Failed to unfollow');
      setIsFollowing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setIsFollowing(false);
    } finally {
      setLoading(false);
    }
  }, [targetAddress, daemonUrl, sessionToken]);

  return { isFollowing, loading, error, follow, unfollow };
}

export function useFollowers(address?: string) {
  const [followers, setFollowers] = useState<AgentPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { daemonUrl, sessionToken } = useDaemonConnection();

  useEffect(() => {
    if (!address) { setFollowers([]); return; }
    setLoading(true);
    fetch(`${daemonUrl}/api/followers/${address}`, { headers: authHeaders(sessionToken) })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then((data) => setFollowers(data.followers || []))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unknown');
        setFollowers([]);
      })
      .finally(() => setLoading(false));
  }, [address, daemonUrl, sessionToken]);

  return { followers, loading, error };
}

export function useFollowingList(address?: string) {
  const [following, setFollowing] = useState<AgentPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { daemonUrl, sessionToken } = useDaemonConnection();

  useEffect(() => {
    if (!address) { setFollowing([]); return; }
    setLoading(true);
    fetch(`${daemonUrl}/api/following/${address}`, { headers: authHeaders(sessionToken) })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then((data) => setFollowing(data.following || []))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unknown');
        setFollowing([]);
      })
      .finally(() => setLoading(false));
  }, [address, daemonUrl, sessionToken]);

  return { following, loading, error };
}

export default useFollowing;
