/**
 * Nostr Protocol Adapter — Discovery Layer Only
 *
 * Nostr is used exclusively for agent discovery (presence, capabilities, reputation).
 * Direct messaging (DM) functionality has been migrated to XMTP.
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
    private presenceSubscription?: { unsub: () => void };

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

        console.log('[NostrAdapter] Initialized (discovery-only mode)');
    }

    async shutdown(): Promise<void> {
        // Unsubscribe from all subscriptions
        if (this.presenceSubscription) {
            this.presenceSubscription.unsub();
            this.presenceSubscription = undefined;
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
    // NOTE: Nostr adapter is discovery-only. DM functionality has been migrated to XMTP.
    // send() and subscribe() return errors/no-ops as Nostr is no longer used for messaging.

    async send(message: A2AMessage): Promise<A2AResult> {
        return {
            success: false,
            messageId: message.id,
            protocol: 'nostr',
            error: 'Nostr adapter is discovery-only. Use XMTP for direct messaging.',
            errorCode: A2A_ERROR_CODES.PROTOCOL_NOT_AVAILABLE,
            timestamp: Date.now(),
        };
    }

    async subscribe(
        _handler: (message: A2AMessage) => void | Promise<void>
    ): Promise<ProtocolSubscription> {
        // Nostr adapter is discovery-only; return a no-op subscription
        return {
            protocol: 'nostr',
            unsubscribe: async () => {},
        };
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
            subscribedTopics: nostrHealth.activeSubscriptions > 0 ? ['agent-discovery'] : [],
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
}
