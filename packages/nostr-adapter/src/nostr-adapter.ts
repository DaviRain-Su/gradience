/**
 * Nostr Protocol Adapter -- discovery layer.
 * Nostr handles agent presence broadcast + discovery.
 * Direct messaging goes through XMTP.
 */

import { NostrClient, type NostrClientOptions } from './nostr-client.js';
import {
    A2A_ERROR_CODES,
    type ProtocolAdapter,
    type ProtocolSubscription,
    type A2AMessage,
    type A2AResult,
    type AgentInfo,
    type AgentFilter,
    type ProtocolHealthStatus,
    type AgentPresenceContent,
    type NostrSubscription,
} from '@gradiences/a2a-types';

export interface NostrAdapterOptions extends NostrClientOptions {
    autoDiscover?: boolean;
}

export class NostrAdapter implements ProtocolAdapter {
    readonly protocol = 'nostr' as const;
    private client: NostrClient;
    private options: NostrAdapterOptions;
    private discoveredAgents: Map<string, AgentInfo> = new Map();
    private presenceSubscription?: NostrSubscription;

    constructor(options: NostrAdapterOptions = {}) {
        this.options = { autoDiscover: true, ...options };
        this.client = new NostrClient(options);
    }

    async initialize(): Promise<void> {
        if (!this.options.relays || this.options.relays.length === 0) {
            console.log('[NostrAdapter] No relays configured, using defaults');
        }
        await this.client.connect();
        if (this.options.autoDiscover) {
            await this.startDiscovery();
        }
        console.log('[NostrAdapter] Initialized (discovery-only mode)');
    }

    async shutdown(): Promise<void> {
        if (this.presenceSubscription) {
            this.presenceSubscription.unsub();
            this.presenceSubscription = undefined;
        }
        await this.client.disconnect();
        this.discoveredAgents.clear();
    }

    isAvailable(): boolean {
        return this.client.isConnected();
    }

    // Discovery-only adapter; DMs go through XMTP
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

    async subscribe(_handler: (message: A2AMessage) => void | Promise<void>): Promise<ProtocolSubscription> {
        return { protocol: 'nostr', unsubscribe: async () => {} };
    }

    async discoverAgents(filter?: AgentFilter): Promise<AgentInfo[]> {
        const events = await this.client.queryPresence(
            {
                availableOnly: filter?.availableOnly ?? false,
                minReputation: filter?.minReputation,
                capabilities: filter?.capabilities,
            },
            filter?.limit ?? 100,
        );

        const agents: AgentInfo[] = [];
        for (const event of events) {
            try {
                const content: AgentPresenceContent = JSON.parse(event.content);
                if (filter?.minReputation && content.reputation_score < filter.minReputation) continue;
                if (filter?.capabilities && !filter.capabilities.some((c) => content.capabilities.includes(c)))
                    continue;

                if (content.soul) {
                    if (filter?.soulType && content.soul.type !== filter.soulType) continue;
                    if (
                        filter?.interestTags?.length &&
                        !filter.interestTags.some((t) => content.soul!.tags.includes(t))
                    )
                        continue;
                    if (filter?.soulVisibility && content.soul.visibility !== filter.soulVisibility) continue;
                } else if (filter?.soulType || filter?.interestTags || filter?.soulVisibility) {
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
                    multiaddrs: [],
                    lastSeenAt: event.created_at * 1000,
                };
                agents.push(agent);
                this.discoveredAgents.set(agent.address, agent);
            } catch {}
        }
        return agents;
    }

    async broadcastCapabilities(agentInfo: AgentInfo): Promise<void> {
        const content: AgentPresenceContent = {
            agent: agentInfo.address,
            display_name: agentInfo.displayName,
            capabilities: agentInfo.capabilities,
            reputation_score: agentInfo.reputationScore,
            available: agentInfo.available,
        };
        await this.client.publishPresence(content);
    }

    health(): ProtocolHealthStatus {
        const h = this.client.health();
        return {
            available: h.connected,
            peerCount: h.relayCount,
            subscribedTopics: h.activeSubscriptions > 0 ? ['agent-discovery'] : [],
            lastActivityAt: h.lastEventAt,
        };
    }

    getClient(): NostrClient {
        return this.client;
    }

    getDiscoveredAgents(): AgentInfo[] {
        return Array.from(this.discoveredAgents.values());
    }

    private async startDiscovery(): Promise<void> {
        this.presenceSubscription = await this.client.subscribePresence({}, (event) => {
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
            } catch {}
        });
    }
}
