// Mock module for @gradiences/domain-resolver
// This is a temporary mock to allow the build to succeed

export function resolveDomain(domain: string): Promise<string | null> {
    return Promise.resolve(null);
}

export function validateDomain(domain: string): boolean {
    return domain.length > 0;
}

export const DOMAIN_TLDS = ['.sol', '.agent'];
