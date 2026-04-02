/**
 * libp2p Node Implementation
 * 
 * P2P direct communication for AgentM A2A protocol
 * Simplified version - PubSub only for now
 * 
 * @module a2a-router/libp2p-node
 */

// @ts-nocheck - Disable strict type checking for this file due to libp2p v3 type issues

import { createLibp2p, type Libp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { gossipsub } from '@libp2p/gossipsub';
import { identify } from '@libp2p/identify';
import { bootstrap } from '@libp2p/bootstrap';
import { noise } from '@libp2p/noise';
import { mplex } from '@libp2p/mplex';
import { LIBP2P_CONFIG } from './constants.js';
import { toErrorMessage } from './utils.js';
import type {
    Libp2pMessage,
    CapabilityOfferMessage,
    DirectMessage,
    DiscoveredAgent,
    Libp2pHealthStatus,
    Libp2pNodeOptions,
    MessageHandler,
    Libp2pSubscription,
} from '../../shared/libp2p-types.js';

export class Libp2pNode {
    private node: Libp2p | null = null;
    private options: Required<Libp2pNodeOptions>;
    private discoveredAgents: Map<string, DiscoveredAgent> = new Map();
    private subscriptions: Map<string, Set<MessageHandler>> = new Map();
    private lastError?: string;

    constructor(options: Libp2pNodeOptions = {}) {
        this.options = {
            bootstrapList: options.bootstrapList ?? [...LIBP2P_CONFIG.BOOTSTRAP_LIST],
            topics: options.topics ?? [LIBP2P_CONFIG.TOPICS.AGENT_DISCOVERY],
            solanaPrivateKey: options.solanaPrivateKey ?? new Uint8Array(),
            dhtClientMode: options.dhtClientMode ?? true,
            maxConnections: options.maxConnections ?? 50,
        };
    }

    // ============ Lifecycle ============

    async start(): Promise<void> {
        if (this.node) {
            throw new Error('[Libp2pNode] Already started');
        }

        try {
            this.node = await createLibp2p({
                transports: [webSockets()],
                connectionEncrypters: [noise()],
                streamMuxers: [mplex()],
                peerDiscovery: [
                    bootstrap({
                        list: this.options.bootstrapList,
                    }),
                ],
                services: {
                    identify: identify(),
                    pubsub: gossipsub({
                        emitSelf: false,
                    }),
                },
            } as any);

            this.setupEventHandlers();

            // Subscribe to configured topics
            for (const topic of this.options.topics) {
                await this.subscribeTopic(topic);
            }

            console.log(`[Libp2pNode] Started with peer ID: ${this.node.peerId.toString()}`);
        } catch (error) {
            this.lastError = error instanceof Error ? error.message : String(error);
            throw new Error(`[Libp2pNode] Failed to start: ${this.lastError}`);
        }
    }

    async stop(): Promise<void> {
        if (!this.node) return;

        for (const [topic] of this.subscriptions) {
            await this.unsubscribeTopic(topic);
        }

        await this.node.stop();
        this.node = null;
        this.discoveredAgents.clear();
        this.subscriptions.clear();
        console.log('[Libp2pNode] Stopped');
    }

    isStarted(): boolean {
        return this.node !== null;
    }

    // ============ Identity ============

    getPeerId(): string {
        this.ensureStarted();
        return this.node!.peerId.toString();
    }

    getMultiaddrs(): string[] {
        this.ensureStarted();
        return this.node!.getMultiaddrs().map(ma => ma.toString());
    }

    // ============ Connection Management ============

    async dial(peerIdOrMultiaddr: string): Promise<void> {
        this.ensureStarted();

        try {
            const { multiaddr } = await import('@multiformats/multiaddr');
            const ma = multiaddr(peerIdOrMultiaddr);
            await (this.node!.dial as any)(ma);
        } catch (err) {
            // Try as peer ID
            try {
                const { peerIdFromString } = await import('@libp2p/peer-id');
                const peerId = peerIdFromString(peerIdOrMultiaddr);
                await (this.node!.dial as any)(peerId);
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                throw new Error(
                    `[Libp2pNode] Failed to dial ${peerIdOrMultiaddr}: ${msg}`
                );
            }
        }
    }

    async hangUp(peerId: string): Promise<void> {
        this.ensureStarted();
        const { peerIdFromString } = await import('@libp2p/peer-id');
        const pid = peerIdFromString(peerId);
        await (this.node!.hangUp as any)(pid);
    }

    getPeerCount(): number {
        this.ensureStarted();
        return this.node!.getConnections().length;
    }

    // ============ PubSub ============

    async publish(topic: string, message: Libp2pMessage): Promise<void> {
        this.ensureStarted();

        const data = new TextEncoder().encode(JSON.stringify(message));

        try {
            await this.node!.services.pubsub.publish(topic, data);
        } catch (e) {
            throw new Error(
                `[Libp2pNode] Failed to publish to ${topic}: ${toErrorMessage(e)}`
            );
        }
    }

    async subscribe(topic: string, handler: MessageHandler): Promise<Libp2pSubscription> {
        this.ensureStarted();

        if (!this.subscriptions.has(topic)) {
            this.subscriptions.set(topic, new Set());
            await this.node!.services.pubsub.subscribe(topic);
        }

        this.subscriptions.get(topic)!.add(handler);

        return {
            topic,
            unsubscribe: () => {
                const handlers = this.subscriptions.get(topic);
                if (handlers) {
                    handlers.delete(handler);
                    if (handlers.size === 0) {
                        this.unsubscribeTopic(topic);
                    }
                }
            },
        };
    }

    getSubscribedTopics(): string[] {
        this.ensureStarted();
        return Array.from(this.subscriptions.keys());
    }

    // ============ Discovery ============

    async broadcastCapabilities(offer: CapabilityOfferMessage['payload']): Promise<void> {
        const message: CapabilityOfferMessage = {
            type: 'capability_offer',
            from: this.getPeerId(),
            timestamp: Date.now(),
            payload: offer,
        };

        await this.publish(LIBP2P_CONFIG.TOPICS.AGENT_DISCOVERY, message);
    }

    async subscribeDiscovery(handler: (agent: DiscoveredAgent) => void): Promise<Libp2pSubscription> {
        return this.subscribe(LIBP2P_CONFIG.TOPICS.AGENT_DISCOVERY, (msg: Libp2pMessage) => {
            if (msg.type === 'capability_offer') {
                const offer = msg as CapabilityOfferMessage;
                const agent: DiscoveredAgent = {
                    address: offer.payload.agent,
                    peerId: offer.from,
                    displayName: offer.payload.display_name,
                    capabilities: offer.payload.capabilities,
                    reputationScore: offer.payload.reputation_score,
                    available: offer.payload.available,
                    multiaddrs: offer.payload.multiaddrs,
                    nostrPubkey: offer.payload.nostr_pubkey,
                    discoveredAt: Date.now(),
                };

                this.discoveredAgents.set(agent.address, agent);
                handler(agent);
            }
        });
    }

    getDiscoveredAgents(): DiscoveredAgent[] {
        return Array.from(this.discoveredAgents.values());
    }

    // ============ Direct Messaging ============

    async sendDirectMessage(toPeerId: string, content: string, options: { messageId?: string; inReplyTo?: string } = {}): Promise<void> {
        const message: DirectMessage = {
            type: 'direct_message',
            from: this.getPeerId(),
            timestamp: Date.now(),
            payload: {
                to: toPeerId,
                content,
                messageId: options.messageId ?? crypto.randomUUID(),
                inReplyTo: options.inReplyTo,
            },
        };

        await this.publish(LIBP2P_CONFIG.TOPICS.DIRECT_MESSAGES, message);
    }

    async subscribeDirectMessages(handler: (msg: DirectMessage) => void): Promise<Libp2pSubscription> {
        return this.subscribe(LIBP2P_CONFIG.TOPICS.DIRECT_MESSAGES, (msg: Libp2pMessage) => {
            if (msg.type === 'direct_message') {
                handler(msg as DirectMessage);
            }
        });
    }

    // ============ Health ============

    health(): Libp2pHealthStatus {
        if (!this.node) {
            return {
                started: false,
                peerId: '',
                listenAddrs: [],
                peerCount: 0,
                subscribedTopics: [],
                lastError: this.lastError,
            };
        }

        return {
            started: true,
            peerId: this.node.peerId.toString(),
            listenAddrs: this.node.getMultiaddrs().map(ma => ma.toString()),
            peerCount: this.node.getConnections().length,
            subscribedTopics: this.getSubscribedTopics(),
            lastError: this.lastError,
        };
    }

    // ============ Private Methods ============

    private ensureStarted(): void {
        if (!this.node) {
            throw new Error(`[Libp2pNode] Not started. Call start() first.`);
        }
    }

    private setupEventHandlers(): void {
        if (!this.node) return;

        this.node.addEventListener('peer:connect', (evt: any) => {
            const peerId = evt.detail.toString();
            console.log(`[Libp2pNode] Peer connected: ${peerId}`);
        });

        this.node.addEventListener('peer:disconnect', (evt: any) => {
            const peerId = evt.detail.toString();
            console.log(`[Libp2pNode] Peer disconnected: ${peerId}`);
        });

        this.node.services.pubsub.addEventListener('message', (evt: any) => {
            const { topic, data } = evt.detail;
            try {
                const message = JSON.parse(new TextDecoder().decode(data)) as Libp2pMessage;
                const handlers = this.subscriptions.get(topic);
                if (handlers) {
                    handlers.forEach(handler => {
                        try {
                            handler(message);
                        } catch (err) {
                            console.error(`[Libp2pNode] Handler error:`, err);
                        }
                    });
                }
            } catch (err) {
                console.error(`[Libp2pNode] Failed to parse message:`, err);
            }
        });
    }

    private async subscribeTopic(topic: string): Promise<void> {
        if (!this.node) return;
        await this.node.services.pubsub.subscribe(topic);
    }

    private async unsubscribeTopic(topic: string): Promise<void> {
        if (!this.node) return;
        await this.node.services.pubsub.unsubscribe(topic);
        this.subscriptions.delete(topic);
    }
}
