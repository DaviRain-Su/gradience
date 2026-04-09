'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Address } from '@solana/kit';
import type { A2AChannel } from '@/lib/a2a/a2a-client';

export interface UseChannelStateResult {
    channels: A2AChannel[];
    loading: boolean;
    error: string | null;
    refresh: () => void;
}

export function useChannelState(walletAddress: string | null): UseChannelStateResult {
    const [channels, setChannels] = useState<A2AChannel[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadChannels = useCallback(async () => {
        if (!walletAddress) {
            setChannels([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            // TODO: replace with real A2A query transport once on-chain indexing is available.
            const mock: A2AChannel[] = [
                {
                    channelId: '1001',
                    payee: 'B9Lf9z5BfNPT4d5KMeaBFx8x1G4CULZYR1jA2kmxRDka' as Address,
                    depositAmount: 0.5,
                    spentAmount: 0.12,
                    status: 'open',
                    expiresAt: Date.now() + 86_400_000,
                },
            ];
            setChannels(mock);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load channels');
        } finally {
            setLoading(false);
        }
    }, [walletAddress]);

    useEffect(() => {
        loadChannels();
    }, [loadChannels]);

    return {
        channels,
        loading,
        error,
        refresh: loadChannels,
    };
}
