/**
 * Profile Domain Types
 *
 * Type definitions for domain-related components
 *
 * @module components/profile/types
 */

/** Supported domain types */
export type DomainType = 'sol' | 'eth' | 'ens' | 'bonfida';

/** Domain status in the system */
export type DomainStatus = 'linked' | 'pending' | 'verified' | 'failed';

/** Domain information structure */
export interface DomainInfo {
    /** Full domain name (e.g., "example.sol") */
    name: string;
    /** Domain type */
    type: DomainType;
    /** Current status */
    status: DomainStatus;
    /** Resolver address or registry reference */
    resolver?: string;
    /** Transaction hash for on-chain operations */
    txHash?: string;
    /** When the domain was linked/verified */
    linkedAt?: number;
    /** Error message if failed */
    error?: string;
}

/** Props for domain validation */
export interface DomainValidationResult {
    valid: boolean;
    error?: string;
    normalized?: string;
}

/** Domain registration/link input state */
export interface DomainInputState {
    value: string;
    isValid: boolean;
    isChecking: boolean;
    error: string | null;
    normalizedDomain: string | null;
}

/** Profile with domain information */
export interface ProfileWithDomains {
    agent: string;
    displayName: string;
    avatarUrl?: string;
    domains: DomainInfo[];
    primaryDomain?: DomainInfo;
}
