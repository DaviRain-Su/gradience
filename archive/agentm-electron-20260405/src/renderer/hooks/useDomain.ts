/**
 * useDomain Hook
 *
 * React hook for domain resolution operations
 *
 * @module hooks/useDomain
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { resolve, reverse, isValidDomain, getDefaultResolver, type ResolverConfig } from '@gradiences/domain-resolver';

interface UseDomainOptions {
    /** Auto-resolve on mount if domain/address provided */
    autoResolve?: boolean;
    /** Resolver configuration */
    config?: ResolverConfig;
}

interface UseDomainReturn {
    /** Resolve domain to address */
    resolveDomain: (domain: string) => Promise<string | null>;
    /** Reverse resolve address to domain */
    reverseResolve: (address: string) => Promise<string | null>;
    /** Check if domain format is valid */
    validateDomain: (domain: string) => boolean;
    /** Current resolved address */
    resolvedAddress: string | null;
    /** Current resolved domain */
    resolvedDomain: string | null;
    /** Loading state */
    loading: boolean;
    /** Error message */
    error: string | null;
    /** Clear error */
    clearError: () => void;
}

/**
 * Hook for domain resolution operations
 */
export function useDomain(options: UseDomainOptions = {}): UseDomainReturn {
    const { autoResolve = false, config } = options;

    const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
    const [resolvedDomain, setResolvedDomain] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Cache for resolved domains to avoid repeated calls
    const cacheRef = useRef<Map<string, string>>(new Map());

    const resolveDomain = useCallback(
        async (domain: string): Promise<string | null> => {
            if (!domain) {
                setError('Domain is required');
                return null;
            }

            if (!isValidDomain(domain)) {
                setError('Invalid domain format');
                return null;
            }

            // Check cache
            const cached = cacheRef.current.get(`domain:${domain}`);
            if (cached) {
                setResolvedAddress(cached);
                return cached;
            }

            setLoading(true);
            setError(null);

            try {
                const address = await resolve(domain, config);
                setResolvedAddress(address);

                if (address) {
                    cacheRef.current.set(`domain:${domain}`, address);
                    cacheRef.current.set(`address:${address}`, domain);
                } else {
                    setError('Domain not registered');
                }

                return address;
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to resolve domain';
                setError(message);
                console.error('Domain resolution error:', err);
                return null;
            } finally {
                setLoading(false);
            }
        },
        [config],
    );

    const reverseResolve = useCallback(
        async (address: string): Promise<string | null> => {
            if (!address) {
                setError('Address is required');
                return null;
            }

            // Check cache
            const cached = cacheRef.current.get(`address:${address}`);
            if (cached) {
                setResolvedDomain(cached);
                return cached;
            }

            setLoading(true);
            setError(null);

            try {
                const domain = await reverse(address, config);
                setResolvedDomain(domain);

                if (domain) {
                    cacheRef.current.set(`address:${address}`, domain);
                    cacheRef.current.set(`domain:${domain}`, address);
                }

                return domain;
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to reverse resolve';
                setError(message);
                console.error('Reverse resolution error:', err);
                return null;
            } finally {
                setLoading(false);
            }
        },
        [config],
    );

    const validateDomain = useCallback((domain: string): boolean => {
        return isValidDomain(domain);
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Clear cache on unmount
    useEffect(() => {
        return () => {
            cacheRef.current.clear();
        };
    }, []);

    return {
        resolveDomain,
        reverseResolve,
        validateDomain,
        resolvedAddress,
        resolvedDomain,
        loading,
        error,
        clearError,
    };
}

/**
 * Hook for managing a specific domain/address pair
 */
interface UseDomainProfileOptions {
    /** Initial domain */
    domain?: string;
    /** Initial address */
    address?: string;
    /** Auto-resolve on mount */
    autoResolve?: boolean;
}

interface UseDomainProfileReturn {
    /** Domain (from input or reverse resolved) */
    domain: string | null;
    /** Address (from input or resolved) */
    address: string | null;
    /** Set domain manually */
    setDomain: (domain: string) => void;
    /** Set address manually */
    setAddress: (address: string) => void;
    /** Refresh resolution */
    refresh: () => Promise<void>;
    /** Loading state */
    loading: boolean;
    /** Error message */
    error: string | null;
}

/**
 * Hook for managing a domain profile (bidirectional resolution)
 */
export function useDomainProfile(options: UseDomainProfileOptions = {}): UseDomainProfileReturn {
    const { domain: initialDomain, address: initialAddress, autoResolve = true } = options;

    const [domain, setDomainState] = useState<string | null>(initialDomain || null);
    const [address, setAddressState] = useState<string | null>(initialAddress || null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {
        resolveDomain,
        reverseResolve,
        loading: resolveLoading,
        error: resolveError,
    } = useDomain({ autoResolve: false });

    // Sync loading and error states
    useEffect(() => {
        setLoading(resolveLoading);
    }, [resolveLoading]);

    useEffect(() => {
        setError(resolveError);
    }, [resolveError]);

    // Auto-resolve on mount
    useEffect(() => {
        if (!autoResolve) return;

        if (initialDomain && !initialAddress) {
            resolveDomain(initialDomain).then((addr) => {
                if (addr) setAddressState(addr);
            });
        } else if (initialAddress && !initialDomain) {
            reverseResolve(initialAddress).then((dom) => {
                if (dom) setDomainState(dom);
            });
        }
    }, [initialDomain, initialAddress, autoResolve, resolveDomain, reverseResolve]);

    const setDomain = useCallback(
        async (newDomain: string) => {
            setDomainState(newDomain);
            const addr = await resolveDomain(newDomain);
            if (addr) {
                setAddressState(addr);
            }
        },
        [resolveDomain],
    );

    const setAddress = useCallback(
        async (newAddress: string) => {
            setAddressState(newAddress);
            const dom = await reverseResolve(newAddress);
            if (dom) {
                setDomainState(dom);
            }
        },
        [reverseResolve],
    );

    const refresh = useCallback(async () => {
        if (domain) {
            const addr = await resolveDomain(domain);
            if (addr) setAddressState(addr);
        } else if (address) {
            const dom = await reverseResolve(address);
            if (dom) setDomainState(dom);
        }
    }, [domain, address, resolveDomain, reverseResolve]);

    return {
        domain,
        address,
        setDomain,
        setAddress,
        refresh,
        loading,
        error,
    };
}

export default useDomain;
