/**
 * MagicBlock Protocol Adapter
 *
 * Adapter for MagicBlock A2A protocol with micropayment support
 *
 * @module a2a-router/adapters/magicblock-adapter
 */

import { MagicBlockA2AAgent, InMemoryMagicBlockHub, estimateMicropayment } from '../../../renderer/lib/a2a-client.js';
import { A2A_ERROR_CODES } from '../constants.js';
import type {
    ProtocolAdapter,
    ProtocolSubscription,
    A2AMessage,
    A2AResult,
    AgentInfo,
    AgentFilter,
    ProtocolHealthStatus,
} from '../../../shared/a2a-router-types.js';
import type { MagicBlockTransport } from '../../../renderer/lib/a2a-client.js';

export interface MagicBlockAdapterOptions {
    /** Agent ID (Solana address) */
    agentId: string;
    /** MagicBlock transport */
    transport?: MagicBlockTransport;
    /** In-memory hub for local transport (optional) */
    hub?: InMemoryMagicBlockHub;
    /** Micropayment policy */
    paymentPolicy?: {
        baseMicrolamports: number;
        perByteMicrolamports: number;
    };
    /** Auto-start on initialize */
    autoStart?: boolean;
}

export class MagicBlockAdapter implements ProtocolAdapter {
    readonly protocol = 'magicblock' as const;
    private agent: MagicBlockA2AAgent | null = null;
    private options: Required<MagicBlockAdapterOptions>;
    private hub: InMemoryMagicBlockHub;
    private started = false;
    private messageHandler?: (message: A2AMessage) => void | Promise<void>;
    private unsubscribeDelivery?: () => void;
    private lastActivityAt?: number;

    constructor(options: MagicBlockAdapterOptions) {
        this.hub = options.hub ?? new InMemoryMagicBlockHub();
        this.options = {
            agentId: options.agentId,
            transport: options.transport ?? this.createDefaultTransport(),
            hub: this.hub,
            paymentPolicy: options.paymentPolicy ?? {
                baseMicrolamports: 100,
                perByteMicrolamports: 2,
            },
            autoStart: options.autoStart ?? true,
        };
    }

    // ============ Lifecycle ============

    async initialize(): Promise<void> {
        if (this.agent) {
            throw new Error('[MagicBlockAdapter] Already initialized');
        }

        this.agent = new MagicBlockA2AAgent(
            this.options.agentId,
            this.options.transport,
            () => Date.now(),
            this.options.paymentPolicy
        );

        if (this.options.autoStart) {
            this.agent.start();
            this.started = true;
        }

        // Subscribe to deliveries for message handling
        this.unsubscribeDelivery = this.agent.onDelivery((delivery) => {
            this.lastActivityAt = Date.now();

            if (delivery.direction === 'incoming' && this.messageHandler) {
                const message: A2AMessage = {
                    id: delivery.envelope.id,
                    from: delivery.envelope.from,
                    to: delivery.envelope.to,
                    type: this.topicToMessageType(delivery.envelope.topic),
                    timestamp: delivery.envelope.createdAt,
                    payload: {
                        content: delivery.envelope.message,
                        paymentMicrolamports: delivery.envelope.paymentMicrolamports,
                        channel: delivery.channel,
                        latencyMs: delivery.latencyMs,
                    },
                    protocol: 'magicblock',
                };

                void this.messageHandler(message);
            }
        });

        console.log('[MagicBlockAdapter] Initialized');
    }

    async shutdown(): Promise<void> {
        if (!this.agent) return;

        this.unsubscribeDelivery?.();
        this.agent.stop();
        this.agent = null;
        this.started = false;

        console.log('[MagicBlockAdapter] Shutdown');
    }

    isAvailable(): boolean {
        return this.agent !== null && this.started;
    }

    // ============ Messaging ============

    async send(message: A2AMessage): Promise<A2AResult> {
        if (!this.agent || !this.started) {
            return {
                success: false,
                messageId: message.id,
                protocol: 'magicblock',
                error: 'MagicBlock adapter not initialized',
                errorCode: A2A_ERROR_CODES.PROTOCOL_NOT_AVAILABLE,
                timestamp: Date.now(),
            };
        }

        try {
            // Calculate micropayment
            const topic = message.type;
            const content = typeof message.payload === 'string'
                ? message.payload
                : JSON.stringify(message.payload);

            const paymentMicrolamports = estimateMicropayment(
                topic,
                content,
                this.options.paymentPolicy
            );

            // Send via MagicBlock
            const envelope = this.agent.sendInvite({
                to: message.to,
                topic,
                message: content,
            });

            this.lastActivityAt = Date.now();

            return {
                success: true,
                messageId: envelope.id,
                protocol: 'magicblock',
                timestamp: Date.now(),
            };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            return {
                success: false,
                messageId: message.id,
                protocol: 'magicblock',
                error: err.message,
                errorCode: A2A_ERROR_CODES.PROTOCOL_SEND_FAILED,
                timestamp: Date.now(),
            };
        }
    }

    async subscribe(
        handler: (message: A2AMessage) => void | Promise<void>
    ): Promise<ProtocolSubscription> {
        this.messageHandler = handler;

        return {
            protocol: 'magicblock',
            unsubscribe: async () => {
                this.messageHandler = undefined;
            },
        };
    }

    // ============ Discovery ============

    async discoverAgents(_filter?: AgentFilter): Promise<AgentInfo[]> {
        // MagicBlock doesn't have built-in discovery
        // Agents are discovered through other means (Indexer, Nostr, libp2p)
        return [];
    }

    async broadcastCapabilities(agentInfo: AgentInfo): Promise<void> {
        // Broadcast presence via MagicBlock by sending to a broadcast topic
        if (!this.agent || !this.started) return;

        const content = JSON.stringify({
            agent: agentInfo.address,
            display_name: agentInfo.displayName,
            capabilities: agentInfo.capabilities,
            reputation_score: agentInfo.reputationScore,
            available: agentInfo.available,
        });

        // Send to broadcast topic
        this.agent.sendInvite({
            to: 'broadcast', // Special broadcast address
            topic: 'agent_presence',
            message: content,
        });

        this.lastActivityAt = Date.now();
    }

    // ============ Health ============

    health(): ProtocolHealthStatus {
        return {
            available: this.isAvailable(),
            peerCount: 0, // MagicBlock doesn't track peers
            subscribedTopics: this.started ? ['agent_presence'] : [],
            lastActivityAt: this.lastActivityAt,
        };
    }

    // ============ MagicBlock Specific ============

    /**
     * Get micropayment estimate for a message
     */
    estimatePayment(topic: string, message: string): number {
        return estimateMicropayment(topic, message, this.options.paymentPolicy);
    }

    /**
     * Get the underlying MagicBlock agent
     */
    getAgent(): MagicBlockA2AAgent | null {
        return this.agent;
    }

    // ============ Private Methods ============

    private createDefaultTransport(): MagicBlockTransport {
        return {
            name: 'magicblock-inmemory',
            publish: (envelope) => this.hub.publish(envelope),
            subscribe: (handler) => this.hub.subscribe(handler),
        };
    }

    private topicToMessageType(topic: string): A2AMessage['type'] {
        // Map MagicBlock topics to A2A message types
        const topicMap: Record<string, A2AMessage['type']> = {
            'general': 'direct_message',
            'task_proposal': 'task_proposal',
            'task_accept': 'task_accept',
            'task_reject': 'task_reject',
            'task_counter': 'task_counter',
            'agent_presence': 'capability_offer',
            'reputation_query': 'reputation_query',
            'reputation_response': 'reputation_response',
            'payment_request': 'payment_request',
            'payment_confirm': 'payment_confirm',
        };

        return topicMap[topic] ?? 'direct_message';
    }
}

export default MagicBlockAdapter;
