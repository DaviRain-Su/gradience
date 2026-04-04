'use client';

import { useDomain } from '@/hooks/useDomain';

export function DomainBadge({
    address,
    linkedDomain,
}: {
    address: string;
    linkedDomain?: string | null;
}) {
    const { resolution, displayName, loading } = useDomain(linkedDomain ? null : address);
    const label = linkedDomain ?? (loading ? 'Resolving...' : displayName);
    const source = linkedDomain
        ? 'linked'
        : resolution?.source ?? (label.includes('...') ? 'address' : 'resolved');

    return (
        <span
            data-testid="domain-badge"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-800 text-xs text-gray-300"
        >
            <span>{label}</span>
            <span data-testid="domain-badge-source" className="text-[10px] text-gray-500 uppercase">
                {source}
            </span>
        </span>
    );
}
