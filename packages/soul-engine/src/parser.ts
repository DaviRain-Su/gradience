/**
 * SOUL.md Parser
 * 
 * Parses and stringifies SOUL.md files (Markdown <-> SoulProfile)
 */

import matter from 'gray-matter';
import { marked } from 'marked';
import { z } from 'zod';
import {
    type SoulProfile,
    type CreateSoulProfileInput,
    type ValidationResult,
    SoulError,
    SoulErrorCode,
    SOUL_VERSION,
    SOUL_DEFAULTS,
    SOUL_LIMITS,
} from './types.js';

// ============ Zod Schemas for Validation ============

const SoulTypeSchema = z.enum(['human', 'agent']);
const PrivacyLevelSchema = z.enum(['public', 'zk-selective', 'private']);
const CommunicationToneSchema = z.enum(['formal', 'casual', 'technical', 'friendly']);
const CommunicationPaceSchema = z.enum(['fast', 'moderate', 'slow']);
const CommunicationDepthSchema = z.enum(['surface', 'moderate', 'deep']);

const SoulProfileSchema = z.object({
    id: z.string().uuid(),
    version: z.string(),
    soulType: SoulTypeSchema,
    createdAt: z.number().positive(),
    updatedAt: z.number().positive(),
    identity: z.object({
        displayName: z.string().min(1).max(SOUL_LIMITS.displayName),
        bio: z.string().min(1).max(SOUL_LIMITS.bio),
        avatarCID: z.string().optional(),
        links: z.record(z.string()).optional(),
    }),
    values: z.object({
        core: z.array(z.string()).min(1).max(SOUL_LIMITS.arrayField),
        priorities: z.array(z.string()).min(1).max(SOUL_LIMITS.arrayField),
        dealBreakers: z.array(z.string()).max(SOUL_LIMITS.arrayField),
    }),
    interests: z.object({
        topics: z.array(z.string()).min(1).max(SOUL_LIMITS.arrayField),
        skills: z.array(z.string()).min(1).max(SOUL_LIMITS.arrayField),
        goals: z.array(z.string()).max(SOUL_LIMITS.arrayField),
    }),
    communication: z.object({
        tone: CommunicationToneSchema,
        pace: CommunicationPaceSchema,
        depth: CommunicationDepthSchema,
    }),
    boundaries: z.object({
        forbiddenTopics: z.array(z.string()).max(SOUL_LIMITS.forbiddenTopics),
        maxConversationLength: z.number().int().min(1).max(100),
        privacyLevel: PrivacyLevelSchema,
        autoEndTriggers: z.array(z.string()).max(SOUL_LIMITS.forbiddenTopics).optional(),
    }),
    storage: z.object({
        contentHash: z.string(),
        embeddingHash: z.string(),
        storageType: z.enum(['ipfs', 'arweave']),
        cid: z.string(),
    }),
    onChain: z.object({
        solanaAddress: z.string(),
        reputationPDA: z.string(),
        socialScore: z.number().int().min(0).max(100),
        completedProbes: z.number().int().nonnegative().optional(),
        lastActivityAt: z.number().positive().optional(),
    }).optional(),
});

// ============ Helper Functions ============

/**
 * Generate UUID
 */
function generateUUID(): string {
    return crypto.randomUUID();
}

/**
 * Extract text content from markdown heading
 */
function extractHeadingContent(markdown: string, heading: string): string {
    const regex = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
    const match = markdown.match(regex);
    return match ? match[1].trim() : '';
}

/**
 * Parse list items from markdown
 */
function parseListItems(text: string): string[] {
    const lines = text.split('\n');
    const items: string[] = [];
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ')) {
            items.push(trimmed.substring(2).trim());
        }
    }
    
    return items;
}

/**
 * Parse key-value pairs
 */
function parseKeyValue(text: string): Record<string, string> {
    const lines = text.split('\n');
    const result: Record<string, string> = {};
    
    for (const line of lines) {
        const match = line.match(/^([^:]+):\s*(.+)$/);
        if (match) {
            const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
            const value = match[2].trim();
            result[key] = value;
        }
    }
    
    return result;
}

// ============ SoulParser Class ============

export class SoulParser {
    /**
     * Parse SOUL.md markdown to SoulProfile
     */
    static parse(markdown: string): SoulProfile {
        try {
            // Parse frontmatter
            const { data: frontmatter, content } = matter(markdown);
            
            if (!frontmatter.soul_version) {
                throw new SoulError(
                    SoulErrorCode.MISSING_REQUIRED_FIELD,
                    'Missing required field: soul_version'
                );
            }
            
            if (!frontmatter.soul_type) {
                throw new SoulError(
                    SoulErrorCode.MISSING_REQUIRED_FIELD,
                    'Missing required field: soul_type'
                );
            }
            
            // Parse sections
            const identitySection = extractHeadingContent(content, 'Identity');
            const valuesSection = extractHeadingContent(content, 'Core Values');
            const interestsSection = extractHeadingContent(content, 'Interests');
            const commSection = extractHeadingContent(content, 'Communication Style');
            const boundariesSection = extractHeadingContent(content, 'Boundaries');
            
            // Parse Identity
            const identityKV = parseKeyValue(identitySection);
            const linksMatch = identitySection.match(/###\s+Links[^\n]*\n([\s\S]*?)(?=\n##|$)/i);
            const links: Record<string, string> = {};
            
            if (linksMatch) {
                const linkLines = linksMatch[1].split('\n');
                for (const line of linkLines) {
                    const match = line.match(/-\s+([^:]+):\s*(.+)/);
                    if (match) {
                        const key = match[1].trim().toLowerCase();
                        links[key] = match[2].trim();
                    }
                }
            }
            
            const identity = {
                displayName: identityKV.name || '',
                bio: identityKV.bio || '',
                avatarCID: identityKV.avatar,
                links: Object.keys(links).length > 0 ? links : undefined,
            };
            
            // Parse Core Values - use simpler regex
            const coreMatch = valuesSection.match(/###\s+Core Principles([\s\S]*?)(?=###|$)/i);
            const prioritiesMatch = valuesSection.match(/###\s+Priorities([\s\S]*?)(?=###|$)/i);
            const dealBreakersMatch = valuesSection.match(/###\s+Deal Breakers([\s\S]*?)(?=###|$)/i);
            
            const values = {
                core: coreMatch ? parseListItems(coreMatch[1]) : [],
                priorities: prioritiesMatch ? parseListItems(prioritiesMatch[1]) : [],
                dealBreakers: dealBreakersMatch ? parseListItems(dealBreakersMatch[1]) : [],
            };
            
            // Parse Interests - use simpler regex
            const topicsMatch = interestsSection.match(/###\s+Topics([\s\S]*?)(?=###|$)/i);
            const skillsMatch = interestsSection.match(/###\s+Skills([\s\S]*?)(?=###|$)/i);
            const goalsMatch = interestsSection.match(/###\s+Goals([\s\S]*?)(?=###|$)/i);
            
            const interests = {
                topics: topicsMatch ? parseListItems(topicsMatch[1]) : [],
                skills: skillsMatch ? parseListItems(skillsMatch[1]) : [],
                goals: goalsMatch ? parseListItems(goalsMatch[1]) : [],
            };
            
            // Parse Communication Style
            const commKV = parseKeyValue(commSection);
            const communication = {
                tone: (commKV.tone || SOUL_DEFAULTS.communication.tone) as any,
                pace: (commKV.pace || SOUL_DEFAULTS.communication.pace) as any,
                depth: (commKV.depth || SOUL_DEFAULTS.communication.depth) as any,
            };
            
            // Parse Boundaries
            const forbiddenMatch = boundariesSection.match(/###\s+Forbidden Topics[^\n]*\n([\s\S]*?)(?=\n[A-Z]|$)/i);
            const autoEndMatch = boundariesSection.match(/###\s+Auto-End Triggers[^\n]*\n([\s\S]*?)(?=\n##|$)/i);
            const boundariesKV = parseKeyValue(boundariesSection);
            
            const boundaries = {
                forbiddenTopics: forbiddenMatch ? parseListItems(forbiddenMatch[1]) : [],
                maxConversationLength: parseInt(boundariesKV.max_conversation_length || '20'),
                privacyLevel: (boundariesKV.privacy_level || 'public') as any,
                autoEndTriggers: autoEndMatch ? parseListItems(autoEndMatch[1]) : undefined,
            };
            
            // Create profile
            const createdAt = frontmatter.created_at
                ? new Date(frontmatter.created_at).getTime()
                : Date.now();
            const updatedAt = frontmatter.updated_at
                ? new Date(frontmatter.updated_at).getTime()
                : createdAt;  // Default to createdAt if not specified
            
            const profile: SoulProfile = {
                id: frontmatter.id || generateUUID(),
                version: frontmatter.soul_version,
                soulType: frontmatter.soul_type,
                createdAt,
                updatedAt,
                identity,
                values,
                interests,
                communication,
                boundaries,
                storage: {
                    contentHash: '',
                    embeddingHash: '',
                    storageType: 'ipfs',
                    cid: '',
                },
            };
            
            return profile;
        } catch (error) {
            if (error instanceof SoulError) {
                throw error;
            }
            throw new SoulError(
                SoulErrorCode.INVALID_FORMAT,
                'Failed to parse SOUL.md',
                error
            );
        }
    }
    
    /**
     * Stringify SoulProfile to SOUL.md markdown
     */
    static stringify(profile: SoulProfile): string {
        // Build frontmatter
        const frontmatter = {
            soul_version: profile.version,
            soul_type: profile.soulType,
            created_at: new Date(profile.createdAt).toISOString(),
            updated_at: new Date(profile.updatedAt).toISOString(),
        };
        
        // Build markdown sections
        const sections: string[] = [];
        
        // Identity
        sections.push('## Identity\n');
        sections.push(`Name: ${profile.identity.displayName}`);
        sections.push(`Bio: ${profile.identity.bio}`);
        if (profile.identity.avatarCID) {
            sections.push(`Avatar: ${profile.identity.avatarCID}`);
        }
        if (profile.identity.links && Object.keys(profile.identity.links).length > 0) {
            sections.push('\n### Links');
            for (const [key, value] of Object.entries(profile.identity.links)) {
                const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
                sections.push(`- ${capitalizedKey}: ${value}`);
            }
        }
        
        // Core Values
        sections.push('\n## Core Values\n');
        sections.push('### Core Principles');
        profile.values.core.forEach(v => sections.push(`- ${v}`));
        sections.push('\n### Priorities');
        profile.values.priorities.forEach(p => sections.push(`- ${p}`));
        if (profile.values.dealBreakers.length > 0) {
            sections.push('\n### Deal Breakers');
            profile.values.dealBreakers.forEach(d => sections.push(`- ${d}`));
        }
        
        // Interests
        sections.push('\n## Interests\n');
        sections.push('### Topics');
        profile.interests.topics.forEach(t => sections.push(`- ${t}`));
        sections.push('\n### Skills');
        profile.interests.skills.forEach(s => sections.push(`- ${s}`));
        if (profile.interests.goals.length > 0) {
            sections.push('\n### Goals');
            profile.interests.goals.forEach(g => sections.push(`- ${g}`));
        }
        
        // Communication Style
        sections.push('\n## Communication Style\n');
        sections.push(`Tone: ${profile.communication.tone}`);
        sections.push(`Pace: ${profile.communication.pace}`);
        sections.push(`Depth: ${profile.communication.depth}`);
        
        // Boundaries
        sections.push('\n## Boundaries\n');
        if (profile.boundaries.forbiddenTopics.length > 0) {
            sections.push('### Forbidden Topics');
            profile.boundaries.forbiddenTopics.forEach(t => sections.push(`- ${t}`));
            sections.push('');
        }
        sections.push(`Max Conversation Length: ${profile.boundaries.maxConversationLength} turns`);
        sections.push(`Privacy Level: ${profile.boundaries.privacyLevel}`);
        if (profile.boundaries.autoEndTriggers && profile.boundaries.autoEndTriggers.length > 0) {
            sections.push('\n### Auto-End Triggers');
            profile.boundaries.autoEndTriggers.forEach(t => sections.push(`- ${t}`));
        }
        
        const content = `# SOUL Profile\n\n${sections.join('\n')}`;
        
        return matter.stringify(content, frontmatter);
    }
    
    /**
     * Validate SoulProfile
     */
    static validate(profile: SoulProfile): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        try {
            SoulProfileSchema.parse(profile);
        } catch (error) {
            if (error instanceof z.ZodError) {
                error.errors.forEach(err => {
                    errors.push(`${err.path.join('.')}: ${err.message}`);
                });
            }
        }
        
        // Additional validation
        if (profile.updatedAt < profile.createdAt) {
            errors.push('updatedAt must be >= createdAt');
        }
        
        // Warnings
        if (profile.values.core.length > 10) {
            warnings.push('Consider reducing core values to top 5-10 most important ones');
        }
        
        if (profile.identity.bio.length < 50) {
            warnings.push('Bio is quite short, consider adding more details');
        }
        
        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }
}
