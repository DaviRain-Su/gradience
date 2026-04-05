/**
 * Matching Engine
 * 
 * Complete matching pipeline: Embedding + LLM + Report Generation
 * 
 * @module @gradiences/soul-engine/matching
 */

export * from './embedding.js';
export * from './llm-analyzer.js';
export * from './report-generator.js';

import { EmbeddingMatcher } from './embedding.js';
import { LLMAnalyzer } from './llm-analyzer.js';
import { ReportGenerator } from './report-generator.js';
import type { SoulProfile } from '../types.js';
import type { ProbeSession } from '../probe-types.js';
import type { LLMConfig, LLMConfigWithFallback } from '../llm-config.js';
import type { EmbeddingMatcherConfig } from './embedding.js';
import type { ReportOptions, MatchingReport } from './report-generator.js';

/**
 * Complete matching engine configuration
 */
export interface MatchingEngineConfig {
    /** Embedding matcher config */
    embedding?: EmbeddingMatcherConfig;

    /** LLM analyzer config (with fallback support) */
    llm: LLMConfig | LLMConfigWithFallback;
}

// Re-export LLMConfig from unified config module for convenience
export type { 
    LLMConfig, 
    LLMProvider, 
    LLMConfigWithFallback, 
    FallbackMode 
} from '../llm-config.js';

// Re-export functions
export { 
    buildLLMConfigWithFallback,
    getFallbackModeDescription 
} from '../llm-config.js';

/**
 * Complete Matching Engine
 * 
 * Orchestrates the full matching pipeline
 */
export class MatchingEngine {
    private embeddingMatcher: EmbeddingMatcher;
    private llmAnalyzer: LLMAnalyzer;
    private config: MatchingEngineConfig;
    
    constructor(config: MatchingEngineConfig) {
        this.config = config;
        this.embeddingMatcher = new EmbeddingMatcher(config.embedding);
        
        // Check if we should use rule-based analysis
        const llmConfig = config.llm as LLMConfigWithFallback;
        const useRuleBased = llmConfig.fallbackMode !== 'off' || !config.llm.apiKey;
        
        this.llmAnalyzer = new LLMAnalyzer(config.llm, { useRuleBased });
    }
    
    /**
     * Initialize the matching engine
     */
    async initialize(): Promise<void> {
        await this.embeddingMatcher.initialize();
        
        const llmConfig = this.config.llm as LLMConfigWithFallback;
        const mode = llmConfig.fallbackMode || (this.config.llm.apiKey ? 'off' : 'embedding-only');
        
        console.log(`[MatchingEngine] Initialized (mode: ${mode})`);
    }
    
    /**
     * Find and analyze top matches for a source profile
     */
    async findMatches(
        sourceProfile: SoulProfile,
        candidateProfiles: SoulProfile[],
        options?: {
            topK?: number;
            runLLMAnalysis?: boolean;
        }
    ): Promise<MatchingReport[]> {
        // Step 1: Fast embedding-based filtering
        const embeddingMatches = await this.embeddingMatcher.findTopMatches(
            sourceProfile,
            candidateProfiles
        );
        
        console.log(`[MatchingEngine] Found ${embeddingMatches.length} embedding matches`);
        
        // Step 2: Optional LLM deep analysis on top matches
        const reports: MatchingReport[] = [];
        
        const topK = options?.topK || Math.min(embeddingMatches.length, 5);
        const runLLM = options?.runLLMAnalysis !== false; // Default true
        
        for (let i = 0; i < topK; i++) {
            const match = embeddingMatches[i];
            const targetProfile = candidateProfiles.find(p => p.id === match.profileId);
            
            if (!targetProfile) {
                continue;
            }
            
            // Run LLM analysis if enabled
            let llmAnalysis;
            if (runLLM) {
                llmAnalysis = await this.llmAnalyzer.analyzeCompatibility(
                    sourceProfile,
                    targetProfile
                );
            } else {
                // Create dummy analysis
                llmAnalysis = this.createDummyAnalysis();
            }
            
            // Generate report
            const report = ReportGenerator.generate({
                sourceProfile,
                targetProfile,
                embeddingMatch: match,
                llmAnalysis,
            });
            
            reports.push(report);
        }
        
        console.log(`[MatchingEngine] Generated ${reports.length} reports`);
        
        return reports;
    }
    
    /**
     * Analyze compatibility between two specific profiles
     */
    async analyzeMatch(
        sourceProfile: SoulProfile,
        targetProfile: SoulProfile,
        probeSession?: ProbeSession,
        options?: ReportOptions
    ): Promise<MatchingReport> {
        // Generate embeddings
        const sourceEmbedding = await this.embeddingMatcher.generateEmbedding(sourceProfile);
        const targetEmbedding = await this.embeddingMatcher.generateEmbedding(targetProfile);
        
        const sourceSections = await this.embeddingMatcher.generateSectionEmbeddings(sourceProfile);
        const targetSections = await this.embeddingMatcher.generateSectionEmbeddings(targetProfile);
        
        // Compute similarities
        const overall = this.embeddingMatcher.cosineSimilarity(sourceEmbedding, targetEmbedding);
        const values = this.embeddingMatcher.cosineSimilarity(sourceSections.values, targetSections.values);
        const interests = this.embeddingMatcher.cosineSimilarity(sourceSections.interests, targetSections.interests);
        const style = this.embeddingMatcher.cosineSimilarity(sourceSections.style, targetSections.style);
        
        const embeddingMatch = {
            profileId: targetProfile.id,
            similarity: overall,
            sections: { values, interests, style, overall },
        };
        
        // Run LLM analysis
        const llmAnalysis = await this.llmAnalyzer.analyzeCompatibility(
            sourceProfile,
            targetProfile,
            probeSession
        );
        
        // Generate report
        const report = ReportGenerator.generate({
            sourceProfile,
            targetProfile,
            embeddingMatch,
            llmAnalysis,
            probeSession,
            options,
        });
        
        return report;
    }
    
    /**
     * Create a dummy LLM analysis (for fast mode)
     */
    private createDummyAnalysis() {
        return {
            overallScore: 50,
            dimensions: {
                values: { dimension: 'values' as const, score: 50, summary: 'Not analyzed', evidence: [], risks: [], suggestions: [] },
                tone: { dimension: 'tone' as const, score: 50, summary: 'Not analyzed', evidence: [], risks: [], suggestions: [] },
                boundaries: { dimension: 'boundaries' as const, score: 50, summary: 'Not analyzed', evidence: [], risks: [], suggestions: [] },
                interests: { dimension: 'interests' as const, score: 50, summary: 'Not analyzed', evidence: [], risks: [], suggestions: [] },
            },
            recommendedTopics: [],
            avoidTopics: [],
            assessment: 'LLM analysis skipped',
        };
    }
}
