/**
 * A2A Relay Transport — connects AgentM to the A2A Relay API.
 *
 * Replaces InMemoryMagicBlockTransport for production use.
 * Publishes envelopes to the relay and polls for incoming messages.
 */

import type { A2AEnvelope, MicropaymentPolicy } from '../../shared/types.ts';
import type { MagicBlockTransport } from './a2a-client.ts';
import { DEFAULT_MICROPAYMENT_POLICY } from './a2a-client.ts';

export interface RelayTransportConfig {
    /** Relay API base URL (e.g., http://127.0.0.1:4000) */
    relayUrl: string;
    /** Agent's public key (Solana address) */
    agentId: string;
    /** Bearer token for relay authentication */
    authToken?: string;
    /** Polling interval in ms (default: 2000) */
    pollIntervalMs?: number;
    /** Request timeout in ms (default: 5000) */
    timeoutMs?: number;
}

export class RelayTransport implements MagicBlockTransport {
    readonly name = 'a2a-relay';

    private readonly config: Required<RelayTransportConfig>;
    private readonly handlers = new Set<(envelope: A2AEnvelope) => void>();
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private lastPullTimestamp = 0;

    constructor(config: RelayTransportConfig) {
        this.config = {
            relayUrl: config.relayUrl.replace(/\/$/, ''),
            agentId: config.agentId,
            authToken: config.authToken ?? '',
            pollIntervalMs: config.pollIntervalMs ?? 2000,
            timeoutMs: config.timeoutMs ?? 5000,
        };
    }

    publish(envelope: A2AEnvelope): void {
        const url = `${this.config.relayUrl}/v1/envelopes/publish`;
        const headers: Record<string, string> = {
            'content-type': 'application/json',
        };
        if (this.config.authToken) {
            headers.authorization = `Bearer ${this.config.authToken}`;
        }

        // Fire and forget — errors logged but not thrown
        fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                from: envelope.from,
                to: envelope.to,
                topic: envelope.topic,
                message: envelope.message,
                paymentMicrolamports: envelope.paymentMicrolamports,
                createdAt: envelope.createdAt,
                id: envelope.id,
            }),
            signal: AbortSignal.timeout(this.config.timeoutMs),
        }).catch(() => {
            // Silently ignore publish failures — message shown as 'failed' in UI
        });
    }

    subscribe(handler: (envelope: A2AEnvelope) => void): () => void {
        this.handlers.add(handler);

        // Start polling if not already running
        if (!this.pollTimer && this.handlers.size > 0) {
            this.startPolling();
        }

        return () => {
            this.handlers.delete(handler);
            if (this.handlers.size === 0) {
                this.stopPolling();
            }
        };
    }

    private startPolling(): void {
        if (this.pollTimer) return;
        this.lastPullTimestamp = Date.now();

        this.pollTimer = setInterval(() => {
            this.pull().catch(() => {
                // Silently ignore pull failures
            });
        }, this.config.pollIntervalMs);

        // Initial pull immediately
        this.pull().catch(() => {});
    }

    private stopPolling(): void {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    private async pull(): Promise<void> {
        const url = `${this.config.relayUrl}/v1/envelopes/pull?agent=${encodeURIComponent(this.config.agentId)}&since=${this.lastPullTimestamp}`;
        const headers: Record<string, string> = {};
        if (this.config.authToken) {
            headers.authorization = `Bearer ${this.config.authToken}`;
        }

        const response = await fetch(url, {
            headers,
            signal: AbortSignal.timeout(this.config.timeoutMs),
        });

        if (!response.ok) return;

        const data = (await response.json()) as {
            envelopes?: Array<{
                id: string;
                from: string;
                to: string;
                topic: string;
                message: string;
                createdAt: number;
                paymentMicrolamports: number;
            }>;
        };

        if (!data.envelopes || !Array.isArray(data.envelopes)) return;

        for (const raw of data.envelopes) {
            const envelope: A2AEnvelope = {
                id: raw.id,
                from: raw.from,
                to: raw.to,
                topic: raw.topic,
                message: raw.message,
                createdAt: raw.createdAt,
                paymentMicrolamports: raw.paymentMicrolamports,
            };

            // Update last pull timestamp to avoid re-fetching
            if (envelope.createdAt > this.lastPullTimestamp) {
                this.lastPullTimestamp = envelope.createdAt;
            }

            for (const handler of this.handlers) {
                handler(envelope);
            }
        }
    }

    /** Stop polling and clean up. */
    destroy(): void {
        this.stopPolling();
        this.handlers.clear();
    }
}

/**
 * Create a transport that auto-selects:
 * - RelayTransport if VITE_A2A_RELAY_URL is set
 * - InMemoryMagicBlockTransport otherwise (demo mode)
 */
export function createAutoTransport(
    agentId: string,
): MagicBlockTransport {
    const relayUrl = typeof import.meta !== 'undefined'
        ? (import.meta as unknown as { env?: { VITE_A2A_RELAY_URL?: string } }).env?.VITE_A2A_RELAY_URL
        : undefined;

    if (relayUrl) {
        const authToken = typeof import.meta !== 'undefined'
            ? (import.meta as unknown as { env?: { VITE_A2A_RELAY_AUTH_TOKEN?: string } }).env?.VITE_A2A_RELAY_AUTH_TOKEN
            : undefined;

        return new RelayTransport({
            relayUrl,
            agentId,
            authToken,
        });
    }

    // Fallback to in-memory (demo mode)
    const { InMemoryMagicBlockHub, InMemoryMagicBlockTransport } = require('./a2a-client.ts');
    const hub = new InMemoryMagicBlockHub();
    return new InMemoryMagicBlockTransport(hub);
}
