'use client';
/**
 * Soul Matching Hook
 *
 * Manage compatibility matching and analysis
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { SoulProfile, MatchingReport, ProbeSession, MatchingDimension } from '@/types/soul';

interface UseSoulMatchingOptions {
    /** LLM API key */
    apiKey: string;

    /** LLM provider */
    provider?: 'openai' | 'anthropic';

    /** LLM model */
    model?: string;
}

interface UseSoulMatchingReturn {
    /** Matching engine initialized */
    initialized: boolean;

    /** Loading state */
    loading: boolean;

    /** Error message */
    error: string | null;

    /** Generate match report */
    analyzeMatch: (
        sourceProfile: SoulProfile,
        targetProfile: SoulProfile,
        probeSession?: ProbeSession,
    ) => Promise<MatchingReport | null>;

    /** Find top matches from candidates */
    findMatches: (sourceProfile: SoulProfile, candidates: SoulProfile[], topK?: number) => Promise<MatchingReport[]>;
}

export function useSoulMatching(options: UseSoulMatchingOptions): UseSoulMatchingReturn {
    const [initialized, setInitialized] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const initRef = useRef(false);

    // Initialize engine
    useEffect(() => {
        const init = async () => {
            try {
                if (!options.apiKey) {
                    setError('API key required for full matching');
                    // Still mark as initialized for demo mode
                    setInitialized(true);
                    return;
                }

                // Simulate initialization
                await new Promise((resolve) => setTimeout(resolve, 500));

                initRef.current = true;
                setInitialized(true);
                setError(null);

                console.log('[useSoulMatching] Engine initialized');
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to initialize');
                console.error('[useSoulMatching] Init error:', err);
            }
        };

        void init();
    }, [options.apiKey, options.provider, options.model]);

    // Calculate embedding similarity (mock implementation)
    const calculateEmbeddingSimilarity = (source: SoulProfile, target: SoulProfile) => {
        const sections = {
            identity: 0.7 + Math.random() * 0.2,
            values: calculateArrayOverlap(source.values.core, target.values.core),
            interests: calculateArrayOverlap(source.interests.topics, target.interests.topics),
            communication: calculateCommunicationMatch(source.communication, target.communication),
        };

        const overall = (sections.identity + sections.values + sections.interests + sections.communication) / 4;

        return { overall, sections };
    };

    const calculateArrayOverlap = (arr1: string[], arr2: string[]) => {
        const set1 = new Set(arr1.map((s) => s.toLowerCase()));
        const set2 = new Set(arr2.map((s) => s.toLowerCase()));
        const intersection = [...set1].filter((x) => set2.has(x));
        const union = new Set([...set1, ...set2]);
        return intersection.length / (union.size || 1);
    };

    const calculateCommunicationMatch = (comm1: SoulProfile['communication'], comm2: SoulProfile['communication']) => {
        let score = 0;
        if (comm1.tone === comm2.tone) score += 0.33;
        if (comm1.pace === comm2.pace) score += 0.33;
        if (comm1.depth === comm2.depth) score += 0.34;
        return Math.max(0.3, score);
    };

    // Analyze single match
    const analyzeMatch = useCallback(
        async (
            sourceProfile: SoulProfile,
            targetProfile: SoulProfile,
            probeSession?: ProbeSession,
        ): Promise<MatchingReport | null> => {
            setLoading(true);
            setError(null);

            try {
                // Calculate embedding similarity
                const embeddingMatch = calculateEmbeddingSimilarity(sourceProfile, targetProfile);

                // Generate LLM analysis (mock for now)
                const llmScore = Math.round(50 + Math.random() * 40);

                // Calculate weighted score
                const embeddingWeight = 0.4;
                const llmWeight = 0.6;
                const compatibilityScore = Math.round(
                    embeddingMatch.overall * 100 * embeddingWeight + llmScore * llmWeight,
                );

                // Generate dimensions analysis
                const dimensions = {
                    values: generateDimensionAnalysis('values', sourceProfile, targetProfile),
                    tone: generateDimensionAnalysis('tone', sourceProfile, targetProfile),
                    boundaries: generateDimensionAnalysis('boundaries', sourceProfile, targetProfile),
                    interests: generateDimensionAnalysis('interests', sourceProfile, targetProfile),
                };

                const report: MatchingReport = {
                    id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    sourceProfileId: sourceProfile.id,
                    targetProfileId: targetProfile.id,
                    compatibilityScore,
                    embeddingMatch,
                    analysis: {
                        assessment: generateAssessment(compatibilityScore, sourceProfile, targetProfile),
                        recommendedTopics: findCommonTopics(sourceProfile, targetProfile),
                        avoidTopics: findConflictingTopics(sourceProfile, targetProfile),
                        dimensions,
                    },
                    sessionId: probeSession?.id,
                    generatedAt: Date.now(),
                    breakdown: {
                        embedding: Math.round(embeddingMatch.overall * 100),
                        llm: llmScore,
                        weights: {
                            embedding: embeddingWeight,
                            llm: llmWeight,
                        },
                    },
                };

                console.log('[useSoulMatching] Analysis complete:', report.compatibilityScore);
                return report;
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Analysis failed';
                setError(message);
                console.error('[useSoulMatching] Analysis error:', err);
                return null;
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    // Find top matches
    const findMatches = useCallback(
        async (sourceProfile: SoulProfile, candidates: SoulProfile[], topK = 5): Promise<MatchingReport[]> => {
            setLoading(true);
            setError(null);

            try {
                const reports: MatchingReport[] = [];

                for (const candidate of candidates.slice(0, topK * 2)) {
                    const report = await analyzeMatch(sourceProfile, candidate);
                    if (report) {
                        reports.push(report);
                    }
                }

                // Sort by compatibility score
                reports.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

                console.log('[useSoulMatching] Found', reports.length, 'matches');
                return reports.slice(0, topK);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Matching failed';
                setError(message);
                console.error('[useSoulMatching] Matching error:', err);
                return [];
            } finally {
                setLoading(false);
            }
        },
        [analyzeMatch],
    );

    return {
        initialized,
        loading,
        error,
        analyzeMatch,
        findMatches,
    };
}

// Helper functions
function generateDimensionAnalysis(dimension: string, source: SoulProfile, target: SoulProfile): MatchingDimension {
    const score = Math.round(40 + Math.random() * 50);

    const dimensionContent: Record<
        string,
        { summary: string; evidence: string[]; risks: string[]; suggestions: string[] }
    > = {
        values: {
            summary: 'Core values show moderate alignment with some complementary differences.',
            evidence: ['Shared emphasis on growth and learning', 'Both prioritize meaningful work'],
            risks: ['Different approaches to risk-taking'],
            suggestions: ['Discuss value priorities early', 'Find common ground on deal-breakers'],
        },
        tone: {
            summary: 'Communication styles are compatible with complementary strengths.',
            evidence: ['Both prefer ' + source.communication.depth + ' conversations'],
            risks: ['Pace differences may cause minor friction'],
            suggestions: ['Establish communication preferences', 'Be mindful of response times'],
        },
        boundaries: {
            summary: 'Boundary preferences are well-aligned for respectful interaction.',
            evidence: ['Similar privacy expectations', 'Compatible conversation length preferences'],
            risks: ['Some topic restrictions may limit exploration'],
            suggestions: ['Respect forbidden topics', 'Check in on comfort levels'],
        },
        interests: {
            summary: 'Interest overlap provides solid foundation for engaging conversations.',
            evidence: ['Common topics in ' + source.interests.topics.slice(0, 2).join(', ')],
            risks: ['Skill gaps may require explanation'],
            suggestions: ['Explore shared interests first', 'Share expertise generously'],
        },
    };

    const content = dimensionContent[dimension] || dimensionContent.values;

    return {
        dimension,
        score,
        summary: content.summary,
        evidence: content.evidence,
        risks: content.risks,
        suggestions: content.suggestions,
    };
}

function generateAssessment(score: number, source: SoulProfile, target: SoulProfile): string {
    if (score >= 80) {
        return `Excellent compatibility between ${source.identity.displayName} and ${target.identity.displayName}. Strong alignment in core values and communication style suggests productive collaboration potential.`;
    } else if (score >= 60) {
        return `Good compatibility with complementary strengths. While there are some differences, they could enhance collaboration through diverse perspectives.`;
    } else if (score >= 40) {
        return `Moderate compatibility. Success will depend on clear communication and respecting boundaries. Consider starting with lighter topics.`;
    } else {
        return `Lower compatibility score suggests significant differences. Approach with curiosity and patience if you choose to connect.`;
    }
}

function findCommonTopics(source: SoulProfile, target: SoulProfile): string[] {
    const common = [
        ...source.interests.topics.filter((t) => target.interests.topics.includes(t)),
        ...source.values.core.filter((v) => target.values.core.includes(v)),
    ];
    return common.length > 0 ? common.slice(0, 5) : ['introductions', 'shared goals', 'learning interests'];
}

function findConflictingTopics(source: SoulProfile, target: SoulProfile): string[] {
    const allForbidden = [...source.boundaries.forbiddenTopics, ...target.boundaries.forbiddenTopics];
    return [...new Set(allForbidden)].slice(0, 5);
}
