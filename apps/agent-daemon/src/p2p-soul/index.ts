/**
 * P2P Soul Handshake Protocol - Main Module
 * 
 * A privacy-preserving, peer-to-peer Soul Profile matching protocol
 * with end-to-end encryption and progressive disclosure.
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
  signMessage,
  verifySignature,
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

// Export transport layer
export {
  P2PTransportManager,
  MessageTracker,
  type TransportAdapter,
  type EncryptedPayload,
  type SendResult,
  type TransportHealth,
  type MessageEnvelope,
  type P2PTransportConfig,
} from './transport.js';

// Export transport adapters
export {
  NostrTransportAdapter,
  type NostrTransportOptions,
} from './transports/nostr.js';

export {
  XmtpTransportAdapter,
  type XmtpTransportOptions,
} from './transports/xmtp.js';

// Version
export const VERSION = '1.0.0';

// Protocol description
export const PROTOCOL_DESCRIPTION = `
P2P Soul Handshake Protocol v1.0.0

A privacy-preserving protocol for Soul Profile matching between AI Agents.

Features:
- End-to-end encryption (X25519 + AES-256-GCM)
- Progressive disclosure (5 levels: L0-L4)
- Zero-knowledge proofs for skill verification
- Multiple transport adapters (Nostr, XMTP)
- Message acknowledgment and retry
- Local-first: Soul.md never leaves the device

Usage:
1. Generate key pair
2. Connect to transport adapters
3. Discover candidates via Nostr
4. Send handshake invite
5. Progressive disclosure based on mutual interest
6. Match and exchange contact info

Inspired by: Signal Protocol, Noise Protocol, LayerZero
`;
