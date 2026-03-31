import type { EventEnvelope } from './types.js';

export type EventHandler = (event: EventEnvelope) => void | Promise<void>;
export type SourceErrorHandler = (error: unknown) => void | Promise<void>;

export interface EventSource {
    readonly name: string;
    start(onEvent: EventHandler, onError: SourceErrorHandler): Promise<void>;
    stop(): Promise<void>;
}

export interface AsyncStreamEventSourceOptions {
    name: string;
    streamFactory: () => AsyncIterable<EventEnvelope>;
}

export class AsyncStreamEventSource implements EventSource {
    readonly name: string;
    private running = false;
    private loopPromise: Promise<void> | null = null;

    constructor(private readonly options: AsyncStreamEventSourceOptions) {
        this.name = options.name;
    }

    async start(onEvent: EventHandler, onError: SourceErrorHandler): Promise<void> {
        this.running = true;
        const stream = this.options.streamFactory();
        this.loopPromise = (async () => {
            try {
                for await (const event of stream) {
                    if (!this.running) {
                        return;
                    }
                    await onEvent(event);
                }
            } catch (error) {
                if (this.running) {
                    await onError(error);
                }
            }
        })();
    }

    async stop(): Promise<void> {
        this.running = false;
        await this.loopPromise;
    }
}

export interface PollingEventSourceOptions {
    pollEvents: () => Promise<EventEnvelope[]>;
    pollIntervalMs?: number;
}

export class PollingEventSource implements EventSource {
    readonly name = 'polling';
    readonly pollIntervalMs: number;

    private timer: NodeJS.Timeout | null = null;
    private inFlight: Promise<void> | null = null;

    constructor(private readonly options: PollingEventSourceOptions) {
        this.pollIntervalMs = options.pollIntervalMs ?? 5_000;
    }

    async start(onEvent: EventHandler, onError: SourceErrorHandler): Promise<void> {
        const tick = async () => {
            try {
                const events = await this.options.pollEvents();
                for (const event of events) {
                    await onEvent(event);
                }
            } catch (error) {
                await onError(error);
            }
        };

        this.inFlight = tick();
        this.timer = setInterval(() => {
            this.inFlight = tick();
        }, this.pollIntervalMs);
    }

    async stop(): Promise<void> {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        await this.inFlight;
    }
}

export interface MockEventSourceOptions {
    events: EventEnvelope[];
    intervalMs?: number;
    throwOnStart?: boolean;
}

export class MockEventSource implements EventSource {
    readonly name: string;
    private timer: NodeJS.Timeout | null = null;

    constructor(
        name: string,
        private readonly options: MockEventSourceOptions,
    ) {
        this.name = name;
    }

    async start(onEvent: EventHandler): Promise<void> {
        if (this.options.throwOnStart) {
            throw new Error(`${this.name} unavailable`);
        }

        const events = [...this.options.events];
        const intervalMs = this.options.intervalMs ?? 0;
        const emit = async () => {
            const next = events.shift();
            if (!next) {
                return;
            }
            await onEvent(next);
            if (events.length > 0) {
                this.timer = setTimeout(() => {
                    void emit();
                }, intervalMs);
            }
        };
        await emit();
    }

    async stop(): Promise<void> {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
}
