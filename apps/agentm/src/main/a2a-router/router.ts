/**
 * A2A Router
 *
 * Unified routing layer for multi-protocol A2A communication
 *
 * @module a2a-router/router
 */

import { NostrAdapter } from './adapters/nostr-adapter.js';
import { XMTPAdapter } from './adapters/xmtp-adapter.js';
import { ROUTER_CONFIG, A2A_ERROR_CODES } from './constants.js';
import type {
    A2ARouterOptions,
    ProtocolAdapter,
    ProtocolType,
    ProtocolPriority,
    A2AIntent,
    A2AMessage,
    A2AResult,
    AgentInfo,
    AgentFilter,
    RouterHealthStatus,
    ProtocolHealthStatus,
} from '../../shared/a2a-router-types.js';

export class A2ARouter {
    private adapters: Map<ProtocolType, ProtocolAdapter> = new Map();
    private options: Required<A2ARouterOptions>;
    private initialized = false;
    private healthCheckInterval?: NodeJS.Timeout;
    private messageHandlers: ((message: A2AMessage) => void | Promise<void>)[] = [];
    private lastError?: string;

    constructor(options: A2ARouterOptions = {}) {
        const protocolPriority = options.protocolPriority ?? {
            broadcast: ['nostr'],
            discovery: ['nostr'],
            direct_message: ['xmtp', 'nostr'],
            task_negotiation: ['xmtp', 'nostr'],
            interop: ['google-a2a'],
        };

        this.options = {
            enableNostr: options.enableNostr ?? true,
            nostrOptions: options.nostrOptions ?? {},
            googleA2AOptions: options.googleA2AOptions ?? {},
            agentId: options.agentId ?? 'unknown',
            protocolPriority,
            healthCheckInterval: options.healthCheckInterval ?? ROUTER_CONFIG.HEALTH_CHECK_INTERVAL_MS,
            messageTimeout: options.messageTimeout ?? ROUTER_CONFIG.MESSAGE_TIMEOUT_MS,
            enableXMTP: options.enableXMTP ?? true,
            xmtpOptions: options.xmtpOptions ?? {},
        };
    }

    // ============ Lifecycle ============

    async initialize(): Promise<void> {
        if (this.initialized) {
            throw new Error('[A2ARouter] Already initialized');
        }

        // Initialize enabled adapters
        if (this.options.enableNostr) {
            const nostrAdapter = new NostrAdapter(this.options.nostrOptions);
            await nostrAdapter.initialize();
            this.adapters.set('nostr', nostrAdapter);
            console.log('[A2ARouter] Nostr adapter initialized');
        }

        // Initialize XMTP adapter
        if (this.options.enableXMTP) {
            const xmtpAdapter = new XMTPAdapter(this.options.xmtpOptions);
            await xmtpAdapter.initialize();
            this.adapters.set('xmtp', xmtpAdapter);
            console.log('[A2ARouter] XMTP adapter initialized');
        }

        // Start health check
        this.startHealthCheck();

        this.initialized = true;
        console.log('[A2ARouter] Initialized with protocols:', Array.from(this.adapters.keys()));
    }

    async shutdown(): Promise<void> {
        if (!this.initialized) {
            return;
        }

        // Stop health check
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = undefined;
        }

        // Shutdown all adapters
        for (const [protocol, adapter] of this.adapters) {
            try {
                await adapter.shutdown();
                console.log(`[A2ARouter] ${protocol} adapter shutdown`);
            } catch (error) {
                console.error(`[A2ARouter] Failed to shutdown ${protocol} adapter:`, error);
            }
        }

        this.adapters.clear();
        this.initialized = false;
        this.messageHandlers = [];

        console.log('[A2ARouter] Shutdown');
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    // ============ Messaging ============

    async send(intent: A2AIntent): Promise<A2AResult> {
        this.ensureInitialized();

        const message: A2AMessage = {
            id: crypto.randomUUID(),
            from: this.getOwnAddress(),
            to: intent.to,
            type: intent.type,
            timestamp: Date.now(),
            payload: intent.payload,
        };

        // Select protocol
        const protocol = intent.preferredProtocol ?? this.selectProtocol('direct_message');

        if (!protocol) {
            return {
                success: false,
                messageId: message.id,
                protocol: 'nostr', // fallback
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

        // Send with timeout
        const timeout = intent.timeout ?? this.options.messageTimeout;
        const result = await this.withTimeout(
            adapter.send(message),
            timeout,
            `Message timeout after ${timeout}ms`
        );

        return result;
    }

    async subscribe(
        handler: (message: A2AMessage) => void | Promise<void>
    ): Promise<() => Promise<void>> {
        this.ensureInitialized();

        this.messageHandlers.push(handler);

        // Subscribe on all adapters
        const unsubscribes: (() => Promise<void>)[] = [];

        for (const [protocol, adapter] of this.adapters) {
            try {
                const subscription = await adapter.subscribe((message) => {
                    // Add protocol info
                    message.protocol = protocol;
                    handler(message);
                });

                unsubscribes.push(subscription.unsubscribe);
            } catch (error) {
                console.error(`[A2ARouter] Failed to subscribe on ${protocol}:`, error);
            }
        }

        // Return unsubscribe function
        return async () => {
            const index = this.messageHandlers.indexOf(handler);
            if (index > -1) {
                this.messageHandlers.splice(index, 1);
            }

            for (const unsubscribe of unsubscribes) {
                try {
                    await unsubscribe();
                } catch (error) {
                    console.error('[A2ARouter] Unsubscribe error:', error);
                }
            }
        };
    }

    // ============ Discovery ============

    async discoverAgents(filter?: AgentFilter): Promise<AgentInfo[]> {
        this.ensureInitialized();

        const allAgents: AgentInfo[] = [];
        const seenAddresses = new Set<string>();

        // Query all adapters
        for (const [protocol, adapter] of this.adapters) {
            try {
                const agents = await adapter.discoverAgents(filter);
                for (const agent of agents) {
                    if (!seenAddresses.has(agent.address)) {
                        seenAddresses.add(agent.address);
                        allAgents.push(agent);
                    }
                }
            } catch (error) {
                console.error(`[A2ARouter] Failed to discover on ${protocol}:`, error);
            }
        }

        return allAgents;
    }

    async broadcastCapabilities(agentInfo: AgentInfo): Promise<void> {
        this.ensureInitialized();

        // Broadcast on all adapters
        for (const [protocol, adapter] of this.adapters) {
            try {
                await adapter.broadcastCapabilities(agentInfo);
            } catch (error) {
                console.error(`[A2ARouter] Failed to broadcast on ${protocol}:`, error);
            }
        }
    }

    // ============ Health ============

    health(): RouterHealthStatus {
        const protocolStatus: Record<ProtocolType, ProtocolHealthStatus> = {
            nostr: { available: false, peerCount: 0, subscribedTopics: [] },
            xmtp: { available: false, peerCount: 0, subscribedTopics: [] },
            'cross-chain': { available: false, peerCount: 0, subscribedTopics: [] },
            layerzero: { available: false, peerCount: 0, subscribedTopics: [] },
            wormhole: { available: false, peerCount: 0, subscribedTopics: [] },
            debridge: { available: false, peerCount: 0, subscribedTopics: [] },
            'google-a2a': { available: false, peerCount: 0, subscribedTopics: [] },
        };

        let totalPeers = 0;

        for (const [protocol, adapter] of this.adapters) {
            const health = adapter.health();
            protocolStatus[protocol] = health;
            totalPeers += health.peerCount;
        }

        return {
            initialized: this.initialized,
            availableProtocols: Array.from(this.adapters.keys()),
            protocolStatus,
            totalPeers,
            activeSubscriptions: this.messageHandlers.length,
            lastError: this.lastError,
        };
    }

    // ============ Private Methods ============

    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('[A2ARouter] Not initialized. Call initialize() first.');
        }
    }

    private selectProtocol(priority: ProtocolPriority): ProtocolType | null {
        const priorityList = this.options.protocolPriority[priority];

        for (const protocol of priorityList) {
            const adapter = this.adapters.get(protocol);
            if (adapter?.isAvailable()) {
                return protocol;
            }
        }

        // Fallback to any available protocol
        for (const [protocol, adapter] of this.adapters) {
            if (adapter.isAvailable()) {
                return protocol;
            }
        }

        return null;
    }

    private startHealthCheck(): void {
        this.healthCheckInterval = setInterval(() => {
            for (const [protocol, adapter] of this.adapters) {
                const health = adapter.health();
                if (!health.available) {
                    console.warn(`[A2ARouter] ${protocol} adapter is unhealthy`);
                }
            }
        }, this.options.healthCheckInterval);
    }

    private async withTimeout<T>(
        promise: Promise<T>,
        timeoutMs: number,
        errorMessage: string
    ): Promise<T> {
        return Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
            }),
        ]);
    }

    private getOwnAddress(): string {
        // This should return the agent's Solana address
        // For now, return a placeholder based on available adapters
        for (const [protocol, adapter] of this.adapters) {
            if (protocol === 'nostr') {
                return (adapter as NostrAdapter)['client'].getPublicKey();
            }

        }
        return 'unknown';
    }
}
