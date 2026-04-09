/**
 * LLM-based Deep Analysis
 *
 * 4-dimension compatibility analysis using LLM
 *
 * @module @gradiences/soul-engine/matching/llm-analyzer
 */

import type { SoulProfile } from '../types.js';
import type { ProbeSession } from '../probe-types.js';
import type { LLMConfig, LLMProvider } from '../llm-config.js';
import { LLM_DEFAULT_BASE_URLS, LLM_DEFAULT_MODELS, LLM_API_KEY_ENV } from '../llm-config.js';

/**
 * Analysis dimension
 */
export type AnalysisDimension = 'values' | 'tone' | 'boundaries' | 'interests';

/**
 * Dimension analysis result
 */
export interface DimensionAnalysis {
    /** Dimension name */
    dimension: AnalysisDimension;

    /** Compatibility score (0-100) */
    score: number;

    /** Alignment summary */
    summary: string;

    /** Key evidence from conversation */
    evidence: string[];

    /** Potential risks or concerns */
    risks: string[];

    /** Suggestions for engagement */
    suggestions: string[];
}

/**
 * Complete compatibility analysis
 */
export interface CompatibilityAnalysis {
    /** Overall compatibility score (0-100) */
    overallScore: number;

    /** Individual dimension analyses */
    dimensions: {
        values: DimensionAnalysis;
        tone: DimensionAnalysis;
        boundaries: DimensionAnalysis;
        interests: DimensionAnalysis;
    };

    /** Recommended interaction topics */
    recommendedTopics: string[];

    /** Topics to avoid */
    avoidTopics: string[];

    /** Overall assessment */
    assessment: string;
}

/**
 * Internal LLM configuration with provider mapping
 * @deprecated Use LLMConfig from '../llm-config.js' instead
 */
interface InternalLLMConfig extends LLMConfig {
    /** Internal provider mapping for API calls */
    internalProvider: 'openai' | 'anthropic' | 'custom';
}

/**
 * Default LLM configuration
 */
const DEFAULT_LLM_CONFIG: Partial<LLMConfig> = {
    maxTokens: 2000,
    temperature: 0.7,
};

/**
 * LLM Analyzer
 */
export class LLMAnalyzer {
    private config: LLMConfig;
    private useRuleBased: boolean;

    constructor(config: LLMConfig, options?: { useRuleBased?: boolean }) {
        this.config = { ...DEFAULT_LLM_CONFIG, ...config } as LLMConfig;
        // Use rule-based analysis if no API key or explicitly requested
        this.useRuleBased = options?.useRuleBased ?? !this.config.apiKey;

        if (this.useRuleBased) {
            console.log('[LLMAnalyzer] Using rule-based analysis (no LLM API calls)');
        }
    }

    /**
     * Analyze compatibility based on Soul Profiles and conversation
     */
    async analyzeCompatibility(
        sourceProfile: SoulProfile,
        targetProfile: SoulProfile,
        probeSession?: ProbeSession,
    ): Promise<CompatibilityAnalysis> {
        // Use rule-based analysis if no API key available
        if (this.useRuleBased) {
            return this.analyzeCompatibilityRuleBased(sourceProfile, targetProfile, probeSession);
        }

        // Run 4 dimension analyses in parallel using LLM
        const [values, tone, boundaries, interests] = await Promise.all([
            this.analyzeValues(sourceProfile, targetProfile, probeSession),
            this.analyzeTone(sourceProfile, targetProfile, probeSession),
            this.analyzeBoundaries(sourceProfile, targetProfile, probeSession),
            this.analyzeInterests(sourceProfile, targetProfile, probeSession),
        ]);

        // Calculate overall score (weighted average)
        const overallScore = Math.round(
            values.score * 0.35 + // Values: 35%
                tone.score * 0.2 + // Tone: 20%
                boundaries.score * 0.25 + // Boundaries: 25%
                interests.score * 0.2, // Interests: 20%
        );

        // Generate overall assessment
        const assessment = await this.generateAssessment({
            overallScore,
            dimensions: { values, tone, boundaries, interests },
            sourceProfile,
            targetProfile,
        });

        // Extract recommended/avoid topics
        const recommendedTopics = this.extractRecommendedTopics({ values, tone, boundaries, interests });
        const avoidTopics = this.extractAvoidTopics({ values, tone, boundaries, interests }, targetProfile);

        return {
            overallScore,
            dimensions: { values, tone, boundaries, interests },
            recommendedTopics,
            avoidTopics,
            assessment,
        };
    }

    /**
     * Rule-based compatibility analysis (fallback when LLM is not available)
     * Provides basic compatibility scoring without API calls
     */
    private async analyzeCompatibilityRuleBased(
        source: SoulProfile,
        target: SoulProfile,
        _probeSession?: ProbeSession,
    ): Promise<CompatibilityAnalysis> {
        console.log('[LLMAnalyzer] Running rule-based analysis');

        // Analyze each dimension using rules
        const values = this.analyzeValuesRuleBased(source, target);
        const tone = this.analyzeToneRuleBased(source, target);
        const boundaries = this.analyzeBoundariesRuleBased(source, target);
        const interests = this.analyzeInterestsRuleBased(source, target);

        // Calculate overall score (weighted average)
        const overallScore = Math.round(
            values.score * 0.35 + tone.score * 0.2 + boundaries.score * 0.25 + interests.score * 0.2,
        );

        // Generate assessment
        let assessment: string;
        if (overallScore >= 80) {
            assessment = `Excellent compatibility (${overallScore}/100). Strong alignment across values, communication style, and interests. Highly recommended for collaboration.`;
        } else if (overallScore >= 60) {
            assessment = `Good compatibility (${overallScore}/100). Solid alignment with some areas to navigate. Recommended for collaboration with awareness of differences.`;
        } else if (overallScore >= 40) {
            assessment = `Moderate compatibility (${overallScore}/100). Mixed alignment - some shared ground but significant differences. Proceed with caution and clear communication.`;
        } else {
            assessment = `Low compatibility (${overallScore}/100). Substantial differences in values, style, or interests. Collaboration may be challenging without significant accommodation.`;
        }

        // Add note about rule-based analysis
        assessment += ' [Analysis performed in local mode without LLM API calls]';

        // Extract topics
        const recommendedTopics = this.extractRecommendedTopicsRuleBased(source, target);
        const avoidTopics = this.extractAvoidTopicsRuleBased(source, target);

        return {
            overallScore,
            dimensions: { values, tone, boundaries, interests },
            recommendedTopics,
            avoidTopics,
            assessment,
        };
    }

    // ============ Rule-Based Analysis Methods ============

    private analyzeValuesRuleBased(source: SoulProfile, target: SoulProfile): DimensionAnalysis {
        const sourceValues = new Set(source.values.core.map((v) => v.toLowerCase()));
        const targetValues = new Set(target.values.core.map((v) => v.toLowerCase()));

        // Count overlaps
        let overlap = 0;
        sourceValues.forEach((v) => {
            if (targetValues.has(v)) overlap++;
        });

        const maxValues = Math.max(sourceValues.size, targetValues.size);
        const score = maxValues > 0 ? Math.round((overlap / maxValues) * 100) : 50;

        // Check for deal-breaker conflicts
        const sourceDealBreakers = new Set(source.values.dealBreakers.map((v) => v.toLowerCase()));
        const targetDealBreakers = new Set(target.values.dealBreakers.map((v) => v.toLowerCase()));
        const targetValuesLower = new Set(target.values.core.map((v) => v.toLowerCase()));

        let conflicts = 0;
        sourceDealBreakers.forEach((db) => {
            if (targetValuesLower.has(db)) conflicts++;
        });

        const risks: string[] = [];
        if (conflicts > 0) {
            risks.push(`${conflicts} potential value conflicts detected`);
        }

        return {
            dimension: 'values',
            score,
            summary:
                score >= 70
                    ? 'Strong value alignment detected'
                    : score >= 40
                      ? 'Moderate value overlap'
                      : 'Limited shared values',
            evidence: overlap > 0 ? [`Found ${overlap} shared core values`] : [],
            risks,
            suggestions:
                score < 60
                    ? ['Clarify values early in collaboration', 'Respect differing priorities']
                    : ['Build on shared values', 'Explore complementary strengths'],
        };
    }

    private analyzeToneRuleBased(source: SoulProfile, target: SoulProfile): DimensionAnalysis {
        const toneMap: Record<string, number> = {
            formal: 1,
            professional: 1,
            casual: 2,
            friendly: 2,
            direct: 3,
            blunt: 3,
            diplomatic: 4,
            indirect: 4,
        };

        const sourceTone = toneMap[source.communication.tone.toLowerCase()] || 2;
        const targetTone = toneMap[target.communication.tone.toLowerCase()] || 2;

        // Calculate tone similarity (closer is better, but not exact match needed)
        const diff = Math.abs(sourceTone - targetTone);
        const score = Math.max(30, 100 - diff * 25);

        const paceDiff = Math.abs(
            (source.communication.pace === 'fast' ? 3 : source.communication.pace === 'moderate' ? 2 : 1) -
                (target.communication.pace === 'fast' ? 3 : target.communication.pace === 'moderate' ? 2 : 1),
        );

        const paceScore = 100 - paceDiff * 30;

        const combinedScore = Math.round(score * 0.6 + paceScore * 0.4);

        return {
            dimension: 'tone',
            score: combinedScore,
            summary: combinedScore >= 70 ? 'Compatible communication styles' : 'Different communication preferences',
            evidence: [`Source tone: ${source.communication.tone}`, `Target tone: ${target.communication.tone}`],
            risks: combinedScore < 50 ? ['Potential communication friction'] : [],
            suggestions: ['Adjust pace to match partner', 'Clarify intent when tone differs'],
        };
    }

    private analyzeBoundariesRuleBased(source: SoulProfile, target: SoulProfile): DimensionAnalysis {
        const sourcePrivacy = source.boundaries.privacyLevel;
        const targetPrivacy = target.boundaries.privacyLevel;

        const privacyScores: Record<string, number> = {
            open: 100,
            public: 100,
            moderate: 70,
            selective: 70,
            private: 40,
            closed: 40,
        };

        const sourceScore = privacyScores[sourcePrivacy.toLowerCase()] || 70;
        const targetScore = privacyScores[targetPrivacy.toLowerCase()] || 70;

        // Higher privacy + lower privacy = potential conflict
        const diff = Math.abs(sourceScore - targetScore);
        const score = Math.max(30, 100 - diff * 0.5);

        // Check forbidden topics overlap
        const sourceForbidden = new Set(source.boundaries.forbiddenTopics.map((t) => t.toLowerCase()));
        const targetInterests = new Set(target.interests.topics.map((t) => t.toLowerCase()));

        let conflicts = 0;
        sourceForbidden.forEach((topic) => {
            if (targetInterests.has(topic)) conflicts++;
        });

        return {
            dimension: 'boundaries',
            score: Math.round(score),
            summary: score >= 70 ? 'Compatible privacy expectations' : 'Different privacy needs to navigate',
            evidence: [`Source privacy: ${sourcePrivacy}`, `Target privacy: ${targetPrivacy}`],
            risks: conflicts > 0 ? [`${conflicts} topic(s) may trigger boundary concerns`] : [],
            suggestions: ['Respect privacy preferences', 'Ask before sharing personal information'],
        };
    }

    private analyzeInterestsRuleBased(source: SoulProfile, target: SoulProfile): DimensionAnalysis {
        const sourceTopics = new Set(source.interests.topics.map((t) => t.toLowerCase()));
        const targetTopics = new Set(target.interests.topics.map((t) => t.toLowerCase()));

        // Count overlaps
        let overlap = 0;
        sourceTopics.forEach((t) => {
            if (targetTopics.has(t)) overlap++;
        });

        const maxTopics = Math.max(sourceTopics.size, targetTopics.size);
        const score = maxTopics > 0 ? Math.round((overlap / maxTopics) * 100) : 50;

        // Check skills complementarity
        const sourceSkills = new Set(source.interests.skills.map((s) => s.toLowerCase()));
        const targetSkills = new Set(target.interests.skills.map((s) => s.toLowerCase()));

        let skillOverlap = 0;
        sourceSkills.forEach((s) => {
            if (targetSkills.has(s)) skillOverlap++;
        });

        return {
            dimension: 'interests',
            score,
            summary: score >= 70 ? 'Strong shared interests' : score >= 40 ? 'Some common ground' : 'Diverse interests',
            evidence:
                overlap > 0
                    ? [`${overlap} shared topics`, `${skillOverlap} shared skills`]
                    : ['Different interest areas'],
            risks: score < 30 ? ['Limited common interests'] : [],
            suggestions:
                score < 50
                    ? ['Explore new topics together', 'Share expertise across domains']
                    : ['Collaborate on shared interests', 'Introduce each other to new topics'],
        };
    }

    private extractRecommendedTopicsRuleBased(source: SoulProfile, target: SoulProfile): string[] {
        const topics = new Set<string>();

        // Add shared interests
        const sourceTopics = new Set(source.interests.topics.map((t) => t.toLowerCase()));
        for (const t of target.interests.topics) {
            if (sourceTopics.has(t.toLowerCase())) {
                topics.add(t);
            }
        }

        // Add shared goals
        source.interests.goals.forEach((g) => {
            if (
                target.interests.goals.some(
                    (tg) => tg.toLowerCase().includes(g.toLowerCase()) || g.toLowerCase().includes(tg.toLowerCase()),
                )
            ) {
                topics.add(g);
            }
        });

        return Array.from(topics).slice(0, 5);
    }

    private extractAvoidTopicsRuleBased(source: SoulProfile, target: SoulProfile): string[] {
        const avoidTopics = new Set<string>();

        // Add forbidden topics
        for (const t of source.boundaries.forbiddenTopics) {
            avoidTopics.add(t);
        }
        for (const t of target.boundaries.forbiddenTopics) {
            avoidTopics.add(t);
        }

        return Array.from(avoidTopics).slice(0, 5);
    }

    // ============ LLM-Based Analysis Methods ============

    /**
     * Analyze values alignment
     */
    private async analyzeValues(
        source: SoulProfile,
        target: SoulProfile,
        session?: ProbeSession,
    ): Promise<DimensionAnalysis> {
        const prompt = this.buildValuesPrompt(source, target, session);
        const response = await this.callLLM(prompt, 'values-analysis');

        return this.parseAnalysisResponse(response, 'values');
    }

    /**
     * Analyze communication tone compatibility
     */
    private async analyzeTone(
        source: SoulProfile,
        target: SoulProfile,
        session?: ProbeSession,
    ): Promise<DimensionAnalysis> {
        const prompt = this.buildTonePrompt(source, target, session);
        const response = await this.callLLM(prompt, 'tone-analysis');

        return this.parseAnalysisResponse(response, 'tone');
    }

    /**
     * Analyze boundary respect
     */
    private async analyzeBoundaries(
        source: SoulProfile,
        target: SoulProfile,
        session?: ProbeSession,
    ): Promise<DimensionAnalysis> {
        const prompt = this.buildBoundariesPrompt(source, target, session);
        const response = await this.callLLM(prompt, 'boundaries-analysis');

        return this.parseAnalysisResponse(response, 'boundaries');
    }

    /**
     * Analyze interest overlap
     */
    private async analyzeInterests(
        source: SoulProfile,
        target: SoulProfile,
        session?: ProbeSession,
    ): Promise<DimensionAnalysis> {
        const prompt = this.buildInterestsPrompt(source, target, session);
        const response = await this.callLLM(prompt, 'interests-analysis');

        return this.parseAnalysisResponse(response, 'interests');
    }

    // ============ Prompt Builders ============

    private buildValuesPrompt(source: SoulProfile, target: SoulProfile, session?: ProbeSession): string {
        const conversationContext = session ? this.formatConversation(session) : 'No conversation yet.';

        return `Analyze values alignment between two individuals based on their Soul Profiles and conversation.

**Person A (Source):**
- Core values: ${source.values.core.join(', ')}
- Priorities: ${source.values.priorities.join(', ')}
- Deal-breakers: ${source.values.dealBreakers.join(', ')}

**Person B (Target):**
- Core values: ${target.values.core.join(', ')}
- Priorities: ${target.values.priorities.join(', ')}
- Deal-breakers: ${target.values.dealBreakers.join(', ')}

**Conversation:**
${conversationContext}

Provide a JSON response with:
{
  "score": <0-100>,
  "summary": "<brief alignment summary>",
  "evidence": ["<evidence from conversation>", ...],
  "risks": ["<potential value conflicts>", ...],
  "suggestions": ["<engagement suggestions>", ...]
}`;
    }

    private buildTonePrompt(source: SoulProfile, target: SoulProfile, session?: ProbeSession): string {
        const conversationContext = session ? this.formatConversation(session) : 'No conversation yet.';

        return `Analyze communication style compatibility between two individuals.

**Person A (Source):**
- Tone: ${source.communication.tone}
- Pace: ${source.communication.pace}
- Depth: ${source.communication.depth}

**Person B (Target):**
- Tone: ${target.communication.tone}
- Pace: ${target.communication.pace}
- Depth: ${target.communication.depth}

**Conversation:**
${conversationContext}

Provide a JSON response with:
{
  "score": <0-100>,
  "summary": "<tone compatibility summary>",
  "evidence": ["<evidence from conversation>", ...],
  "risks": ["<potential communication issues>", ...],
  "suggestions": ["<communication tips>", ...]
}`;
    }

    private buildBoundariesPrompt(source: SoulProfile, target: SoulProfile, session?: ProbeSession): string {
        const conversationContext = session ? this.formatConversation(session) : 'No conversation yet.';

        return `Analyze boundary respect and privacy compatibility.

**Person A (Source) Boundaries:**
- Forbidden topics: ${source.boundaries.forbiddenTopics.join(', ') || 'None'}
- Privacy level: ${source.boundaries.privacyLevel}

**Person B (Target) Boundaries:**
- Forbidden topics: ${target.boundaries.forbiddenTopics.join(', ') || 'None'}
- Privacy level: ${target.boundaries.privacyLevel}

**Conversation:**
${conversationContext}

Provide a JSON response with:
{
  "score": <0-100>,
  "summary": "<boundary respect summary>",
  "evidence": ["<examples of boundary respect>", ...],
  "risks": ["<potential boundary violations>", ...],
  "suggestions": ["<how to respect boundaries>", ...]
}`;
    }

    private buildInterestsPrompt(source: SoulProfile, target: SoulProfile, session?: ProbeSession): string {
        const conversationContext = session ? this.formatConversation(session) : 'No conversation yet.';

        return `Analyze interest overlap and potential collaboration areas.

**Person A (Source):**
- Topics: ${source.interests.topics.join(', ')}
- Skills: ${source.interests.skills.join(', ')}
- Goals: ${source.interests.goals.join(', ')}

**Person B (Target):**
- Topics: ${target.interests.topics.join(', ')}
- Skills: ${target.interests.skills.join(', ')}
- Goals: ${target.interests.goals.join(', ')}

**Conversation:**
${conversationContext}

Provide a JSON response with:
{
  "score": <0-100>,
  "summary": "<interest overlap summary>",
  "evidence": ["<shared interests from conversation>", ...],
  "risks": ["<areas of disinterest>", ...],
  "suggestions": ["<collaboration opportunities>", ...]
}`;
    }

    private formatConversation(session: ProbeSession): string {
        if (!session.conversation || session.conversation.length === 0) {
            return 'No conversation yet.';
        }

        return session.conversation.map((msg) => `${msg.role === 'prober' ? 'A' : 'B'}: ${msg.content}`).join('\n');
    }

    // ============ LLM Integration ============

    private async callLLM(prompt: string, _task: string): Promise<string> {
        const endpoint = this.getEndpoint();
        const headers = this.getHeaders();

        // Map unified provider to internal provider type
        const internalProvider = this.mapToInternalProvider(this.config.provider);

        const body = {
            model: this.config.model,
            messages: [
                {
                    role: 'system',
                    content:
                        'You are an expert at analyzing interpersonal compatibility. Respond in valid JSON format only.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
        };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
            }

            const data = (await response.json()) as Record<string, any>;

            // Extract content based on provider
            if (internalProvider === 'openai') {
                return data.choices[0].message.content;
            } else if (internalProvider === 'anthropic') {
                return data.content[0].text;
            }

            throw new Error('Unsupported provider response format');
        } catch (error) {
            console.error('[LLMAnalyzer] API call failed:', error);
            throw error;
        }
    }

    /**
     * Map unified LLMProvider to internal provider type
     */
    private mapToInternalProvider(provider: LLMProvider): 'openai' | 'anthropic' {
        if (provider === 'claude') {
            return 'anthropic';
        }
        // openai and moonshot both use OpenAI-compatible API
        return 'openai';
    }

    private getEndpoint(): string {
        // Use custom baseUrl if provided (stored in baseUrl field)
        const baseUrl = this.config.baseUrl;
        if (baseUrl) {
            return `${baseUrl}/chat/completions`;
        }

        const internalProvider = this.mapToInternalProvider(this.config.provider);

        switch (internalProvider) {
            case 'openai':
                return 'https://api.openai.com/v1/chat/completions';
            case 'anthropic':
                return 'https://api.anthropic.com/v1/messages';
            default:
                throw new Error('Endpoint required - set baseUrl in config');
        }
    }

    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        const internalProvider = this.mapToInternalProvider(this.config.provider);

        if (internalProvider === 'openai') {
            headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        } else if (internalProvider === 'anthropic') {
            headers['x-api-key'] = this.config.apiKey;
            headers['anthropic-version'] = '2023-06-01';
        }

        return headers;
    }

    // ============ Response Parsing ============

    private parseAnalysisResponse(response: string, dimension: AnalysisDimension): DimensionAnalysis {
        try {
            // Extract JSON from response (handle markdown code blocks)
            let jsonStr = response.trim();

            if (jsonStr.startsWith('```json')) {
                jsonStr = jsonStr.replace(/```json\n/, '').replace(/\n```$/, '');
            } else if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/```\n/, '').replace(/\n```$/, '');
            }

            const parsed = JSON.parse(jsonStr);

            return {
                dimension,
                score: parsed.score || 0,
                summary: parsed.summary || '',
                evidence: parsed.evidence || [],
                risks: parsed.risks || [],
                suggestions: parsed.suggestions || [],
            };
        } catch (error) {
            console.error('[LLMAnalyzer] Failed to parse response:', error);

            // Return fallback
            return {
                dimension,
                score: 50,
                summary: 'Analysis unavailable (parsing error)',
                evidence: [],
                risks: ['Unable to analyze due to parsing error'],
                suggestions: [],
            };
        }
    }

    // ============ Synthesis ============

    private async generateAssessment(params: {
        overallScore: number;
        dimensions: {
            values: DimensionAnalysis;
            tone: DimensionAnalysis;
            boundaries: DimensionAnalysis;
            interests: DimensionAnalysis;
        };
        sourceProfile: SoulProfile;
        targetProfile: SoulProfile;
    }): Promise<string> {
        const { overallScore, dimensions } = params;

        // Generate simple assessment based on scores
        if (overallScore >= 80) {
            return `Excellent compatibility (${overallScore}/100). Strong alignment across values, communication style, and interests. Highly recommended for collaboration.`;
        } else if (overallScore >= 60) {
            return `Good compatibility (${overallScore}/100). Solid alignment with some areas to navigate. Recommended for collaboration with awareness of differences.`;
        } else if (overallScore >= 40) {
            return `Moderate compatibility (${overallScore}/100). Mixed alignment - some shared ground but significant differences. Proceed with caution and clear communication.`;
        } else {
            return `Low compatibility (${overallScore}/100). Substantial differences in values, style, or interests. Collaboration may be challenging without significant accommodation.`;
        }
    }

    private extractRecommendedTopics(dimensions: {
        values: DimensionAnalysis;
        tone: DimensionAnalysis;
        boundaries: DimensionAnalysis;
        interests: DimensionAnalysis;
    }): string[] {
        const topics = new Set<string>();

        // Extract from suggestions
        Object.values(dimensions).forEach((dim) => {
            dim.suggestions.forEach((s) => {
                // Simple keyword extraction (can be enhanced with NLP)
                const keywords = s.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
                keywords.forEach((kw) => topics.add(kw));
            });
        });

        return Array.from(topics).slice(0, 5);
    }

    private extractAvoidTopics(
        dimensions: {
            values: DimensionAnalysis;
            tone: DimensionAnalysis;
            boundaries: DimensionAnalysis;
            interests: DimensionAnalysis;
        },
        targetProfile: SoulProfile,
    ): string[] {
        const avoid = new Set<string>(targetProfile.boundaries.forbiddenTopics);

        // Add from risks
        Object.values(dimensions).forEach((dim) => {
            dim.risks.forEach((r) => {
                const keywords = r.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
                keywords.forEach((kw) => avoid.add(kw));
            });
        });

        return Array.from(avoid).slice(0, 5);
    }
}
