/**
 * Matching Report Generator
 * 
 * Generate comprehensive compatibility reports combining embedding + LLM analysis
 * 
 * @module @gradiences/soul-engine/matching/report-generator
 */

import type { SoulProfile } from '../types.js';
import type { ProbeSession } from '../probe-types.js';
import type { EmbeddingMatch } from './embedding.js';
import type { CompatibilityAnalysis } from './llm-analyzer.js';

/**
 * Matching report
 */
export interface MatchingReport {
    /** Report ID */
    id: string;
    
    /** Source profile ID */
    sourceId: string;
    
    /** Target profile ID */
    targetId: string;
    
    /** Probe session ID (if available) */
    sessionId?: string;
    
    /** Combined compatibility score (0-100) */
    compatibilityScore: number;
    
    /** Score breakdown */
    breakdown: {
        /** Embedding similarity (0-100) */
        embedding: number;
        
        /** LLM analysis (0-100) */
        llm: number;
        
        /** Weights used */
        weights: {
            embedding: number;
            llm: number;
        };
    };
    
    /** LLM compatibility analysis */
    analysis: CompatibilityAnalysis;
    
    /** Embedding match details */
    embeddingMatch: EmbeddingMatch;
    
    /** Report in Markdown format */
    markdown: string;
    
    /** Storage CID (IPFS/Arweave) */
    cid?: string;
    
    /** Generated timestamp */
    generatedAt: number;
}

/**
 * Report generation options
 */
export interface ReportOptions {
    /** Include full conversation transcript */
    includeConversation?: boolean;
    
    /** Include detailed dimension breakdowns */
    includeDetails?: boolean;
    
    /** Custom weights for scoring */
    weights?: {
        embedding: number;
        llm: number;
    };
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: Required<ReportOptions> = {
    includeConversation: true,
    includeDetails: true,
    weights: {
        embedding: 0.3,  // 30%
        llm: 0.7,         // 70%
    },
};

/**
 * Report Generator
 */
export class ReportGenerator {
    /**
     * Generate a matching report
     */
    static generate(params: {
        sourceProfile: SoulProfile;
        targetProfile: SoulProfile;
        embeddingMatch: EmbeddingMatch;
        llmAnalysis: CompatibilityAnalysis;
        probeSession?: ProbeSession;
        options?: ReportOptions;
    }): MatchingReport {
        const options = { ...DEFAULT_OPTIONS, ...params.options };
        const { sourceProfile, targetProfile, embeddingMatch, llmAnalysis, probeSession } = params;
        
        // Calculate combined score
        const embeddingScore = embeddingMatch.similarity * 100;
        const llmScore = llmAnalysis.overallScore;
        
        const compatibilityScore = Math.round(
            embeddingScore * options.weights.embedding +
            llmScore * options.weights.llm
        );
        
        // Generate markdown report
        const markdown = this.generateMarkdown({
            sourceProfile,
            targetProfile,
            compatibilityScore,
            embeddingScore,
            llmScore,
            embeddingMatch,
            llmAnalysis,
            probeSession,
            options,
        });
        
        // Create report
        const report: MatchingReport = {
            id: `report-${crypto.randomUUID()}`,
            sourceId: sourceProfile.id,
            targetId: targetProfile.id,
            sessionId: probeSession?.id,
            compatibilityScore,
            breakdown: {
                embedding: embeddingScore,
                llm: llmScore,
                weights: options.weights,
            },
            analysis: llmAnalysis,
            embeddingMatch,
            markdown,
            generatedAt: Date.now(),
        };
        
        return report;
    }
    
    /**
     * Generate Markdown report
     */
    private static generateMarkdown(params: {
        sourceProfile: SoulProfile;
        targetProfile: SoulProfile;
        compatibilityScore: number;
        embeddingScore: number;
        llmScore: number;
        embeddingMatch: EmbeddingMatch;
        llmAnalysis: CompatibilityAnalysis;
        probeSession?: ProbeSession;
        options: Required<ReportOptions>;
    }): string {
        const {
            sourceProfile,
            targetProfile,
            compatibilityScore,
            embeddingScore,
            llmScore,
            embeddingMatch,
            llmAnalysis,
            probeSession,
            options,
        } = params;
        
        const lines: string[] = [];
        
        // Header
        lines.push('# Soul Matching Report\n');
        lines.push(`**Generated:** ${new Date().toISOString()}\n`);
        
        // Profiles
        lines.push('## Profiles\n');
        lines.push(`**Source:** ${sourceProfile.identity.displayName} (${sourceProfile.soulType})`);
        lines.push(`**Target:** ${targetProfile.identity.displayName} (${targetProfile.soulType})\n`);
        
        // Overall Score
        lines.push('## Overall Compatibility\n');
        lines.push(this.generateScoreBar(compatibilityScore));
        lines.push(`**Score:** ${compatibilityScore}/100\n`);
        lines.push(`**Assessment:** ${llmAnalysis.assessment}\n`);
        
        // Score Breakdown
        lines.push('## Score Breakdown\n');
        lines.push('| Component | Score | Weight |');
        lines.push('|-----------|-------|--------|');
        lines.push(`| Embedding Similarity | ${embeddingScore.toFixed(1)} | ${(options.weights.embedding * 100).toFixed(0)}% |`);
        lines.push(`| LLM Deep Analysis | ${llmScore.toFixed(1)} | ${(options.weights.llm * 100).toFixed(0)}% |`);
        lines.push(`| **Combined** | **${compatibilityScore}** | **100%** |\n`);
        
        // Dimension Analysis
        if (options.includeDetails) {
            lines.push('## Dimension Analysis\n');
            
            const dimensions = [
                { key: 'values', name: 'Values Alignment', weight: 35 },
                { key: 'boundaries', name: 'Boundary Respect', weight: 25 },
                { key: 'tone', name: 'Communication Style', weight: 20 },
                { key: 'interests', name: 'Interest Overlap', weight: 20 },
            ] as const;
            
            for (const dim of dimensions) {
                const analysis = llmAnalysis.dimensions[dim.key];
                
                lines.push(`### ${dim.name} (${dim.weight}%)\n`);
                lines.push(this.generateScoreBar(analysis.score));
                lines.push(`**Score:** ${analysis.score}/100\n`);
                lines.push(`**Summary:** ${analysis.summary}\n`);
                
                if (analysis.evidence.length > 0) {
                    lines.push('**Evidence:**');
                    analysis.evidence.forEach(e => lines.push(`- ${e}`));
                    lines.push('');
                }
                
                if (analysis.risks.length > 0) {
                    lines.push('**Risks:**');
                    analysis.risks.forEach(r => lines.push(`- ${r}`));
                    lines.push('');
                }
                
                if (analysis.suggestions.length > 0) {
                    lines.push('**Suggestions:**');
                    analysis.suggestions.forEach(s => lines.push(`- ${s}`));
                    lines.push('');
                }
            }
        }
        
        // Embedding Details
        lines.push('## Embedding Similarity\n');
        lines.push('| Section | Similarity |');
        lines.push('|---------|------------|');
        lines.push(`| Overall | ${(embeddingMatch.sections.overall * 100).toFixed(1)}% |`);
        lines.push(`| Values | ${(embeddingMatch.sections.values * 100).toFixed(1)}% |`);
        lines.push(`| Interests | ${(embeddingMatch.sections.interests * 100).toFixed(1)}% |`);
        lines.push(`| Style | ${(embeddingMatch.sections.style * 100).toFixed(1)}% |\n`);
        
        // Recommendations
        lines.push('## Recommendations\n');
        
        if (llmAnalysis.recommendedTopics.length > 0) {
            lines.push('### Recommended Topics');
            llmAnalysis.recommendedTopics.forEach(t => lines.push(`- ${t}`));
            lines.push('');
        }
        
        if (llmAnalysis.avoidTopics.length > 0) {
            lines.push('### Topics to Avoid');
            llmAnalysis.avoidTopics.forEach(t => lines.push(`- ${t}`));
            lines.push('');
        }
        
        // Conversation Transcript
        if (options.includeConversation && probeSession?.conversation) {
            lines.push('## Conversation Transcript\n');
            lines.push(`**Session:** ${probeSession.id}`);
            lines.push(`**Turns:** ${probeSession.conversation.length / 2}\n`);
            
            probeSession.conversation.forEach((msg, i) => {
                const speaker = msg.role === 'prober' ? 'Source' : 'Target';
                lines.push(`**${speaker} (Turn ${msg.turn + 1}):** ${msg.content}\n`);
            });
        }
        
        // Footer
        lines.push('---\n');
        lines.push('*This report was generated by Soul Engine - AI-powered compatibility analysis for agents and humans.*');
        
        return lines.join('\n');
    }
    
    /**
     * Generate a visual score bar
     */
    private static generateScoreBar(score: number): string {
        const filled = Math.round(score / 5); // 20 blocks max
        const empty = 20 - filled;
        
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        
        let color = '🔴';
        if (score >= 80) color = '🟢';
        else if (score >= 60) color = '🟡';
        else if (score >= 40) color = '🟠';
        
        return `${color} \`${bar}\`\n`;
    }
    
    /**
     * Upload report to storage (IPFS/Arweave)
     */
    static async uploadReport(
        report: MatchingReport,
        storageClient: {
            upload: (content: string) => Promise<string>;
        }
    ): Promise<string> {
        try {
            const cid = await storageClient.upload(report.markdown);
            report.cid = cid;
            return cid;
        } catch (error) {
            console.error('[ReportGenerator] Upload failed:', error);
            throw error;
        }
    }
}
