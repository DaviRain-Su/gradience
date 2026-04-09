/**
 * Google A2A (Agent2Agent) Protocol Adapter
 *
 * Implements the Google Agent2Agent open protocol for cross-framework
 * agent interoperability. Enables Gradience agents to communicate with
 * any A2A-compatible agent (LangChain, CrewAI, AutoGen, etc.)
 *
 * Google A2A Spec: https://github.com/a2aproject/A2A
 *
 * Key concepts:
 * - Agent Card: JSON at /.well-known/agent.json describing capabilities
 * - Tasks: JSON-RPC lifecycle (submitted → working → input-required → done)
 * - Streaming: SSE for real-time task updates
 * - Push notifications: Webhook-based delivery
 *
 * Mapping to Gradience:
 * - Agent Card ↔ Chain Hub Profile
 * - A2A Task ↔ Gradience Task (post_task / submit_result / settle)
 * - A2A Message ↔ A2AMessage (direct_message / task_proposal)
 *
 * @module google-a2a-adapter/google-a2a-adapter
 */

import { A2A_ERROR_CODES } from '@gradiences/a2a-types';
import type {
    ProtocolAdapter,
    ProtocolSubscription,
    A2AMessage,
    A2AMessageType,
    A2AResult,
    AgentInfo,
    AgentFilter,
    ProtocolHealthStatus,
} from '@gradiences/a2a-types';
import { GOOGLE_A2A_CONFIG, GOOGLE_A2A_ERROR_CODES } from './constants.js';

// ============ Google A2A Types ============

/** Google A2A Agent Card (/.well-known/agent.json) */
export interface GoogleA2AAgentCard {
    /** Agent name */
    name: string;
    /** Agent description */
    description: string;
    /** Agent endpoint URL (JSON-RPC) */
    url: string;
    /** Agent version */
    version?: string;
    /** Supported capabilities (skills) */
    capabilities: GoogleA2ACapability[];
    /** Supported authentication methods */
    authentication?: {
        schemes: string[];
        credentials?: string;
    };
    /** Default input/output modes */
    defaultInputModes?: string[];
    defaultOutputModes?: string[];
    /** Provider info */
    provider?: {
        organization: string;
        url?: string;
    };
    /** Gradience-specific extensions */
    'x-gradience'?: {
        solanaAddress: string;
        reputationScore: number;
        chainHubProfileId?: string;
        protocolVersion: string;
    };
}

/** Google A2A capability/skill definition */
export interface GoogleA2ACapability {
    /** Skill ID */
    id: string;
    /** Skill name */
    name: string;
    /** Skill description */
    description: string;
    /** Input schema (JSON Schema) */
    inputSchema?: Record<string, unknown>;
    /** Output schema (JSON Schema) */
    outputSchema?: Record<string, unknown>;
    /** Tags for filtering */
    tags?: string[];
}

/** Google A2A Task states */
export type GoogleA2ATaskState =
    | 'submitted'
    | 'working'
    | 'input-required'
    | 'completed'
    | 'canceled'
    | 'failed'
    | 'unknown';

/** Google A2A Task */
export interface GoogleA2ATask {
    id: string;
    sessionId?: string;
    status: {
        state: GoogleA2ATaskState;
        message?: {
            role: 'user' | 'agent';
            parts: Array<{ type: 'text'; text: string } | { type: 'data'; data: unknown }>;
        };
        timestamp?: string;
    };
    artifacts?: Array<{
        name?: string;
        description?: string;
        parts: Array<{ type: 'text'; text: string } | { type: 'data'; data: unknown }>;
    }>;
    metadata?: Record<string, unknown>;
}

/** Google A2A JSON-RPC request */
interface GoogleA2AJsonRpcRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: string;
    params?: Record<string, unknown>;
}

/** Google A2A JSON-RPC response */
interface GoogleA2AJsonRpcResponse {
    jsonrpc: '2.0';
    id: string | number;
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}

// ============ Adapter Options ============

export interface GoogleA2AAdapterOptions {
    /** This agent's Agent Card metadata */
    agentCard?: Partial<GoogleA2AAgentCard>;
    /** URL where this agent's Agent Card is hosted */
    agentCardUrl?: string;
    /** Port for local JSON-RPC server (0 = disabled) */
    serverPort?: number;
    /** Known peer Agent Card URLs */
    knownPeers?: string[];
    /** HTTP request timeout (ms) */
    requestTimeout?: number;
    /** Solana address of this agent */
    solanaAddress?: string;
    /** Reputation score to advertise */
    reputationScore?: number;
}

// ============ Gradience ↔ Google A2A Mapping ============

/** Map Gradience message type to Google A2A method */
function gradienceTypeToA2AMethod(type: string): string {
    switch (type) {
        case 'task_proposal':
            return 'tasks/send';
        case 'task_accept':
        case 'task_reject':
        case 'task_counter':
            return 'tasks/send'; // task response as message
        case 'capability_query':
            return 'tasks/send'; // capability query as task
        case 'direct_message':
            return 'tasks/send'; // wrap in task
        default:
            return 'tasks/send';
    }
}

/** Map Google A2A task state to Gradience message type */
function a2aStateToGradienceType(state: GoogleA2ATaskState): A2AMessageType {
    switch (state) {
        case 'submitted':
            return 'task_proposal';
        case 'working':
            return 'task_accept';
        case 'completed':
            return 'payment_confirm';
        case 'canceled':
        case 'failed':
            return 'task_reject';
        default:
            return 'direct_message';
    }
}

// ============ Adapter Implementation ============

export class GoogleA2AAdapter implements ProtocolAdapter {
    readonly protocol = 'google-a2a' as const;
    private options: GoogleA2AAdapterOptions;
    private discoveredAgents: Map<string, AgentInfo> = new Map();
    private discoveredCards: Map<string, GoogleA2AAgentCard> = new Map();
    private messageHandler?: (message: A2AMessage) => void | Promise<void>;
    private pollInterval?: ReturnType<typeof setInterval>;
    private initialized = false;
    private lastActivityAt?: number;

    constructor(options: GoogleA2AAdapterOptions = {}) {
        this.options = {
            requestTimeout: GOOGLE_A2A_CONFIG.TIMEOUTS.REQUEST,
            serverPort: 0,
            knownPeers: [],
            ...options,
        };
    }

    // ============ Lifecycle ============

    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Discover known peers on startup
        if (this.options.knownPeers && this.options.knownPeers.length > 0) {
            await this.discoverFromKnownPeers();
        }

        this.initialized = true;
        console.log('[GoogleA2AAdapter] Initialized', {
            knownPeers: this.options.knownPeers?.length ?? 0,
            serverPort: this.options.serverPort,
        });
    }

    async shutdown(): Promise<void> {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = undefined;
        }

        this.discoveredAgents.clear();
        this.discoveredCards.clear();
        this.messageHandler = undefined;
        this.initialized = false;

        console.log('[GoogleA2AAdapter] Shutdown');
    }

    isAvailable(): boolean {
        return this.initialized;
    }

    // ============ Messaging ============

    async send(message: A2AMessage): Promise<A2AResult> {
        try {
            // Find the recipient's A2A endpoint
            const endpoint = await this.resolveEndpoint(message.to);
            if (!endpoint) {
                return {
                    success: false,
                    messageId: message.id,
                    protocol: 'google-a2a',
                    error: `No Google A2A endpoint found for ${message.to}`,
                    errorCode: A2A_ERROR_CODES.PROTOCOL_NOT_AVAILABLE,
                    timestamp: Date.now(),
                };
            }

            // Build Google A2A JSON-RPC request
            const rpcRequest: GoogleA2AJsonRpcRequest = {
                jsonrpc: '2.0',
                id: message.id,
                method: gradienceTypeToA2AMethod(message.type),
                params: {
                    id: message.id,
                    sessionId: `gradience-${message.from}-${Date.now()}`,
                    message: {
                        role: 'user',
                        parts: [
                            {
                                type: 'text',
                                text:
                                    typeof message.payload === 'string'
                                        ? message.payload
                                        : JSON.stringify(message.payload),
                            },
                        ],
                    },
                    metadata: {
                        'x-gradience-from': message.from,
                        'x-gradience-type': message.type,
                        'x-gradience-timestamp': message.timestamp,
                        'x-gradience-protocol': 'gradience-a2a-bridge/v1',
                    },
                },
            };

            // Send JSON-RPC request
            const controller = new AbortController();
            const timeout = setTimeout(
                () => controller.abort(),
                this.options.requestTimeout ?? GOOGLE_A2A_CONFIG.TIMEOUTS.REQUEST,
            );

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify(rpcRequest),
                    signal: controller.signal,
                });

                clearTimeout(timeout);

                if (!response.ok) {
                    return {
                        success: false,
                        messageId: message.id,
                        protocol: 'google-a2a',
                        error: `HTTP ${response.status}: ${response.statusText}`,
                        errorCode: A2A_ERROR_CODES.PROTOCOL_SEND_FAILED,
                        timestamp: Date.now(),
                    };
                }

                const rpcResponse = (await response.json()) as GoogleA2AJsonRpcResponse;

                if (rpcResponse.error) {
                    return {
                        success: false,
                        messageId: message.id,
                        protocol: 'google-a2a',
                        error: rpcResponse.error.message,
                        errorCode: GOOGLE_A2A_ERROR_CODES.RPC_ERROR,
                        timestamp: Date.now(),
                    };
                }

                this.lastActivityAt = Date.now();

                return {
                    success: true,
                    messageId: message.id,
                    protocol: 'google-a2a',
                    timestamp: Date.now(),
                };
            } finally {
                clearTimeout(timeout);
            }
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            return {
                success: false,
                messageId: message.id,
                protocol: 'google-a2a',
                error: err.message,
                errorCode: A2A_ERROR_CODES.PROTOCOL_SEND_FAILED,
                timestamp: Date.now(),
            };
        }
    }

    async subscribe(handler: (message: A2AMessage) => void | Promise<void>): Promise<ProtocolSubscription> {
        this.messageHandler = handler;

        // Poll known peers for task updates (simple polling strategy)
        // In production, use SSE or webhooks per Google A2A spec
        this.pollInterval = setInterval(() => {
            this.pollPeersForUpdates().catch((err) => {
                console.error('[GoogleA2AAdapter] Poll error:', err);
            });
        }, GOOGLE_A2A_CONFIG.TIMEOUTS.POLL_INTERVAL);

        const subscription: ProtocolSubscription = {
            protocol: 'google-a2a',
            unsubscribe: async () => {
                if (this.pollInterval) {
                    clearInterval(this.pollInterval);
                    this.pollInterval = undefined;
                }
                this.messageHandler = undefined;
            },
        };

        return subscription;
    }

    // ============ Discovery ============

    async discoverAgents(filter?: AgentFilter): Promise<AgentInfo[]> {
        // Re-fetch known peers
        await this.discoverFromKnownPeers();

        let agents = Array.from(this.discoveredAgents.values());

        // Apply filters
        if (filter?.capabilities) {
            agents = agents.filter((a) => filter.capabilities!.some((c) => a.capabilities.includes(c)));
        }
        if (filter?.minReputation) {
            agents = agents.filter((a) => a.reputationScore >= filter.minReputation!);
        }
        if (filter?.availableOnly) {
            agents = agents.filter((a) => a.available);
        }
        if (filter?.limit) {
            agents = agents.slice(0, filter.limit);
        }

        return agents;
    }

    async broadcastCapabilities(agentInfo: AgentInfo): Promise<void> {
        // In Google A2A, capabilities are published via Agent Card
        // The Agent Card is hosted at a well-known URL
        // Here we just update our local card representation
        console.log('[GoogleA2AAdapter] Agent Card updated for', agentInfo.address);

        // The actual hosting of /.well-known/agent.json should be done
        // by the Agent Daemon's HTTP server
    }

    /** Generate this agent's Agent Card for hosting */
    generateAgentCard(agentInfo: AgentInfo): GoogleA2AAgentCard {
        const baseCard = this.options.agentCard ?? {};
        return {
            name: baseCard.name ?? agentInfo.displayName,
            description: baseCard.description ?? `Gradience Agent: ${agentInfo.displayName}`,
            url: this.options.agentCardUrl ?? `http://localhost:${this.options.serverPort ?? 3000}`,
            version: '1.0.0',
            capabilities: agentInfo.capabilities.map((cap) => ({
                id: cap.toLowerCase().replace(/\s+/g, '-'),
                name: cap,
                description: `${cap} capability`,
                tags: ['gradience'],
            })),
            authentication: {
                schemes: ['bearer'],
            },
            defaultInputModes: ['text/plain', 'application/json'],
            defaultOutputModes: ['text/plain', 'application/json'],
            provider: {
                organization: 'Gradience Protocol',
                url: 'https://gradiences.xyz',
            },
            'x-gradience': {
                solanaAddress: agentInfo.address,
                reputationScore: agentInfo.reputationScore,
                protocolVersion: '0.1.0',
            },
            ...baseCard,
        };
    }

    /**
     * Handle an incoming Google A2A JSON-RPC request
     * (called by the Agent Daemon HTTP server)
     */
    async handleIncomingRequest(request: GoogleA2AJsonRpcRequest): Promise<GoogleA2AJsonRpcResponse> {
        const { method, params, id } = request;

        switch (method) {
            case 'tasks/send': {
                const task = params as unknown as GoogleA2ATask;
                const messageParts = task?.status?.message?.parts ?? [];
                const textPart = messageParts.find((p) => p.type === 'text');
                const metadata = (params?.metadata ?? {}) as Record<string, unknown>;

                // Convert to Gradience A2AMessage
                const message: A2AMessage = {
                    id: (task?.id ?? id) as string,
                    from: (metadata['x-gradience-from'] as string) ?? 'unknown',
                    to: this.options.solanaAddress ?? 'self',
                    type: a2aStateToGradienceType(task?.status?.state ?? 'submitted'),
                    timestamp: Date.now(),
                    payload: textPart && 'text' in textPart ? textPart.text : params,
                    protocol: 'google-a2a',
                };

                // Dispatch to handler
                if (this.messageHandler) {
                    await this.messageHandler(message);
                }

                this.lastActivityAt = Date.now();

                return {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        id: task?.id ?? id,
                        sessionId: (params?.sessionId as string) ?? `session-${Date.now()}`,
                        status: {
                            state: 'working',
                            timestamp: new Date().toISOString(),
                        },
                    },
                };
            }

            case 'tasks/get': {
                // Return task status (stub for now)
                return {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        id: params?.id ?? id,
                        status: { state: 'unknown' },
                    },
                };
            }

            case 'tasks/cancel': {
                return {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        id: params?.id ?? id,
                        status: { state: 'canceled' },
                    },
                };
            }

            default:
                return {
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: -32601,
                        message: `Method not found: ${method}`,
                    },
                };
        }
    }

    // ============ Health ============

    health(): ProtocolHealthStatus {
        return {
            available: this.initialized,
            peerCount: this.discoveredAgents.size,
            subscribedTopics: this.messageHandler ? ['tasks'] : [],
            lastActivityAt: this.lastActivityAt,
        };
    }

    // ============ Private Methods ============

    private async resolveEndpoint(address: string): Promise<string | null> {
        // Check cached agents
        const agent = this.discoveredAgents.get(address);
        if (agent?.googleA2AEndpoint) {
            return agent.googleA2AEndpoint;
        }

        // Check cached cards
        const card = this.discoveredCards.get(address);
        if (card?.url) {
            return card.url;
        }

        // Try well-known URL if address looks like a URL
        if (address.startsWith('http')) {
            const cardUrl = new URL('/.well-known/agent.json', address).toString();
            const card = await this.fetchAgentCard(cardUrl);
            if (card) {
                return card.url;
            }
        }

        return null;
    }

    private async discoverFromKnownPeers(): Promise<void> {
        const peers = this.options.knownPeers ?? [];

        const results = await Promise.allSettled(peers.map((peerUrl) => this.fetchAgentCard(peerUrl)));

        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                this.registerCard(result.value);
            }
        }
    }

    private async fetchAgentCard(url: string): Promise<GoogleA2AAgentCard | null> {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), GOOGLE_A2A_CONFIG.TIMEOUTS.AGENT_CARD_FETCH);

            const response = await fetch(url, {
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (!response.ok) return null;

            const card = (await response.json()) as GoogleA2AAgentCard;

            // Validate minimal fields
            if (!card.name || !card.url) return null;

            return card;
        } catch {
            return null;
        }
    }

    private registerCard(card: GoogleA2AAgentCard): void {
        const solanaAddress = card['x-gradience']?.solanaAddress ?? card.url;

        this.discoveredCards.set(solanaAddress, card);

        const agent: AgentInfo = {
            address: solanaAddress,
            displayName: card.name,
            capabilities: card.capabilities.map((c) => c.name),
            reputationScore: card['x-gradience']?.reputationScore ?? 0,
            available: true,
            discoveredVia: 'google-a2a',
            googleA2AEndpoint: card.url,
            multiaddrs: [],
            lastSeenAt: Date.now(),
        };

        this.discoveredAgents.set(solanaAddress, agent);
    }

    private async pollPeersForUpdates(): Promise<void> {
        // Re-discover to check for updates
        await this.discoverFromKnownPeers();
    }

    // ============ Static Helpers ============

    /** Create a well-known agent.json path handler for Express/Fastify */
    static createAgentCardHandler(card: GoogleA2AAgentCard) {
        return (_req: unknown, res: { json: (data: unknown) => void }) => {
            res.json(card);
        };
    }
}
