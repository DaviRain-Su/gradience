/**
 * Soul Profile Types
 *
 * Type definitions for SOUL.md - the standardized soul profile format
 * for non-financial A2A social matching in the Gradience ecosystem.
 *
 * @module @gradiences/soul-engine/types
 */

// ============ Core Types ============

/**
 * Soul type - distinguishes between human and agent profiles
 */
export type SoulType = 'human' | 'agent';

/**
 * Privacy level for Soul Profile visibility
 */
export type PrivacyLevel =
    | 'public' // Fully visible to everyone
    | 'zk-selective' // Selective disclosure with ZK proofs
    | 'private'; // Only visible with explicit permission

/**
 * Communication tone preference
 */
export type CommunicationTone = 'formal' | 'casual' | 'technical' | 'friendly';

/**
 * Communication pace preference
 */
export type CommunicationPace = 'fast' | 'moderate' | 'slow';

/**
 * Communication depth preference
 */
export type CommunicationDepth = 'surface' | 'moderate' | 'deep';

/**
 * Storage type for Soul Profile content
 */
export type StorageType = 'ipfs' | 'arweave';

// ============ Profile Components ============

/**
 * Identity information
 */
export interface SoulIdentity {
    /** Display name */
    displayName: string;

    /** Short bio or description */
    bio: string;

    /** Optional avatar image CID */
    avatarCID?: string;

    /** Optional website or social links */
    links?: {
        website?: string;
        twitter?: string;
        github?: string;
        [key: string]: string | undefined;
    };
}

/**
 * Core values and principles
 */
export interface SoulValues {
    /** Core values (e.g., "honesty", "creativity") */
    core: string[];

    /** Life/work priorities */
    priorities: string[];

    /** Deal-breakers or red lines */
    dealBreakers: string[];
}

/**
 * Interests and passions
 */
export interface SoulInterests {
    /** Topics of interest */
    topics: string[];

    /** Skills and capabilities */
    skills: string[];

    /** Goals and aspirations */
    goals: string[];
}

/**
 * Communication style preferences
 */
export interface SoulCommunication {
    /** Tone preference */
    tone: CommunicationTone;

    /** Pace preference */
    pace: CommunicationPace;

    /** Depth preference */
    depth: CommunicationDepth;
}

/**
 * Boundaries and constraints
 */
export interface SoulBoundaries {
    /** Topics to avoid */
    forbiddenTopics: string[];

    /** Maximum conversation length (turns) */
    maxConversationLength: number;

    /** Privacy level */
    privacyLevel: PrivacyLevel;

    /** Auto-end triggers (keywords that end conversation) */
    autoEndTriggers?: string[];
}

/**
 * Storage metadata
 */
export interface SoulStorage {
    /** Content hash (SHA-256 of SOUL.md) */
    contentHash: string;

    /** Embedding vector hash */
    embeddingHash: string;

    /** Storage type */
    storageType: StorageType;

    /** Content identifier (IPFS CID or Arweave TX ID) */
    cid: string;
}

/**
 * On-chain metadata (optional)
 */
export interface SoulOnChain {
    /** Solana wallet address */
    solanaAddress: string;

    /** Reputation PDA address */
    reputationPDA: string;

    /** Social accuracy score (0-100) */
    socialScore: number;

    /** Number of completed probes */
    completedProbes?: number;

    /** Last activity timestamp */
    lastActivityAt?: number;
}

// ============ Main Profile Type ============

/**
 * Complete Soul Profile
 *
 * Represents a comprehensive soul profile for an agent or human,
 * containing identity, values, interests, communication preferences,
 * boundaries, and storage metadata.
 */
export interface SoulProfile {
    // Metadata
    /** Unique identifier (UUID) */
    id: string;

    /** SOUL.md format version */
    version: string;

    /** Soul type */
    soulType: SoulType;

    /** Creation timestamp (Unix ms) */
    createdAt: number;

    /** Last update timestamp (Unix ms) */
    updatedAt: number;

    // Profile Components
    /** Identity information */
    identity: SoulIdentity;

    /** Core values */
    values: SoulValues;

    /** Interests and passions */
    interests: SoulInterests;

    /** Communication preferences */
    communication: SoulCommunication;

    /** Boundaries and constraints */
    boundaries: SoulBoundaries;

    /** Storage metadata */
    storage: SoulStorage;

    /** On-chain metadata (optional) */
    onChain?: SoulOnChain;
}

// ============ Validation & Errors ============

/**
 * Validation result
 */
export interface ValidationResult {
    /** Whether validation passed */
    valid: boolean;

    /** Error messages (if any) */
    errors: string[];

    /** Warning messages (if any) */
    warnings?: string[];
}

/**
 * Soul Profile error codes
 */
export enum SoulErrorCode {
    // Parsing errors
    INVALID_FORMAT = 'INVALID_FORMAT',
    INVALID_FRONTMATTER = 'INVALID_FRONTMATTER',
    MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

    // Storage errors
    STORAGE_UPLOAD_FAILED = 'STORAGE_UPLOAD_FAILED',
    STORAGE_DOWNLOAD_FAILED = 'STORAGE_DOWNLOAD_FAILED',
    STORAGE_HASH_MISMATCH = 'STORAGE_HASH_MISMATCH',

    // Validation errors
    INVALID_SOUL_TYPE = 'INVALID_SOUL_TYPE',
    INVALID_PRIVACY_LEVEL = 'INVALID_PRIVACY_LEVEL',
    INVALID_COMMUNICATION_STYLE = 'INVALID_COMMUNICATION_STYLE',

    // General errors
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Soul Profile error
 */
export class SoulError extends Error {
    constructor(
        public code: SoulErrorCode,
        message: string,
        public cause?: unknown,
    ) {
        super(message);
        this.name = 'SoulError';
    }
}

// ============ Utility Types ============

/**
 * Partial Soul Profile (for updates)
 */
export type PartialSoulProfile = Partial<Omit<SoulProfile, 'id' | 'version' | 'createdAt'>> & {
    id: string;
};

/**
 * Soul Profile creation input
 */
export type CreateSoulProfileInput = Omit<SoulProfile, 'id' | 'createdAt' | 'updatedAt' | 'storage'> & {
    storage?: Partial<SoulStorage>;
};

/**
 * Soul Profile update input
 */
export type UpdateSoulProfileInput = Partial<
    Omit<SoulProfile, 'id' | 'version' | 'createdAt' | 'updatedAt' | 'storage'>
> & {
    storage?: Partial<SoulStorage>;
};

// ============ Constants ============

/**
 * Current SOUL.md format version
 */
export const SOUL_VERSION = '1.0';

/**
 * Default values
 */
export const SOUL_DEFAULTS = {
    version: SOUL_VERSION,
    communication: {
        tone: 'friendly' as CommunicationTone,
        pace: 'moderate' as CommunicationPace,
        depth: 'moderate' as CommunicationDepth,
    },
    boundaries: {
        forbiddenTopics: [] as string[],
        maxConversationLength: 20,
        privacyLevel: 'public' as PrivacyLevel,
    },
} as const;

/**
 * Maximum field lengths
 */
export const SOUL_LIMITS = {
    displayName: 100,
    bio: 500,
    arrayField: 20,
    topicLength: 50,
    forbiddenTopics: 10,
} as const;
