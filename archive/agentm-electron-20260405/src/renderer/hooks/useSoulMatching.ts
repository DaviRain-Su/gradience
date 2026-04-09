/**
 * Soul Matching Hook
 *
 * Manage compatibility matching and analysis
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { SoulProfile, MatchingReport, ProbeSession } from '@gradiences/soul-engine';
import { MatchingEngine } from '@gradiences/soul-engine';

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
    const engineRef = useRef<MatchingEngine | null>(null);

    // Initialize engine
    useEffect(() => {
        const init = async () => {
            try {
                if (!options.apiKey) {
                    setError('API key required');
                    return;
                }

                const engine = new MatchingEngine({
                    llm: {
                        provider: options.provider || 'openai',
                        apiKey: options.apiKey,
                        model: options.model || 'gpt-4',
                    },
                });

                await engine.initialize();
                engineRef.current = engine;
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

    // Analyze single match
    const analyzeMatch = useCallback(
        async (
            sourceProfile: SoulProfile,
            targetProfile: SoulProfile,
            probeSession?: ProbeSession,
        ): Promise<MatchingReport | null> => {
            if (!engineRef.current || !initialized) {
                setError('Engine not initialized');
                return null;
            }

            setLoading(true);
            setError(null);

            try {
                const report = await engineRef.current.analyzeMatch(sourceProfile, targetProfile, probeSession);

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
        [initialized],
    );

    // Find top matches
    const findMatches = useCallback(
        async (sourceProfile: SoulProfile, candidates: SoulProfile[], topK = 5): Promise<MatchingReport[]> => {
            if (!engineRef.current || !initialized) {
                setError('Engine not initialized');
                return [];
            }

            setLoading(true);
            setError(null);

            try {
                const reports = await engineRef.current.findMatches(sourceProfile, candidates, {
                    topK,
                    runLLMAnalysis: true,
                });

                console.log('[useSoulMatching] Found', reports.length, 'matches');
                return reports;
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Matching failed';
                setError(message);
                console.error('[useSoulMatching] Matching error:', err);
                return [];
            } finally {
                setLoading(false);
            }
        },
        [initialized],
    );

    return {
        initialized,
        loading,
        error,
        analyzeMatch,
        findMatches,
    };
}
