// Domain resolver -- backed by agent-daemon SNS/ENS resolution API

const API_BASE = process.env.NEXT_PUBLIC_DAEMON_API || 'https://api.gradiences.xyz';

export const DOMAIN_TLDS = ['.sol', '.eth'];

export function isValidDomain(domain: string): boolean {
    if (!domain || domain.length === 0) return false;
    return domain.endsWith('.sol') || domain.endsWith('.eth');
}

export function validateDomain(domain: string): boolean {
    return isValidDomain(domain);
}

export async function resolve(domain: string): Promise<{ address: string; domain: string } | null> {
    if (!isValidDomain(domain)) return null;
    try {
        const endpoint = domain.endsWith('.eth')
            ? `${API_BASE}/api/v1/domains/ens/resolve/${encodeURIComponent(domain)}`
            : `${API_BASE}/api/v1/domains/resolve/${encodeURIComponent(domain)}`;
        const res = await fetch(endpoint);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.address) return null;
        return { address: data.address, domain: data.domain };
    } catch {
        return null;
    }
}

export async function resolveDomain(domain: string): Promise<string | null> {
    const result = await resolve(domain);
    return result?.address ?? null;
}

export async function reverse(address: string): Promise<string | null> {
    if (!address) return null;
    try {
        const res = await fetch(`${API_BASE}/api/v1/domains/reverse/${encodeURIComponent(address)}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data.domain ?? null;
    } catch {
        return null;
    }
}

export async function batchReverse(addresses: string[]): Promise<Record<string, string | null>> {
    if (!addresses.length) return {};
    try {
        const res = await fetch(`${API_BASE}/api/v1/domains/batch-reverse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addresses }),
        });
        if (!res.ok) return {};
        const data = await res.json();
        return data.results ?? {};
    } catch {
        return {};
    }
}
