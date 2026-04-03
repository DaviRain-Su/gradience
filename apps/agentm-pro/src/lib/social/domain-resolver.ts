/**
 * Domain Resolution for Agent Social Platform
 *
 * Resolves .sol (SNS) and .eth (ENS) domains to public keys and vice versa.
 * Provides a unified interface for multi-chain domain resolution.
 */

export interface DomainResolution {
    domain: string;
    address: string;
    chain: 'solana' | 'ethereum';
    source: 'sns' | 'ens';
    resolvedAt: number;
}

export interface DomainResolverConfig {
    solanaRpcUrl?: string;
    ensRpcUrl?: string;
}

const DEFAULT_SOLANA_RPC = 'https://api.mainnet-beta.solana.com';
const SNS_API_BASE = 'https://sns-api.bonfida.com';

export class DomainResolver {
    private config: Required<DomainResolverConfig>;
    private cache = new Map<string, DomainResolution>();

    constructor(config?: DomainResolverConfig) {
        this.config = {
            solanaRpcUrl: config?.solanaRpcUrl ?? DEFAULT_SOLANA_RPC,
            ensRpcUrl: config?.ensRpcUrl ?? '',
        };
    }

    async resolve(domainOrAddress: string): Promise<DomainResolution | null> {
        const cached = this.cache.get(domainOrAddress);
        if (cached && Date.now() - cached.resolvedAt < 300_000) {
            return cached;
        }

        if (domainOrAddress.endsWith('.sol')) {
            return this.resolveSNS(domainOrAddress);
        }
        if (domainOrAddress.endsWith('.eth')) {
            return this.resolveENS(domainOrAddress);
        }
        // Try reverse resolution
        return this.reverseResolve(domainOrAddress);
    }

    async resolveSNS(domain: string): Promise<DomainResolution | null> {
        try {
            const name = domain.replace(/\.sol$/, '');
            const res = await fetch(`${SNS_API_BASE}/v2/domain/resolve/${name}`);
            if (!res.ok) return null;
            const data = await res.json();
            const address = data.result as string;
            if (!address) return null;

            const resolution: DomainResolution = {
                domain,
                address,
                chain: 'solana',
                source: 'sns',
                resolvedAt: Date.now(),
            };
            this.cache.set(domain, resolution);
            this.cache.set(address, resolution);
            return resolution;
        } catch {
            return null;
        }
    }

    async resolveENS(domain: string): Promise<DomainResolution | null> {
        try {
            // Use public ENS resolution API
            const res = await fetch(`https://api.ensdata.net/${domain}`);
            if (!res.ok) return null;
            const data = await res.json();
            const address = data.address as string;
            if (!address) return null;

            const resolution: DomainResolution = {
                domain,
                address,
                chain: 'ethereum',
                source: 'ens',
                resolvedAt: Date.now(),
            };
            this.cache.set(domain, resolution);
            this.cache.set(address, resolution);
            return resolution;
        } catch {
            return null;
        }
    }

    async reverseResolve(address: string): Promise<DomainResolution | null> {
        // Try SNS reverse resolution first (Solana addresses are base58)
        if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
            try {
                const res = await fetch(`${SNS_API_BASE}/v2/domain/reverse-lookup/${address}`);
                if (res.ok) {
                    const data = await res.json();
                    const domain = data.result as string;
                    if (domain) {
                        const resolution: DomainResolution = {
                            domain: `${domain}.sol`,
                            address,
                            chain: 'solana',
                            source: 'sns',
                            resolvedAt: Date.now(),
                        };
                        this.cache.set(domain, resolution);
                        this.cache.set(address, resolution);
                        return resolution;
                    }
                }
            } catch {
                // Fall through
            }
        }

        return null;
    }

    /** Format display name: use domain if available, otherwise truncate address */
    async formatDisplayName(address: string): Promise<string> {
        const resolution = await this.resolve(address);
        if (resolution) return resolution.domain;
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    }

    clearCache(): void {
        this.cache.clear();
    }
}
