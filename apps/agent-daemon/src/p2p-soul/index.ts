/**
 * P2P Soul Handshake Protocol - Main Module
 * 
 * @module p2p-soul
 */

// Export types
export * from './types.js';

// Export crypto functions
export {
  generateX25519KeyPair,
  computeSharedSecret,
  hkdfSha256,
  encryptDisclosure,
  decryptDisclosure,
  sha256,
  hashInterest,
  buildMerkleRoot,
  generateMerkleProof,
  verifyMerkleProof,
  createCommitment,
  verifyCommitment,
  generateSessionId,
  generateMessageId,
} from './crypto.js';

// Export FSM
export { HandshakeFSM, createHandshakeFSM } from './fsm.js';

// Export engine
export {
  MatchEngine,
  parseSoulMd,
  toSoulProfile,
  generateSoulDigest,
  generateLevel1Data,
  generateLevel2Data,
  generateLevel3Data,
  generateLevel4Data,
  generateDisclosureData,
} from './engine.js';

// Export discovery
export { DiscoveryService, createDiscoveryService } from './discovery.js';

// Export storage
export {
  type HandshakeStorage,
  SqliteHandshakeStorage,
  InMemoryHandshakeStorage,
} from './storage.js';

// Version
export const VERSION = '1.0.0';
