import { useState, useEffect, useCallback } from 'react';
import type { AttestationSummary } from '../lib/api-types.ts';

const API_BASE = 'http://127.0.0.1:3939';

interface UseAttestationsResult {
    attestations: AttestationSummary[];
    total: number;
    loading: boolean;
    error: string | null;
    refresh: () => void;
}

export function useAttestations(publicKey: string | null): UseAttestationsResult {
    const [attestations, setAttestations] = useState<AttestationSummary[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(() => {
        if (!publicKey) return;
        setLoading(true);
        setError(null);
        fetch(`${API_BASE}/me/attestations?limit=20&offset=0`, {
            signal: AbortSignal.timeout(5000),
        })
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then((data: { attestations: AttestationSummary[]; total: number }) => {
                setAttestations(data.attestations);
                setTotal(data.total);
            })
            .catch((err) => {
                setError(err instanceof Error ? err.message : 'Unknown error');
            })
            .finally(() => {
                setLoading(false);
            });
    }, [publicKey]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { attestations, total, loading, error, refresh };
}
