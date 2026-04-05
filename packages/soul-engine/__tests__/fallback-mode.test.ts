/**
 * Fallback Mode Tests
 * 
 * Tests for LLM configuration with fallback support
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    buildLLMConfigWithFallback,
    getFallbackModeDescription,
    LLMAnalyzer,
    MatchingEngine,
    type LLMConfigWithFallback,
    type SoulProfile,
} from '../src/index.js';

describe('Fallback Mode Configuration', () => {
    it('should auto-enable fallback when no API key', () => {
        const config = buildLLMConfigWithFallback({
            provider: 'openai',
            model: 'gpt-4',
            apiKey: '', // No API key
        });
        
        expect(config.fallbackMode).toBe('embedding-only');
        expect(config.allowEmbeddingOnly).toBe(true);
    });
    
    it('should disable fallback when API key is provided', () => {
        const config = buildLLMConfigWithFallback({
            provider: 'openai',
            model: 'gpt-4',
            apiKey: 'sk-test123',
        });
        
        expect(config.fallbackMode).toBe('off');
        expect(config.allowEmbeddingOnly).toBe(false);
    });
    
    it('should respect explicit fallback mode', () => {
        const config = buildLLMConfigWithFallback({
            provider: 'openai',
            model: 'gpt-4',
            apiKey: 'sk-test123',
            fallbackMode: 'rule-based',
        });
        
        expect(config.fallbackMode).toBe('rule-based');
    });
    
    it('should provide correct fallback descriptions', () => {
        expect(getFallbackModeDescription('embedding-only'))
            .toContain('embedding-based');
        expect(getFallbackModeDescription('rule-based'))
            .toContain('rule-based');
        expect(getFallbackModeDescription('off'))
            .toContain('Full LLM');
    });
});

describe('Rule-Based Analysis', () => {
    const mockSourceProfile: SoulProfile = {
        id: 'source-1',
        agentDID: 'did:gradience:source',
        publicKey: 'pubkey1',
        version: '1.0',
        values: {
            core: ['Innovation', 'Transparency', 'Collaboration'],
            priorities: ['Quality', 'Speed'],
            dealBreakers: ['Dishonesty'],
        },
        communication: {
            tone: 'Professional',
            pace: 'moderate',
            depth: 'detailed',
            style: 'Direct',
        },
        boundaries: {
            forbiddenTopics: ['Politics', 'Religion'],
            privacyLevel: 'selective',
        },
        interests: {
            topics: ['AI', 'Blockchain', 'Open Source'],
            skills: ['TypeScript', 'Rust', 'Solana'],
            goals: ['Build useful products', 'Learn new tech'],
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    
    const mockTargetProfile: SoulProfile = {
        id: 'target-1',
        agentDID: 'did:gradience:target',
        publicKey: 'pubkey2',
        version: '1.0',
        values: {
            core: ['Innovation', 'Integrity', 'Collaboration'],
            priorities: ['Security', 'Quality'],
            dealBreakers: ['Negligence'],
        },
        communication: {
            tone: 'Professional',
            pace: 'moderate',
            depth: 'detailed',
            style: 'Analytical',
        },
        boundaries: {
            forbiddenTopics: ['Politics'],
            privacyLevel: 'moderate',
        },
        interests: {
            topics: ['AI', 'DeFi', 'Open Source'],
            skills: ['TypeScript', 'Python', 'Ethereum'],
            goals: ['Build secure systems', 'Collaborate globally'],
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    
    it('should perform rule-based analysis without API key', async () => {
        const analyzer = new LLMAnalyzer({
            provider: 'openai',
            model: 'gpt-4',
            apiKey: '', // No API key
        });
        
        const result = await analyzer.analyzeCompatibility(
            mockSourceProfile,
            mockTargetProfile
        );
        
        expect(result.overallScore).toBeGreaterThanOrEqual(0);
        expect(result.overallScore).toBeLessThanOrEqual(100);
        expect(result.dimensions.values.score).toBeGreaterThan(0);
        expect(result.dimensions.tone.score).toBeGreaterThan(0);
        expect(result.dimensions.boundaries.score).toBeGreaterThan(0);
        expect(result.dimensions.interests.score).toBeGreaterThan(0);
        expect(result.assessment).toContain('local mode');
    });
    
    it('should calculate values alignment correctly', async () => {
        const analyzer = new LLMAnalyzer({
            provider: 'openai',
            model: 'gpt-4',
            apiKey: '',
        });
        
        const result = await analyzer.analyzeCompatibility(
            mockSourceProfile,
            mockTargetProfile
        );
        
        // Should detect shared values (Innovation, Collaboration)
        expect(result.dimensions.values.score).toBeGreaterThan(50);
        expect(result.dimensions.values.evidence.length).toBeGreaterThan(0);
    });
    
    it('should identify interest overlaps', async () => {
        const analyzer = new LLMAnalyzer({
            provider: 'openai',
            model: 'gpt-4',
            apiKey: '',
        });
        
        const result = await analyzer.analyzeCompatibility(
            mockSourceProfile,
            mockTargetProfile
        );
        
        // Should detect shared topics (AI, Open Source)
        expect(result.dimensions.interests.score).toBeGreaterThan(0);
        expect(result.recommendedTopics.length).toBeGreaterThan(0);
    });
});

describe('MatchingEngine with Fallback', () => {
    it('should initialize in fallback mode without API key', async () => {
        const engine = new MatchingEngine({
            llm: {
                provider: 'openai',
                model: 'gpt-4',
                apiKey: '',
            },
        });
        
        // Should not throw
        await expect(engine.initialize()).resolves.not.toThrow();
    });
});
