// Domain resolver -- backed by agent-daemon SNS/ENS resolution API
// Architecture: Local-first -- only connects to localhost:7420

const API_BASE = process.env.NEXT_PUBLIC_DAEMON_URL || 'http://localhost:7420';

export const DOMAIN_TLDS = ['.sol', '.eth'];

export function isValidDomain(domain: string): boolean {
    if (!domain || domain.length === 0) return false;
    return domain.endsWith('.sol') || domain.endsWith('.eth');
}

export function validateDomain(domain: string): boolean {
    return isValidDomain(domain);
}

/**
 * Resolve domain to address via local daemon
 * Returns null if daemon not running (no cloud fallback)
 */
export async function resolve(domain: string): Promise<{ address: string; domain: string } | null> {
    if (!isValidDomain(domain)) return null;
    
    try {
        const endpoint = domain.endsWith('.eth')
            ? `${API_BASE}/api/v1/domains/ens/resolve/${encodeURIComponent(domain)}`
            : `${API_BASE}/api/v1/domains/resolve/${encodeURIComponent(domain)}`;
        
        const res = await fetch(endpoint, {
            signal: AbortSignal.timeout(5000),
        });
        
        if (!res.ok) {
            if (res.status === 503) {
                console.warn('Daemon not available. Domain resolution requires local daemon.');
            }
            return null;
        }
        
        const data = await res.json();
        if (!data.address) return null;
        
        return { address: data.address, domain: data.domain };
    } catch (err) {
        // Silent fail -- daemon not running
        console.warn('Domain resolution failed (daemon not running):', err);
        return null;
    }
}

export async function resolveDomain(domain: string): Promise<string | null> {
    const result = await resolve(domain);
    return result?.address ?? null;
}

/**
 * Reverse resolve address to domain via local daemon
 */
export async function reverse(address: string): Promise<string | null> {
    if (!address) return null;
    
    try {
        const res = await fetch(`${API_BASE}/api/v1/domains/reverse/${encodeURIComponent(address)}`, {
            signal: AbortSignal.timeout(5000),
        });
        
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
            signal: AbortSignal.timeout(5000),
        });
        
        if (!res.ok) return {};
        
        const data = await res.json();
        return data.results ?? {};
    } catch {
        return {};
    }
}
