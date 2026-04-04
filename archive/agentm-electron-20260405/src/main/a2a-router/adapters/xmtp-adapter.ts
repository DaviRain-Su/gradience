/**
 * XMTP Protocol Adapter — Messaging Layer
 *
 * XMTP is the primary Agent-to-Agent communication protocol with:
 * - MLS E2E encryption (IETF RFC 9420)
 * - Wallet address as identity (OWS compatible)
 * - Native Agent support via @xmtp/agent-sdk
 *
 * Nostr handles discovery; XMTP handles direct messaging and payment confirmations.
 *
 * @module a2a-router/adapters/xmtp-adapter
 */

import { A2A_ERROR_CODES } from '../constants.js';
import type {
    ProtocolAdapter,
    ProtocolSubscription,
    A2AMessage,
    A2AResult,
    AgentInfo,
    AgentFilter,
    ProtocolHealthStatus,
    ProtocolType,
} from '../../../shared/a2a-router-types.js';

// XMTP types (from @xmtp/agent-sdk)
interface XMTPAgent {
    addresses: string[];
    inboxId: string;
    conversations: {
        newConversation: (address: string) => Promise<XMTPConversation>;
        list: () => Promise<XMTPConversation[]>;
    };
}

interface XMTPConversation {
    id: string;
    peerAddress: string;
    send: (content: string) => Promise<void>;
    messages: () => Promise<XMTPMessage[]>;
    streamMessages: () => AsyncGenerator<XMTPMessage>;
}

interface XMTPMessage {
    id: string;
    content: string;
    senderAddress: string;
    sentAt: Date;
}

export interface XMTPAdapterOptions {
    /** XMTP environment */
    env?: 'production' | 'dev';
    /** Private key for signing (hex string) */
    privateKey?: string;
    /** Optional: specific wallet address to use */
    address?: string;
    /** Enable message streaming */
    enableStreaming?: boolean;
}

/**
 * XMTP Protocol Adapter
 *
 * Implements direct messaging between Agents using XMTP protocol.
 * Each Agent uses their wallet address as their XMTP identity.
 */
export class XMTPAdapter implements ProtocolAdapter {
    readonly protocol: ProtocolType = 'xmtp';
    private agent: XMTPAgent | null = null;
    private options: XMTPAdapterOptions;
    private subscriptions: ProtocolSubscription[] = [];
    private messageStreamAbortController: AbortController | null = null;
    private conversations: Map<string, XMTPConversation> = new Map();

    constructor(options: XMTPAdapterOptions = {}) {
        this.options = {
            env: 'dev',
            enableStreaming: true,
            ...options,
        };
    }

    // ============ Lifecycle ============

    async initialize(): Promise<void> {
        // Dynamic import to avoid bundling issues
        const { Agent } = await import('@xmtp/agent-sdk');

        if (!this.options.privateKey) {
            console.log('[XMTPAdapter] No private key provided, will operate in read-only mode');
            return;
        }

        try {
            // Create XMTP Agent
            this.agent = await Agent.create(this.options.privateKey, {
                env: this.options.env,
            });

            console.log(`[XMTPAdapter] Initialized with inbox: ${this.agent.inboxId}`);
            console.log(`[XMTPAdapter] Addresses: ${this.agent.addresses.join(', ')}`);

            // Start message streaming if enabled
            if (this.options.enableStreaming) {
                this.startMessageStream();
            }
        } catch (error) {
            console.error('[XMTPAdapter] Failed to initialize:', error);
            throw error;
        }
    }

    async shutdown(): Promise<void> {
        // Stop message streaming
        if (this.messageStreamAbortController) {
            this.messageStreamAbortController.abort();
            this.messageStreamAbortController = null;
        }

        // Unsubscribe all
        for (const sub of this.subscriptions) {
            await sub.unsubscribe();
        }
        this.subscriptions = [];

        // Clear conversations cache
        this.conversations.clear();

        // XMTP Agent doesn't have explicit disconnect, just clear reference
        this.agent = null;

        console.log('[XMTPAdapter] Shutdown');
    }

    isAvailable(): boolean {
        return this.agent !== null;
    }

    // ============ Messaging ============

    async send(message: A2AMessage): Promise<A2AResult> {
        if (!this.agent) {
            return {
                success: false,
                messageId: message.id,
                protocol: 'xmtp',
                error: 'XMTP agent not initialized',
                errorCode: A2A_ERROR_CODES.PROTOCOL_NOT_AVAILABLE,
                timestamp: Date.now(),
            };
        }

        try {
            // Get or create conversation with recipient
            const conversation = await this.getOrCreateConversation(message.to);

            // Serialize message
            const content = JSON.stringify({
                gradience: {
                    version: '1.0',
                    message,
                },
            });

            // Send via XMTP
            await conversation.send(content);

            return {
                success: true,
                messageId: message.id,
                protocol: 'xmtp',
                timestamp: Date.now(),
            };
        } catch (error) {
            console.error('[XMTPAdapter] Send failed:', error);
            return {
                success: false,
                messageId: message.id,
                protocol: 'xmtp',
                error: error instanceof Error ? error.message : 'Send failed',
                errorCode: A2A_ERROR_CODES.PROTOCOL_SEND_FAILED,
                timestamp: Date.now(),
            };
        }
    }

    async subscribe(
        handler: (message: A2AMessage) => void | Promise<void>
    ): Promise<ProtocolSubscription> {
        const subscription: ProtocolSubscription = {
            protocol: 'xmtp',
            unsubscribe: async () => {
                // Remove from active subscriptions
                const idx = this.subscriptions.indexOf(subscription);
                if (idx > -1) {
                    this.subscriptions.splice(idx, 1);
                }
            },
        };

        this.subscriptions.push(subscription);

        // If streaming is enabled, messages will be processed by startMessageStream
        // Otherwise, poll for messages
        if (!this.options.enableStreaming && this.agent) {
            this.pollMessages(handler);
        }

        return subscription;
    }

    // ============ Discovery ============
    // NOTE: XMTP is messaging-only. Discovery is handled by Nostr.

    async discoverAgents(_filter?: AgentFilter): Promise<AgentInfo[]> {
        // XMTP doesn't handle discovery
        return [];
    }

    async broadcastCapabilities(_agentInfo: AgentInfo): Promise<void> {
        // XMTP doesn't handle capability broadcasting (Nostr does)
        // Could potentially send a message to a "capability channel" in the future
        console.log('[XMTPAdapter] Capability broadcast not supported (use Nostr)');
    }

    // ============ Health ============

    health(): ProtocolHealthStatus {
        if (!this.agent) {
            return {
                available: false,
                peerCount: 0,
                subscribedTopics: [],
                error: 'Agent not initialized',
            };
        }

        return {
            available: true,
            peerCount: this.conversations.size,
            subscribedTopics: this.options.enableStreaming ? ['messages'] : [],
            lastActivityAt: Date.now(),
        };
    }

    // ============ XMTP-Specific Methods ============

    /**
     * Get inbox ID (XMTP identity)
     */
    getInboxId(): string | null {
        return this.agent?.inboxId ?? null;
    }

    /**
     * Get connected wallet addresses
     */
    getAddresses(): string[] {
        return this.agent?.addresses ?? [];
    }

    /**
     * Check if can message an address
     */
    async canMessage(address: string): Promise<boolean> {
        if (!this.agent) return false;
        // XMTP Agent doesn't have static canMessage, use conversations as proxy
        try {
            await this.getOrCreateConversation(address);
            return true;
        } catch {
            return false;
        }
    }

    // ============ Private Methods ============

    private async getOrCreateConversation(address: string): Promise<XMTPConversation> {
        // Check cache
        if (this.conversations.has(address)) {
            return this.conversations.get(address)!;
        }

        if (!this.agent) {
            throw new Error('XMTP agent not initialized');
        }

        // Create new conversation
        const conversation = await this.agent.conversations.newConversation(address);
        this.conversations.set(address, conversation);

        return conversation;
    }

    private startMessageStream(): void {
        if (!this.agent || !this.options.enableStreaming) return;

        this.messageStreamAbortController = new AbortController();
        const { signal } = this.messageStreamAbortController;

        // Start streaming in background
        (async () => {
            try {
                // Stream all conversations
                const conversations = await this.agent!.conversations.list();

                for (const conversation of conversations) {
                    if (signal.aborted) break;

                    // Cache conversation
                    this.conversations.set(conversation.peerAddress, conversation);

                    // Stream messages
                    for await (const msg of conversation.streamMessages()) {
                        if (signal.aborted) break;

                        await this.processMessage(msg);
                    }
                }
            } catch (error) {
                if (!signal.aborted) {
                    console.error('[XMTPAdapter] Message stream error:', error);
                }
            }
        })();
    }

    private async pollMessages(
        handler: (message: A2AMessage) => void | Promise<void>
    ): Promise<void> {
        if (!this.agent) return;

        const poll = async () => {
            try {
                const conversations = await this.agent!.conversations.list();

                for (const conversation of conversations) {
                    const messages = await conversation.messages();

                    for (const msg of messages) {
                        const parsed = this.parseMessage(msg);
                        if (parsed) {
                            await handler(parsed);
                        }
                    }
                }
            } catch (error) {
                console.error('[XMTPAdapter] Poll error:', error);
            }

            // Continue polling
            if (this.agent) {
                setTimeout(poll, 5000);
            }
        };

        poll();
    }

    private async processMessage(msg: XMTPMessage): Promise<void> {
        const parsed = this.parseMessage(msg);
        if (!parsed) return;

        // Notify all subscribers
        for (const sub of this.subscriptions) {
            // Subscribers are handled via the subscribe() method
            // This is a simplified implementation
        }
    }

    private parseMessage(msg: XMTPMessage): A2AMessage | null {
        try {
            const parsed = JSON.parse(msg.content);

            // Check if it's a Gradience message
            if (parsed.gradience?.message) {
                return parsed.gradience.message as A2AMessage;
            }

            // Plain message fallback
            return {
                id: msg.id,
                from: msg.senderAddress,
                to: this.agent?.addresses[0] ?? '',
                type: 'direct_message',
                timestamp: msg.sentAt.getTime(),
                payload: msg.content,
                protocol: 'xmtp',
            };
        } catch {
            // Not JSON, treat as plain message
            return {
                id: msg.id,
                from: msg.senderAddress,
                to: this.agent?.addresses[0] ?? '',
                type: 'direct_message',
                timestamp: msg.sentAt.getTime(),
                payload: msg.content,
                protocol: 'xmtp',
            };
        }
    }
}
