/**
 * Nostr client -- connects to relays, publishes/subscribes presence events.
 */

import { SimplePool, type Event as NostrToolsEvent, type Filter } from 'nostr-tools';
import type { SubCloser } from 'nostr-tools/abstract-pool';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import {
    NOSTR_CONFIG,
    type AgentPresenceEvent,
    type AgentPresenceContent,
    type PresenceFilter,
    type NostrHealthStatus,
    type RelayStatus,
    type NostrSubscription,
    type NIP89HandlerEvent,
    type NIP89HandlerContent,
    type NIP90JobRequest,
    type NIP90JobResult,
    type NIP90JobFeedback,
    type DVMFilter,
} from '@gradiences/a2a-types';

export interface NostrClientOptions {
    relays?: string[];
    privateKey?: string; // hex encoded
}

function fromHex(hex: string): Uint8Array {
    if (hex.length % 2 !== 0) throw new Error('Invalid hex private key length');
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
}

export class NostrClient {
    private pool: SimplePool | null = null;
    private relays: string[];
    private privateKey: Uint8Array;
    private pubkey: string;
    private relayStatus: Map<string, RelayStatus> = new Map();
    private activeSubscriptions: Set<string> = new Set();
    private lastEventAt?: number;

    constructor(options: NostrClientOptions = {}) {
        this.relays = options.relays ? [...options.relays] : [...NOSTR_CONFIG.DEFAULT_RELAYS];
        this.privateKey = options.privateKey ? fromHex(options.privateKey) : generateSecretKey();
        this.pubkey = getPublicKey(this.privateKey);

        this.relays.forEach((url) => {
            this.relayStatus.set(url, {
                url,
                connected: false,
                latencyMs: Infinity,
                errorCount: 0,
            });
        });
    }

    async connect(): Promise<void> {
        this.pool = new SimplePool();

        await Promise.all(
            this.relays.map(async (url) => {
                const start = Date.now();
                try {
                    const sub = this.pool!.subscribeMany(
                        [url],
                        { kinds: [1], limit: 1 },
                        {
                            onevent: () => {},
                            onclose: () => {},
                        },
                    );
                    setTimeout(() => sub.close(), 100);
                    const latency = Date.now() - start;
                    this.updateRelayStatus(url, { connected: true, latencyMs: latency });
                } catch {
                    this.updateRelayStatus(url, {
                        connected: false,
                        errorCount: this.relayStatus.get(url)!.errorCount + 1,
                    });
                }
            }),
        );

        const connectedCount = this.getConnectedRelayCount();
        if (connectedCount === 0) {
            console.warn('[NostrClient] No relays connected');
        } else {
            console.log(`[NostrClient] Connected to ${connectedCount}/${this.relays.length} relays`);
        }
    }

    async disconnect(): Promise<void> {
        if (this.pool) {
            this.pool.close(this.relays);
            this.pool = null;
        }
        this.relayStatus.forEach((status, url) => {
            this.relayStatus.set(url, { ...status, connected: false });
        });
        this.activeSubscriptions.clear();
    }

    isConnected(): boolean {
        return this.pool !== null && this.getConnectedRelayCount() > 0;
    }

    getPublicKey(): string {
        return this.pubkey;
    }

    getConnectedRelayCount(): number {
        return Array.from(this.relayStatus.values()).filter((r) => r.connected).length;
    }

    // ============ Presence ============

    async publishPresence(content: AgentPresenceContent): Promise<string> {
        this.ensureConnected();
        const event = {
            kind: NOSTR_CONFIG.KINDS.AGENT_PRESENCE,
            pubkey: this.pubkey,
            created_at: Math.floor(Date.now() / 1000),
            content: JSON.stringify(content),
            tags: [['t', 'gradience-agent']],
        };
        const signedEvent = this.signEvent(event);
        await this.publishWithRetry(signedEvent);
        return signedEvent.id!;
    }

    async subscribePresence(
        filter: PresenceFilter,
        callback: (event: AgentPresenceEvent) => void,
    ): Promise<NostrSubscription> {
        this.ensureConnected();
        const subId = `presence-${Date.now()}`;
        this.activeSubscriptions.add(subId);

        const sub = this.pool!.subscribeMany(
            this.getConnectedRelays(),
            { kinds: [NOSTR_CONFIG.KINDS.AGENT_PRESENCE] },
            {
                onevent: (event: NostrToolsEvent) => {
                    this.lastEventAt = Date.now();
                    try {
                        const content: AgentPresenceContent = JSON.parse(event.content);
                        if (filter.availableOnly && !content.available) return;
                        if (filter.minReputation && content.reputation_score < filter.minReputation) return;
                        if (filter.capabilities && !filter.capabilities.some((c) => content.capabilities.includes(c)))
                            return;
                        callback(event as unknown as AgentPresenceEvent);
                    } catch {}
                },
                onclose: () => {
                    this.activeSubscriptions.delete(subId);
                },
            },
        );

        return {
            unsub: () => {
                sub.close();
                this.activeSubscriptions.delete(subId);
            },
        };
    }

    async queryPresence(filter: PresenceFilter, limit = 100): Promise<AgentPresenceEvent[]> {
        this.ensureConnected();
        const events: AgentPresenceEvent[] = [];

        return new Promise((resolve) => {
            const sub = this.pool!.subscribeMany(
                this.getConnectedRelays(),
                { kinds: [NOSTR_CONFIG.KINDS.AGENT_PRESENCE], limit },
                {
                    onevent: (event: NostrToolsEvent) => {
                        try {
                            const content: AgentPresenceContent = JSON.parse(event.content);
                            if (filter.availableOnly && !content.available) return;
                            if (filter.minReputation && content.reputation_score < filter.minReputation) return;
                            if (
                                filter.capabilities &&
                                !filter.capabilities.some((c) => content.capabilities.includes(c))
                            )
                                return;
                            events.push(event as unknown as AgentPresenceEvent);
                        } catch {}
                    },
                    onclose: () => {
                        resolve(events.slice(0, limit));
                    },
                },
            );

            setTimeout(() => {
                sub.close();
                resolve(events.slice(0, limit));
            }, NOSTR_CONFIG.TIMEOUTS.SUBSCRIBE);
        });
    }

    // ============ NIP-89 Handler ============

    async publishHandler(handlerId: string, content: NIP89HandlerContent): Promise<string> {
        this.ensureConnected();
        const tags: string[][] = [
            ['d', handlerId],
            ['t', 'gradience-dvm'],
        ];
        if (content.kinds) {
            content.kinds.forEach((kind) => tags.push(['k', kind.toString()]));
        }
        const event = {
            kind: NOSTR_CONFIG.KINDS.HANDLER_ANNOUNCEMENT,
            pubkey: this.pubkey,
            created_at: Math.floor(Date.now() / 1000),
            content: JSON.stringify(content),
            tags,
        };
        const signedEvent = this.signEvent(event);
        await this.publishWithRetry(signedEvent);
        return signedEvent.id!;
    }

    // ============ NIP-90 DVM ============

    async publishJobRequest(kind: number, input: string, tags: string[][] = []): Promise<string> {
        this.ensureConnected();
        if (kind < NOSTR_CONFIG.KINDS.DVM_JOB_REQUEST_BASE || kind >= NOSTR_CONFIG.KINDS.DVM_JOB_RESULT_BASE) {
            throw new Error(`Invalid job request kind: ${kind}`);
        }
        const event = {
            kind,
            pubkey: this.pubkey,
            created_at: Math.floor(Date.now() / 1000),
            content: input,
            tags: [['t', 'gradience-job'], ...tags],
        };
        const signedEvent = this.signEvent(event);
        await this.publishWithRetry(signedEvent);
        return signedEvent.id!;
    }

    async publishJobResult(requestEvent: NIP90JobRequest, result: string, amount?: number): Promise<string> {
        this.ensureConnected();
        const resultKind = requestEvent.kind + 1000;
        const tags: string[][] = [
            ['e', requestEvent.id!],
            ['p', requestEvent.pubkey],
            ['t', 'gradience-job-result'],
        ];
        if (amount !== undefined) tags.push(['amount', amount.toString()]);

        const event = {
            kind: resultKind,
            pubkey: this.pubkey,
            created_at: Math.floor(Date.now() / 1000),
            content: result,
            tags,
        };
        const signedEvent = this.signEvent(event);
        await this.publishWithRetry(signedEvent);
        return signedEvent.id!;
    }

    async subscribeJobRequests(
        kinds: number[],
        callback: (event: NIP90JobRequest) => void,
    ): Promise<NostrSubscription> {
        this.ensureConnected();
        const subId = `job-requests-${Date.now()}`;
        this.activeSubscriptions.add(subId);

        const sub = this.pool!.subscribeMany(
            this.getConnectedRelays(),
            { kinds },
            {
                onevent: (event: NostrToolsEvent) => {
                    this.lastEventAt = Date.now();
                    callback(event as unknown as NIP90JobRequest);
                },
                onclose: () => {
                    this.activeSubscriptions.delete(subId);
                },
            },
        );

        return {
            unsub: () => {
                sub.close();
                this.activeSubscriptions.delete(subId);
            },
        };
    }

    // ============ Health ============

    health(): NostrHealthStatus {
        return {
            connected: this.isConnected(),
            relayCount: this.getConnectedRelayCount(),
            activeSubscriptions: this.activeSubscriptions.size,
            lastEventAt: this.lastEventAt,
            relays: Array.from(this.relayStatus.values()),
        };
    }

    // ============ Private ============

    private ensureConnected(): void {
        if (!this.isConnected()) {
            throw new Error('[NostrClient] Not connected. Call connect() first.');
        }
    }

    private getConnectedRelays(): string[] {
        return this.relays.filter((url) => this.relayStatus.get(url)?.connected);
    }

    private updateRelayStatus(url: string, update: Partial<RelayStatus>): void {
        const current = this.relayStatus.get(url)!;
        this.relayStatus.set(url, {
            ...current,
            ...update,
            lastConnectedAt: update.connected ? Date.now() : current.lastConnectedAt,
        });
    }

    private signEvent(event: Partial<NostrToolsEvent>): NostrToolsEvent {
        return finalizeEvent(
            {
                kind: event.kind!,
                created_at: event.created_at!,
                tags: event.tags ?? [],
                content: event.content ?? '',
            },
            this.privateKey,
        );
    }

    private async publishWithRetry(event: NostrToolsEvent): Promise<void> {
        const connectedRelays = this.getConnectedRelays();
        if (connectedRelays.length === 0) {
            throw new Error('[NostrClient] No connected relays');
        }

        const results = await Promise.allSettled(
            connectedRelays.map(async (url) => {
                for (let attempt = 1; attempt <= NOSTR_CONFIG.RETRY.MAX_ATTEMPTS; attempt++) {
                    try {
                        await this.pool!.publish([url], event);
                        return;
                    } catch (error) {
                        if (attempt === NOSTR_CONFIG.RETRY.MAX_ATTEMPTS) throw error;
                        await new Promise((r) => setTimeout(r, NOSTR_CONFIG.RETRY.BACKOFF_MS * attempt));
                    }
                }
            }),
        );

        const successCount = results.filter((r) => r.status === 'fulfilled').length;
        if (successCount === 0) {
            throw new Error('[NostrClient] Failed to publish to all relays');
        }
    }
}
