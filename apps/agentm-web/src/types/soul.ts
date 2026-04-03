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
