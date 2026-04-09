/**
 * P2P Soul Handshake Protocol - Type Definitions
 *
 * @module p2p-soul/types
 */

// ============================================================================
// Disclosure Levels
// ============================================================================

export enum DisclosureLevel {
    LEVEL_0_PUBLIC = 0, // 公开：声誉分数、活跃领域
    LEVEL_1_ANONYMOUS = 1, // 匿名：兴趣标签哈希、技能类别
    LEVEL_2_VAGUE = 2, // 模糊：经验年限范围、大致地理位置
    LEVEL_3_DETAILED = 3, // 详细：具体项目经历、联系方式
    LEVEL_4_FULL = 4, // 完整：完整 Soul.md
}

// ============================================================================
// Message Types
// ============================================================================

export type MessageType =
    | 'DISCOVER'
    | 'INVITE'
    | 'INVITE_RESPONSE'
    | 'HANDSHAKE_L1'
    | 'HANDSHAKE_L2'
    | 'HANDSHAKE_L3'
    | 'HANDSHAKE_L4'
    | 'HANDSHAKE_COMPLETE'
    | 'HANDSHAKE_REJECT'
    | 'MATCH_CONFIRM'
    | 'MATCH_REJECT'
    | 'ACK';

// ============================================================================
// Base Message Structure
// ============================================================================

export interface SoulMessage {
    version: '1.0.0';
    messageId: string;
    correlationId: string;
    timestamp: number;
    sender: {
        did: string;
        publicKey: string;
    };
    messageType: MessageType;
    payload: unknown;
    signature: string;
}

// ============================================================================
// Message Payloads
// ============================================================================

export interface DiscoverPayload {
    publicProfile: {
        did: string;
        reputationScore: number;
        activeCategories: string[];
        seeking: 'collaboration' | 'mentorship' | 'hiring' | 'funding';
    };
    interestHashes: string[];
    maxDisclosureLevel: DisclosureLevel;
    expiresAt: number;
}

export interface InvitePayload {
    targetDid: string;
    publicProfile: DiscoverPayload['publicProfile'];
    initialDisclosure: DisclosureLevel;
    ephemeralPublicKey: string;
    reputationProof: {
        programId: string;
        accountAddress: string;
        signature: string;
    };
}

export interface InviteResponsePayload {
    inviteId: string;
    accepted: boolean;
    initialDisclosure?: DisclosureLevel;
    ephemeralPublicKey?: string;
    reason?: string;
}

export interface HandshakePayload {
    level: DisclosureLevel;
    encryptedData: string;
    zkProof: {
        type: 'merkle' | 'range' | 'membership';
        proof: string;
        publicInputs: string[];
    };
    nextLevelCommitment?: string;
    verdict: 'interested' | 'need_more_info' | 'pass';
}

export interface MatchPayload {
    confirmed: boolean;
    encryptedContact?: string;
    reason?: string;
}

// ============================================================================
// Disclosure Data Levels
// ============================================================================

export interface Level1Data {
    skillCategories: string[];
    experienceRange: '0-2' | '2-5' | '5-10' | '10+';
    availabilityRange: 'low' | 'medium' | 'high';
    timezoneOffset: number;
}

export interface Level2Data {
    skillDetails: Array<{
        category: string;
        proficiency: 'beginner' | 'intermediate' | 'expert';
        yearsOfExperience: number;
    }>;
    projectTypes: string[];
    collaborationStyle: 'solo' | 'small_team' | 'large_team';
    communicationPreference: 'async' | 'sync' | 'mixed';
}

export interface Level3Data {
    notableProjects: Array<{
        name: string;
        description: string;
        role: string;
        url?: string;
    }>;
    specificSkills: string[];
    portfolioUrl?: string;
    githubUrl?: string;
    linkedinUrl?: string;
}

export interface Level4Data {
    fullSoulMd: string;
    contactInfo: {
        email?: string;
        telegram?: string;
        discord?: string;
    };
}

// ============================================================================
// Soul Profile & Digest
// ============================================================================

export interface SoulProfile {
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
    projects: Level3Data['notableProjects'];
    contact: Level4Data['contactInfo'];
}

export interface SoulDigest {
    did: string;
    reputationScore: number;
    activeCategories: string[];
    seeking: string;
    interestHashes: string[];
    skillsRoot: string;
    maxDisclosureLevel: DisclosureLevel;
    timezoneOffset?: number;
    availabilityRange?: 'low' | 'medium' | 'high';
}

// ============================================================================
// Handshake State Machine
// ============================================================================

export type HandshakeState = 'IDLE' | 'DISCOVERING' | 'INVITED' | 'HANDSHAKING' | 'MATCHED' | 'FAILED';

export type HandshakeEvent =
    | { type: 'DISCOVER'; criteria: DiscoveryCriteria }
    | { type: 'FOUND'; candidate: SoulDigest }
    | { type: 'RECEIVE_INVITE'; invite: InviteMessage }
    | { type: 'ACCEPT_INVITE'; initialDisclosure: DisclosureLevel }
    | { type: 'REJECT_INVITE'; reason?: string }
    | { type: 'DISCLOSE'; level: DisclosureLevel; data: unknown; verdict: Verdict }
    | { type: 'CONFIRM_MATCH' }
    | { type: 'REJECT_MATCH'; reason?: string }
    | { type: 'TIMEOUT' }
    | { type: 'ERROR'; error: Error };

export type Verdict = 'interested' | 'need_more_info' | 'pass';

// ============================================================================
// Message Wrappers
// ============================================================================

export interface InviteMessage extends SoulMessage {
    messageType: 'INVITE';
    payload: InvitePayload;
}

export interface HandshakeMessage extends SoulMessage {
    messageType: 'HANDSHAKE_L1' | 'HANDSHAKE_L2' | 'HANDSHAKE_L3' | 'HANDSHAKE_L4';
    payload: HandshakePayload;
}

// ============================================================================
// Configuration
// ============================================================================

export interface P2pSoulConfig {
    // Timeouts
    discoverTimeoutMs: number;
    handshakeTimeoutMs: number;
    matchTimeoutMs: number;

    // Disclosure settings
    defaultDisclosureLevel: DisclosureLevel;
    maxDisclosureLevel: DisclosureLevel;

    // Matching settings
    minReputationScore: number;
    minMatchScore: number;

    // Crypto settings
    keyAlgorithm: 'X25519';
    encryptionAlgorithm: 'AES-256-GCM';

    // Network settings
    nostrRelays: string[];
    enableXmtp: boolean;
}

export interface DiscoveryCriteria {
    seeking?: string;
    categories?: string[];
    minReputationScore?: number;
    maxResults?: number;
}

// ============================================================================
// Match Evaluation
// ============================================================================

export interface MatchEvaluation {
    scores: {
        interest: number;
        skill: number;
        reputation: number;
        availability: number;
    };
    overallScore: number;
    verdict: Verdict;
    willingToDisclose: DisclosureLevel;
}

export interface MatchConfig {
    weights: {
        interest: number;
        skill: number;
        reputation: number;
        availability: number;
    };
    thresholds: {
        interested: number;
        pass: number;
    };
    disclosureLevels: {
        interested: DisclosureLevel;
        need_more_info: DisclosureLevel;
        pass: DisclosureLevel;
    };
}

// ============================================================================
// Crypto Types
// ============================================================================

export interface X25519KeyPair {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
}

export interface EncryptedData {
    ciphertext: string;
    nonce: string;
    algorithm: 'AES-256-GCM';
}

export interface MerkleProof {
    root: string;
    leaf: string;
    proof: string[];
    index: number;
}

// ============================================================================
// Storage Types
// ============================================================================

export interface HandshakeSession {
    id: string;
    initiatorDid: string;
    responderDid: string;
    currentState: HandshakeState;
    currentLevel: DisclosureLevel;
    createdAt: number;
    updatedAt: number;
    expiresAt: number;
    encryptedContext: string;
}

export interface DisclosureRecord {
    id: string;
    sessionId: string;
    level: DisclosureLevel;
    fromDid: string;
    toDid: string;
    encryptedData: string;
    zkProof?: string;
    verdict: Verdict;
    createdAt: number;
}

export interface MatchRecord {
    id: string;
    sessionId: string;
    partyADid: string;
    partyBDid: string;
    matchedAt: number;
    sharedLevel: DisclosureLevel;
    encryptedContactA?: string;
    encryptedContactB?: string;
}

// ============================================================================
// Errors
// ============================================================================

export class P2pSoulError extends Error {
    constructor(
        message: string,
        public code: string,
        public state?: HandshakeState,
    ) {
        super(message);
        this.name = 'P2pSoulError';
    }
}

export class HandshakeError extends P2pSoulError {
    constructor(message: string, state: HandshakeState) {
        super(message, 'HANDSHAKE_ERROR', state);
        this.name = 'HandshakeError';
    }
}

export class CryptoError extends P2pSoulError {
    constructor(message: string) {
        super(message, 'CRYPTO_ERROR');
        this.name = 'CryptoError';
    }
}
