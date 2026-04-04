declare module '@gradiences/domain-resolver' {
    export function resolveDomain(domain: string): Promise<string | null>;
    export function resolveAddress(address: string): Promise<string | null>;
    export interface DomainInfo {
        domain: string;
        address: string;
        owner: string;
    }
}

declare module '@gradiences/soul-engine' {
    export interface SoulProfile {
        soulType: string;
        identity: { displayName: string; bio: string };
        values: { core: string[]; priorities: string[]; dealBreakers: string[] };
    }
    export interface MatchReport {
        score: number;
        compatibility: number;
        sharedValues: string[];
        conflictAreas: string[];
        topics: Array<{ name: string; alignment: number }>;
        summary: string;
    }
    export interface MatchingReport {
        overallScore: number;
        analysis: {
            recommendedTopics: string[];
            avoidTopics: string[];
            dimensions: Array<{ name: string; score: number; description: string }>;
        };
        embeddingMatch: {
            overall: number;
            sections: Record<string, number>;
        };
    }
    export function computeMatch(a: SoulProfile, b: SoulProfile): MatchReport;
}
