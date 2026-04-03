/**
 * Tests for Soul Profile types
 */

import { describe, it, expect } from 'vitest';
import {
    type SoulProfile,
    type SoulType,
    type PrivacyLevel,
    SOUL_VERSION,
    SOUL_DEFAULTS,
    SOUL_LIMITS,
    SoulError,
    SoulErrorCode,
} from './types.js';

describe('Soul Profile Types', () => {
    it('should create a valid SoulProfile object', () => {
        const profile: SoulProfile = {
            id: 'test-uuid-123',
            version: '1.0',
            soulType: 'agent',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            identity: {
                displayName: 'Test Agent',
                bio: 'A test agent for unit testing',
            },
            values: {
                core: ['honesty', 'creativity'],
                priorities: ['learning'],
                dealBreakers: ['deception'],
            },
            interests: {
                topics: ['AI', 'blockchain'],
                skills: ['conversation'],
                goals: ['improvement'],
            },
            communication: {
                tone: 'friendly',
                pace: 'moderate',
                depth: 'deep',
            },
            boundaries: {
                forbiddenTopics: ['politics'],
                maxConversationLength: 20,
                privacyLevel: 'public',
            },
            storage: {
                contentHash: 'sha256-test',
                embeddingHash: 'embedding-test',
                storageType: 'ipfs',
                cid: 'QmTest123',
            },
        };

        expect(profile.soulType).toBe('agent');
        expect(profile.identity.displayName).toBe('Test Agent');
        expect(profile.values.core).toContain('honesty');
    });

    it('should support human soul type', () => {
        const soulType: SoulType = 'human';
        expect(soulType).toBe('human');
    });

    it('should support all privacy levels', () => {
        const publicLevel: PrivacyLevel = 'public';
        const zkLevel: PrivacyLevel = 'zk-selective';
        const privateLevel: PrivacyLevel = 'private';

        expect(publicLevel).toBe('public');
        expect(zkLevel).toBe('zk-selective');
        expect(privateLevel).toBe('private');
    });

    it('should export SOUL_VERSION constant', () => {
        expect(SOUL_VERSION).toBe('1.0');
    });

    it('should export SOUL_DEFAULTS', () => {
        expect(SOUL_DEFAULTS.version).toBe('1.0');
        expect(SOUL_DEFAULTS.communication.tone).toBe('friendly');
        expect(SOUL_DEFAULTS.communication.pace).toBe('moderate');
        expect(SOUL_DEFAULTS.boundaries.privacyLevel).toBe('public');
    });

    it('should export SOUL_LIMITS', () => {
        expect(SOUL_LIMITS.displayName).toBe(100);
        expect(SOUL_LIMITS.bio).toBe(500);
        expect(SOUL_LIMITS.arrayField).toBe(20);
    });

    it('should create SoulError with code', () => {
        const error = new SoulError(
            SoulErrorCode.INVALID_FORMAT,
            'Test error message'
        );

        expect(error.code).toBe(SoulErrorCode.INVALID_FORMAT);
        expect(error.message).toBe('Test error message');
        expect(error.name).toBe('SoulError');
    });

    it('should support optional onChain metadata', () => {
        const profile: SoulProfile = {
            id: 'test-uuid',
            version: '1.0',
            soulType: 'agent',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            identity: { displayName: 'Test', bio: 'Test bio' },
            values: { core: [], priorities: [], dealBreakers: [] },
            interests: { topics: [], skills: [], goals: [] },
            communication: SOUL_DEFAULTS.communication,
            boundaries: SOUL_DEFAULTS.boundaries,
            storage: {
                contentHash: 'test',
                embeddingHash: 'test',
                storageType: 'ipfs',
                cid: 'QmTest',
            },
            onChain: {
                solanaAddress: 'test-address',
                reputationPDA: 'test-pda',
                socialScore: 85,
            },
        };

        expect(profile.onChain).toBeDefined();
        expect(profile.onChain?.socialScore).toBe(85);
    });

    it('should support optional fields', () => {
        const profile: SoulProfile = {
            id: 'test-uuid',
            version: '1.0',
            soulType: 'human',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            identity: {
                displayName: 'Human User',
                bio: 'A human user',
                avatarCID: 'QmAvatar123',
                links: {
                    website: 'https://example.com',
                    twitter: 'https://twitter.com/user',
                },
            },
            values: { core: [], priorities: [], dealBreakers: [] },
            interests: { topics: [], skills: [], goals: [] },
            communication: SOUL_DEFAULTS.communication,
            boundaries: {
                ...SOUL_DEFAULTS.boundaries,
                autoEndTriggers: ['goodbye', 'bye'],
            },
            storage: {
                contentHash: 'test',
                embeddingHash: 'test',
                storageType: 'arweave',
                cid: 'ArweaveTxID',
            },
        };

        expect(profile.identity.avatarCID).toBe('QmAvatar123');
        expect(profile.identity.links?.website).toBe('https://example.com');
        expect(profile.boundaries.autoEndTriggers).toContain('goodbye');
        expect(profile.storage.storageType).toBe('arweave');
    });
});
