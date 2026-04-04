// Mock module for @gradiences/domain-resolver
// This is a temporary mock to allow the build to succeed

export function resolveDomain(domain: string): Promise<string | null> {
    return Promise.resolve(null);
}

export function validateDomain(domain: string): boolean {
    return domain.length > 0;
}

export const DOMAIN_TLDS = ['.sol', '.agent'];

// Additional exports needed by components
export function resolve(domain: string): Promise<{ address: string; domain: string } | null> {
    return Promise.resolve(null);
}

export function reverse(address: string): Promise<string | null> {
    return Promise.resolve(null);
}

export function isValidDomain(domain: string): boolean {
    return domain.length > 0 && (domain.endsWith('.sol') || domain.endsWith('.agent'));
}
