// Main exports
export { DomainResolver } from './resolver';
export { DomainCache } from './cache';

// Provider exports
export { SNSProvider } from './providers/sns';
export { ENSProvider } from './providers/ens';

// Type exports
export type { DomainRecord, ResolverConfig, SNSProviderConfig, ENSProviderConfig, Provider, CacheEntry } from './types';

// Error exports
export { DomainResolverError, ProviderError, ValidationError } from './types';

// Convenience function for quick resolution
import { DomainResolver } from './resolver';
import { ResolverConfig } from './types';

let defaultResolver: DomainResolver | null = null;

/**
 * Quick resolve function using default resolver instance
 * @param domain Domain to resolve
 * @param config Optional configuration (creates new resolver if provided)
 * @returns Resolved address or null
 */
export async function resolve(domain: string, config?: ResolverConfig): Promise<string | null> {
    if (config) {
        // Create temporary resolver with custom config
        const resolver = new DomainResolver(config);
        return resolver.resolve(domain);
    }

    // Use default resolver instance
    if (!defaultResolver) {
        defaultResolver = new DomainResolver();
    }

    return defaultResolver.resolve(domain);
}

/**
 * Quick reverse lookup function using default resolver instance
 * @param address Address to reverse lookup
 * @param config Optional configuration (creates new resolver if provided)
 * @returns Domain name or null
 */
export async function reverse(address: string, config?: ResolverConfig): Promise<string | null> {
    if (config) {
        // Create temporary resolver with custom config
        const resolver = new DomainResolver(config);
        return resolver.reverse(address);
    }

    // Use default resolver instance
    if (!defaultResolver) {
        defaultResolver = new DomainResolver();
    }

    return defaultResolver.reverse(address);
}

/**
 * Check if a domain is valid format
 * @param domain Domain to validate
 * @returns true if valid format
 */
export function isValidDomain(domain: string): boolean {
    // Create a temporary resolver for validation
    const resolver = new DomainResolver();
    return resolver.isValid(domain);
}

/**
 * Get the default resolver instance
 * @returns Default resolver instance
 */
export function getDefaultResolver(): DomainResolver {
    if (!defaultResolver) {
        defaultResolver = new DomainResolver();
    }
    return defaultResolver;
}

/**
 * Set a custom default resolver
 * @param resolver Custom resolver instance
 */
export function setDefaultResolver(resolver: DomainResolver): void {
    defaultResolver = resolver;
}

/**
 * Reset the default resolver
 */
export function resetDefaultResolver(): void {
    defaultResolver = null;
}

// Re-export constants for convenience
export const ENS_MAINNET_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
export const ENS_RESOLVER_INTERFACE_ID = '0x3b3b57de';
