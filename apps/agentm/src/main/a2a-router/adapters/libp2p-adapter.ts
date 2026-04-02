/**
 * libp2p Protocol Adapter
 *
 * Adapter for libp2p protocol in A2A Router
 *
 * @module a2a-router/adapters/libp2p-adapter
 */

// @ts-nocheck - Disable strict type checking for this file due to libp2p v3 type issues

import { Libp2pNode } from '../libp2p-node.js';
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
import type { Libp2pNodeOptions } from '../libp2p-node.js';
import type { CapabilityOfferPayload } from '../../../shared/libp2p-types.js';

export interface Libp2pAdapterOptions extends Libp2pNodeOptions {
    /** Auto-discover agents on start */
    autoDiscover?: boolean;
}

export class Libp2pAdapter implements ProtocolAdapter {
    readonly protocol = 'libp2p' as const;
    private node: Libp2pNode;
    private options: Libp2pAdapterOptions;
    private subscriptions: ProtocolSubscription[] = [];
    private discoveredAgents: Map<string, AgentInfo> = new Map();
    private messageHandler?: (message: A2AMessage) => void | Promise<void>;
    private discoverySubscription?: { unsubscribe: () => void };
    private dmSubscription?: { unsubscribe: () => void };

    constructor(options: Libp2pAdapterOptions = {}) {
        this.options = {
            autoDiscover: true,
            ...options,
        };
        this.node = new Libp2pNode(options);
    }

    // ============ Lifecycle ============

    async initialize(): Promise<void> {
        await this.node.start();

        if (this.options.autoDiscover) {
            await this.startDiscovery();
        }

        console.log('[Libp2pAdapter] Initialized');
    }

    async shutdown(): Promise<void> {
        // Unsubscribe from all subscriptions
        if (this.discoverySubscription) {
            this.discoverySubscription.unsubscribe();
            this.discoverySubscription = undefined;
        }

        if (this.dmSubscription) {
            this.dmSubscription.unsubscribe();
            this.dmSubscription = undefined;
        }

        await this.node.stop();
        this.discoveredAgents.clear();

        console.log('[Libp2pAdapter] Shutdown');
    }

    isAvailable(): boolean {
        return this.node.isStarted();
    }

    // ============ Messaging ============

    async send(message: A2AMessage): Promise<A2AResult> {
        try {
            // For libp2p, we need the recipient's peer ID
            const recipientPeerId = await this.lookupPeerId(message.to);

            if (!recipientPeerId) {
                return {
                    success: false,
                    messageId: message.id,
                    protocol: 'libp2p',
                    error: `Recipient ${message.to} does not have a libp2p peer ID`,
                    errorCode: A2A_ERROR_CODES.PROTOCOL_NOT_AVAILABLE,
                    timestamp: Date.now(),
                };
            }

            // Send direct message via PubSub
            await this.node.sendDirectMessage(
                recipientPeerId,
                JSON.stringify(message),
                { messageId: message.id }
            );

            return {
                success: true,
                messageId: message.id,
                protocol: 'libp2p',
                timestamp: Date.now(),
            };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            return {
                success: false,
                messageId: message.id,
                protocol: 'libp2p',
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

        // Subscribe to direct messages
        this.dmSubscription = await this.node.subscribeDirectMessages((msg) => {
            try {
                const message = JSON.parse(msg.payload.content) as A2AMessage;
                // Verify the message is intended for us
                if (message.to === this.getOwnAddress()) {
                    handler(message);
                }
            } catch (error) {
                console.error('[Libp2pAdapter] Failed to parse DM:', error);
            }
        });

        const subscription: ProtocolSubscription = {
            protocol: 'libp2p',
            unsubscribe: async () => {
                if (this.dmSubscription) {
                    this.dmSubscription.unsubscribe();
                    this.dmSubscription = undefined;
                }
            },
        };

        this.subscriptions.push(subscription);
        return subscription;
    }

    // ============ Discovery ============

    async discoverAgents(filter?: AgentFilter): Promise<AgentInfo[]> {
        // Get discovered agents from libp2p
        const agents = this.node.getDiscoveredAgents();

        // Apply filters
        return agents
            .map((agent) => ({
                address: agent.address,
                displayName: agent.displayName,
                capabilities: agent.capabilities,
                reputationScore: agent.reputationScore,
                available: agent.available,
                discoveredVia: 'libp2p' as const,
                libp2pPeerId: agent.peerId,
                multiaddrs: agent.multiaddrs,
                nostrPubkey: agent.nostrPubkey,
                lastSeenAt: agent.discoveredAt,
            }))
            .filter((agent) => {
                if (filter?.minReputation && agent.reputationScore < filter.minReputation) {
                    return false;
                }
                if (filter?.capabilities && !filter.capabilities.some(c => agent.capabilities.includes(c))) {
                    return false;
                }
                if (filter?.availableOnly && !agent.available) {
                    return false;
                }
                return true;
            })
            .slice(0, filter?.limit ?? 100);
    }

    async broadcastCapabilities(agentInfo: AgentInfo): Promise<void> {
        const offer: CapabilityOfferPayload = {
            agent: agentInfo.address,
            display_name: agentInfo.displayName,
            capabilities: agentInfo.capabilities,
            reputation_score: agentInfo.reputationScore,
            available: agentInfo.available,
            multiaddrs: this.node.getMultiaddrs(),
            nostr_pubkey: agentInfo.nostrPubkey,
        };

        await this.node.broadcastCapabilities(offer);
    }

    // ============ Health ============

    health(): ProtocolHealthStatus {
        const libp2pHealth = this.node.health();

        return {
            available: libp2pHealth.started,
            peerCount: libp2pHealth.peerCount,
            subscribedTopics: libp2pHealth.subscribedTopics,
            lastActivityAt: libp2pHealth.started ? Date.now() : undefined,
        };
    }

    // ============ Private Methods ============

    private async startDiscovery(): Promise<void> {
        // Subscribe to discovery topic
        this.discoverySubscription = await this.node.subscribeDiscovery((agent) => {
            this.discoveredAgents.set(agent.address, {
                address: agent.address,
                displayName: agent.displayName,
                capabilities: agent.capabilities,
                reputationScore: agent.reputationScore,
                available: agent.available,
                discoveredVia: 'libp2p',
                libp2pPeerId: agent.peerId,
                multiaddrs: agent.multiaddrs,
                nostrPubkey: agent.nostrPubkey,
                lastSeenAt: agent.discoveredAt,
            });
        });
    }

    private async lookupPeerId(solanaAddress: string): Promise<string | null> {
        // First check our discovered agents
        const agent = this.discoveredAgents.get(solanaAddress);
        if (agent?.libp2pPeerId) {
            return agent.libp2pPeerId;
        }

        // Otherwise query from network
        const agents = await this.discoverAgents({ limit: 100 });
        const found = agents.find(a => a.address === solanaAddress);
        return found?.libp2pPeerId ?? null;
    }

    private getOwnAddress(): string {
        // This should return the agent's Solana address
        // For now, return the peer ID as a placeholder
        return this.node.getPeerId();
    }
}
