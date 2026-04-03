import { useState, useEffect, useCallback } from 'react';
import { getIndexerClient, type ReputationApi } from '../lib/indexer-api.ts';

export function useReputation(address: string | null) {
    const [reputation, setReputation] = useState<ReputationApi | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!address) {
            setReputation(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await getIndexerClient().getReputation(address);
            setReputation(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load reputation');
        } finally {
            setLoading(false);
        }
    }, [address]);

    useEffect(() => {
        refresh();
        const interval = setInterval(() => void refresh(), 30_000);
        return () => clearInterval(interval);
    }, [refresh]);

    return { reputation, loading, error, refresh };
}
