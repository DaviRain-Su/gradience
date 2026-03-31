import { AbsurdWorkflowEngine } from './engine.js';
import type { EventSource } from './sources.js';
import type { EventEnvelope } from './types.js';

export type ListenerMode = 'triton' | 'helius' | 'polling';

export interface JudgeDaemonOptions {
    tritonSource: EventSource;
    heliusSource: EventSource;
    pollingSource: EventSource;
    logger?: Pick<Console, 'info' | 'warn' | 'error'>;
}

export class JudgeDaemon {
    private readonly logger: Pick<Console, 'info' | 'warn' | 'error'>;
    private currentMode: ListenerMode | null = null;
    private activeSource: EventSource | null = null;
    private stopping = false;

    constructor(
        private readonly engine: AbsurdWorkflowEngine,
        private readonly options: JudgeDaemonOptions,
    ) {
        this.logger = options.logger ?? console;
    }

    async start(): Promise<void> {
        await this.engine.initialize();

        try {
            await this.activate('triton', this.options.tritonSource);
            return;
        } catch (error) {
            this.logger.warn(`Triton source failed, trying Helius fallback: ${asMessage(error)}`);
        }

        try {
            await this.activate('helius', this.options.heliusSource);
            return;
        } catch (error) {
            this.logger.warn(`Helius source failed, switching to polling: ${asMessage(error)}`);
        }

        await this.activate('polling', this.options.pollingSource);
    }

    async stop(): Promise<void> {
        this.stopping = true;
        if (this.activeSource) {
            await this.activeSource.stop();
            this.activeSource = null;
        }
        await this.engine.close();
    }

    mode(): ListenerMode | null {
        return this.currentMode;
    }

    private async activate(mode: ListenerMode, source: EventSource): Promise<void> {
        this.currentMode = mode;
        this.activeSource = source;
        await source.start(
            async (event) => this.handleEvent(event),
            async (error) => this.handleSourceError(mode, error),
        );
        this.logger.info(`Judge daemon listening via ${mode}`);
    }

    private async handleEvent(event: EventEnvelope): Promise<void> {
        await this.engine.handleEvent(event);
    }

    private async handleSourceError(mode: ListenerMode, error: unknown): Promise<void> {
        if (this.stopping) {
            return;
        }

        this.logger.error(`${mode} source error: ${asMessage(error)}`);
        if (mode === 'triton') {
            try {
                await this.switchToFallback('helius', this.options.heliusSource, 'polling');
            } catch (fallbackError) {
                this.logger.error(
                    `Unable to switch from Triton after source error: ${asMessage(fallbackError)}`,
                );
            }
            return;
        }
        if (mode === 'helius') {
            try {
                await this.switchToFallback('polling', this.options.pollingSource);
            } catch (fallbackError) {
                this.logger.error(
                    `Unable to switch from Helius after source error: ${asMessage(fallbackError)}`,
                );
            }
        }
    }

    private async switchToFallback(
        preferredMode: ListenerMode,
        preferredSource: EventSource,
        secondaryMode?: ListenerMode,
    ): Promise<void> {
        if (this.activeSource) {
            await this.activeSource.stop();
        }
        try {
            await this.activate(preferredMode, preferredSource);
        } catch (error) {
            this.logger.error(
                `Fallback source ${preferredMode} failed: ${asMessage(error)}`,
            );
            if (!secondaryMode) {
                throw error;
            }
            if (secondaryMode === 'polling') {
                try {
                    await this.activate('polling', this.options.pollingSource);
                } catch (secondaryError) {
                    this.logger.error(
                        `Secondary fallback ${secondaryMode} failed: ${asMessage(secondaryError)}`,
                    );
                    throw secondaryError;
                }
            }
        }
    }
}

function asMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
