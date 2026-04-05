/**
 * XMTP Protocol Adapter for A2A Router
 *
 * Wraps XMTPClient to implement ProtocolAdapter interface.
 * XMTP provides E2E encrypted direct messaging between Agents.
 *
 * @module xmtp-adapter
 */

import { XMTPClient } from './client.js';
import { GradienceMessageType, type WalletSigner, type TaskOfferPayload } from './types.js';
import {
    A2A_ERROR_CODES,
    type ProtocolAdapter,
    type ProtocolSubscription,
    type A2AMessage,
    type A2AResult,
    type AgentInfo,
    type AgentFilter,
    type ProtocolHealthStatus,
    type ProtocolType,
} from '@gradiences/a2a-types';

export interface XMTPAdapterOptions {
    /** XMTP environment */
    env?: 'production' | 'dev' | 'local';
    /** Wallet signer for XMTP identity */
    walletSigner?: WalletSigner;
    /** Enable message streaming (default: true) */
    enableStreaming?: boolean;
    /** Maximum retry attempts */
    maxRetries?: number;
}

/**
 * XMTP Protocol Adapter
 *
 * Implements ProtocolAdapter for E2E encrypted messaging.
 */
export class XMTPAdapter implements ProtocolAdapter {
    readonly protocol: ProtocolType = 'xmtp';
    private client: XMTPClient | null = null;
    private options: Required<XMTPAdapterOptions>;
    private subscriptions: Set<(message: A2AMessage) => void | Promise<void>> = new Set();
    private unsubscribeStream: (() => void) | null = null;
    private logger: Console;

    constructor(options: XMTPAdapterOptions = {}) {
        this.options = {
            env: 'dev',
            enableStreaming: true,
            maxRetries: 3,
            walletSigner: undefined as unknown as WalletSigner,
            ...options,
        };
        this.logger = console;
    }

    // ============ Lifecycle ============

    async initialize(): Promise<void> {
        if (!this.options.walletSigner) {
            this.logger.warn('[XMTPAdapter] No wallet signer provided, operating in read-only mode');
            return;
        }

        try {
            this.client = new XMTPClient({ 
                env: this.options.env,
                maxRetries: this.options.maxRetries 
            });
            await this.client.connect(this.options.walletSigner);

            const address = await this.options.walletSigner.getAddress();
            this.logger.info(`[XMTPAdapter] Initialized with address: ${address}, env: ${this.options.env}`);

            // Start message streaming if enabled
            if (this.options.enableStreaming) {
                await this.startMessageStream();
            }
        } catch (err) {
            this.logger.error('[XMTPAdapter] Failed to initialize:', err);
            throw err;
        }
    }

    async shutdown(): Promise<void> {
        // Stop message streaming
        if (this.unsubscribeStream) {
            this.unsubscribeStream();
            this.unsubscribeStream = null;
        }

        this.subscriptions.clear();

        if (this.client) {
            await this.client.disconnect();
            this.client = null;
        }

        this.logger.info('[XMTPAdapter] Shutdown complete');
    }

    isAvailable(): boolean {
        return this.client?.isConnected ?? false;
    }

    // ============ Messaging ============

    async send(message: A2AMessage): Promise<A2AResult> {
        if (!this.client?.isConnected) {
            return {
                success: false,
                messageId: message.id,
                protocol: 'xmtp',
                error: 'XMTP not connected',
                errorCode: A2A_ERROR_CODES.PROTOCOL_NOT_AVAILABLE,
                timestamp: Date.now(),
            };
        }

        try {
            // Map A2A message type to XMTP message type
            const msgType = this.mapA2ATypeToGradienceType(message.type);
            const payload = message.payload as Record<string, unknown> ?? {};

            await this.client.sendMessage(message.to, msgType, payload as unknown as TaskOfferPayload);

            return {
                success: true,
                messageId: message.id,
                protocol: 'xmtp',
                timestamp: Date.now(),
            };
        } catch (err) {
            this.logger.error('[XMTPAdapter] Send failed:', err);
            return {
                success: false,
                messageId: message.id,
                protocol: 'xmtp',
                error: err instanceof Error ? err.message : 'Send failed',
                errorCode: A2A_ERROR_CODES.PROTOCOL_SEND_FAILED,
                timestamp: Date.now(),
            };
        }
    }

    async subscribe(
        handler: (message: A2AMessage) => void | Promise<void>
    ): Promise<ProtocolSubscription> {
        this.subscriptions.add(handler);

        return {
            protocol: 'xmtp',
            unsubscribe: async () => {
                this.subscriptions.delete(handler);
            },
        };
    }

    // ============ Discovery ============
    // XMTP is messaging-only; discovery is handled by Nostr

    async discoverAgents(_filter?: AgentFilter): Promise<AgentInfo[]> {
        return [];
    }

    async broadcastCapabilities(_agentInfo: AgentInfo): Promise<void> {
        this.logger.debug('[XMTPAdapter] Capability broadcast not supported (use Nostr)');
    }

    // ============ Health ============

    health(): ProtocolHealthStatus {
        if (!this.client?.isConnected) {
            return {
                available: false,
                peerCount: 0,
                subscribedTopics: [],
                error: 'Not connected',
            };
        }

        return {
            available: true,
            peerCount: 0, // XMTP doesn't expose peer count directly
            subscribedTopics: this.options.enableStreaming ? ['messages'] : [],
            lastActivityAt: Date.now(),
        };
    }

    // ============ Public Methods ============

    getClient(): XMTPClient | null {
        return this.client;
    }

    async listConversations() {
        if (!this.client?.isConnected) {
            return [];
        }
        return this.client.getConversations();
    }

    // ============ Private Methods ============

    private async startMessageStream(): Promise<void> {
        if (!this.client) return;

        try {
            this.unsubscribeStream = await this.client.streamMessages((xmtpMsg) => {
                // Convert XMTP message to A2AMessage
                const a2aMsg: A2AMessage = {
                    id: xmtpMsg.id,
                    from: xmtpMsg.sender,
                    to: xmtpMsg.recipient,
                    type: this.mapGradienceTypeToA2AType(xmtpMsg.messageType),
                    timestamp: xmtpMsg.timestamp,
                    payload: xmtpMsg.payload,
                    protocol: 'xmtp',
                };

                // Notify all subscribers
                Array.from(this.subscriptions).forEach((handler) => {
                    try {
                        handler(a2aMsg);
                    } catch (err) {
                        this.logger.error('[XMTPAdapter] Message handler failed:', err);
                    }
                });
            });
        } catch (err) {
            this.logger.error('[XMTPAdapter] Failed to start message stream:', err);
            throw err;
        }
    }

    private mapA2ATypeToGradienceType(type: string): GradienceMessageType {
        switch (type) {
            case 'task_proposal':
                return GradienceMessageType.TaskOffer;
            case 'task_accept':
            case 'task_result':
                return GradienceMessageType.TaskResult;
            case 'capability_offer':
                return GradienceMessageType.JudgeVerdict;
            case 'payment_confirm':
                return GradienceMessageType.PaymentConfirmation;
            default:
                return GradienceMessageType.TaskOffer;
        }
    }

    private mapGradienceTypeToA2AType(type: GradienceMessageType): A2AMessage['type'] {
        switch (type) {
            case GradienceMessageType.TaskOffer:
                return 'task_proposal';
            case GradienceMessageType.TaskResult:
                return 'task_accept';
            case GradienceMessageType.JudgeVerdict:
                return 'capability_offer';
            case GradienceMessageType.PaymentConfirmation:
                return 'payment_confirm';
            default:
                return 'direct_message';
        }
    }
}
