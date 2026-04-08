/**
 * P2P Soul Handshake Protocol - Match Engine
 * 
 * Local matching algorithm that evaluates compatibility between
 * local Soul profile and remote Soul digest.
 * 
 * @module p2p-soul/engine
 */

import type {
  SoulProfile,
  SoulDigest,
  MatchEvaluation,
  MatchConfig,
  Verdict,
} from './types.js';
import { DisclosureLevel } from './types.js';
import { hashInterest } from './crypto.js';

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_MATCH_CONFIG: MatchConfig = {
  weights: {
    interest: 0.3,
    skill: 0.3,
    reputation: 0.2,
    availability: 0.2,
  },
  thresholds: {
    interested: 70,
    pass: 30,
  },
  disclosureLevels: {
    interested: DisclosureLevel.LEVEL_3_DETAILED,
    need_more_info: DisclosureLevel.LEVEL_2_VAGUE,
    pass: DisclosureLevel.LEVEL_1_ANONYMOUS,
  },
};

// ============================================================================
// Match Engine
// ============================================================================

export class MatchEngine {
  private config: MatchConfig;
  
  constructor(config: Partial<MatchConfig> = {}) {
    this.config = {
      weights: { ...DEFAULT_MATCH_CONFIG.weights, ...config.weights },
      thresholds: { ...DEFAULT_MATCH_CONFIG.thresholds, ...config.thresholds },
      disclosureLevels: { ...DEFAULT_MATCH_CONFIG.disclosureLevels, ...config.disclosureLevels },
    };
  }
  
  /**
   * Evaluate match between local profile and remote digest
   */
  evaluate(localSoul: SoulProfile, remoteDigest: SoulDigest): MatchEvaluation {
    const scores = {
      interest: this.calculateInterestScore(localSoul, remoteDigest),
      skill: this.calculateSkillComplementarity(localSoul, remoteDigest),
      reputation: this.calculateReputationScore(remoteDigest),
      availability: this.calculateAvailabilityMatch(localSoul, remoteDigest),
    };
    
    const overallScore = this.weightedAverage(scores);
    const verdict = this.computeVerdict(overallScore);
    const willingToDisclose = this.computeDisclosureLevel(verdict);
    
    return {
      scores,
      overallScore,
      verdict,
      willingToDisclose,
    };
  }
  
  /**
   * Calculate interest match score (0-100)
   * Based on overlap between local interests and remote interest hashes
   */
  private calculateInterestScore(local: SoulProfile, remote: SoulDigest): number {
    if (local.interests.length === 0 || remote.interestHashes.length === 0) {
      return 50; // Neutral score if no data
    }
    
    // Hash local interests
    const localInterestHashes = new Set(local.interests.map(i => hashInterest(i)));
    
    // Count matches
    let matches = 0;
    for (const remoteHash of remote.interestHashes) {
      if (localInterestHashes.has(remoteHash)) {
        matches++;
      }
    }
    
    // Calculate Jaccard similarity
    const union = new Set([...localInterestHashes, ...remote.interestHashes]).size;
    const jaccard = union > 0 ? matches / union : 0;
    
    // Scale to 0-100
    return Math.round(jaccard * 100);
  }
  
  /**
   * Calculate skill complementarity score (0-100)
   * Higher score when skills are complementary rather than overlapping
   */
  private calculateSkillComplementarity(local: SoulProfile, remote: SoulDigest): number {
    const localSkillCategories = new Set(local.skills.map(s => s.category));
    const remoteSkillCategories = new Set(remote.activeCategories);
    
    if (localSkillCategories.size === 0 || remoteSkillCategories.size === 0) {
      return 50;
    }
    
    // Calculate what each side has that the other doesn't
    const localHasRemoteNeeds = [...remoteSkillCategories].filter(
      cat => !localSkillCategories.has(cat)
    ).length;
    
    const remoteHasLocalNeeds = [...localSkillCategories].filter(
      cat => !remoteSkillCategories.has(cat)
    ).length;
    
    // Complementarity = both can provide value to each other
    const totalUnique = localSkillCategories.size + remoteSkillCategories.size;
    const complementarity = (localHasRemoteNeeds + remoteHasLocalNeeds) / totalUnique;
    
    return Math.round(complementarity * 100);
  }
  
  /**
   * Calculate reputation score (0-100)
   */
  private calculateReputationScore(remote: SoulDigest): number {
    // Normalize reputation score to 0-100
    return Math.min(100, Math.max(0, remote.reputationScore));
  }
  
  /**
   * Calculate availability match score (0-100)
   * Currently simplified - can be enhanced with timezone overlap calculation
   */
  private calculateAvailabilityMatch(local: SoulProfile, remote: SoulDigest): number {
    // For now, return neutral score
    // TODO: Implement timezone overlap and availability matching
    return 70;
  }
  
  /**
   * Calculate weighted average of scores
   */
  private weightedAverage(scores: { interest: number; skill: number; reputation: number; availability: number }): number {
    const weighted = 
      scores.interest * this.config.weights.interest +
      scores.skill * this.config.weights.skill +
      scores.reputation * this.config.weights.reputation +
      scores.availability * this.config.weights.availability;
    
    return Math.round(weighted);
  }
  
  /**
   * Compute verdict based on overall score
   */
  private computeVerdict(score: number): Verdict {
    if (score >= this.config.thresholds.interested) {
      return 'interested';
    } else if (score <= this.config.thresholds.pass) {
      return 'pass';
    } else {
      return 'need_more_info';
    }
  }
  
  /**
   * Compute disclosure level based on verdict
   */
  private computeDisclosureLevel(verdict: Verdict): DisclosureLevel {
    return this.config.disclosureLevels[verdict];
  }
  
  /**
   * Update match configuration
   */
  updateConfig(config: Partial<MatchConfig>): void {
    this.config = {
      weights: { ...this.config.weights, ...config.weights },
      thresholds: { ...this.config.thresholds, ...config.thresholds },
      disclosureLevels: { ...this.config.disclosureLevels, ...config.disclosureLevels },
    };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): MatchConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Soul Profile Parser
// ============================================================================

export interface ParsedSoulMd {
  did: string;
  interests: string[];
  skills: Array<{
    name: string;
    category: string;
    level: 'beginner' | 'intermediate' | 'expert';
    yearsOfExperience: number;
  }>;
  experience: {
    totalYears: number;
    categories: string[];
  };
  availability: {
    hoursPerWeek: number;
    timezone: string;
  };
  seeking: string;
  projects: Array<{
    name: string;
    description: string;
    role: string;
    url?: string;
  }>;
  contact: {
    email?: string;
    telegram?: string;
    discord?: string;
  };
  links?: {
    portfolio?: string;
    github?: string;
    linkedin?: string;
  };
}

/**
 * Parse Soul.md content into structured profile
 */
export function parseSoulMd(content: string): ParsedSoulMd {
  // Simple markdown parsing - can be enhanced with a proper parser
  const lines = content.split('\n');
  
  const profile: Partial<ParsedSoulMd> = {
    interests: [],
    skills: [],
    experience: { totalYears: 0, categories: [] },
    availability: { hoursPerWeek: 0, timezone: 'UTC' },
    projects: [],
    contact: {},
    links: {},
  };
  
  let currentSection: string | null = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Parse headers
    if (trimmed.startsWith('# ')) {
      profile.did = trimmed.replace('# ', '').trim();
    } else if (trimmed.startsWith('## ')) {
      currentSection = trimmed.replace('## ', '').trim().toLowerCase();
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const item = trimmed.replace(/^[-*]\s*/, '');
      
      switch (currentSection) {
        case 'interests':
          profile.interests?.push(item);
          break;
        case 'skills':
          const skillMatch = item.match(/^(.+?)\s*\(([^)]+)\)\s*-?\s*(\d+)?\s*years?/i);
          if (skillMatch) {
            profile.skills?.push({
              name: skillMatch[1].trim(),
              category: skillMatch[2].trim(),
              level: 'intermediate',
              yearsOfExperience: parseInt(skillMatch[3] || '0'),
            });
          }
          break;
        case 'projects':
          const projectMatch = item.match(/^\[(.+?)\]\((.+?)\)\s*-\s*(.+)/);
          if (projectMatch) {
            profile.projects?.push({
              name: projectMatch[1],
              url: projectMatch[2],
              description: projectMatch[3],
              role: 'Contributor',
            });
          }
          break;
      }
    } else if (trimmed.includes(':')) {
      const [key, value] = trimmed.split(':').map(s => s.trim());
      
      switch (currentSection) {
        case 'experience':
          if (key === 'total years') {
            profile.experience!.totalYears = parseInt(value) || 0;
          } else if (key === 'categories') {
            profile.experience!.categories = value.split(',').map(s => s.trim());
          }
          break;
        case 'availability':
          if (key === 'hours per week') {
            profile.availability!.hoursPerWeek = parseInt(value) || 0;
          } else if (key === 'timezone') {
            profile.availability!.timezone = value;
          }
          break;
        case 'seeking':
          profile.seeking = value;
          break;
        case 'contact':
          (profile.contact as any)[key.toLowerCase()] = value;
          break;
        case 'links':
          if (!profile.links) profile.links = {};
          const linkKey = key.toLowerCase();
          if (linkKey === 'portfolio' || linkKey === 'github' || linkKey === 'linkedin') {
            (profile.links as any)[linkKey] = value;
          }
          break;
      }
    }
  }
  
  return profile as ParsedSoulMd;
}

/**
 * Convert parsed Soul.md to SoulProfile format
 */
export function toSoulProfile(parsed: ParsedSoulMd): SoulProfile {
  return {
    did: parsed.did,
    interests: parsed.interests,
    skills: parsed.skills,
    experience: parsed.experience,
    availability: parsed.availability,
    seeking: parsed.seeking,
    projects: parsed.projects,
    contact: parsed.contact,
  };
}

// ============================================================================
// Soul Digest Generator
// ============================================================================

import type { Level1Data, Level2Data, Level3Data, Level4Data } from './types.js';
import { buildMerkleRoot, sha256 } from './crypto.js';

/**
 * Generate SoulDigest from SoulProfile
 */
export function generateSoulDigest(
  profile: SoulProfile,
  maxDisclosureLevel: DisclosureLevel = DisclosureLevel.LEVEL_4_FULL
): SoulDigest {
  return {
    did: profile.did,
    reputationScore: 0, // TODO: Fetch from chain
    activeCategories: [...new Set(profile.skills.map(s => s.category))],
    seeking: profile.seeking,
    interestHashes: profile.interests.map(i => hashInterest(i)),
    skillsRoot: buildMerkleRoot(profile.skills.map(s => JSON.stringify(s))),
    maxDisclosureLevel,
  };
}

/**
 * Generate Level 1 disclosure data
 */
export function generateLevel1Data(profile: SoulProfile): Level1Data {
  const totalYears = profile.experience.totalYears;
  let experienceRange: Level1Data['experienceRange'];
  
  if (totalYears < 2) experienceRange = '0-2';
  else if (totalYears < 5) experienceRange = '2-5';
  else if (totalYears < 10) experienceRange = '5-10';
  else experienceRange = '10+';
  
  const hoursPerWeek = profile.availability.hoursPerWeek;
  let availabilityRange: Level1Data['availabilityRange'];
  
  if (hoursPerWeek < 10) availabilityRange = 'low';
  else if (hoursPerWeek < 30) availabilityRange = 'medium';
  else availabilityRange = 'high';
  
  // Round timezone to nearest 2 hours
  const timezoneOffset = Math.round(parseInt(profile.availability.timezone) / 2) * 2;
  
  return {
    skillCategories: [...new Set(profile.skills.map(s => s.category))],
    experienceRange,
    availabilityRange,
    timezoneOffset,
  };
}

/**
 * Generate Level 2 disclosure data
 */
export function generateLevel2Data(profile: SoulProfile): Level2Data {
  const hasEmail = !!profile.contact.email;
  const hasSocial = !!(profile.contact.telegram || profile.contact.discord);
  const communicationPreference = hasEmail && hasSocial ? 'mixed' : hasSocial ? 'informal' : 'formal';

  return {
    skillDetails: profile.skills.map(s => ({
      category: s.category,
      proficiency: s.level,
      yearsOfExperience: s.yearsOfExperience,
    })),
    projectTypes: profile.experience.categories,
    collaborationStyle: profile.availability.hoursPerWeek > 20 ? 'small_team' : 'solo',
    communicationPreference,
  };
}

/**
 * Generate Level 3 disclosure data
 */
export function generateLevel3Data(profile: SoulProfile): Level3Data {
  const portfolioUrl = profile.projects.find(p => p.url)?.url;
  return {
    notableProjects: profile.projects,
    specificSkills: profile.skills.map(s => s.name),
    portfolioUrl,
  };
}

/**
 * Generate Level 4 disclosure data
 */
export function generateLevel4Data(profile: SoulProfile, rawSoulMd: string): Level4Data {
  return {
    fullSoulMd: rawSoulMd,
    contactInfo: profile.contact,
  };
}

/**
 * Generate disclosure data for a specific level
 */
export function generateDisclosureData(
  profile: SoulProfile,
  rawSoulMd: string,
  level: DisclosureLevel
): unknown {
  switch (level) {
    case DisclosureLevel.LEVEL_1_ANONYMOUS:
      return generateLevel1Data(profile);
    case DisclosureLevel.LEVEL_2_VAGUE:
      return generateLevel2Data(profile);
    case DisclosureLevel.LEVEL_3_DETAILED:
      return generateLevel3Data(profile);
    case DisclosureLevel.LEVEL_4_FULL:
      return generateLevel4Data(profile, rawSoulMd);
    default:
      return {};
  }
}
