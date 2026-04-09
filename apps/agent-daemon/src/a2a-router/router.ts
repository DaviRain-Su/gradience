/**
 * A2ARouter -- multi-protocol agent-to-agent communication with production-grade features.
 *
 * - Nostr: discovery + capability broadcast
 * - XMTP: direct messaging (E2E encrypted)
 *
 * Production features:
 * - Circuit breaker for fault tolerance
 * - Rate limiting for traffic control
 * - Retry with exponential backoff
 * - Health monitoring
 * - Metrics collection
 * - Message validation
 */

import { NostrAdapter, type NostrAdapterOptions } from '@gradiences/nostr-adapter';
import { XMTPAdapter, type XMTPAdapterOptions, type WalletSigner } from '@gradiences/xmtp-adapter';
import {
    NOSTR_CONFIG,
    A2A_ERROR_CODES as BASE_A2A_ERROR_CODES,
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
import { A2A_ERROR_CODES as LOCAL_A2A_ERROR_CODES } from './constants.js';
import { logger } from '../utils/logger.js';

// Merge error codes
const A2A_ERROR_CODES = { ...BASE_A2A_ERROR_CODES, ...LOCAL_A2A_ERROR_CODES };

// Production-grade features
import { getCircuitBreakerRegistry, CircuitOpenError } from './circuit-breaker.js';
import { getRateLimiterRegistry, RateLimitError } from './rate-limiter.js';
import { getHealthMonitor, createProtocolHealthCheck, type SystemHealth } from './health-monitor.js';
import { getMetrics, A2A_METRICS, recordMessageSend, recordMessageReceive, initMetrics } from './metrics.js';
import { withRetry, DEFAULT_RETRY_POLICY, type RetryPolicy } from './error-recovery.js';
import { validateA2AMessage } from './validation.js';

export interface A2ARouterEnhancedOptions extends A2ARouterOptions {
    /** Enable circuit breaker (default: true) */
    enableCircuitBreaker?: boolean;
    /** Enable rate limiting (default: true) */
    enableRateLimiting?: boolean;
    /** Enable retry with backoff (default: true) */
    enableRetry?: boolean;
    /** Enable message validation (default: true) */
    enableValidation?: boolean;
    /** Enable metrics collection (default: true) */
    enableMetrics?: boolean;
    /** Enable health monitoring (default: true) */
    enableHealthMonitor?: boolean;
    /** Retry policy configuration */
    retryPolicy?: RetryPolicy;
}

export class A2ARouter {
    private adapters: Map<ProtocolType, ProtocolAdapter> = new Map();
    private initialized = false;
    private healthCheckInterval?: NodeJS.Timeout;
    private messageHandlers: ((message: A2AMessage) => void | Promise<void>)[] = [];
    private options: Required<
        Pick<
            A2ARouterEnhancedOptions,
            | 'enableNostr'
            | 'enableXMTP'
            | 'healthCheckInterval'
            | 'messageTimeout'
            | 'enableCircuitBreaker'
            | 'enableRateLimiting'
            | 'enableRetry'
            | 'enableValidation'
            | 'enableMetrics'
            | 'enableHealthMonitor'
        >
    >;
    private retryPolicy: RetryPolicy;
    private nostrRelays: string[];
    private nostrPrivateKey?: string;
    private xmtpEnv?: 'production' | 'dev';
    private xmtpWalletSigner?: {
        getAddress(): Promise<string>;
        signMessage(message: string | Uint8Array): Promise<string>;
    };
    private agentId: string;

    // Production-grade components
    private circuitBreakerRegistry = getCircuitBreakerRegistry();
    private rateLimiterRegistry = getRateLimiterRegistry();
    private healthMonitor = getHealthMonitor();
    private metrics = getMetrics();

    constructor(options: A2ARouterEnhancedOptions = {}) {
        this.options = {
            enableNostr: options.enableNostr ?? true,
            enableXMTP: options.enableXMTP ?? false,
            healthCheckInterval: options.healthCheckInterval ?? 30000,
            messageTimeout: options.messageTimeout ?? 30000,
            enableCircuitBreaker: options.enableCircuitBreaker ?? true,
            enableRateLimiting: options.enableRateLimiting ?? true,
            enableRetry: options.enableRetry ?? true,
            enableValidation: options.enableValidation ?? true,
            enableMetrics: options.enableMetrics ?? true,
            enableHealthMonitor: options.enableHealthMonitor ?? true,
        };
        this.retryPolicy = options.retryPolicy ?? DEFAULT_RETRY_POLICY;
        this.nostrRelays = options.nostrRelays ?? [...NOSTR_CONFIG.DEFAULT_RELAYS];
        this.nostrPrivateKey = options.nostrPrivateKey;
        this.xmtpEnv = options.xmtpEnv;
        this.xmtpWalletSigner = options.xmtpWalletSigner;
        this.agentId = options.agentId ?? 'unknown';

        // Initialize metrics
        if (this.options.enableMetrics) {
            initMetrics();
        }

        // Set up health monitor router integration
        if (this.options.enableHealthMonitor) {
            this.healthMonitor.setRouterHealthFn(() => this.health());
        }
    }

    // ============ Lifecycle ============

    async initialize(): Promise<void> {
        if (this.initialized) return;

        if (this.options.enableNostr) {
            try {
                await this.initializeNostrAdapter();
            } catch (err) {
                logger.warn({ err }, 'Nostr adapter failed to initialize, continuing without it');
            }
        }

        // XMTP requires a wallet signer for identity
        if (this.options.enableXMTP && this.xmtpWalletSigner) {
            try {
                await this.initializeXMTPAdapter();
            } catch (err) {
                logger.warn({ err }, 'XMTP adapter failed to initialize');
            }
        } else if (this.options.enableXMTP) {
            logger.info('XMTP enabled but no wallet signer provided, skipping');
        }

        // Start health monitoring
        if (this.options.enableHealthMonitor) {
            this.startHealthMonitoring();
        }

        this.startHealthCheck();
        this.initialized = true;

        // Update router up metric
        this.metrics.set(A2A_METRICS.ROUTER_UP, 1);

        logger.info({ protocols: Array.from(this.adapters.keys()) }, 'A2ARouter initialized');
    }

    private async initializeNostrAdapter(): Promise<void> {
        const nostrOpts: NostrAdapterOptions = {
            relays: this.nostrRelays,
            privateKey: this.nostrPrivateKey,
            autoDiscover: true,
        };

        const adapter = new NostrAdapter(nostrOpts);

        // Wrap initialization with circuit breaker if enabled
        if (this.options.enableCircuitBreaker) {
            const breaker = this.circuitBreakerRegistry.forProtocol('nostr');
            await breaker.execute(() => adapter.initialize());
        } else {
            await adapter.initialize();
        }

        this.adapters.set('nostr', adapter);

        // Register protocol health check
        if (this.options.enableHealthMonitor) {
            this.healthMonitor.registerCheck({
                name: 'protocol:nostr',
                check: createProtocolHealthCheck('nostr', () => adapter.health()),
                intervalMs: 30000,
                timeoutMs: 5000,
                critical: false,
            });
        }

        logger.info({ relays: this.nostrRelays.length }, 'Nostr adapter initialized');
    }

    private async initializeXMTPAdapter(): Promise<void> {
        const xmtpOpts: XMTPAdapterOptions = {
            env: this.xmtpEnv ?? 'dev',
            walletSigner: this.xmtpWalletSigner,
            enableStreaming: true,
        };

        const adapter = new XMTPAdapter(xmtpOpts);

        // Wrap initialization with circuit breaker if enabled
        if (this.options.enableCircuitBreaker) {
            const breaker = this.circuitBreakerRegistry.forProtocol('xmtp');
            await breaker.execute(() => adapter.initialize());
        } else {
            await adapter.initialize();
        }

        this.adapters.set('xmtp', adapter);

        // Register protocol health check
        if (this.options.enableHealthMonitor) {
            this.healthMonitor.registerCheck({
                name: 'protocol:xmtp',
                check: createProtocolHealthCheck('xmtp', () => adapter.health()),
                intervalMs: 30000,
                timeoutMs: 5000,
                critical: false,
            });
        }

        logger.info({ env: this.xmtpEnv }, 'XMTP adapter initialized');
    }

    async shutdown(): Promise<void> {
        if (!this.initialized) return;

        // Stop health monitoring
        if (this.options.enableHealthMonitor) {
            this.healthMonitor.stop();
        }

        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = undefined;
        }

        await Promise.all(
            Array.from(this.adapters.entries()).map(async ([protocol, adapter]) => {
                try {
                    await adapter.shutdown();
                    logger.info({ protocol }, 'Adapter shutdown');
                } catch (err) {
                    logger.error({ err, protocol }, 'Adapter shutdown failed');
                }
            }),
        );

        this.adapters.clear();
        this.initialized = false;
        this.messageHandlers = [];

        // Update router up metric
        this.metrics.set(A2A_METRICS.ROUTER_UP, 0);
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    // ============ Messaging ============

    async send(intent: A2AIntent): Promise<A2AResult> {
        this.ensureInitialized();

        const startTime = Date.now();

        // Validate intent if enabled
        if (this.options.enableValidation) {
            const validation = this.validateIntent(intent);
            if (!validation.valid) {
                return {
                    success: false,
                    messageId: '',
                    protocol: 'nostr',
                    error: validation.error,
                    errorCode: A2A_ERROR_CODES.INVALID_INTENT,
                    timestamp: Date.now(),
                };
            }
        }

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
            const result: A2AResult = {
                success: false,
                messageId: message.id,
                protocol: 'nostr',
                error: 'No available protocol',
                errorCode: A2A_ERROR_CODES.ROUTER_NO_PROTOCOL_AVAILABLE,
                timestamp: Date.now(),
            };
            recordMessageSend('none', false, Date.now() - startTime);
            return result;
        }

        const adapter = this.adapters.get(protocol);
        if (!adapter) {
            const result: A2AResult = {
                success: false,
                messageId: message.id,
                protocol,
                error: `Protocol ${protocol} not available`,
                errorCode: A2A_ERROR_CODES.PROTOCOL_NOT_AVAILABLE,
                timestamp: Date.now(),
            };
            recordMessageSend(protocol, false, Date.now() - startTime);
            return result;
        }

        try {
            // Apply rate limiting if enabled
            if (this.options.enableRateLimiting) {
                const limiter = this.rateLimiterRegistry.forProtocol(protocol);
                await limiter.tryExecute(async () => {
                    // Execution continues after rate limit check
                });
            }

            // Execute send with circuit breaker and retry
            const result = await this.executeSend(adapter, message, protocol);

            // Record metrics
            const latencyMs = Date.now() - startTime;
            recordMessageSend(protocol, result.success, latencyMs);

            return result;
        } catch (error) {
            const latencyMs = Date.now() - startTime;
            recordMessageSend(protocol, false, latencyMs);

            if (error instanceof CircuitOpenError) {
                return {
                    success: false,
                    messageId: message.id,
                    protocol,
                    error: `Circuit breaker open: ${error.message}`,
                    errorCode: A2A_ERROR_CODES.PROTOCOL_NOT_AVAILABLE,
                    timestamp: Date.now(),
                };
            }

            if (error instanceof RateLimitError) {
                return {
                    success: false,
                    messageId: message.id,
                    protocol,
                    error: `Rate limited: ${error.message}`,
                    errorCode: A2A_ERROR_CODES.INTENT_TIMEOUT,
                    timestamp: Date.now(),
                };
            }

            throw error;
        }
    }

    private async executeSend(
        adapter: ProtocolAdapter,
        message: A2AMessage,
        protocol: ProtocolType,
    ): Promise<A2AResult> {
        const sendOperation = async () => adapter.send(message);

        // Apply circuit breaker if enabled
        let operation = sendOperation;
        if (this.options.enableCircuitBreaker) {
            const breaker = this.circuitBreakerRegistry.forProtocol(protocol);
            const wrappedOperation = operation;
            operation = () => breaker.execute(wrappedOperation);
        }

        // Apply retry if enabled
        if (this.options.enableRetry) {
            const wrappedOperation = operation;
            operation = async () => {
                const result = await withRetry(async () => wrappedOperation(), this.retryPolicy);
                if (!result.success) {
                    throw result.error ?? new Error('Send failed after retries');
                }
                return result.value!;
            };
        }

        return operation();
    }

    async subscribe(handler: (message: A2AMessage) => void | Promise<void>): Promise<() => Promise<void>> {
        this.ensureInitialized();
        this.messageHandlers.push(handler);

        // Update active subscriptions metric
        this.metrics.set(A2A_METRICS.ACTIVE_SUBSCRIPTIONS, this.messageHandlers.length);

        const unsubscribes: (() => Promise<void>)[] = [];

        await Promise.all(
            Array.from(this.adapters.entries()).map(async ([protocol, adapter]) => {
                try {
                    const subscription = await adapter.subscribe((message) => {
                        // Validate incoming message if enabled
                        if (this.options.enableValidation) {
                            const validation = validateA2AMessage(message);
                            if (!validation.valid) {
                                logger.warn(
                                    { error: validation.error, messageId: message.id },
                                    'Invalid message received',
                                );
                                return;
                            }
                        }

                        // Record receive metric
                        recordMessageReceive(protocol);

                        handler(message);
                    });
                    unsubscribes.push(subscription.unsubscribe);
                } catch (err) {
                    logger.error({ err, protocol }, 'Failed to subscribe on adapter');
                }
            }),
        );

        return async () => {
            const idx = this.messageHandlers.indexOf(handler);
            if (idx > -1) this.messageHandlers.splice(idx, 1);

            // Update active subscriptions metric
            this.metrics.set(A2A_METRICS.ACTIVE_SUBSCRIPTIONS, this.messageHandlers.length);

            for (const unsub of unsubscribes) {
                try {
                    await unsub();
                } catch {}
            }
        };
    }

    // ============ Discovery ============

    async discoverAgents(filter?: AgentFilter): Promise<AgentInfo[]> {
        this.ensureInitialized();

        const allAgents: AgentInfo[] = [];
        const seenAddresses = new Set<string>();

        await Promise.all(
            Array.from(this.adapters.values()).map(async (adapter) => {
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
            }),
        );

        // Update discovered agents metric
        this.metrics.set(A2A_METRICS.DISCOVERED_AGENTS, allAgents.length);

        return allAgents;
    }

    async broadcastCapabilities(agentInfo: AgentInfo): Promise<void> {
        this.ensureInitialized();

        await Promise.all(
            Array.from(this.adapters.entries()).map(async ([protocol, adapter]) => {
                try {
                    // Apply rate limiting
                    if (this.options.enableRateLimiting) {
                        const limiter = this.rateLimiterRegistry.forProtocol(protocol);
                        await limiter.tryExecute(async () => {
                            await adapter.broadcastCapabilities(agentInfo);
                        });
                    } else {
                        await adapter.broadcastCapabilities(agentInfo);
                    }

                    logger.debug({ protocol }, 'Broadcasted capabilities');
                } catch (err) {
                    logger.error({ err, protocol }, 'Failed to broadcast capabilities');
                }
            }),
        );
    }

    // ============ Health ============

    health(): RouterHealthStatus {
        const protocolStatus: Partial<Record<ProtocolType, ProtocolHealthStatus>> = {};
        let totalPeers = 0;

        Array.from(this.adapters.entries()).forEach(([protocol, adapter]) => {
            const h = adapter.health();
            protocolStatus[protocol] = h;
            totalPeers += h.peerCount;
        });

        return {
            initialized: this.initialized,
            availableProtocols: Array.from(this.adapters.keys()),
            protocolStatus,
            totalPeers,
            activeSubscriptions: this.messageHandlers.length,
        };
    }

    /**
     * Get detailed system health including circuit breakers and rate limiters
     */
    getSystemHealth(): SystemHealth {
        return this.healthMonitor.getHealth();
    }

    // ============ Metrics ============

    /**
     * Get Prometheus-formatted metrics
     */
    getMetrics(): string {
        return this.metrics.export();
    }

    /**
     * Get metrics as JSON
     */
    getMetricsJSON(): Record<string, unknown> {
        return this.metrics.exportJSON();
    }

    // ============ Private ============

    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('[A2ARouter] Not initialized. Call initialize() first.');
        }
    }

    private validateIntent(intent: A2AIntent): { valid: boolean; error?: string } {
        if (!intent.to) {
            return { valid: false, error: 'Recipient address is required' };
        }
        if (!intent.type) {
            return { valid: false, error: 'Message type is required' };
        }
        return { valid: true };
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

        const availableAdapter = Array.from(this.adapters.entries()).find(([, adapter]) => adapter.isAvailable());
        if (availableAdapter) return availableAdapter[0];

        return null;
    }

    private startHealthCheck(): void {
        this.healthCheckInterval = setInterval(() => {
            Array.from(this.adapters.entries()).forEach(([protocol, adapter]) => {
                const h = adapter.health();
                if (!h.available) {
                    logger.debug({ protocol }, 'Adapter unhealthy');
                }
            });
        }, this.options.healthCheckInterval);
    }

    private startHealthMonitoring(): void {
        // Register memory health check
        this.healthMonitor.registerCheck({
            name: 'memory',
            check: async () => {
                const memUsage = process.memoryUsage();
                const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
                const thresholdMB = 512;

                const status =
                    heapUsedMB > thresholdMB * 1.5 ? 'unhealthy' : heapUsedMB > thresholdMB ? 'degraded' : 'healthy';

                return {
                    name: 'memory',
                    status,
                    responseTimeMs: 0,
                    lastCheckedAt: Date.now(),
                    details: {
                        heapUsedMB: Math.round(heapUsedMB * 100) / 100,
                        thresholdMB,
                    },
                };
            },
            intervalMs: 60000,
            timeoutMs: 5000,
            critical: false,
        });

        this.healthMonitor.start();
        logger.info('Health monitoring started');
    }
}
