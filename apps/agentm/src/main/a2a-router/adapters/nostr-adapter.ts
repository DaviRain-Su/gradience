/**
 * Nostr Protocol Adapter
 *
 * Adapter for Nostr protocol in A2A Router
 *
 * @module a2a-router/adapters/nostr-adapter
 */

import { NostrClient } from '../nostr-client.js';
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
import type { NostrClientOptions } from '../nostr-client.js';
import type { AgentPresenceContent } from '../../../shared/nostr-types.js';

export interface NostrAdapterOptions extends NostrClientOptions {
    /** Auto-discover agents on start */
    autoDiscover?: boolean;
}

export class NostrAdapter implements ProtocolAdapter {
    readonly protocol = 'nostr' as const;
    private client: NostrClient;
    private options: NostrAdapterOptions;
    private subscriptions: ProtocolSubscription[] = [];
    private discoveredAgents: Map<string, AgentInfo> = new Map();
    private messageHandler?: (message: A2AMessage) => void | Promise<void>;
    private presenceSubscription?: { unsub: () => void };
    private dmSubscription?: { unsub: () => void };

    constructor(options: NostrAdapterOptions = {}) {
        this.options = {
            autoDiscover: true,
            ...options,
        };
        this.client = new NostrClient(options);
    }

    // ============ Lifecycle ============

    async initialize(): Promise<void> {
        // Skip if no relays configured (for testing)
        if (!this.options.relays || this.options.relays.length === 0) {
            console.log('[NostrAdapter] No relays configured, skipping initialization');
            return;
        }

        await this.client.connect();

        if (this.options.autoDiscover) {
            await this.startDiscovery();
        }

        console.log('[NostrAdapter] Initialized');
    }

    async shutdown(): Promise<void> {
        // Unsubscribe from all subscriptions
        if (this.presenceSubscription) {
            this.presenceSubscription.unsub();
            this.presenceSubscription = undefined;
        }

        if (this.dmSubscription) {
            this.dmSubscription.unsub();
            this.dmSubscription = undefined;
        }

        await this.client.disconnect();
        this.discoveredAgents.clear();

        console.log('[NostrAdapter] Shutdown');
    }

    isAvailable(): boolean {
        // Not available if no relays configured
        if (!this.options.relays || this.options.relays.length === 0) {
            return false;
        }
        return this.client.isConnected();
    }

    // ============ Messaging ============

    async send(message: A2AMessage): Promise<A2AResult> {
        // Return error if no relays configured
        if (!this.options.relays || this.options.relays.length === 0) {
            return {
                success: false,
                messageId: message.id,
                protocol: 'nostr',
                error: 'No relays configured',
                errorCode: A2A_ERROR_CODES.PROTOCOL_NOT_AVAILABLE,
                timestamp: Date.now(),
            };
        }

        try {
            // For Nostr, we need the recipient's Nostr pubkey
            // This should be looked up from the agent's profile
            const recipientPubkey = await this.lookupNostrPubkey(message.to);

            if (!recipientPubkey) {
                return {
                    success: false,
                    messageId: message.id,
                    protocol: 'nostr',
                    error: `Recipient ${message.to} does not have a Nostr pubkey`,
                    errorCode: A2A_ERROR_CODES.PROTOCOL_NOT_AVAILABLE,
                    timestamp: Date.now(),
                };
            }

            // Send encrypted DM
            const eventId = await this.client.sendDM(
                recipientPubkey,
                JSON.stringify(message)
            );

            return {
                success: true,
                messageId: message.id,
                protocol: 'nostr',
                timestamp: Date.now(),
            };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            return {
                success: false,
                messageId: message.id,
                protocol: 'nostr',
                error: err.message,
                errorCode: A2A_ERROR_CODES.PROTOCOL_SEND_FAILED,
                timestamp: Date.now(),
            };
        }
    }

    async subscribe(
        handler: (message: A2AMessage) => void | Promise<void>
    ): Promise<ProtocolSubscription> {
        // Return dummy subscription if no relays configured
        if (!this.options.relays || this.options.relays.length === 0) {
            return {
                protocol: 'nostr',
                unsubscribe: async () => {},
            };
        }

        this.messageHandler = handler;

        // Subscribe to DMs
        this.dmSubscription = await this.client.subscribeDMs((event) => {
            try {
                const message = JSON.parse(event.content) as A2AMessage;
                // Verify the message is intended for us
                if (message.to === this.getOwnAddress()) {
                    handler(message);
                }
            } catch (error) {
                console.error('[NostrAdapter] Failed to parse DM:', error);
            }
        });

        const subscription: ProtocolSubscription = {
            protocol: 'nostr',
            unsubscribe: async () => {
                if (this.dmSubscription) {
                    this.dmSubscription.unsub();
                    this.dmSubscription = undefined;
                }
            },
        };

        this.subscriptions.push(subscription);
        return subscription;
    }

    // ============ Discovery ============

    async discoverAgents(filter?: AgentFilter): Promise<AgentInfo[]> {
        // Return empty if no relays configured
        if (!this.options.relays || this.options.relays.length === 0) {
            return [];
        }

        // Query recent presence events
        const events = await this.client.queryPresence(
            {
                availableOnly: filter?.availableOnly ?? false,
                minReputation: filter?.minReputation,
                capabilities: filter?.capabilities,
            },
            filter?.limit ?? 100
        );

        const agents: AgentInfo[] = [];

        for (const event of events) {
            try {
                const content: AgentPresenceContent = JSON.parse(event.content);

                // Apply filters
                if (filter?.minReputation && content.reputation_score < filter.minReputation) {
                    continue;
                }
                if (filter?.capabilities && !filter.capabilities.some(c => content.capabilities.includes(c))) {
                    continue;
                }

                const agent: AgentInfo = {
                    address: content.agent,
                    displayName: content.display_name,
                    capabilities: content.capabilities,
                    reputationScore: content.reputation_score,
                    available: content.available,
                    discoveredVia: 'nostr',
                    nostrPubkey: event.pubkey,
                    multiaddrs: [], // Nostr doesn't provide multiaddrs
                    lastSeenAt: event.created_at * 1000,
                };

                agents.push(agent);
                this.discoveredAgents.set(agent.address, agent);
            } catch (error) {
                console.error('[NostrAdapter] Failed to parse presence event:', error);
            }
        }

        return agents;
    }

    async broadcastCapabilities(agentInfo: AgentInfo): Promise<void> {
        // Skip if no relays configured
        if (!this.options.relays || this.options.relays.length === 0) {
            return;
        }

        const content: AgentPresenceContent = {
            agent: agentInfo.address,
            display_name: agentInfo.displayName,
            capabilities: agentInfo.capabilities,
            reputation_score: agentInfo.reputationScore,
            available: agentInfo.available,
        };

        await this.client.publishPresence(content);
    }

    // ============ Health ============

    health(): ProtocolHealthStatus {
        const nostrHealth = this.client.health();

        return {
            available: nostrHealth.connected,
            peerCount: nostrHealth.relayCount,
            subscribedTopics: nostrHealth.activeSubscriptions > 0 ? ['agent-discovery', 'dm'] : [],
            lastActivityAt: nostrHealth.lastEventAt,
        };
    }

    // ============ Private Methods ============

    private async startDiscovery(): Promise<void> {
        // Subscribe to presence events
        this.presenceSubscription = await this.client.subscribePresence(
            {},
            (event) => {
                try {
                    const content: AgentPresenceContent = JSON.parse(event.content);
                    const agent: AgentInfo = {
                        address: content.agent,
                        displayName: content.display_name,
                        capabilities: content.capabilities,
                        reputationScore: content.reputation_score,
                        available: content.available,
                        discoveredVia: 'nostr',
                        nostrPubkey: event.pubkey,
                        multiaddrs: [],
                        lastSeenAt: event.created_at * 1000,
                    };

                    this.discoveredAgents.set(agent.address, agent);
                } catch (error) {
                    console.error('[NostrAdapter] Failed to process presence:', error);
                }
            }
        );
    }

    private async lookupNostrPubkey(solanaAddress: string): Promise<string | null> {
        // First check our discovered agents
        const agent = this.discoveredAgents.get(solanaAddress);
        if (agent?.nostrPubkey) {
            return agent.nostrPubkey;
        }

        // Otherwise query from relays
        const agents = await this.discoverAgents({ limit: 100 });
        const found = agents.find(a => a.address === solanaAddress);
        return found?.nostrPubkey ?? null;
    }

    private getOwnAddress(): string {
        // This should return the agent's Solana address
        // For now, return a placeholder
        return this.client.getPublicKey();
    }
}
