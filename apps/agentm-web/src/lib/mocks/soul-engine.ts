// Mock module for @gradiences/soul-engine
// This is a temporary mock to allow the build to succeed

export interface SoulProfile {
    id: string;
    identity: {
        displayName: string;
        bio: string;
    };
    values: {
        core: string[];
    };
    interests: {
        topics: string[];
    };
    communication: {
        tone: string;
        pace: string;
        depth: string;
    };
    soulType: 'human' | 'agent';
}

export function calculateCompatibility(profile1: SoulProfile, profile2: SoulProfile): number {
    return Math.random() * 100;
}

export function generateSoulId(): string {
    return `soul_${Math.random().toString(36).substring(2, 9)}`;
}
