/**
 * Embedding-based Matching
 *
 * Fast similarity matching using sentence embeddings from Transformers.js
 *
 * @module @gradiences/soul-engine/matching/embedding
 */

import { pipeline, type Pipeline } from '@xenova/transformers';
import type { SoulProfile } from '../types.js';

/**
 * Embedding match result
 */
export interface EmbeddingMatch {
    /** Target Soul Profile ID */
    profileId: string;

    /** Cosine similarity score (0-1) */
    similarity: number;

    /** Matched sections (for debugging) */
    sections: {
        values: number;
        interests: number;
        style: number;
        overall: number;
    };
}

/**
 * Embedding matcher configuration
 */
export interface EmbeddingMatcherConfig {
    /** Model name (default: Xenova/all-MiniLM-L6-v2) */
    model?: string;

    /** Top K matches to return */
    topK?: number;

    /** Minimum similarity threshold (0-1) */
    minSimilarity?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<EmbeddingMatcherConfig> = {
    model: 'Xenova/all-MiniLM-L6-v2',
    topK: 10,
    minSimilarity: 0.3,
};

/**
 * Embedding Matcher
 *
 * Uses Transformers.js to generate embeddings and compute similarity
 */
export class EmbeddingMatcher {
    private config: Required<EmbeddingMatcherConfig>;
    private extractor?: Pipeline;
    private isInitialized = false;

    constructor(config: EmbeddingMatcherConfig = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Initialize the model
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        console.log('[EmbeddingMatcher] Loading model:', this.config.model);

        this.extractor = (await pipeline('feature-extraction', this.config.model)) as Pipeline;
        this.isInitialized = true;

        console.log('[EmbeddingMatcher] Model loaded');
    }

    /**
     * Generate embedding from Soul Profile
     */
    async generateEmbedding(profile: SoulProfile): Promise<number[]> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Combine key sections into text
        const text = this.profileToText(profile);

        // Generate embedding
        const output = await this.extractor!(text, {
            pooling: 'mean',
            normalize: true,
        });

        // Extract embedding as array
        return Array.from(output.data as Float32Array);
    }

    /**
     * Generate embeddings for specific sections
     */
    async generateSectionEmbeddings(profile: SoulProfile): Promise<{
        values: number[];
        interests: number[];
        style: number[];
    }> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const valuesText = this.valuesToText(profile);
        const interestsText = this.interestsToText(profile);
        const styleText = this.styleToText(profile);

        const [values, interests, style] = await Promise.all([
            this.embedText(valuesText),
            this.embedText(interestsText),
            this.embedText(styleText),
        ]);

        return { values, interests, style };
    }

    /**
     * Embed a text string
     */
    private async embedText(text: string): Promise<number[]> {
        const output = await this.extractor!(text, {
            pooling: 'mean',
            normalize: true,
        });

        return Array.from(output.data as Float32Array);
    }

    /**
     * Compute cosine similarity between two embeddings
     */
    cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error('Embedding dimensions must match');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

        if (magnitude === 0) {
            return 0;
        }

        return dotProduct / magnitude;
    }

    /**
     * Find top K matches from a pool of candidates
     */
    async findTopMatches(sourceProfile: SoulProfile, candidateProfiles: SoulProfile[]): Promise<EmbeddingMatch[]> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Generate embeddings
        const sourceEmbedding = await this.generateEmbedding(sourceProfile);
        const sourceSections = await this.generateSectionEmbeddings(sourceProfile);

        const matches: EmbeddingMatch[] = [];

        for (const candidate of candidateProfiles) {
            // Skip self
            if (candidate.id === sourceProfile.id) {
                continue;
            }

            const candidateEmbedding = await this.generateEmbedding(candidate);
            const candidateSections = await this.generateSectionEmbeddings(candidate);

            // Compute overall similarity
            const overall = this.cosineSimilarity(sourceEmbedding, candidateEmbedding);

            // Compute section similarities
            const valuesSim = this.cosineSimilarity(sourceSections.values, candidateSections.values);
            const interestsSim = this.cosineSimilarity(sourceSections.interests, candidateSections.interests);
            const styleSim = this.cosineSimilarity(sourceSections.style, candidateSections.style);

            // Filter by threshold
            if (overall < this.config.minSimilarity) {
                continue;
            }

            matches.push({
                profileId: candidate.id,
                similarity: overall,
                sections: {
                    values: valuesSim,
                    interests: interestsSim,
                    style: styleSim,
                    overall,
                },
            });
        }

        // Sort by similarity (descending)
        matches.sort((a, b) => b.similarity - a.similarity);

        // Return top K
        return matches.slice(0, this.config.topK);
    }

    // ============ Private Helpers ============

    /**
     * Convert Soul Profile to text representation
     */
    private profileToText(profile: SoulProfile): string {
        const parts: string[] = [];

        // Values
        parts.push(this.valuesToText(profile));

        // Interests
        parts.push(this.interestsToText(profile));

        // Communication style
        parts.push(this.styleToText(profile));

        return parts.join(' ');
    }

    /**
     * Convert values to text
     */
    private valuesToText(profile: SoulProfile): string {
        const parts: string[] = [];

        if (profile.values.core.length > 0) {
            parts.push('Core values: ' + profile.values.core.join(', '));
        }

        if (profile.values.priorities.length > 0) {
            parts.push('Priorities: ' + profile.values.priorities.join(', '));
        }

        if (profile.values.dealBreakers.length > 0) {
            parts.push('Deal-breakers: ' + profile.values.dealBreakers.join(', '));
        }

        return parts.join('. ');
    }

    /**
     * Convert interests to text
     */
    private interestsToText(profile: SoulProfile): string {
        const parts: string[] = [];

        if (profile.interests.topics.length > 0) {
            parts.push('Topics: ' + profile.interests.topics.join(', '));
        }

        if (profile.interests.skills.length > 0) {
            parts.push('Skills: ' + profile.interests.skills.join(', '));
        }

        if (profile.interests.goals.length > 0) {
            parts.push('Goals: ' + profile.interests.goals.join(', '));
        }

        return parts.join('. ');
    }

    /**
     * Convert communication style to text
     */
    private styleToText(profile: SoulProfile): string {
        const parts: string[] = [];

        parts.push('Communication tone: ' + profile.communication.tone);
        parts.push('Communication pace: ' + profile.communication.pace);
        parts.push('Communication depth: ' + profile.communication.depth);

        return parts.join('. ');
    }
}
