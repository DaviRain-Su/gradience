import { DomainCache } from './cache';
import { SNSProvider } from './providers/sns';
import { ENSProvider } from './providers/ens';
import { Provider, ResolverConfig, DomainResolverError, ValidationError, ProviderError } from './types';

export class DomainResolver {
    private cache: DomainCache;
    private providers: Map<string, Provider>;
    private config: ResolverConfig;

    constructor(config: ResolverConfig = {}) {
        this.config = config;

        // Initialize cache
        const cacheConfig = config.cache || {};
        this.cache = new DomainCache(
            cacheConfig.maxSize || 1000,
            cacheConfig.ttl || 5 * 60 * 1000, // 5 minutes default
        );

        // Initialize providers
        this.providers = new Map();

        // Add SNS provider by default
        this.providers.set('sns', new SNSProvider(config.providers?.sns));

        // Add ENS provider (stub for now)
        this.providers.set('ens', new ENSProvider(config.providers?.ens));
    }

    /**
     * Resolve a domain name to an address
     * @param domain Domain name (e.g., 'alice.sol', 'bob.eth')
     * @returns Public key/address or null if not found
     */
    async resolve(domain: string): Promise<string | null> {
        // Validate domain format
        if (!this.isValid(domain)) {
            throw new ValidationError(`Invalid domain format: ${domain}`, domain);
        }

        const normalizedDomain = this.normalizeDomain(domain);

        // Check cache first
        const cached = this.cache.get(normalizedDomain);
        if (cached !== undefined) {
            return cached;
        }

        // Find appropriate provider
        const provider = this.findProvider(normalizedDomain);
        if (!provider) {
            throw new DomainResolverError(
                `No provider found for domain: ${normalizedDomain}`,
                'NO_PROVIDER',
                normalizedDomain,
            );
        }

        try {
            // Resolve using provider
            const result = await provider.resolve(normalizedDomain);

            // Cache the result (including null results to avoid repeated lookups)
            this.cache.set(normalizedDomain, result);

            return result;
        } catch (error) {
            if (error instanceof ProviderError || error instanceof ValidationError) {
                throw error;
            }

            throw new DomainResolverError(
                `Failed to resolve domain ${normalizedDomain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'RESOLUTION_FAILED',
                normalizedDomain,
                error instanceof Error ? error : undefined,
            );
        }
    }

    /**
     * Reverse lookup: find domain name for an address
     * @param address Public key/address to look up
     * @returns Domain name or null if not found
     */
    async reverse(address: string): Promise<string | null> {
        if (!address || typeof address !== 'string') {
            throw new ValidationError(`Invalid address: ${address}`, address);
        }

        const normalizedAddress = address.trim();

        // Check cache first (reverse lookup cache key)
        const cacheKey = `reverse:${normalizedAddress}`;
        const cached = this.cache.get(cacheKey);
        if (cached !== undefined) {
            return cached;
        }

        // Try all providers that support reverse lookup
        const errors: Error[] = [];
        let attemptedProviders = 0;

        for (const provider of this.providers.values()) {
            if (!provider.reverse) {
                continue;
            }

            attemptedProviders++;
            try {
                const result = await provider.reverse(normalizedAddress);
                if (result) {
                    // Cache the result
                    this.cache.set(cacheKey, result);
                    return result;
                }
            } catch (error) {
                // Only collect errors that are not "not implemented" errors
                if (error instanceof Error && !error.message.includes('not implemented')) {
                    errors.push(error);
                }
                // Continue trying other providers
            }
        }

        // If no provider found a result, cache null and return
        this.cache.set(cacheKey, null);

        // Only throw errors if we actually attempted some providers and got real errors
        if (errors.length > 0 && attemptedProviders > 0) {
            throw new DomainResolverError(
                `Reverse lookup failed for ${normalizedAddress}. Errors: ${errors.map((e) => e.message).join('; ')}`,
                'REVERSE_LOOKUP_FAILED',
                normalizedAddress,
                errors[0],
            );
        }

        return null;
    }

    /**
     * Validate domain format
     * @param domain Domain to validate
     * @returns true if valid, false otherwise
     */
    isValid(domain: string): boolean {
        if (!domain || typeof domain !== 'string') {
            return false;
        }

        const normalized = this.normalizeDomain(domain);

        // Basic format check
        if (!normalized.includes('.')) {
            return false;
        }

        // Find provider that supports this domain
        const provider = this.findProvider(normalized);
        if (!provider) {
            return false;
        }

        // Let the provider do specific validation
        return provider.supports(normalized);
    }

    /**
     * Add a custom provider
     * @param name Provider name
     * @param provider Provider instance
     */
    addProvider(name: string, provider: Provider): void {
        this.providers.set(name, provider);
    }

    /**
     * Remove a provider
     * @param name Provider name
     */
    removeProvider(name: string): boolean {
        return this.providers.delete(name);
    }

    /**
     * Get list of supported domains
     * @returns Array of supported TLDs
     */
    getSupportedDomains(): string[] {
        const domains = new Set<string>();

        for (const provider of this.providers.values()) {
            // This is a simplified approach - in a full implementation,
            // providers would expose their supported TLDs
            if (provider.name === 'SNS') {
                domains.add('.sol');
            } else if (provider.name === 'ENS') {
                domains.add('.eth');
            }
        }

        return Array.from(domains);
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; maxSize: number; defaultTTL: number } {
        return this.cache.getStats();
    }

    /**
     * Cleanup expired cache entries
     */
    cleanupCache(): number {
        return this.cache.cleanup();
    }

    private normalizeDomain(domain: string): string {
        return domain.toLowerCase().trim();
    }

    private findProvider(domain: string): Provider | undefined {
        for (const provider of this.providers.values()) {
            if (provider.supports(domain)) {
                return provider;
            }
        }
        return undefined;
    }
}
