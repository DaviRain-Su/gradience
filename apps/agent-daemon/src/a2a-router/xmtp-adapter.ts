/**
 * XMTP Protocol Adapter for A2A Router
 *
 * Wraps @gradiences/xmtp-adapter to implement ProtocolAdapter interface.
 * XMTP provides E2E encrypted direct messaging between Agents.
 *
 * @module a2a-router/xmtp-adapter
 */

import { XMTPClient, type WalletSigner, GradienceMessageType, type TaskOfferPayload } from '@gradiences/xmtp-adapter';
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
import { logger } from '../utils/logger.js';

export interface XMTPAdapterOptions {
    /** XMTP environment */
    env?: 'production' | 'dev';
    /** Wallet signer for XMTP identity */
    walletSigner?: WalletSigner;
    /** Enable message streaming (default: true) */
    enableStreaming?: boolean;
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

    constructor(options: XMTPAdapterOptions = {}) {
        this.options = {
            env: 'dev',
            enableStreaming: true,
            walletSigner: undefined as unknown as WalletSigner,
            ...options,
        };
    }

    // ============ Lifecycle ============

    async initialize(): Promise<void> {
        if (!this.options.walletSigner) {
            logger.warn('[XMTPAdapter] No wallet signer provided, operating in read-only mode');
            return;
        }

        try {
            this.client = new XMTPClient({ env: this.options.env });
            await this.client.connect(this.options.walletSigner);

            const address = await this.options.walletSigner.getAddress();
            logger.info({ address, env: this.options.env }, 'XMTP adapter initialized');

            // Start message streaming if enabled
            if (this.options.enableStreaming) {
                this.startMessageStream();
            }
        } catch (err) {
            logger.error({ err }, 'XMTP adapter failed to initialize');
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

        logger.info('XMTP adapter shutdown');
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
            const msgType = GradienceMessageType.TaskOffer;
            const payload = message.payload as Record<string, unknown> ?? {};

            await this.client.sendMessage(message.to, msgType, payload as unknown as TaskOfferPayload);

            return {
                success: true,
                messageId: message.id,
                protocol: 'xmtp',
                timestamp: Date.now(),
            };
        } catch (err) {
            logger.error({ err, to: message.to }, 'XMTP send failed');
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
        logger.debug('[XMTPAdapter] Capability broadcast not supported (use Nostr)');
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

    // ============ Private Methods ============

    private startMessageStream(): void {
        if (!this.client) return;

        this.client.streamMessages((xmtpMsg) => {
            // Convert XMTP message to A2AMessage
            const a2aMsg: A2AMessage = {
                id: xmtpMsg.id,
                from: xmtpMsg.sender,
                to: xmtpMsg.recipient,
                type: 'direct_message',
                timestamp: xmtpMsg.timestamp,
                payload: xmtpMsg.payload,
                protocol: 'xmtp',
            };

            // Notify all subscribers
            for (const handler of this.subscriptions) {
                try {
                    handler(a2aMsg);
                } catch (err) {
                    logger.error({ err }, 'XMTP message handler failed');
                }
            }
        }).then((unsub) => {
            this.unsubscribeStream = unsub;
        }).catch((err) => {
            logger.error({ err }, 'Failed to start XMTP message stream');
        });
    }
}
