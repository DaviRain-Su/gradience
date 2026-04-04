import type { SoulProfile } from '../../types/soul';

export interface MatchResult {
    score: number;
    breakdown: {
        values: number;
        interests: number;
        communication: number;
    };
    sharedValues: string[];
    sharedInterests: string[];
    conflictAreas: string[];
}

function intersect(a: string[], b: string[]): string[] {
    const setB = new Set(b.map(s => s.toLowerCase()));
    return a.filter(v => setB.has(v.toLowerCase()));
}

function jaccardSimilarity(a: string[], b: string[]): number {
    if (a.length === 0 && b.length === 0) return 1;
    const setA = new Set(a.map(s => s.toLowerCase()));
    const setB = new Set(b.map(s => s.toLowerCase()));
    const intersection = [...setA].filter(x => setB.has(x)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
}

const TONE_DISTANCE: Record<string, number> = {
    'formal-formal': 1, 'formal-technical': 0.7, 'formal-friendly': 0.3, 'formal-casual': 0.2,
    'technical-technical': 1, 'technical-friendly': 0.5, 'technical-casual': 0.3,
    'friendly-friendly': 1, 'friendly-casual': 0.8,
    'casual-casual': 1,
};

const PACE_DISTANCE: Record<string, number> = {
    'fast-fast': 1, 'fast-moderate': 0.6, 'fast-slow': 0.2,
    'moderate-moderate': 1, 'moderate-slow': 0.6,
    'slow-slow': 1,
};

const DEPTH_DISTANCE: Record<string, number> = {
    'deep-deep': 1, 'deep-moderate': 0.6, 'deep-surface': 0.2,
    'moderate-moderate': 1, 'moderate-surface': 0.5,
    'surface-surface': 1,
};

function commSimilarity(key: string, map: Record<string, number>): number {
    return map[key] ?? map[key.split('-').reverse().join('-')] ?? 0.5;
}

function communicationScore(a: SoulProfile['communication'], b: SoulProfile['communication']): number {
    const tone = commSimilarity(`${a.tone}-${b.tone}`, TONE_DISTANCE);
    const pace = commSimilarity(`${a.pace}-${b.pace}`, PACE_DISTANCE);
    const depth = commSimilarity(`${a.depth}-${b.depth}`, DEPTH_DISTANCE);
    return (tone * 0.4 + pace * 0.3 + depth * 0.3);
}

export function calculateCompatibility(p1: SoulProfile, p2: SoulProfile): MatchResult {
    const valuesScore = jaccardSimilarity(p1.values.core, p2.values.core) * 0.6
        + jaccardSimilarity(p1.values.priorities, p2.values.priorities) * 0.3
        + (intersect(p1.values.dealBreakers, p2.values.dealBreakers).length > 0 ? 0.1 : 0);

    const interestsScore = jaccardSimilarity(p1.interests.topics, p2.interests.topics) * 0.5
        + jaccardSimilarity(p1.interests.skills, p2.interests.skills) * 0.3
        + jaccardSimilarity(p1.interests.goals, p2.interests.goals) * 0.2;

    const commScore = communicationScore(p1.communication, p2.communication);

    const overall = valuesScore * 40 + interestsScore * 35 + commScore * 25;

    const sharedValues = intersect(p1.values.core, p2.values.core);
    const sharedInterests = intersect(p1.interests.topics, p2.interests.topics);

    const conflictAreas: string[] = [];
    const p1Breakers = new Set(p1.values.dealBreakers.map(s => s.toLowerCase()));
    for (const v of p2.values.core) {
        if (p1Breakers.has(v.toLowerCase())) conflictAreas.push(v);
    }
    const p2Breakers = new Set(p2.values.dealBreakers.map(s => s.toLowerCase()));
    for (const v of p1.values.core) {
        if (p2Breakers.has(v.toLowerCase())) conflictAreas.push(v);
    }

    return {
        score: Math.round(overall * 10) / 10,
        breakdown: {
            values: Math.round(valuesScore * 100),
            interests: Math.round(interestsScore * 100),
            communication: Math.round(commScore * 100),
        },
        sharedValues,
        sharedInterests,
        conflictAreas,
    };
}

export function generateSoulId(): string {
    return `soul_${Math.random().toString(36).substring(2, 9)}`;
}
