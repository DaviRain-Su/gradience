/**
 * Social Probe
 *
 * Multi-round conversation framework for social compatibility assessment
 *
 * @module @gradiences/soul-engine/probe
 */

import type {
    ProbeSession,
    ProbeConfig,
    ProbeMessage,
    ProbeResult,
    ProbeEvent,
    ProbeEventHandler,
    ProbeStatus,
    PROBE_DEFAULTS,
} from './probe-types.js';
import type { SoulBoundaries } from './types.js';

// Placeholder for A2A Router - will be injected
export interface A2ARouterLike {
    send(params: {
        to: string;
        type: string;
        preferredProtocol?: string;
        payload: unknown;
    }): Promise<{ success: boolean; messageId: string; error?: string }>;

    subscribe(
        handler: (message: { id: string; from: string; payload?: any }) => void | Promise<void>,
    ): Promise<{ unsubscribe: () => Promise<void> }>;
}

/**
 * Generate session ID
 */
function generateSessionId(): string {
    return `probe-${crypto.randomUUID()}`;
}

/**
 * Generate message ID
 */
function generateMessageId(): string {
    return crypto.randomUUID();
}

/**
 * Social Probe class
 */
export class SocialProbe {
    private router: A2ARouterLike;
    private sessions: Map<string, ProbeSession> = new Map();
    private eventHandlers: Map<string, Set<ProbeEventHandler>> = new Map();

    constructor(router: A2ARouterLike) {
        this.router = router;
    }

    /**
     * Initiate a social probe
     */
    async initiate(params: {
        targetAddress: string;
        config: ProbeConfig;
        boundaries: {
            prober: SoulBoundaries;
            target: SoulBoundaries;
        };
        protocol?: string;
    }): Promise<ProbeSession> {
        const sessionId = generateSessionId();
        const protocol = params.protocol || 'xmtp';

        // Create session
        const session: ProbeSession = {
            id: sessionId,
            proberId: 'self', // Will be filled by caller
            targetId: params.targetAddress,
            protocol,
            status: 'pending',
            conversation: [],
            config: params.config,
            boundaries: params.boundaries,
            startedAt: Date.now(),
        };

        this.sessions.set(sessionId, session);

        // Emit invite event
        this.emitEvent({
            type: 'invite_sent',
            sessionId,
            timestamp: Date.now(),
        });

        // Send probe invitation
        const inviteResult = await this.router.send({
            to: params.targetAddress,
            type: 'task_proposal',
            preferredProtocol: protocol,
            payload: {
                sessionId,
                type: 'social-probe',
                depth: params.config.depth,
                maxTurns: params.config.maxTurns,
                timestamp: Date.now(),
            },
        });

        if (!inviteResult.success) {
            session.status = 'failed';
            session.error = inviteResult.error || 'Failed to send invite';
            this.emitEvent({
                type: 'probe_failed',
                sessionId,
                timestamp: Date.now(),
                data: { error: session.error },
            });
            return session;
        }

        // Wait for acceptance
        const accepted = await this.waitForAcceptance(sessionId, params.config.timeoutMs);

        if (!accepted) {
            session.status = 'failed';
            session.error = 'Invite not accepted (timeout)';
            this.emitEvent({
                type: 'invite_rejected',
                sessionId,
                timestamp: Date.now(),
            });
            return session;
        }

        // Start probing
        session.status = 'probing';
        this.emitEvent({
            type: 'invite_accepted',
            sessionId,
            timestamp: Date.now(),
        });

        // Run conversation
        await this.runConversation(session);

        return session;
    }

    /**
     * Run the conversation loop
     */
    private async runConversation(session: ProbeSession): Promise<void> {
        for (let turn = 0; turn < session.config.maxTurns; turn++) {
            this.emitEvent({
                type: 'turn_start',
                sessionId: session.id,
                turn,
                timestamp: Date.now(),
            });

            // Generate question
            const question = await this.generateQuestion(session, turn);

            // Send message
            const sendResult = await this.router.send({
                to: session.targetId,
                type: 'direct_message',
                preferredProtocol: session.protocol,
                payload: {
                    sessionId: session.id,
                    turn,
                    role: 'prober',
                    content: question,
                    timestamp: Date.now(),
                },
            });

            if (!sendResult.success) {
                session.status = 'failed';
                session.error = `Turn ${turn} send failed: ${sendResult.error}`;
                this.emitEvent({
                    type: 'probe_failed',
                    sessionId: session.id,
                    timestamp: Date.now(),
                    data: { turn, error: session.error },
                });
                return;
            }

            const proberMessage: ProbeMessage = {
                id: sendResult.messageId,
                turn,
                role: 'prober',
                content: question,
                timestamp: Date.now(),
            };

            session.conversation.push(proberMessage);

            this.emitEvent({
                type: 'message_sent',
                sessionId: session.id,
                turn,
                message: proberMessage,
                timestamp: Date.now(),
            });

            // Wait for response
            const response = await this.waitForResponse(session.id, turn, session.config.timeoutMs);

            if (!response) {
                session.status = 'failed';
                session.error = `Turn ${turn} timeout (no response)`;
                this.emitEvent({
                    type: 'probe_failed',
                    sessionId: session.id,
                    timestamp: Date.now(),
                    data: { turn, error: session.error },
                });
                return;
            }

            session.conversation.push(response);

            this.emitEvent({
                type: 'message_received',
                sessionId: session.id,
                turn,
                message: response,
                timestamp: Date.now(),
            });

            // Check if should end
            if (await this.shouldEndProbe(session)) {
                break;
            }

            this.emitEvent({
                type: 'turn_complete',
                sessionId: session.id,
                turn,
                timestamp: Date.now(),
            });
        }

        // Mark as completed
        session.status = 'completed';
        session.completedAt = Date.now();

        this.emitEvent({
            type: 'probe_complete',
            sessionId: session.id,
            timestamp: Date.now(),
        });
    }

    /**
     * Generate a probe question
     */
    private async generateQuestion(session: ProbeSession, turn: number): Promise<string> {
        // Get conversation context
        const recentMessages = session.conversation.slice(-3);

        // Determine topic
        const availableTopics = session.config.topics?.filter(
            (t) => !session.config.avoidTopics?.includes(t) && !session.boundaries.target.forbiddenTopics.includes(t),
        ) || ['general interests', 'goals', 'values'];

        const topic = availableTopics[turn % availableTopics.length];

        // Generate simple question (will be enhanced with LLM in later phases)
        const questions = [
            `What are your thoughts on ${topic}?`,
            `How do you approach ${topic}?`,
            `Can you tell me about your experience with ${topic}?`,
            `What interests you most about ${topic}?`,
            `How would you describe your perspective on ${topic}?`,
        ];

        return questions[turn % questions.length];
    }

    /**
     * Wait for invitation acceptance
     */
    private async waitForAcceptance(sessionId: string, timeoutMs: number): Promise<boolean> {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(false), timeoutMs);

            const unsubscribe = this.router.subscribe(async (message) => {
                if (message.payload?.sessionId === sessionId && message.payload?.type === 'accept') {
                    clearTimeout(timeout);
                    await (await unsubscribe).unsubscribe();
                    resolve(true);
                }
            });
        });
    }

    /**
     * Wait for response to a specific turn
     */
    private async waitForResponse(sessionId: string, turn: number, timeoutMs: number): Promise<ProbeMessage | null> {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(null), timeoutMs);

            const unsubscribe = this.router.subscribe(async (message) => {
                if (
                    message.payload?.sessionId === sessionId &&
                    message.payload?.turn === turn &&
                    message.payload?.role === 'target'
                ) {
                    clearTimeout(timeout);
                    await (await unsubscribe).unsubscribe();

                    const probeMessage: ProbeMessage = {
                        id: message.id,
                        turn,
                        role: 'target',
                        content: message.payload.content,
                        timestamp: Date.now(),
                    };

                    resolve(probeMessage);
                }
            });
        });
    }

    /**
     * Check if probe should end early
     */
    private async shouldEndProbe(session: ProbeSession): Promise<boolean> {
        const lastMessage = session.conversation[session.conversation.length - 1];

        if (!lastMessage) {
            return false;
        }

        // Check auto-end triggers
        const allTriggers = [
            ...(session.boundaries.prober.autoEndTriggers || []),
            ...(session.boundaries.target.autoEndTriggers || []),
        ];

        for (const trigger of allTriggers) {
            if (lastMessage.content.toLowerCase().includes(trigger.toLowerCase())) {
                return true;
            }
        }

        // Check for forbidden topics
        for (const topic of session.boundaries.target.forbiddenTopics) {
            if (lastMessage.content.toLowerCase().includes(topic.toLowerCase())) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get session by ID
     */
    getSession(sessionId: string): ProbeSession | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Cancel an ongoing probe
     */
    async cancel(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);

        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        if (session.status === 'completed' || session.status === 'failed') {
            throw new Error(`Session already ${session.status}: ${sessionId}`);
        }

        session.status = 'cancelled';
        session.completedAt = Date.now();

        this.emitEvent({
            type: 'probe_cancelled',
            sessionId,
            timestamp: Date.now(),
        });
    }

    /**
     * Subscribe to probe events
     */
    on(sessionId: string, handler: ProbeEventHandler): () => void {
        if (!this.eventHandlers.has(sessionId)) {
            this.eventHandlers.set(sessionId, new Set());
        }

        this.eventHandlers.get(sessionId)!.add(handler);

        // Return unsubscribe function
        return () => {
            this.eventHandlers.get(sessionId)?.delete(handler);
        };
    }

    /**
     * Emit probe event
     */
    private emitEvent(event: ProbeEvent): void {
        const handlers = this.eventHandlers.get(event.sessionId);

        if (handlers) {
            for (const handler of handlers) {
                try {
                    void handler(event);
                } catch (error) {
                    console.error('[SocialProbe] Event handler error:', error);
                }
            }
        }
    }
}
