import { Connection, PublicKey } from '@solana/web3.js';
import {
    NameRegistryState,
    getAllDomains,
    getDomainKeySync,
    getFavoriteDomain,
    resolve,
    reverseLookup,
} from '@bonfida/spl-name-service';

const DEFAULT_SOLANA_RPC = 'https://api.mainnet-beta.solana.com';
const SNS_API_BASE = 'https://sns-api.bonfida.com';

let sharedConnection: Connection | null = null;

function getConnection(rpcUrl = DEFAULT_SOLANA_RPC): Connection {
    if (!sharedConnection) {
        sharedConnection = new Connection(rpcUrl, 'confirmed');
    }
    return sharedConnection;
}

export function isValidSolDomain(domain: string): boolean {
    const normalized = normalizeSolDomain(domain);
    if (!normalized.endsWith('.sol')) return false;
    const name = normalized.slice(0, -4);
    if (name.length < 1 || name.length > 63) return false;
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(name);
}

export function normalizeSolDomain(domain: string): string {
    const trimmed = domain.trim().toLowerCase();
    return trimmed.endsWith('.sol') ? trimmed : `${trimmed}.sol`;
}

export function isValidSolanaAddress(address: string): boolean {
    try {
        new PublicKey(address);
        return true;
    } catch {
        return false;
    }
}

export async function resolveSolDomain(domain: string, rpcUrl?: string): Promise<string | null> {
    const normalized = normalizeSolDomain(domain);
    if (!isValidSolDomain(normalized)) return null;

    try {
        const owner = await resolve(getConnection(rpcUrl), normalized);
        return owner.toBase58();
    } catch {
        try {
            const name = normalized.replace(/\.sol$/, '');
            const res = await fetch(`${SNS_API_BASE}/v2/domain/resolve/${name}`);
            if (!res.ok) return null;
            const data = await res.json();
            return typeof data.result === 'string' ? data.result : null;
        } catch {
            return null;
        }
    }
}

export async function reverseResolveSolAddress(address: string, rpcUrl?: string): Promise<string | null> {
    if (!isValidSolanaAddress(address)) return null;

    const owner = new PublicKey(address);
    const connection = getConnection(rpcUrl);

    try {
        const favorite = await getFavoriteDomain(connection, owner);
        if (favorite?.reverse) {
            const domain = favorite.reverse.endsWith('.sol')
                ? favorite.reverse
                : `${favorite.reverse}.sol`;
            return normalizeSolDomain(domain);
        }
    } catch {
        // fallback
    }

    try {
        const domains = await getAllDomains(connection, owner);
        if (domains.length > 0) {
            const reverse = await reverseLookup(connection, domains[0]);
            if (reverse) {
                return normalizeSolDomain(reverse);
            }
        }
    } catch {
        // fallback
    }

    try {
        const res = await fetch(`${SNS_API_BASE}/v2/domain/reverse-lookup/${address}`);
        if (!res.ok) return null;
        const data = await res.json();
        if (typeof data.result !== 'string' || !data.result) return null;
        return normalizeSolDomain(data.result);
    } catch {
        return null;
    }
}

export async function checkSolDomainOwnership(
    domain: string,
    expectedOwnerAddress: string,
    rpcUrl?: string
): Promise<boolean | null> {
    const normalized = normalizeSolDomain(domain);
    if (!isValidSolDomain(normalized) || !isValidSolanaAddress(expectedOwnerAddress)) {
        return false;
    }

    try {
        const key = getDomainKeySync(normalized);
        const { registry, nftOwner } = await NameRegistryState.retrieve(
            getConnection(rpcUrl),
            key.pubkey
        );
        const expectedOwner = new PublicKey(expectedOwnerAddress).toBase58();
        const registryOwner = registry.owner.toBase58();
        const tokenizedOwner = nftOwner?.toBase58() ?? null;
        return registryOwner === expectedOwner || tokenizedOwner === expectedOwner;
    } catch {
        return null;
    }
}
