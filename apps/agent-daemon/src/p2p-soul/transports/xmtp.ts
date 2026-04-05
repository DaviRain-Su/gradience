/**
 * P2P Soul Handshake Protocol - XMTP Transport Adapter
 * 
 * Implements TransportAdapter interface using XMTP protocol
 * for encrypted peer-to-peer messaging.
 * 
 * @module p2p-soul/transports/xmtp
 */

import type { TransportAdapter, EncryptedPayload, SendResult, TransportHealth } from '../transport.js';

export interface XmtpTransportOptions {
  privateKey: Uint8Array;
  env?: 'production' | 'dev';
}

/**
 * XMTP Transport Adapter
 * 
 * Uses XMTP for direct peer-to-peer encrypted messaging:
 * - Native E2E encryption (additional layer on top of P2P encryption)
 * - Direct peer-to-peer (no relay needed)
 * - Message persistence
 * - Mobile push notification support
 */
export class XmtpTransportAdapter implements TransportAdapter {
  readonly name = 'xmtp';
  isAvailable = false;
  
  private options: Required<XmtpTransportOptions>;
  private client?: any; // XMTP client
  private conversations = new Map<string, any>(); // did -> conversation
  private messageHandler?: (fromDid: string, payload: EncryptedPayload) => void;
  private lastError?: string;
  private lastLatencyMs = 0;
  private stream?: any;

  constructor(options: XmtpTransportOptions) {
    this.options = {
      privateKey: options.privateKey,
      env: options.env || 'production',
    };
  }

  // ============ Lifecycle ============

  async connect(): Promise<void> {
    try {
      // Dynamic import XMTP SDK
      const { Client } = await import('@xmtp/xmtp-js');
      
      // Create XMTP client
      this.client = await Client.create(this.options.privateKey, {
        env: this.options.env,
      });

      this.isAvailable = true;
      console.log(`[XmtpTransport] Connected with address: ${this.client.address}`);

      // Start listening for messages
      await this.startListening();
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Failed to connect to XMTP';
      throw new Error(this.lastError);
    }
  }

  async disconnect(): Promise<void> {
    if (this.stream) {
      await this.stream.return();
    }
    this.conversations.clear();
    this.isAvailable = false;
    console.log('[XmtpTransport] Disconnected');
  }

  // ============ Message Sending ============

  async send(toDid: string, payload: EncryptedPayload): Promise<SendResult> {
    const start = Date.now();
    
    if (!this.isAvailable || !this.client) {
      return {
        success: false,
        messageId: payload.messageId,
        transport: this.name,
        latencyMs: 0,
        error: 'XMTP client not connected',
      };
    }

    try {
      // Get or create conversation
      const conversation = await this.getConversation(toDid);
      
      // Send message
      const content = JSON.stringify(payload);
      await conversation.send(content);

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

    // Return unsubscribe function
    return () => {
      this.messageHandler = undefined;
    };
  }

  // ============ Health ============

  health(): TransportHealth {
    return {
      connected: this.isAvailable,
      latencyMs: this.lastLatencyMs,
      pendingMessages: 0, // XMTP handles this internally
      lastError: this.lastError,
    };
  }

  // ============ Private Methods ============

  private async startListening(): Promise<void> {
    if (!this.client) return;

    // Stream all conversations
    this.stream = await this.client.conversations.stream();

    // Process incoming messages
    this.processStream();
  }

  private async processStream(): Promise<void> {
    if (!this.stream) return;

    try {
      for await (const conversation of this.stream) {
        // Cache conversation
        const did = this.xmtpAddressToDid(conversation.peerAddress);
        this.conversations.set(did, conversation);

        // Listen for messages in this conversation
        this.listenToConversation(conversation, did);
      }
    } catch (error) {
      console.error('[XmtpTransport] Stream error:', error);
    }
  }

  private async listenToConversation(conversation: any, did: string): Promise<void> {
    try {
      const messages = await conversation.streamMessages();
      
      for await (const message of messages) {
        if (message.senderAddress === this.client.address) {
          // Skip own messages
          continue;
        }

        try {
          const payload = JSON.parse(message.content) as EncryptedPayload;
          
          if (this.messageHandler) {
            this.messageHandler(did, payload);
          }
        } catch (error) {
          console.error('[XmtpTransport] Failed to parse message:', error);
        }
      }
    } catch (error) {
      console.error('[XmtpTransport] Conversation stream error:', error);
    }
  }

  private async getConversation(toDid: string): Promise<any> {
    // Check cache
    if (this.conversations.has(toDid)) {
      return this.conversations.get(toDid);
    }

    // Create new conversation
    const peerAddress = this.didToXmtpAddress(toDid);
    const conversation = await this.client.conversations.newConversation(peerAddress);
    
    this.conversations.set(toDid, conversation);
    return conversation;
  }

  private didToXmtpAddress(did: string): string {
    // Convert DID to Ethereum address for XMTP
    // did:ethr:<address> or similar
    if (did.startsWith('did:ethr:')) {
      return did.split(':')[2];
    }
    
    // For other DID types, we need a mapping
    // This is a simplified version
    throw new Error(`Cannot convert DID ${did} to XMTP address`);
  }

  private xmtpAddressToDid(address: string): string {
    return `did:ethr:${address}`;
  }
}
