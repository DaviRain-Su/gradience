/**
 * P2P Soul Handshake Protocol - Nostr Transport Adapter
 * 
 * Implements TransportAdapter interface using Nostr protocol
 * for decentralized message relay.
 * 
 * @module p2p-soul/transports/nostr
 */

import type { TransportAdapter, EncryptedPayload, SendResult, TransportHealth } from '../transport.js';

export interface NostrTransportOptions {
  relays: string[];
  privateKey: string; // Nostr private key (hex)
}

/**
 * Nostr Transport Adapter
 * 
 * Uses Nostr relays for message transport with the following features:
 * - End-to-end encryption (already handled by P2P layer)
 * - Decentralized relay network
 * - Event-based messaging
 * - Automatic relay rotation
 */
export class NostrTransportAdapter implements TransportAdapter {
  readonly name = 'nostr';
  isAvailable = false;
  
  private options: NostrTransportOptions;
  private relayConnections = new Map<string, WebSocket>();
  private messageHandler?: (fromDid: string, payload: EncryptedPayload) => void;
  private pendingMessages = new Map<string, { resolve: (result: SendResult) => void; timestamp: number }>();
  private lastError?: string;
  private lastLatencyMs = 0;

  constructor(options: NostrTransportOptions) {
    this.options = options;
  }

  // ============ Lifecycle ============

  async connect(): Promise<void> {
    // Connect to all configured relays
    const connectPromises = this.options.relays.map(relay => this.connectRelay(relay));
    await Promise.allSettled(connectPromises);

    this.isAvailable = this.relayConnections.size > 0;
    
    if (this.isAvailable) {
      console.log(`[NostrTransport] Connected to ${this.relayConnections.size} relays`);
    } else {
      throw new Error('Failed to connect to any Nostr relay');
    }
  }

  async disconnect(): Promise<void> {
    for (const [url, ws] of this.relayConnections) {
      ws.close();
    }
    this.relayConnections.clear();
    this.isAvailable = false;
    console.log('[NostrTransport] Disconnected');
  }

  // ============ Message Sending ============

  async send(toDid: string, payload: EncryptedPayload): Promise<SendResult> {
    const start = Date.now();
    
    if (!this.isAvailable) {
      return {
        success: false,
        messageId: payload.messageId,
        transport: this.name,
        latencyMs: 0,
        error: 'Not connected to any relay',
      };
    }

    try {
      // Create Nostr event
      const event = await this.createNostrEvent(toDid, payload);
      
      // Publish to all connected relays
      const publishPromises = Array.from(this.relayConnections.values()).map(ws => 
        this.publishToRelay(ws, event)
      );

      await Promise.all(publishPromises);

      this.lastLatencyMs = Date.now() - start;

      return {
        success: true,
        messageId: payload.messageId,
        transport: this.name,
        latencyMs: this.lastLatencyMs,
      };
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        messageId: payload.messageId,
        transport: this.name,
        latencyMs: Date.now() - start,
        error: this.lastError,
      };
    }
  }

  async subscribe(handler: (fromDid: string, payload: EncryptedPayload) => void): Promise<() => void> {
    this.messageHandler = handler;

    // Subscribe to events on all relays
    for (const [url, ws] of this.relayConnections) {
      this.subscribeOnRelay(ws);
    }

    // Return unsubscribe function
    return () => {
      this.messageHandler = undefined;
      for (const ws of this.relayConnections.values()) {
        // Send CLOSE message
        ws.send(JSON.stringify(['CLOSE', 'p2p-soul-subscription']));
      }
    };
  }

  // ============ Health ============

  health(): TransportHealth {
    return {
      connected: this.isAvailable,
      latencyMs: this.lastLatencyMs,
      pendingMessages: this.pendingMessages.size,
      lastError: this.lastError,
    };
  }

  // ============ Private Methods ============

  private async connectRelay(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      
      ws.onopen = () => {
        console.log(`[NostrTransport] Connected to ${url}`);
        this.relayConnections.set(url, ws);
        resolve();
      };

      ws.onerror = (error) => {
        console.error(`[NostrTransport] Failed to connect to ${url}:`, error);
        reject(error);
      };

      ws.onclose = () => {
        this.relayConnections.delete(url);
        if (this.relayConnections.size === 0) {
          this.isAvailable = false;
        }
      };

      ws.onmessage = (event) => {
        this.handleRelayMessage(url, event.data);
      };

      // Timeout after 5 seconds
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          reject(new Error(`Connection timeout to ${url}`));
        }
      }, 5000);
    });
  }

  private async createNostrEvent(toDid: string, payload: EncryptedPayload): Promise<NostrEvent> {
    const content = JSON.stringify({
      to: toDid,
      payload,
    });

    const event: NostrEvent = {
      id: '', // Will be computed
      pubkey: this.getPublicKey(),
      created_at: Math.floor(Date.now() / 1000),
      kind: 30078, // Application-specific data
      tags: [
        ['p', this.didToNostrPubkey(toDid)], // Recipient
        ['t', 'p2p-soul'],
      ],
      content,
      sig: '', // Will be signed
    };

    // Compute event id
    event.id = this.computeEventId(event);
    
    // Sign event
    event.sig = await this.signEvent(event);

    return event;
  }

  private async publishToRelay(ws: WebSocket, event: NostrEvent): Promise<void> {
    return new Promise((resolve, reject) => {
      if (ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not open'));
        return;
      }

      ws.send(JSON.stringify(['EVENT', event]));
      
      // Wait for OK response
      const timeout = setTimeout(() => {
        reject(new Error('Publish timeout'));
      }, 5000);

      const handler = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        if (data[0] === 'OK' && data[1] === (event as any).id) {
          clearTimeout(timeout);
          ws.removeEventListener('message', handler);
          resolve();
        }
      };

      ws.addEventListener('message', handler);
    });
  }

  private subscribeOnRelay(ws: WebSocket): void {
    const filter = {
      kinds: [30078],
      '#t': ['p2p-soul'],
      '#p': [this.getPublicKey()], // Messages to us
      since: Math.floor(Date.now() / 1000) - 60, // Last minute
    };

    ws.send(JSON.stringify(['REQ', 'p2p-soul-subscription', filter]));
  }

  private handleRelayMessage(relayUrl: string, data: string): void {
    try {
      const message = JSON.parse(data);
      
      if (message[0] === 'EVENT') {
        const event = message[2] as NostrEvent;
        this.handleNostrEvent(event);
      }
    } catch (error) {
      console.error('[NostrTransport] Failed to handle relay message:', error);
    }
  }

  private handleNostrEvent(event: NostrEvent): void {
    try {
      const data = JSON.parse(event.content);
      const fromDid = this.nostrPubkeyToDid(event.pubkey);
      const payload = data.payload as EncryptedPayload;

      if (this.messageHandler) {
        this.messageHandler(fromDid, payload);
      }
    } catch (error) {
      console.error('[NostrTransport] Failed to process event:', error);
    }
  }

  private computeEventId(event: Omit<NostrEvent, 'id' | 'sig'>): string {
    const data = JSON.stringify([
      0,
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags,
      event.content,
    ]);
    
    // Use crypto.subtle for SHA-256
    // This is a simplified version - in production use proper crypto
    return this.simpleHash(data);
  }

  private async signEvent(event: NostrEvent): Promise<string> {
    // In production, use proper schnorr signature
    // This is a placeholder
    const data = event.id;
    return this.simpleHash(data + this.options.privateKey);
  }

  private getPublicKey(): string {
    // Derive public key from private key
    // This is a placeholder - in production use proper key derivation
    return this.simpleHash(this.options.privateKey);
  }

  private didToNostrPubkey(did: string): string {
    // Extract public key from DID
    // did:nostr:<pubkey> or similar
    const parts = did.split(':');
    return parts[parts.length - 1];
  }

  private nostrPubkeyToDid(pubkey: string): string {
    return `did:nostr:${pubkey}`;
  }

  private simpleHash(data: string): string {
    // Simple hash for demo - use proper crypto in production
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}

// Nostr event interface
interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}
