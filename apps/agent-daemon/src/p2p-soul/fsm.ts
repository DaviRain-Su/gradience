/**
 * P2P Soul Handshake Protocol - Finite State Machine
 * 
 * Manages the lifecycle of a P2P soul handshake session.
 * 
 * State Transitions:
 * IDLE → DISCOVERING → INVITED → HANDSHAKING → MATCHED
 *                ↓           ↓           ↓
 *              FAILED      FAILED      FAILED
 * 
 * @module p2p-soul/fsm
 */

import { EventEmitter } from 'node:events';
import type {
  HandshakeState,
  HandshakeEvent,
  HandshakeSession,
  DisclosureLevel,
  SoulDigest,
  InviteMessage,
  Verdict,
  P2pSoulConfig,
  HandshakeError,
  P2pSoulError,
} from './types.js';

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: P2pSoulConfig = {
  discoverTimeoutMs: 60000,      // 1 minute
  handshakeTimeoutMs: 300000,    // 5 minutes
  matchTimeoutMs: 60000,         // 1 minute
  defaultDisclosureLevel: DisclosureLevel.LEVEL_1_ANONYMOUS,
  maxDisclosureLevel: DisclosureLevel.LEVEL_4_FULL,
  minReputationScore: 0,
  minMatchScore: 50,
  keyAlgorithm: 'X25519',
  encryptionAlgorithm: 'AES-256-GCM',
  nostrRelays: ['wss://relay.nostr.band', 'wss://relay.damus.io'],
  enableXmtp: true,
};

// ============================================================================
// State Machine Context
// ============================================================================

interface FSMContext {
  session: HandshakeSession;
  localDid: string;
  remoteDid?: string;
  remoteDigest?: SoulDigest;
  currentLevel: DisclosureLevel;
  localVerdict?: Verdict;
  remoteVerdict?: Verdict;
  sharedSecret?: Uint8Array;
  ephemeralKeyPair?: {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
  };
  timeoutHandle?: NodeJS.Timeout;
}

// ============================================================================
// State Transition Table
// ============================================================================

type TransitionHandler = (ctx: FSMContext, event: HandshakeEvent) => Promise<HandshakeState>;

const TRANSITIONS: Record<HandshakeState, Partial<Record<HandshakeEvent['type'], TransitionHandler>>> = {
  IDLE: {
    DISCOVER: async (ctx, event) => {
      if (event.type !== 'DISCOVER') throw new Error('Invalid event');
      
      ctx.session.currentState = 'DISCOVERING';
      ctx.session.updatedAt = Date.now();
      startTimeout(ctx, 'DISCOVERING');
      
      return 'DISCOVERING';
    },
    RECEIVE_INVITE: async (ctx, event) => {
      if (event.type !== 'RECEIVE_INVITE') throw new Error('Invalid event');
      
      ctx.remoteDid = event.invite.sender.did;
      ctx.session.responderDid = ctx.localDid;
      ctx.session.initiatorDid = ctx.remoteDid;
      ctx.session.currentState = 'INVITED';
      ctx.session.updatedAt = Date.now();
      startTimeout(ctx, 'INVITED');
      
      return 'INVITED';
    },
  },
  
  DISCOVERING: {
    FOUND: async (ctx, event) => {
      if (event.type !== 'FOUND') throw new Error('Invalid event');
      
      ctx.remoteDid = event.candidate.did;
      ctx.remoteDigest = event.candidate;
      ctx.session.responderDid = ctx.remoteDid;
      ctx.session.updatedAt = Date.now();
      
      // Transition to INVITED after sending invite
      return 'INVITED';
    },
    TIMEOUT: async (ctx) => {
      ctx.session.currentState = 'FAILED';
      return 'FAILED';
    },
  },
  
  INVITED: {
    ACCEPT_INVITE: async (ctx, event) => {
      if (event.type !== 'ACCEPT_INVITE') throw new Error('Invalid event');
      
      ctx.currentLevel = event.initialDisclosure;
      ctx.session.currentState = 'HANDSHAKING';
      ctx.session.currentLevel = event.initialDisclosure;
      ctx.session.updatedAt = Date.now();
      clearTimeout(ctx);
      startTimeout(ctx, 'HANDSHAKING');
      
      return 'HANDSHAKING';
    },
    REJECT_INVITE: async (ctx) => {
      ctx.session.currentState = 'FAILED';
      clearTimeout(ctx);
      return 'FAILED';
    },
    TIMEOUT: async (ctx) => {
      ctx.session.currentState = 'FAILED';
      return 'FAILED';
    },
  },
  
  HANDSHAKING: {
    DISCLOSE: async (ctx, event) => {
      if (event.type !== 'DISCLOSE') throw new Error('Invalid event');
      
      // Update local verdict
      ctx.localVerdict = event.verdict;
      
      // Check if we have both verdicts
      if (ctx.localVerdict && ctx.remoteVerdict) {
        // Both parties have made a decision
        if (ctx.localVerdict === 'interested' && ctx.remoteVerdict === 'interested') {
          // Move to next level or complete
          if (event.level >= DisclosureLevel.LEVEL_3_DETAILED) {
            ctx.session.currentState = 'MATCHED';
            ctx.session.updatedAt = Date.now();
            clearTimeout(ctx);
            return 'MATCHED';
          }
        } else if (ctx.localVerdict === 'pass' || ctx.remoteVerdict === 'pass') {
          ctx.session.currentState = 'FAILED';
          clearTimeout(ctx);
          return 'FAILED';
        }
        // If either needs more info, stay in HANDSHAKING
      }
      
      ctx.currentLevel = event.level;
      ctx.session.currentLevel = event.level;
      ctx.session.updatedAt = Date.now();
      
      return 'HANDSHAKING';
    },
    CONFIRM_MATCH: async (ctx) => {
      ctx.session.currentState = 'MATCHED';
      ctx.session.updatedAt = Date.now();
      clearTimeout(ctx);
      return 'MATCHED';
    },
    REJECT_MATCH: async (ctx) => {
      ctx.session.currentState = 'FAILED';
      clearTimeout(ctx);
      return 'FAILED';
    },
    TIMEOUT: async (ctx) => {
      ctx.session.currentState = 'FAILED';
      return 'FAILED';
    },
    ERROR: async (ctx) => {
      ctx.session.currentState = 'FAILED';
      clearTimeout(ctx);
      return 'FAILED';
    },
  },
  
  MATCHED: {
    // Terminal state - no transitions out
  },
  
  FAILED: {
    // Terminal state - no transitions out
  },
};

// ============================================================================
// Timeout Management
// ============================================================================

function startTimeout(ctx: FSMContext, state: HandshakeState): void {
  clearTimeout(ctx);
  
  let timeoutMs: number;
  switch (state) {
    case 'DISCOVERING':
      timeoutMs = DEFAULT_CONFIG.discoverTimeoutMs;
      break;
    case 'HANDSHAKING':
      timeoutMs = DEFAULT_CONFIG.handshakeTimeoutMs;
      break;
    case 'INVITED':
      timeoutMs = DEFAULT_CONFIG.matchTimeoutMs;
      break;
    default:
      return;
  }
  
  ctx.timeoutHandle = setTimeout(() => {
    // Timeout will be handled by the FSM
  }, timeoutMs);
}

function clearTimeout(ctx: FSMContext): void {
  if (ctx.timeoutHandle) {
    clearTimeout(ctx.timeoutHandle);
    ctx.timeoutHandle = undefined;
  }
}

// ============================================================================
// Handshake FSM Class
// ============================================================================

export class HandshakeFSM extends EventEmitter {
  private state: HandshakeState = 'IDLE';
  private context: FSMContext;
  private config: P2pSoulConfig;
  
  constructor(
    sessionId: string,
    localDid: string,
    config: Partial<P2pSoulConfig> = {}
  ) {
    super();
    
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    const now = Date.now();
    this.context = {
      session: {
        id: sessionId,
        initiatorDid: localDid,
        responderDid: '', // Will be set when remote is known
        currentState: 'IDLE',
        currentLevel: DisclosureLevel.LEVEL_0_PUBLIC,
        createdAt: now,
        updatedAt: now,
        expiresAt: now + this.config.handshakeTimeoutMs,
        encryptedContext: '',
      },
      localDid,
      currentLevel: DisclosureLevel.LEVEL_0_PUBLIC,
    };
  }
  
  /**
   * Get current state
   */
  getState(): HandshakeState {
    return this.state;
  }
  
  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.context.session.id;
  }
  
  /**
   * Get session info
   */
  getSession(): HandshakeSession {
    return { ...this.context.session };
  }
  
  /**
   * Get current disclosure level
   */
  getCurrentLevel(): DisclosureLevel {
    return this.context.currentLevel;
  }
  
  /**
   * Get remote digest (if discovered)
   */
  getRemoteDigest(): SoulDigest | undefined {
    return this.context.remoteDigest;
  }
  
  /**
   * Get remote DID
   */
  getRemoteDid(): string | undefined {
    return this.context.remoteDid;
  }
  
  /**
   * Process a state transition event
   */
  async transition(event: HandshakeEvent): Promise<HandshakeState> {
    const handler = TRANSITIONS[this.state]?.[event.type];
    
    if (!handler) {
      throw new HandshakeError(
        `Invalid transition: ${this.state} + ${event.type}`,
        this.state
      );
    }
    
    const previousState = this.state;
    
    try {
      this.state = await handler(this.context, event);
      this.context.session.currentState = this.state;
      
      this.emit('state_changed', {
        from: previousState,
        to: this.state,
        event: event.type,
        sessionId: this.context.session.id,
      });
      
      if (this.state === 'MATCHED') {
        this.emit('matched', {
          sessionId: this.context.session.id,
          localDid: this.context.localDid,
          remoteDid: this.context.remoteDid,
          level: this.context.currentLevel,
        });
      }
      
      if (this.state === 'FAILED') {
        this.emit('failed', {
          sessionId: this.context.session.id,
          fromState: previousState,
          reason: event.type === 'ERROR' ? (event as any).error?.message : 'Transition failed',
        });
      }
      
      return this.state;
    } catch (error) {
      this.emit('error', {
        sessionId: this.context.session.id,
        state: this.state,
        error,
      });
      throw error;
    }
  }
  
  /**
   * Start discovery
   */
  async discover(criteria: { seeking?: string; categories?: string[] }): Promise<void> {
    await this.transition({ type: 'DISCOVER', criteria });
  }
  
  /**
   * Handle received invite
   */
  async receiveInvite(invite: InviteMessage): Promise<void> {
    await this.transition({ type: 'RECEIVE_INVITE', invite });
  }
  
  /**
   * Accept an invite
   */
  async acceptInvite(initialDisclosure: DisclosureLevel): Promise<void> {
    await this.transition({ type: 'ACCEPT_INVITE', initialDisclosure });
  }
  
  /**
   * Reject an invite
   */
  async rejectInvite(reason?: string): Promise<void> {
    await this.transition({ type: 'REJECT_INVITE', reason });
  }
  
  /**
   * Disclose information at a specific level
   */
  async disclose(level: DisclosureLevel, verdict: Verdict, data?: unknown): Promise<void> {
    await this.transition({ type: 'DISCLOSE', level, data, verdict });
  }
  
  /**
   * Confirm match
   */
  async confirmMatch(): Promise<void> {
    await this.transition({ type: 'CONFIRM_MATCH' });
  }
  
  /**
   * Reject match
   */
  async rejectMatch(reason?: string): Promise<void> {
    await this.transition({ type: 'REJECT_MATCH', reason });
  }
  
  /**
   * Set shared secret for encryption
   */
  setSharedSecret(secret: Uint8Array): void {
    this.context.sharedSecret = secret;
  }
  
  /**
   * Get shared secret
   */
  getSharedSecret(): Uint8Array | undefined {
    return this.context.sharedSecret;
  }
  
  /**
   * Set ephemeral key pair
   */
  setEphemeralKeyPair(keyPair: { publicKey: Uint8Array; privateKey: Uint8Array }): void {
    this.context.ephemeralKeyPair = keyPair;
  }
  
  /**
   * Get ephemeral key pair
   */
  getEphemeralKeyPair(): { publicKey: Uint8Array; privateKey: Uint8Array } | undefined {
    return this.context.ephemeralKeyPair;
  }
  
  /**
   * Set remote verdict
   */
  setRemoteVerdict(verdict: Verdict): void {
    this.context.remoteVerdict = verdict;
  }
  
  /**
   * Get remote verdict
   */
  getRemoteVerdict(): Verdict | undefined {
    return this.context.remoteVerdict;
  }
  
  /**
   * Set remote digest
   */
  setRemoteDigest(digest: SoulDigest): void {
    this.context.remoteDigest = digest;
    this.context.remoteDid = digest.did;
    this.context.session.responderDid = digest.did;
  }
  
  /**
   * Check if the session is active (not terminal)
   */
  isActive(): boolean {
    return this.state !== 'MATCHED' && this.state !== 'FAILED';
  }
  
  /**
   * Check if the session is matched
   */
  isMatched(): boolean {
    return this.state === 'MATCHED';
  }
  
  /**
   * Check if the session has failed
   */
  hasFailed(): boolean {
    return this.state === 'FAILED';
  }
  
  /**
   * Dispose resources
   */
  dispose(): void {
    clearTimeout(this.context);
    this.removeAllListeners();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createHandshakeFSM(
  sessionId: string,
  localDid: string,
  config?: Partial<P2pSoulConfig>
): HandshakeFSM {
  return new HandshakeFSM(sessionId, localDid, config);
}
