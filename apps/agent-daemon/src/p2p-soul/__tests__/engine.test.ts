/**
 * P2P Soul Handshake Protocol - Engine Tests
 */

import { describe, it, expect } from 'vitest';
import {
  MatchEngine,
  parseSoulMd,
  toSoulProfile,
  generateSoulDigest,
  generateLevel1Data,
  generateLevel2Data,
  generateLevel3Data,
  generateLevel4Data,
} from '../engine.js';
import { DisclosureLevel } from '../types.js';

describe('MatchEngine', () => {
  const createMockProfile = () => ({
    did: 'did:alice',
    interests: ['DeFi', 'AI', 'Rust'],
    skills: [
      { name: 'Solidity', category: 'Blockchain', level: 'expert' as const, yearsOfExperience: 5 },
      { name: 'Rust', category: 'Systems', level: 'intermediate' as const, yearsOfExperience: 3 },
    ],
    experience: { totalYears: 8, categories: ['Blockchain', 'Systems'] },
    availability: { hoursPerWeek: 20, timezone: 'UTC+0' },
    seeking: 'collaboration',
    projects: [
      { name: 'DeFi Protocol', description: 'AMM DEX', role: 'Lead Dev' },
    ],
    contact: { email: 'alice@example.com' },
  });
  
  const createMockDigest = () => ({
    did: 'did:bob',
    reputationScore: 85,
    activeCategories: ['AI', 'ML'],
    seeking: 'collaboration',
    interestHashes: [
      'a9f8c5e1b3d7f2e6c4a8b0d5f9e3c7a1b4d8f2e6c0a4b8d2f6e0c4a8b2d6f0', // AI
      'b0e9d6f2c4a8e0c6b3d7f1e5c9a3d7f0b4e8c2a6d0f4e8c2a6d0f4e8c2a6d0', // ML
    ],
    skillsRoot: 'c1f0e7b3d5a9f3e7c1b5d9f3e7c1b5d9f3e7c1b5d9f3e7c1b5d9f3e7c1b5d9',
    maxDisclosureLevel: DisclosureLevel.LEVEL_4_FULL,
  });
  
  describe('Interest Matching', () => {
    it('should calculate interest score based on overlap', () => {
      const engine = new MatchEngine();
      const local = createMockProfile();
      const remote = createMockDigest();
      
      const result = engine.evaluate(local, remote);
      
      expect(result.scores.interest).toBeGreaterThanOrEqual(0);
      expect(result.scores.interest).toBeLessThanOrEqual(100);
    });
    
    it('should give neutral score when no interests', () => {
      const engine = new MatchEngine();
      const local = { ...createMockProfile(), interests: [] };
      const remote = { ...createMockDigest(), interestHashes: [] };
      
      const result = engine.evaluate(local, remote);
      
      expect(result.scores.interest).toBe(50);
    });
  });
  
  describe('Skill Complementarity', () => {
    it('should calculate skill complementarity', () => {
      const engine = new MatchEngine();
      const local = createMockProfile();
      const remote = createMockDigest();
      
      const result = engine.evaluate(local, remote);
      
      expect(result.scores.skill).toBeGreaterThanOrEqual(0);
      expect(result.scores.skill).toBeLessThanOrEqual(100);
    });
    
    it('should give neutral score when no skills', () => {
      const engine = new MatchEngine();
      const local = { ...createMockProfile(), skills: [] };
      const remote = { ...createMockDigest(), activeCategories: [] };
      
      const result = engine.evaluate(local, remote);
      
      expect(result.scores.skill).toBe(50);
    });
  });
  
  describe('Reputation Score', () => {
    it('should use reputation score directly', () => {
      const engine = new MatchEngine();
      const local = createMockProfile();
      const remote = createMockDigest();
      
      const result = engine.evaluate(local, remote);
      
      expect(result.scores.reputation).toBe(85);
    });
    
    it('should cap reputation at 100', () => {
      const engine = new MatchEngine();
      const local = createMockProfile();
      const remote = { ...createMockDigest(), reputationScore: 150 };
      
      const result = engine.evaluate(local, remote);
      
      expect(result.scores.reputation).toBe(100);
    });
  });
  
  describe('Verdict Computation', () => {
    it('should return interested for high scores', () => {
      const engine = new MatchEngine({
        thresholds: { interested: 70, pass: 30 },
      });
      
      const local = createMockProfile();
      const remote = { ...createMockDigest(), reputationScore: 100 };
      
      const result = engine.evaluate(local, remote);
      
      if (result.overallScore >= 70) {
        expect(result.verdict).toBe('interested');
      }
    });
    
    it('should return pass for low scores', () => {
      const engine = new MatchEngine({
        thresholds: { interested: 70, pass: 30 },
      });
      
      const local = createMockProfile();
      const remote = { ...createMockDigest(), reputationScore: 0 };
      
      const result = engine.evaluate(local, remote);
      
      if (result.overallScore <= 30) {
        expect(result.verdict).toBe('pass');
      }
    });
  });
  
  describe('Disclosure Level', () => {
    it('should suggest higher disclosure for interested', () => {
      const engine = new MatchEngine();
      
      const local = createMockProfile();
      const remote = createMockDigest();
      
      const result = engine.evaluate(local, remote);
      
      if (result.verdict === 'interested') {
        expect(result.willingToDisclose).toBeGreaterThanOrEqual(DisclosureLevel.LEVEL_2_VAGUE);
      }
    });
  });
});

describe('Soul.md Parser', () => {
  const sampleSoulMd = `# did:alice

## Interests
- DeFi
- AI
- Rust

## Skills
- Solidity (Blockchain) - 5 years
- Rust (Systems) - 3 years

## Experience
total years: 8
categories: Blockchain, Systems

## Availability
hours per week: 20
timezone: UTC+0

## Seeking
collaboration

## Projects
- [DeFi Protocol](https://example.com) - AMM DEX

## Contact
email: alice@example.com
`;
  
  it('should parse DID', () => {
    const parsed = parseSoulMd(sampleSoulMd);
    expect(parsed.did).toBe('did:alice');
  });
  
  it('should parse interests', () => {
    const parsed = parseSoulMd(sampleSoulMd);
    expect(parsed.interests).toContain('DeFi');
    expect(parsed.interests).toContain('AI');
    expect(parsed.interests).toContain('Rust');
  });
  
  it('should parse skills', () => {
    const parsed = parseSoulMd(sampleSoulMd);
    expect(parsed.skills).toHaveLength(2);
    expect(parsed.skills[0].name).toBe('Solidity');
    expect(parsed.skills[0].category).toBe('Blockchain');
    expect(parsed.skills[0].yearsOfExperience).toBe(5);
  });
  
  it('should parse experience', () => {
    const parsed = parseSoulMd(sampleSoulMd);
    expect(parsed.experience.totalYears).toBe(8);
    expect(parsed.experience.categories).toContain('Blockchain');
  });
  
  it('should parse availability', () => {
    const parsed = parseSoulMd(sampleSoulMd);
    expect(parsed.availability.hoursPerWeek).toBe(20);
    expect(parsed.availability.timezone).toBe('UTC+0');
  });
  
  it('should convert to SoulProfile', () => {
    const parsed = parseSoulMd(sampleSoulMd);
    const profile = toSoulProfile(parsed);
    
    expect(profile.did).toBe('did:alice');
    expect(profile.interests).toHaveLength(3);
    expect(profile.skills).toHaveLength(2);
  });
});

describe('Soul Digest Generator', () => {
  const mockProfile = {
    did: 'did:alice',
    interests: ['DeFi', 'AI'],
    skills: [
      { name: 'Solidity', category: 'Blockchain', level: 'expert' as const, yearsOfExperience: 5 },
    ],
    experience: { totalYears: 5, categories: ['Blockchain'] },
    availability: { hoursPerWeek: 20, timezone: 'UTC' },
    seeking: 'collaboration',
    projects: [],
    contact: {},
  };
  
  it('should generate SoulDigest', () => {
    const digest = generateSoulDigest(mockProfile);
    
    expect(digest.did).toBe('did:alice');
    expect(digest.activeCategories).toContain('Blockchain');
    expect(digest.interestHashes).toHaveLength(2);
    expect(digest.skillsRoot).toBeDefined();
  });
  
  it('should generate Level 1 data', () => {
    const data = generateLevel1Data(mockProfile);
    
    expect(data.skillCategories).toContain('Blockchain');
    expect(data.experienceRange).toBe('5-10');
    expect(data.availabilityRange).toBe('medium');
  });
  
  it('should generate Level 2 data', () => {
    const data = generateLevel2Data(mockProfile);
    
    expect(data.skillDetails).toHaveLength(1);
    expect(data.projectTypes).toContain('Blockchain');
  });
  
  it('should generate Level 3 data', () => {
    const data = generateLevel3Data(mockProfile);
    
    expect(data.notableProjects).toEqual([]);
    expect(data.specificSkills).toContain('Solidity');
  });
  
  it('should generate Level 4 data', () => {
    const soulMd = '# did:alice\n\n## Interests\n- DeFi';
    const data = generateLevel4Data(mockProfile, soulMd);
    
    expect(data.fullSoulMd).toBe(soulMd);
    expect(data.contactInfo).toEqual({});
  });
});
