declare module '@gradiences/domain-resolver' {
    export function resolveDomain(domain: string): Promise<string | null>;
    export function resolveAddress(address: string): Promise<string | null>;
    export interface DomainInfo {
        domain: string;
        address: string;
        owner: string;
    }
}
