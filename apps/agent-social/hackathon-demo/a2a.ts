/**
 * Subset of the Gradience A2A protocol + ranking algorithm,
 * inlined here so the demo script has no external workspace deps.
 *
 * Source: apps/agent-social/frontend/src/lib/magicblock-a2a.ts
 *         apps/agent-social/frontend/src/lib/ranking.ts
 */

// ---------------------------------------------------------------------------
// A2A Protocol
// ---------------------------------------------------------------------------

export interface MicropaymentPolicy {
    baseMicrolamports: number;
    perByteMicrolamports: number;
}

export interface A2AEnvelope {
    id: string;
    from: string;
    to: string;
    topic: string;
    message: string;
    createdAt: number;
    paymentMicrolamports: number;
}

export interface A2ADelivery {
    envelope: A2AEnvelope;
    direction: 'incoming' | 'outgoing';
    latencyMs: number;
    channel: string;
    receivedAt: number;
}

export interface SendInviteInput {
    to: string;
    topic: string;
    message: string;
}

export interface MagicBlockTransport {
    readonly name: string;
    publish(envelope: A2AEnvelope): void;
    subscribe(handler: (envelope: A2AEnvelope) => void): () => void;
}

export const DEFAULT_MICROPAYMENT_POLICY: MicropaymentPolicy = {
    baseMicrolamports: 100,
    perByteMicrolamports: 2,
};

export function estimateMicropayment(
    topic: string,
    message: string,
    policy: MicropaymentPolicy = DEFAULT_MICROPAYMENT_POLICY,
): number {
    const bytes = new TextEncoder().encode(`${topic}${message}`).length;
    return policy.baseMicrolamports + bytes * policy.perByteMicrolamports;
}

export class InMemoryMagicBlockHub {
    private readonly subscribers = new Set<(e: A2AEnvelope) => void>();
    private readonly latencyMs: number;

    constructor(options: { latencyMs?: number } = {}) {
        this.latencyMs = options.latencyMs ?? 20;
    }

    subscribe(handler: (e: A2AEnvelope) => void): () => void {
        this.subscribers.add(handler);
        return () => this.subscribers.delete(handler);
    }

    publish(envelope: A2AEnvelope): void {
        for (const h of this.subscribers) {
            setTimeout(() => h(envelope), this.latencyMs);
        }
    }
}

export class InMemoryMagicBlockTransport implements MagicBlockTransport {
    readonly name = 'magicblock-inmemory';
    constructor(private readonly hub: InMemoryMagicBlockHub) {}
    publish(envelope: A2AEnvelope): void { this.hub.publish(envelope); }
    subscribe(handler: (e: A2AEnvelope) => void): () => void { return this.hub.subscribe(handler); }
}

export class MagicBlockA2AAgent {
    private readonly listeners = new Set<(d: A2ADelivery) => void>();
    private unsub: (() => void) | null = null;

    constructor(
        private readonly agentId: string,
        private readonly transport: MagicBlockTransport,
        private readonly now: () => number = () => Date.now(),
        private readonly policy: MicropaymentPolicy = DEFAULT_MICROPAYMENT_POLICY,
    ) {}

    start(): void {
        if (this.unsub) return;
        this.unsub = this.transport.subscribe((envelope) => {
            if (envelope.to !== this.agentId) return;
            this.emit({ envelope, direction: 'incoming', latencyMs: Math.max(0, this.now() - envelope.createdAt), channel: this.transport.name, receivedAt: this.now() });
        });
    }

    stop(): void { this.unsub?.(); this.unsub = null; }

    onDelivery(fn: (d: A2ADelivery) => void): () => void {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    sendInvite(input: SendInviteInput): A2AEnvelope {
        const payment = estimateMicropayment(input.topic, input.message, this.policy);
        const envelope: A2AEnvelope = {
            id: `${this.now()}-${Math.floor(Math.random() * 1_000_000)}`,
            from: this.agentId,
            to: input.to,
            topic: input.topic,
            message: input.message,
            createdAt: this.now(),
            paymentMicrolamports: payment,
        };
        this.transport.publish(envelope);
        this.emit({ envelope, direction: 'outgoing', latencyMs: 0, channel: this.transport.name, receivedAt: this.now() });
        return envelope;
    }

    private emit(d: A2ADelivery): void {
        for (const fn of this.listeners) fn(d);
    }
}

// ---------------------------------------------------------------------------
// Reputation-based agent ranking
// ---------------------------------------------------------------------------

export interface AgentDiscoveryRow {
    agent: string;
    weight: number;
    reputation: {
        global_avg_score: number;
        global_completed: number;
        global_total_applied: number;
        win_rate: number;
    } | null;
}

export function sortAndFilterAgents(rows: AgentDiscoveryRow[], query: string): AgentDiscoveryRow[] {
    const q = query.trim().toLowerCase();
    const filtered = q ? rows.filter(r => r.agent.toLowerCase().includes(q)) : rows;
    return [...filtered].sort((a, b) => {
        const sA = a.reputation?.global_avg_score ?? 0;
        const sB = b.reputation?.global_avg_score ?? 0;
        if (sB !== sA) return sB - sA;
        const cA = a.reputation?.global_completed ?? 0;
        const cB = b.reputation?.global_completed ?? 0;
        if (cB !== cA) return cB - cA;
        return b.weight - a.weight;
    });
}

export function toDiscoveryRows(
    pool: Array<{ judge: string; stake: number; weight: number }>,
    reputations: Map<string, AgentDiscoveryRow['reputation']>,
): AgentDiscoveryRow[] {
    return pool.map(r => ({
        agent: r.judge,
        weight: r.weight,
        reputation: reputations.get(r.judge) ?? null,
    }));
}
