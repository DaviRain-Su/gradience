import { useState, useEffect, useCallback } from 'react';
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';

function authHeaders(token: string | null): Record<string, string> {
    const h: Record<string, string> = {};
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
}

export interface MatchProfile {
    address: string;
    soulType: string;
    displayName: string;
    bio?: string;
    avatar?: string;
    privacyLevel: 'public' | 'zk-selective' | 'private';
    score: number;
    breakdown?: { values: number; interests: number; communication: number };
    sharedValues?: string[];
    sharedInterests?: string[];
    conflictAreas?: string[];
    values?: { core: string[]; priorities: string[] };
    interests?: { topics: string[]; skills?: string[]; goals?: string[] };
    communication?: { tone: string; pace: string; depth: string };
}

export interface DiscoverProfile {
    address: string;
    soulType: string;
    displayName: string;
    bio?: string;
    avatar?: string;
    privacyLevel: 'public' | 'zk-selective' | 'private';
    interests?: { topics: string[] };
    communication?: { tone: string; pace: string; depth: string };
}

export function useMatches() {
    const [matches, setMatches] = useState<MatchProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { daemonUrl, sessionToken } = useDaemonConnection();

    const refresh = useCallback(() => {
        if (!sessionToken) return;
        setLoading(true);
        setError(null);
        fetch(`${daemonUrl}/api/matches`, { headers: authHeaders(sessionToken) })
            .then(async (res) => {
                if (!res.ok) throw new Error(`Matches error: ${res.status}`);
                return res.json();
            })
            .then(data => setMatches(data.matches || []))
            .catch(err => setError(err instanceof Error ? err.message : 'Unknown error'))
            .finally(() => setLoading(false));
    }, [daemonUrl, sessionToken]);

    useEffect(() => { refresh(); }, [refresh]);

    return { matches, loading, error, refresh };
}

export function useDiscover() {
    const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { daemonUrl, sessionToken } = useDaemonConnection();

    useEffect(() => {
        setLoading(true);
        fetch(`${daemonUrl}/api/discover`, { headers: authHeaders(sessionToken) })
            .then(async (res) => {
                if (!res.ok) throw new Error(`Discover error: ${res.status}`);
                return res.json();
            })
            .then(data => setProfiles(data.profiles || []))
            .catch(err => setError(err instanceof Error ? err.message : 'Unknown error'))
            .finally(() => setLoading(false));
    }, [daemonUrl, sessionToken]);

    return { profiles, loading, error };
}
