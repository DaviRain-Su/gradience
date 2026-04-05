/**
 * P2P Soul Handshake Protocol - Message Transport Layer
 * 
 * Provides reliable, encrypted message transport between Agents
 * similar to LayerZero's cross-chain messaging but for P2P Soul matching.
 * 
 * Features:
 * - End-to-end encryption (X25519 + AES-256-GCM)
 * - Message acknowledgment and retry
 * - Multiple transport adapters (Nostr, XMTP)
 * - Message ordering and deduplication
 * 
 * @module p2p-soul/transport
 */

import { EventEmitter } from 'node:events';
import type {
  SoulMessage,
  MessageType,
  X25519KeyPair,
  EncryptedData,
} from './types.js';
import {
  generateX25519KeyPair,
  computeSharedSecret,
  encryptDisclosure,
  decryptDisclosure,
  signMessage,
  verifySignature,
  generateMessageId,
  sha256,
} from './crypto.js';

// ============================================================================
// Transport Types
// ============================================================================

export interface TransportAdapter {
  readonly name: string;
  readonly isAvailable: boolean;
  
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  
  send(toDid: string, message: EncryptedPayload): Promise<SendResult>;
  subscribe(handler: (fromDid: string, payload: EncryptedPayload) => void): Promise<() => void>;
  
  health(): TransportHealth;
}

export interface EncryptedPayload {
  version: '1.0';
  messageId: string;
  senderDid: string;
  recipientDid: string;
  encryptedData: string;  // Base64 encoded encrypted SoulMessage
  senderPublicKey: string; // Base64 encoded X25519 public key
  timestamp: number;
  ttl: number;  // Time to live in seconds
}

export interface SendResult {
  success: boolean;
  messageId: string;
  transport: string;
  latencyMs: number;
  error?: string;
}

export interface TransportHealth {
  connected: boolean;
  latencyMs: number;
  pendingMessages: number;
  lastError?: string;
}

export interface MessageEnvelope {
  message: SoulMessage;
  fromDid: string;
  toDid: string;
  receivedAt: number;
  transport: string;
}

// ============================================================================
// Message Tracker
// ============================================================================

interface PendingMessage {
  messageId: string;
  envelope: EncryptedPayload;
  sentAt: number;
  retryCount: number;
  transports: string[];
  resolve: (result: SendResult) => void;
  reject: (error: Error) => void;
}

export class MessageTracker extends EventEmitter {
  private pending = new Map<string, PendingMessage>();
  private delivered = new Set<string>();
  private seenMessageIds = new Set<string>();
  private maxRetries = 3;
  private retryDelayMs = 5000;

  track(messageId: string, envelope: EncryptedPayload, transports: string[]): Promise<SendResult> {
    return new Promise((resolve, reject) => {
      const pending: PendingMessage = {
        messageId,
        envelope,
        sentAt: Date.now(),
        retryCount: 0,
        transports,
        resolve,
        reject,
      };

      this.pending.set(messageId, pending);
      
      // Set timeout for delivery confirmation
      setTimeout(() => {
        this.checkDelivery(messageId);
      }, this.retryDelayMs);
    });
  }

  confirmDelivery(messageId: string): void {
    const pending = this.pending.get(messageId);
    if (pending) {
      this.delivered.add(messageId);
      this.pending.delete(messageId);
      pending.resolve({
        success: true,
        messageId,
        transport: 'confirmed',
        latencyMs: Date.now() - pending.sentAt,
      });
      this.emit('delivered', messageId);
    }
  }

  isDelivered(messageId: string): boolean {
    return this.delivered.has(messageId);
  }

  hasSeen(messageId: string): boolean {
    return this.seenMessageIds.has(messageId);
  }

  markSeen(messageId: string): void {
    this.seenMessageIds.add(messageId);
  }

  private checkDelivery(messageId: string): void {
    const pending = this.pending.get(messageId);
    if (!pending) return;

    if (this.delivered.has(messageId)) {
      return;
    }

    if (pending.retryCount >= this.maxRetries) {
      this.pending.delete(messageId);
      pending.reject(new Error(`Message ${messageId} failed after ${this.maxRetries} retries`));
      this.emit('failed', messageId);
      return;
    }

    // Retry
    pending.retryCount++;
    this.emit('retry', messageId, pending.retryCount);

    setTimeout(() => {
      this.checkDelivery(messageId);
    }, this.retryDelayMs * pending.retryCount);
  }

  getPendingCount(): number {
    return this.pending.size;
  }

  clear(): void {
    this.pending.clear();
    this.delivered.clear();
    this.seenMessageIds.clear();
  }
}

// ============================================================================
// P2P Transport Manager
// ============================================================================

export interface P2PTransportConfig {
  localDid: string;
  nostrRelays?: string[];
  xmtpEnabled?: boolean;
  keyPair?: X25519KeyPair;
}

export class P2PTransportManager extends EventEmitter {
  private config: P2PTransportConfig;
  private adapters: Map<string, TransportAdapter> = new Map();
  private tracker = new MessageTracker();
  private keyPair: X25519KeyPair;
  private sharedSecrets = new Map<string, Uint8Array>(); // did -> shared secret
  private unsubscribeHandlers: Array<() => void> = [];

  constructor(config: P2PTransportConfig) {
    super();
    this.config = config;
    this.keyPair = config.keyPair || { publicKey: new Uint8Array(), privateKey: new Uint8Array() };
  }

  // ============ Lifecycle ============

  async initialize(): Promise<void> {
    // Generate key pair if not provided
    if (this.keyPair.publicKey.length === 0) {
      this.keyPair = await generateX25519KeyPair();
    }

    // Connect all adapters
    for (const [name, adapter] of this.adapters) {
      try {
        await adapter.connect();
        this.emit('adapter_connected', name);
      } catch (error) {
        console.error(`[P2PTransport] Failed to connect ${name}:`, error);
      }
    }

    // Subscribe to incoming messages
    await this.subscribeToMessages();

    console.log('[P2PTransport] Initialized');
  }

  async shutdown(): Promise<void> {
    // Unsubscribe from all
    for (const unsubscribe of this.unsubscribeHandlers) {
      unsubscribe();
    }
    this.unsubscribeHandlers = [];

    // Disconnect all adapters
    for (const [name, adapter] of this.adapters) {
      try {
        await adapter.disconnect();
        this.emit('adapter_disconnected', name);
      } catch (error) {
        console.error(`[P2PTransport] Failed to disconnect ${name}:`, error);
      }
    }

    this.tracker.clear();
    this.sharedSecrets.clear();

    console.log('[P2PTransport] Shutdown');
  }

  // ============ Adapter Management ============

  registerAdapter(adapter: TransportAdapter): void {
    this.adapters.set(adapter.name, adapter);
    console.log(`[P2PTransport] Registered adapter: ${adapter.name}`);
  }

  getAdapter(name: string): TransportAdapter | undefined {
    return this.adapters.get(name);
  }

  getAvailableAdapters(): TransportAdapter[] {
    return Array.from(this.adapters.values()).filter(a => a.isAvailable);
  }

  // ============ Key Management ============

  getPublicKey(): Uint8Array {
    return this.keyPair.publicKey;
  }

  async deriveSharedSecret(remoteDid: string, remotePublicKey: Uint8Array): Promise<Uint8Array> {
    const cacheKey = `${this.config.localDid}:${remoteDid}`;
    
    if (this.sharedSecrets.has(cacheKey)) {
      return this.sharedSecrets.get(cacheKey)!;
    }

    const secret = computeSharedSecret(this.keyPair.privateKey, remotePublicKey);
    this.sharedSecrets.set(cacheKey, secret);
    return secret;
  }

  // ============ Message Sending ============

  async sendMessage(
    toDid: string,
    message: SoulMessage,
    remotePublicKey?: Uint8Array
  ): Promise<SendResult> {
    const messageId = message.messageId;
    
    // Derive shared secret if remote public key provided
    let sharedSecret: Uint8Array | undefined;
    if (remotePublicKey) {
      sharedSecret = await this.deriveSharedSecret(toDid, remotePublicKey);
    }

    // Encrypt message
    const encrypted = await this.encryptMessage(message, sharedSecret);

    // Create envelope
    const envelope: EncryptedPayload = {
      version: '1.0',
      messageId,
      senderDid: this.config.localDid,
      recipientDid: toDid,
      encryptedData: encrypted,
      senderPublicKey: Buffer.from(this.keyPair.publicKey).toString('base64'),
      timestamp: Date.now(),
      ttl: 300, // 5 minutes TTL
    };

    // Try available adapters
    const availableAdapters = this.getAvailableAdapters();
    if (availableAdapters.length === 0) {
      return {
        success: false,
        messageId,
        transport: 'none',
        latencyMs: 0,
        error: 'No transport adapters available',
      };
    }

    // Send via all available adapters (redundancy)
    const sendPromises = availableAdapters.map(async adapter => {
      const start = Date.now();
      try {
        const result = await adapter.send(toDid, envelope);
        result.latencyMs = Date.now() - start;
        return result;
      } catch (error) {
        return {
          success: false,
          messageId,
          transport: adapter.name,
          latencyMs: Date.now() - start,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Wait for first successful send
    const results = await Promise.allSettled(sendPromises);
    const successful = results
      .filter((r): r is PromiseFulfilledResult<SendResult> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter(r => r.success);

    if (successful.length > 0) {
      // Track for delivery confirmation
      const transports = availableAdapters.map(a => a.name);
      this.tracker.track(messageId, envelope, transports);

      return successful[0];
    }

    // All failed
    const errors = results
      .filter((r): r is PromiseFulfilledResult<SendResult> => r.status === 'fulfilled')
      .map(r => r.value.error)
      .join(', ');

    return {
      success: false,
      messageId,
      transport: 'all',
      latencyMs: 0,
      error: `All transports failed: ${errors}`,
    };
  }

  // ============ Message Receiving ============

  private async subscribeToMessages(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      const unsubscribe = await adapter.subscribe(async (fromDid, payload) => {
        await this.handleIncomingMessage(adapter.name, fromDid, payload);
      });
      this.unsubscribeHandlers.push(unsubscribe);
    }
  }

  private async handleIncomingMessage(
    transportName: string,
    fromDid: string,
    payload: EncryptedPayload
  ): Promise<void> {
    // Check for duplicate
    if (this.tracker.hasSeen(payload.messageId)) {
      return;
    }
    this.tracker.markSeen(payload.messageId);

    // Check TTL
    if (Date.now() > payload.timestamp + payload.ttl * 1000) {
      console.warn(`[P2PTransport] Message ${payload.messageId} expired`);
      return;
    }

    // Check recipient
    if (payload.recipientDid !== this.config.localDid) {
      // Message not for us (might be relay)
      return;
    }

    try {
      // Decrypt message
      const message = await this.decryptMessage(payload);

      // Verify signature
      const isValid = await this.verifyMessageSignature(message);
      if (!isValid) {
        console.error(`[P2PTransport] Invalid signature for message ${payload.messageId}`);
        return;
      }

      // Send acknowledgment
      await this.sendAcknowledgment(fromDid, payload.messageId);

      // Emit received event
      const envelope: MessageEnvelope = {
        message,
        fromDid,
        toDid: this.config.localDid,
        receivedAt: Date.now(),
        transport: transportName,
      };

      this.emit('message', envelope);
    } catch (error) {
      console.error(`[P2PTransport] Failed to process message ${payload.messageId}:`, error);
    }
  }

  // ============ Encryption / Decryption ============

  private async encryptMessage(message: SoulMessage, sharedSecret?: Uint8Array): Promise<string> {
    if (sharedSecret) {
      // Use E2E encryption
      const encrypted = await encryptDisclosure(message, sharedSecret);
      return JSON.stringify(encrypted);
    } else {
      // Fallback: sign but don't encrypt (for public messages)
      return JSON.stringify({
        plaintext: JSON.stringify(message),
        signature: message.signature,
      });
    }
  }

  private async decryptMessage(payload: EncryptedPayload): Promise<SoulMessage> {
    const remotePublicKey = Buffer.from(payload.senderPublicKey, 'base64');
    const sharedSecret = await this.deriveSharedSecret(payload.senderDid, remotePublicKey);

    try {
      // Try E2E decryption
      const encrypted = JSON.parse(payload.encryptedData) as EncryptedData;
      const decrypted = decryptDisclosure(encrypted, sharedSecret);
      return decrypted as SoulMessage;
    } catch {
      // Fallback: plaintext
      const data = JSON.parse(payload.encryptedData);
      return JSON.parse(data.plaintext) as SoulMessage;
    }
  }

  private async verifyMessageSignature(message: SoulMessage): Promise<boolean> {
    // Recreate message data for verification
    const messageData = JSON.stringify({
      version: message.version,
      messageId: message.messageId,
      correlationId: message.correlationId,
      timestamp: message.timestamp,
      sender: message.sender,
      messageType: message.messageType,
      payload: message.payload,
    });

    const senderPublicKey = Buffer.from(message.sender.publicKey, 'base64');
    return verifySignature(
      Buffer.from(messageData),
      message.signature,
      senderPublicKey
    );
  }

  // ============ Acknowledgment ============

  private async sendAcknowledgment(toDid: string, messageId: string): Promise<void> {
    const ackMessage: SoulMessage = {
      version: '1.0.0',
      messageId: await generateMessageId(),
      correlationId: messageId,
      timestamp: Date.now(),
      sender: {
        did: this.config.localDid,
        publicKey: Buffer.from(this.keyPair.publicKey).toString('base64'),
      },
      messageType: 'ACK',
      payload: { originalMessageId: messageId },
      signature: '', // Will be signed below
    };

    // Sign acknowledgment
    const messageData = JSON.stringify({
      version: ackMessage.version,
      messageId: ackMessage.messageId,
      correlationId: ackMessage.correlationId,
      timestamp: ackMessage.timestamp,
      sender: ackMessage.sender,
      messageType: ackMessage.messageType,
      payload: ackMessage.payload,
    });

    ackMessage.signature = signMessage(
      Buffer.from(messageData),
      this.keyPair.privateKey
    );

    // Send via best available transport
    await this.sendMessage(toDid, ackMessage);
  }

  // ============ Health ============

  health(): Record<string, TransportHealth> {
    const health: Record<string, TransportHealth> = {};
    for (const [name, adapter] of this.adapters) {
      health[name] = adapter.health();
    }
    return health;
  }

  getStats(): {
    pendingMessages: number;
    deliveredMessages: number;
    connectedAdapters: number;
  } {
    return {
      pendingMessages: this.tracker.getPendingCount(),
      deliveredMessages: 0, // TODO: Track delivered count
      connectedAdapters: this.getAvailableAdapters().length,
    };
  }
}
