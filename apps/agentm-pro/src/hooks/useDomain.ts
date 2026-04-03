'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DomainResolver } from '@/lib/social';
import type { DomainResolution } from '@/lib/social';

export function useDomain(address: string | null) {
    const resolverRef = useRef(new DomainResolver());
    const [resolution, setResolution] = useState<DomainResolution | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!address) {
            setResolution(null);
            return;
        }

        let cancelled = false;
        setLoading(true);

        resolverRef.current.resolve(address).then((result) => {
            if (!cancelled) {
                setResolution(result);
                setLoading(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [address]);

    const displayName = resolution?.domain ?? (address ? `${address.slice(0, 4)}...${address.slice(-4)}` : '');

    return { resolution, loading, displayName } as const;
}

export function useDomainSearch() {
    const resolverRef = useRef(new DomainResolver());
    const [loading, setLoading] = useState(false);

    const search = useCallback(async (query: string): Promise<DomainResolution | null> => {
        setLoading(true);
        try {
            return await resolverRef.current.resolve(query);
        } finally {
            setLoading(false);
        }
    }, []);

    return { search, loading } as const;
}
