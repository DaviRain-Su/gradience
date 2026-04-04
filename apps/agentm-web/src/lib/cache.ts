type CacheEntry<T> = { data: T; expiresAt: number };

const store = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
    const entry = store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
    }
    return entry.data;
}

export function setCache<T>(key: string, data: T, ttlMs: number): void {
    store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateCache(prefix?: string): void {
    if (!prefix) {
        store.clear();
        return;
    }
    for (const key of store.keys()) {
        if (key.startsWith(prefix)) store.delete(key);
    }
}

export async function cachedFetch<T>(
    url: string,
    options?: RequestInit & { cacheTtlMs?: number },
): Promise<T> {
    const ttl = options?.cacheTtlMs ?? 30_000;
    const method = options?.method?.toUpperCase() ?? 'GET';

    if (method === 'GET') {
        const cached = getCached<T>(url);
        if (cached) return cached;
    }

    const { cacheTtlMs: _, ...fetchOpts } = options ?? {};
    const res = await fetch(url, fetchOpts);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json() as T;

    if (method === 'GET') {
        setCache(url, data, ttl);
    }

    return data;
}
