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
    const payloadBytes = new TextEncoder().encode(`${topic}${message}`).length;
    return policy.baseMicrolamports + payloadBytes * policy.perByteMicrolamports;
}

export class InMemoryMagicBlockHub {
    private readonly subscribers = new Set<(envelope: A2AEnvelope) => void>();
    private readonly latencyMs: number;

    constructor(options: { latencyMs?: number } = {}) {
        this.latencyMs = options.latencyMs ?? 20;
    }

    subscribe(handler: (envelope: A2AEnvelope) => void): () => void {
        this.subscribers.add(handler);
        return () => this.subscribers.delete(handler);
    }

    publish(envelope: A2AEnvelope): void {
        for (const handler of this.subscribers) {
            setTimeout(() => handler(envelope), this.latencyMs);
        }
    }
}

export class InMemoryMagicBlockTransport implements MagicBlockTransport {
    readonly name = 'magicblock-inmemory';

    constructor(private readonly hub: InMemoryMagicBlockHub) {}

    publish(envelope: A2AEnvelope): void {
        this.hub.publish(envelope);
    }

    subscribe(handler: (envelope: A2AEnvelope) => void): () => void {
        return this.hub.subscribe(handler);
    }
}

export class BroadcastChannelMagicBlockTransport implements MagicBlockTransport {
    readonly name = 'magicblock-broadcast';

    constructor(private readonly channel: BroadcastChannel) {}

    publish(envelope: A2AEnvelope): void {
        this.channel.postMessage(envelope);
    }

    subscribe(handler: (envelope: A2AEnvelope) => void): () => void {
        const listener = (event: MessageEvent<unknown>) => {
            const envelope = parseA2AEnvelope(event.data);
            if (!envelope) {
                return;
            }
            handler(envelope);
        };
        this.channel.addEventListener('message', listener);
        return () => this.channel.removeEventListener('message', listener);
    }
}

export class MagicBlockA2AAgent {
    private readonly listeners = new Set<(delivery: A2ADelivery) => void>();
    private unsubscribe: (() => void) | null = null;

    constructor(
        private readonly agentId: string,
        private readonly transport: MagicBlockTransport,
        private readonly now: () => number = () => Date.now(),
        private readonly paymentPolicy: MicropaymentPolicy = DEFAULT_MICROPAYMENT_POLICY,
    ) {}

    start(): void {
        if (this.unsubscribe) {
            return;
        }
        this.unsubscribe = this.transport.subscribe((envelope) => {
            if (envelope.to !== this.agentId) {
                return;
            }
            this.emit({
                envelope,
                direction: 'incoming',
                latencyMs: Math.max(0, this.now() - envelope.createdAt),
                channel: this.transport.name,
                receivedAt: this.now(),
            });
        });
    }

    stop(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
    }

    onDelivery(listener: (delivery: A2ADelivery) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    sendInvite(input: SendInviteInput): A2AEnvelope {
        const envelope: A2AEnvelope = {
            id: `${this.now()}-${Math.floor(Math.random() * 1_000_000)}`,
            from: this.agentId,
            to: input.to,
            topic: input.topic,
            message: input.message,
            createdAt: this.now(),
            paymentMicrolamports: estimateMicropayment(input.topic, input.message, this.paymentPolicy),
        };

        this.emit({
            envelope,
            direction: 'outgoing',
            latencyMs: 0,
            channel: this.transport.name,
            receivedAt: this.now(),
        });
        this.transport.publish(envelope);
        return envelope;
    }

    private emit(delivery: A2ADelivery): void {
        for (const listener of this.listeners) {
            listener(delivery);
        }
    }
}

let browserFallbackHub: InMemoryMagicBlockHub | null = null;

export function createDefaultMagicBlockTransport(channelName = 'gradience-magicblock-a2a'): MagicBlockTransport {
    if (typeof BroadcastChannel !== 'undefined') {
        return new BroadcastChannelMagicBlockTransport(new BroadcastChannel(channelName));
    }
    if (!browserFallbackHub) {
        browserFallbackHub = new InMemoryMagicBlockHub();
    }
    return new InMemoryMagicBlockTransport(browserFallbackHub);
}

export function parseA2AEnvelope(value: unknown): A2AEnvelope | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const row = value as Partial<A2AEnvelope>;
    if (
        typeof row.id !== 'string' ||
        typeof row.from !== 'string' ||
        typeof row.to !== 'string' ||
        typeof row.topic !== 'string' ||
        typeof row.message !== 'string'
    ) {
        return null;
    }
    if (
        typeof row.createdAt !== 'number' ||
        !Number.isFinite(row.createdAt) ||
        row.createdAt < 0 ||
        !Number.isInteger(row.createdAt)
    ) {
        return null;
    }
    if (
        typeof row.paymentMicrolamports !== 'number' ||
        !Number.isFinite(row.paymentMicrolamports) ||
        row.paymentMicrolamports < 0 ||
        !Number.isInteger(row.paymentMicrolamports)
    ) {
        return null;
    }
    return {
        id: row.id,
        from: row.from,
        to: row.to,
        topic: row.topic,
        message: row.message,
        createdAt: row.createdAt,
        paymentMicrolamports: row.paymentMicrolamports,
    };
}
