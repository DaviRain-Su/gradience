/**
 * A2ARouter -- multi-protocol agent-to-agent communication.
 *
 * - Nostr: discovery + capability broadcast
 * - XMTP: direct messaging (E2E encrypted)
 */

import { NostrAdapter, type NostrAdapterOptions } from '@gradiences/nostr-adapter';
import {
    NOSTR_CONFIG,
    A2A_ERROR_CODES,
    type A2AMessage,
    type A2AResult,
    type A2AIntent,
    type AgentInfo,
    type AgentFilter,
    type ProtocolAdapter,
    type ProtocolType,
    type ProtocolPriority,
    type RouterHealthStatus,
    type ProtocolHealthStatus,
    type ProtocolSubscription,
    type A2ARouterOptions,
} from '@gradiences/a2a-types';
import { logger } from '../utils/logger.js';

export class A2ARouter {
    private adapters: Map<ProtocolType, ProtocolAdapter> = new Map();
    private initialized = false;
    private healthCheckInterval?: NodeJS.Timeout;
    private messageHandlers: ((message: A2AMessage) => void | Promise<void>)[] = [];
    private options: Required<Pick<A2ARouterOptions, 'enableNostr' | 'enableXMTP' | 'healthCheckInterval' | 'messageTimeout'>>;
    private nostrRelays: string[];
    private nostrPrivateKey?: string;
    private agentId: string;

    constructor(options: A2ARouterOptions = {}) {
        this.options = {
            enableNostr: options.enableNostr ?? true,
            enableXMTP: options.enableXMTP ?? false, // disabled by default until key is provided
            healthCheckInterval: options.healthCheckInterval ?? 30000,
            messageTimeout: options.messageTimeout ?? 30000,
        };
        this.nostrRelays = options.nostrRelays ?? [...NOSTR_CONFIG.DEFAULT_RELAYS];
        this.nostrPrivateKey = options.nostrPrivateKey;
        this.agentId = options.agentId ?? 'unknown';
    }

    // ============ Lifecycle ============

    async initialize(): Promise<void> {
        if (this.initialized) return;

        if (this.options.enableNostr) {
            try {
                const nostrOpts: NostrAdapterOptions = {
                    relays: this.nostrRelays,
                    privateKey: this.nostrPrivateKey,
                    autoDiscover: true,
                };
                const nostrAdapter = new NostrAdapter(nostrOpts);
                await nostrAdapter.initialize();
                this.adapters.set('nostr', nostrAdapter);
                logger.info({ relays: this.nostrRelays.length }, 'Nostr adapter initialized');
            } catch (err) {
                logger.warn({ err }, 'Nostr adapter failed to initialize, continuing without it');
            }
        }

        // XMTP requires a wallet private key -- skip if not configured
        // The @gradiences/xmtp-adapter package uses @xmtp/xmtp-js which needs
        // a wallet signer at connect time. For now, XMTP is opt-in.
        if (this.options.enableXMTP) {
            logger.info('XMTP adapter enabled but requires wallet signer at runtime');
        }

        this.startHealthCheck();
        this.initialized = true;
        logger.info({ protocols: Array.from(this.adapters.keys()) }, 'A2ARouter initialized');
    }

    async shutdown(): Promise<void> {
        if (!this.initialized) return;

        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = undefined;
        }

        for (const [protocol, adapter] of this.adapters) {
            try {
                await adapter.shutdown();
                logger.info({ protocol }, 'Adapter shutdown');
            } catch (err) {
                logger.error({ err, protocol }, 'Adapter shutdown failed');
            }
        }

        this.adapters.clear();
        this.initialized = false;
        this.messageHandlers = [];
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    // ============ Messaging ============

    async send(intent: A2AIntent): Promise<A2AResult> {
        this.ensureInitialized();

        const message: A2AMessage = {
            id: crypto.randomUUID(),
            from: this.agentId,
            to: intent.to,
            type: intent.type,
            timestamp: Date.now(),
            payload: intent.payload,
        };

        const protocol = intent.preferredProtocol ?? this.selectProtocol('direct_message');
        if (!protocol) {
            return {
                success: false,
                messageId: message.id,
                protocol: 'nostr',
                error: 'No available protocol',
                errorCode: A2A_ERROR_CODES.ROUTER_NO_PROTOCOL_AVAILABLE,
                timestamp: Date.now(),
            };
        }

        const adapter = this.adapters.get(protocol);
        if (!adapter) {
            return {
                success: false,
                messageId: message.id,
                protocol,
                error: `Protocol ${protocol} not available`,
                errorCode: A2A_ERROR_CODES.PROTOCOL_NOT_AVAILABLE,
                timestamp: Date.now(),
            };
        }

        return adapter.send(message);
    }

    async subscribe(
        handler: (message: A2AMessage) => void | Promise<void>
    ): Promise<() => Promise<void>> {
        this.ensureInitialized();
        this.messageHandlers.push(handler);

        const unsubscribes: (() => Promise<void>)[] = [];

        for (const [, adapter] of this.adapters) {
            try {
                const subscription = await adapter.subscribe((message) => {
                    handler(message);
                });
                unsubscribes.push(subscription.unsubscribe);
            } catch (err) {
                logger.error({ err }, 'Failed to subscribe on adapter');
            }
        }

        return async () => {
            const idx = this.messageHandlers.indexOf(handler);
            if (idx > -1) this.messageHandlers.splice(idx, 1);
            for (const unsub of unsubscribes) {
                try { await unsub(); } catch {}
            }
        };
    }

    // ============ Discovery ============

    async discoverAgents(filter?: AgentFilter): Promise<AgentInfo[]> {
        this.ensureInitialized();

        const allAgents: AgentInfo[] = [];
        const seenAddresses = new Set<string>();

        for (const [, adapter] of this.adapters) {
            try {
                const agents = await adapter.discoverAgents(filter);
                for (const agent of agents) {
                    if (!seenAddresses.has(agent.address)) {
                        seenAddresses.add(agent.address);
                        allAgents.push(agent);
                    }
                }
            } catch (err) {
                logger.error({ err }, 'Failed to discover agents');
            }
        }

        return allAgents;
    }

    async broadcastCapabilities(agentInfo: AgentInfo): Promise<void> {
        this.ensureInitialized();

        for (const [protocol, adapter] of this.adapters) {
            try {
                await adapter.broadcastCapabilities(agentInfo);
                logger.debug({ protocol }, 'Broadcasted capabilities');
            } catch (err) {
                logger.error({ err, protocol }, 'Failed to broadcast capabilities');
            }
        }
    }

    // ============ Health ============

    health(): RouterHealthStatus {
        const protocolStatus: Partial<Record<ProtocolType, ProtocolHealthStatus>> = {};
        let totalPeers = 0;

        for (const [protocol, adapter] of this.adapters) {
            const h = adapter.health();
            protocolStatus[protocol] = h;
            totalPeers += h.peerCount;
        }

        return {
            initialized: this.initialized,
            availableProtocols: Array.from(this.adapters.keys()),
            protocolStatus,
            totalPeers,
            activeSubscriptions: this.messageHandlers.length,
        };
    }

    // ============ Private ============

    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('[A2ARouter] Not initialized. Call initialize() first.');
        }
    }

    private selectProtocol(priority: ProtocolPriority): ProtocolType | null {
        const priorityMap: Record<ProtocolPriority, ProtocolType[]> = {
            broadcast: ['nostr'],
            discovery: ['nostr'],
            direct_message: ['xmtp', 'nostr'],
            task_negotiation: ['nostr', 'xmtp'],
            interop: ['google-a2a'],
        };
        const list = priorityMap[priority] ?? ['nostr'];

        for (const protocol of list) {
            const adapter = this.adapters.get(protocol);
            if (adapter?.isAvailable()) return protocol;
        }

        for (const [protocol, adapter] of this.adapters) {
            if (adapter.isAvailable()) return protocol;
        }

        return null;
    }

    private startHealthCheck(): void {
        this.healthCheckInterval = setInterval(() => {
            for (const [protocol, adapter] of this.adapters) {
                const h = adapter.health();
                if (!h.available) {
                    logger.debug({ protocol }, 'Adapter unhealthy');
                }
            }
        }, this.options.healthCheckInterval);
    }
}
