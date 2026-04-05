import type { FastifyInstance } from 'fastify';
import { Connection, PublicKey } from '@solana/web3.js';

// @bonfida/spl-name-service types don't resolve under Node16 moduleResolution
// but the runtime exports are correct.
const loadSNS = () => import('@bonfida/spl-name-service' as string) as Promise<{
    resolve(connection: Connection, domain: string): Promise<PublicKey>;
    getDomainKeySync(domain: string, record?: boolean): { pubkey: PublicKey };
    NameRegistryState: { retrieve(conn: Connection, key: PublicKey): Promise<any> };
    performReverseLookup(connection: Connection, nameAccount: PublicKey): Promise<string>;
    getAllDomains(connection: Connection, wallet: PublicKey): Promise<PublicKey[]>;
}>;

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const ETH_RPC_URL = process.env.ETH_RPC_URL || 'https://eth.llamarpc.com';
const CACHE_TTL = 5 * 60 * 1000; // 5 min

interface CacheEntry {
    value: string | null;
    ts: number;
}

const cache = new Map<string, CacheEntry>();

function getCached(key: string): string | null | undefined {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.ts > CACHE_TTL) {
        cache.delete(key);
        return undefined;
    }
    return entry.value;
}

function setCache(key: string, value: string | null): void {
    cache.set(key, { value, ts: Date.now() });
    if (cache.size > 2000) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
    }
}

export function registerDomainRoutes(app: FastifyInstance) {
    const connection = new Connection(RPC_URL, 'confirmed');
    let sns: Awaited<ReturnType<typeof loadSNS>> | null = null;

    async function getSNS() {
        if (!sns) sns = await loadSNS();
        return sns;
    }

    // GET /api/v1/domains/resolve/:domain - Forward resolve (.sol -> address)
    app.get('/api/v1/domains/resolve/:domain', async (request, reply) => {
        const { domain } = request.params as { domain: string };

        if (!domain || !domain.endsWith('.sol')) {
            return reply.status(400).send({ error: 'Only .sol domains supported currently' });
        }

        const cacheKey = `fwd:${domain}`;
        const cached = getCached(cacheKey);
        if (cached !== undefined) {
            return reply.send({ domain, address: cached });
        }

        try {
            const { resolve } = await getSNS();
            const owner = await resolve(connection, domain);
            const address = owner.toBase58();
            setCache(cacheKey, address);
            return reply.send({ domain, address });
        } catch (err: any) {
            if (err?.message?.includes('Account does not exist') ||
                err?.message?.includes('Invalid name account provided')) {
                setCache(cacheKey, null);
                return reply.send({ domain, address: null });
            }
            return reply.status(500).send({ error: 'Resolution failed', detail: err?.message });
        }
    });

    // GET /api/v1/domains/reverse/:address - Reverse resolve (address -> .sol)
    app.get('/api/v1/domains/reverse/:address', async (request, reply) => {
        const { address } = request.params as { address: string };

        if (!address) {
            return reply.status(400).send({ error: 'Address required' });
        }

        const cacheKey = `rev:${address}`;
        const cached = getCached(cacheKey);
        if (cached !== undefined) {
            return reply.send({ address, domain: cached });
        }

        try {
            const { getAllDomains: getAll, performReverseLookup } = await getSNS();
            const pubkey = new PublicKey(address);
            const domainKeys = await getAll(connection, pubkey);
            if (domainKeys.length === 0) {
                setCache(cacheKey, null);
                return reply.send({ address, domain: null });
            }
            const domainName = await performReverseLookup(connection, domainKeys[0]);
            const domain = domainName ? `${domainName}.sol` : null;
            setCache(cacheKey, domain);
            return reply.send({ address, domain });
        } catch (err: any) {
            if (err?.message?.includes('Account does not exist')) {
                setCache(cacheKey, null);
                return reply.send({ address, domain: null });
            }
            return reply.status(500).send({ error: 'Reverse lookup failed', detail: err?.message });
        }
    });

    // POST /api/v1/domains/batch-reverse - Batch reverse lookup
    app.post('/api/v1/domains/batch-reverse', async (request, reply) => {
        const { addresses } = request.body as { addresses: string[] };

        if (!Array.isArray(addresses) || addresses.length === 0) {
            return reply.status(400).send({ error: 'addresses array required' });
        }

        if (addresses.length > 50) {
            return reply.status(400).send({ error: 'Max 50 addresses per batch' });
        }

        const { getAllDomains: getAll, performReverseLookup } = await getSNS();
        const results: Record<string, string | null> = {};

        await Promise.allSettled(
            addresses.map(async (addr) => {
                const cacheKey = `rev:${addr}`;
                const cached = getCached(cacheKey);
                if (cached !== undefined) {
                    results[addr] = cached;
                    return;
                }
                try {
                    const pubkey = new PublicKey(addr);
                    const domainKeys = await getAll(connection, pubkey);
                    if (domainKeys.length === 0) {
                        results[addr] = null;
                        setCache(cacheKey, null);
                        return;
                    }
                    const domainName = await performReverseLookup(connection, domainKeys[0]);
                    const domain = domainName ? `${domainName}.sol` : null;
                    setCache(cacheKey, domain);
                    results[addr] = domain;
                } catch {
                    results[addr] = null;
                }
            }),
        );

        return reply.send({ results });
    });

    // GET /api/v1/domains/validate/:domain - Validate domain format
    app.get('/api/v1/domains/validate/:domain', async (request, reply) => {
        const { domain } = request.params as { domain: string };
        const valid = !!domain && (domain.endsWith('.sol') || domain.endsWith('.eth'));
        let registered: boolean | null = null;
        if (valid && domain.endsWith('.sol')) {
            try {
                const { getDomainKeySync: getDKS, NameRegistryState: NRS } = await getSNS();
                const { pubkey } = getDKS(domain.replace('.sol', ''));
                await NRS.retrieve(connection, pubkey);
                registered = true;
            } catch {
                registered = false;
            }
        } else if (valid && domain.endsWith('.eth')) {
            const addr = await resolveENS(domain);
            registered = addr !== null;
        }
        return reply.send({ domain, valid, registered });
    });

    // ---- ENS (.eth) routes ----

    // Reuse the same /resolve/:domain and /reverse/:address for .eth
    // The /resolve route already rejects non-.sol above; add .eth support:
    app.get('/api/v1/domains/ens/resolve/:domain', async (request, reply) => {
        const { domain } = request.params as { domain: string };
        if (!domain || !domain.endsWith('.eth')) {
            return reply.status(400).send({ error: 'Only .eth domains supported on this endpoint' });
        }

        const cacheKey = `fwd:${domain}`;
        const cached = getCached(cacheKey);
        if (cached !== undefined) {
            return reply.send({ domain, address: cached });
        }

        const address = await resolveENS(domain);
        setCache(cacheKey, address);
        return reply.send({ domain, address });
    });

    app.get('/api/v1/domains/ens/reverse/:address', async (request, reply) => {
        const { address } = request.params as { address: string };
        if (!address) {
            return reply.status(400).send({ error: 'Address required' });
        }

        const cacheKey = `rev:ens:${address}`;
        const cached = getCached(cacheKey);
        if (cached !== undefined) {
            return reply.send({ address, domain: cached });
        }

        const domain = await reverseENS(address);
        setCache(cacheKey, domain);
        return reply.send({ address, domain });
    });
}

// ---- ENS resolution via Ethereum JSON-RPC (no extra deps) ----



// Lazy-loaded keccak256 from @noble/hashes (transitive dep of @solana/web3.js)
let _keccakFn: ((d: Uint8Array) => Uint8Array) | null = null;

async function initKeccak(): Promise<(d: Uint8Array) => Uint8Array> {
    if (_keccakFn) return _keccakFn;
    // Use Function constructor to avoid Vitest's static import analysis
    // @noble/hashes exports keccak_256 in the sha3 module
    const dynamicImport = new Function('specifier', 'return import(specifier)');
    const mod = await dynamicImport('@noble/hashes/sha3');
    _keccakFn = mod.keccak_256 as (d: Uint8Array) => Uint8Array;
    return _keccakFn;
}

function keccak256Sync(data: Uint8Array): Uint8Array {
    if (!_keccakFn) throw new Error('keccak not initialized, call initKeccak() first');
    return _keccakFn(data);
}

async function ensNamehash(name: string): Promise<string> {
    const keccak = await initKeccak();
    let node = new Uint8Array(32);
    if (name) {
        const labels = name.split('.');
        for (let i = labels.length - 1; i >= 0; i--) {
            const labelHash = new Uint8Array(keccak(new TextEncoder().encode(labels[i])));
            const combined = new Uint8Array(64);
            combined.set(node, 0);
            combined.set(labelHash, 32);
            node = new Uint8Array(keccak(combined));
        }
    }
    return '0x' + Buffer.from(node).toString('hex');
}

async function ethCall(to: string, data: string): Promise<string | null> {
    try {
        const res = await fetch(ETH_RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0', id: 1, method: 'eth_call',
                params: [{ to, data }, 'latest'],
            }),
        });
        const json = await res.json() as { result?: string; error?: any };
        if (json.error || !json.result || json.result === '0x') return null;
        return json.result;
    } catch {
        return null;
    }
}

const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';

async function resolveENS(domain: string): Promise<string | null> {
    try {
        const node = await ensNamehash(domain);
        // Call resolver(bytes32 node) on ENS registry
        const resolverSig = '0x0178b8bf'; // resolver(bytes32)
        const resolverData = resolverSig + node.slice(2);
        const resolverResult = await ethCall(ENS_REGISTRY, resolverData);
        if (!resolverResult || resolverResult.length < 66) return null;

        const resolverAddr = '0x' + resolverResult.slice(26, 66);
        if (resolverAddr === '0x0000000000000000000000000000000000000000') return null;

        // Call addr(bytes32 node) on resolver
        const addrSig = '0x3b3b57de'; // addr(bytes32)
        const addrData = addrSig + node.slice(2);
        const addrResult = await ethCall(resolverAddr, addrData);
        if (!addrResult || addrResult.length < 66) return null;

        const addr = '0x' + addrResult.slice(26, 66);
        if (addr === '0x0000000000000000000000000000000000000000') return null;
        return addr;
    } catch {
        return null;
    }
}

async function reverseENS(address: string): Promise<string | null> {
    try {
        const addr = address.toLowerCase().replace('0x', '');
        const reverseName = `${addr}.addr.reverse`;
        const node = await ensNamehash(reverseName);

        // Get resolver for reverse node
        const resolverSig = '0x0178b8bf';
        const resolverData = resolverSig + node.slice(2);
        const resolverResult = await ethCall(ENS_REGISTRY, resolverData);
        if (!resolverResult || resolverResult.length < 66) return null;

        const resolverAddr = '0x' + resolverResult.slice(26, 66);
        if (resolverAddr === '0x0000000000000000000000000000000000000000') return null;

        // Call name(bytes32 node) on resolver
        const nameSig = '0x691f3431'; // name(bytes32)
        const nameData = nameSig + node.slice(2);
        const nameResult = await ethCall(resolverAddr, nameData);
        if (!nameResult || nameResult.length < 130) return null;

        // Decode string from ABI-encoded response
        const offset = parseInt(nameResult.slice(2, 66), 16) * 2 + 2;
        const length = parseInt(nameResult.slice(offset, offset + 64), 16);
        const hexStr = nameResult.slice(offset + 64, offset + 64 + length * 2);
        const name = Buffer.from(hexStr, 'hex').toString('utf8');
        return name && name.length > 0 ? name : null;
    } catch {
        return null;
    }
}
