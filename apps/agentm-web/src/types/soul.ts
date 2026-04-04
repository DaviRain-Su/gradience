/**
 * Soul Profile Types
 * Minimal types for deployment
 */

export type SoulType = 'human' | 'agent';
export type PrivacyLevel = 'public' | 'zk-selective' | 'private';
export type CommunicationTone = 'formal' | 'casual' | 'technical' | 'friendly';
export type CommunicationPace = 'fast' | 'moderate' | 'slow';
export type CommunicationDepth = 'surface' | 'moderate' | 'deep';
export type StorageType = 'ipfs' | 'arweave';

export interface SoulIdentity {
  displayName: string;
  bio: string;
  avatarCID?: string;
  links?: {
    website?: string;
    twitter?: string;
    github?: string;
    [key: string]: string | undefined;
  };
}

export interface SoulValues {
  core: string[];
  priorities: string[];
  dealBreakers: string[];
}

export interface SoulInterests {
  topics: string[];
  skills: string[];
  goals: string[];
}

export interface SoulCommunication {
  tone: CommunicationTone;
  pace: CommunicationPace;
  depth: CommunicationDepth;
}

export interface SoulBoundaries {
  forbiddenTopics: string[];
  maxConversationLength: number;
  privacyLevel: PrivacyLevel;
  autoEndTriggers?: string[];
}

export interface SoulStorage {
  contentHash: string;
  embeddingHash: string;
  storageType: StorageType;
  cid: string;
}

export interface SoulProfile {
  id: string;
  version: string;
  soulType: SoulType;
  createdAt: number;
  updatedAt: number;
  identity: SoulIdentity;
  values: SoulValues;
  interests: SoulInterests;
  communication: SoulCommunication;
  boundaries: SoulBoundaries;
  storage: SoulStorage;
  onChain?: {
    solanaAddress: string;
    reputationPDA: string;
    socialScore: number;
    completedProbes?: number;
    lastActivityAt?: number;
  };
}

// Probe Session Types
export interface ProbeMessage {
  id: string;
  turn: number;
  role: 'prober' | 'target' | 'system';
  content: string;
  timestamp: number;
}

export interface ProbeConfig {
  depth: 'light' | 'deep';
  maxTurns: number;
  timeoutMs: number;
}

export interface ProbeBoundaries {
  prober: SoulBoundaries;
  target: SoulBoundaries;
}

export type ProbeStatus = 'pending' | 'probing' | 'completed' | 'failed' | 'cancelled';

export interface ProbeSession {
  id: string;
  proberId: string;
  targetId: string;
  protocol: 'xmtp' | 'nostr' | 'p2p';
  status: ProbeStatus;
  conversation: ProbeMessage[];
  config: ProbeConfig;
  boundaries: ProbeBoundaries;
  startedAt: number;
  completedAt?: number;
  error?: string;
}

// Matching Report Types
export interface MatchingDimension {
  dimension: string;
  score: number;
  summary: string;
  evidence: string[];
  risks: string[];
  suggestions: string[];
}

export interface MatchingAnalysis {
  assessment: string;
  recommendedTopics: string[];
  avoidTopics: string[];
  dimensions: {
    values: MatchingDimension;
    tone: MatchingDimension;
    boundaries: MatchingDimension;
    interests: MatchingDimension;
  };
}

export interface MatchingReport {
  id: string;
  sourceProfileId: string;
  targetProfileId: string;
  compatibilityScore: number;
  embeddingMatch: {
    overall: number;
    sections: {
      identity: number;
      values: number;
      interests: number;
      communication: number;
    };
  };
  analysis: MatchingAnalysis;
  sessionId?: string;
  generatedAt: number;
  breakdown: {
    embedding: number;
    llm: number;
    weights: {
      embedding: number;
      llm: number;
    };
  };
}
