/**
 * LLM-based Deep Analysis
 * 
 * 4-dimension compatibility analysis using LLM
 * 
 * @module @gradiences/soul-engine/matching/llm-analyzer
 */

import type { SoulProfile } from '../types.js';
import type { ProbeSession } from '../probe-types.js';

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
 * LLM provider configuration
 */
export interface LLMConfig {
    /** Provider (openai, anthropic, etc.) */
    provider: 'openai' | 'anthropic' | 'custom';
    
    /** API key */
    apiKey: string;
    
    /** Model name */
    model: string;
    
    /** API endpoint (for custom providers) */
    endpoint?: string;
    
    /** Max tokens per request */
    maxTokens?: number;
    
    /** Temperature */
    temperature?: number;
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
    
    constructor(config: LLMConfig) {
        this.config = { ...DEFAULT_LLM_CONFIG, ...config } as LLMConfig;
    }
    
    /**
     * Analyze compatibility based on Soul Profiles and conversation
     */
    async analyzeCompatibility(
        sourceProfile: SoulProfile,
        targetProfile: SoulProfile,
        probeSession?: ProbeSession
    ): Promise<CompatibilityAnalysis> {
        // Run 4 dimension analyses in parallel
        const [values, tone, boundaries, interests] = await Promise.all([
            this.analyzeValues(sourceProfile, targetProfile, probeSession),
            this.analyzeTone(sourceProfile, targetProfile, probeSession),
            this.analyzeBoundaries(sourceProfile, targetProfile, probeSession),
            this.analyzeInterests(sourceProfile, targetProfile, probeSession),
        ]);
        
        // Calculate overall score (weighted average)
        const overallScore = Math.round(
            values.score * 0.35 +       // Values: 35%
            tone.score * 0.20 +          // Tone: 20%
            boundaries.score * 0.25 +    // Boundaries: 25%
            interests.score * 0.20       // Interests: 20%
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
     * Analyze values alignment
     */
    private async analyzeValues(
        source: SoulProfile,
        target: SoulProfile,
        session?: ProbeSession
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
        session?: ProbeSession
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
        session?: ProbeSession
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
        session?: ProbeSession
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
        
        return session.conversation
            .map(msg => `${msg.role === 'prober' ? 'A' : 'B'}: ${msg.content}`)
            .join('\n');
    }
    
    // ============ LLM Integration ============
    
    private async callLLM(prompt: string, _task: string): Promise<string> {
        const endpoint = this.getEndpoint();
        const headers = this.getHeaders();
        
        const body = {
            model: this.config.model,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert at analyzing interpersonal compatibility. Respond in valid JSON format only.',
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
            
            const data = await response.json() as Record<string, any>;
            
            // Extract content based on provider
            if (this.config.provider === 'openai' || this.config.provider === 'custom') {
                return data.choices[0].message.content;
            } else if (this.config.provider === 'anthropic') {
                return data.content[0].text;
            }
            
            throw new Error('Unsupported provider response format');
        } catch (error) {
            console.error('[LLMAnalyzer] API call failed:', error);
            throw error;
        }
    }
    
    private getEndpoint(): string {
        if (this.config.endpoint) {
            return this.config.endpoint;
        }
        
        switch (this.config.provider) {
            case 'openai':
                return 'https://api.openai.com/v1/chat/completions';
            case 'anthropic':
                return 'https://api.anthropic.com/v1/messages';
            default:
                throw new Error('Endpoint required for custom provider');
        }
    }
    
    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        
        if (this.config.provider === 'openai' || this.config.provider === 'custom') {
            headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        } else if (this.config.provider === 'anthropic') {
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
        Object.values(dimensions).forEach(dim => {
            dim.suggestions.forEach(s => {
                // Simple keyword extraction (can be enhanced with NLP)
                const keywords = s.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
                keywords.forEach(kw => topics.add(kw));
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
        targetProfile: SoulProfile
    ): string[] {
        const avoid = new Set<string>(targetProfile.boundaries.forbiddenTopics);
        
        // Add from risks
        Object.values(dimensions).forEach(dim => {
            dim.risks.forEach(r => {
                const keywords = r.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
                keywords.forEach(kw => avoid.add(kw));
            });
        });
        
        return Array.from(avoid).slice(0, 5);
    }
}
