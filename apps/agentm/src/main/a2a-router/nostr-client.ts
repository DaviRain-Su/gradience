/**
 * Nostr client implementation
 * 
 * Handles connection to Nostr relays, publishing events, and subscriptions.
 * 
 * @module a2a-router/nostr-client
 */

import {
    SimplePool,
    type Event as NostrEvent,
    type Filter,
    nip04,
} from 'nostr-tools';
import type { SubCloser } from 'nostr-tools/abstract-pool';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import { NOSTR_CONFIG, A2A_ERROR_CODES } from './constants.js';
import type {
    AgentPresenceEvent,
    AgentPresenceContent,
    EncryptedDMEvent,
    EncryptedDMContent,
    PresenceFilter,
    NostrHealthStatus,
    RelayStatus,
    NostrSubscription,
} from '../../shared/nostr-types.js';

export interface NostrClientOptions {
    relays?: string[];
    privateKey?: string;  // hex encoded
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

        // Initialize relay status
        this.relays.forEach(url => {
            this.relayStatus.set(url, {
                url,
                connected: false,
                latencyMs: Infinity,
                errorCount: 0,
            });
        });
    }

    /**
     * Connect to all configured relays
     */
    async connect(): Promise<void> {
        this.pool = new SimplePool();

        // Try to connect to each relay and measure latency
        await Promise.all(
            this.relays.map(async (url) => {
                const start = Date.now();
                try {
                    // Attempt a simple subscription to test connection
                    const testFilter: Filter = { kinds: [1], limit: 1 };
                    const sub = this.pool!.subscribeMany([url], testFilter, {
                        onevent: () => { },
                        onclose: () => { },
                    });

                    // Close test subscription
                    setTimeout(() => sub.close(), 100);

                    const latency = Date.now() - start;
                    this.updateRelayStatus(url, { connected: true, latencyMs: latency });
                } catch (error) {
                    this.updateRelayStatus(url, {
                        connected: false,
                        errorCount: this.relayStatus.get(url)!.errorCount + 1,
                    });
                }
            })
        );

        // Check if at least 3 relays are connected
        const connectedCount = this.getConnectedRelayCount();
        if (connectedCount < 3) {
            console.warn(`[NostrClient] Only ${connectedCount} relays connected, expected at least 3`);
        }
    }

    /**
     * Disconnect from all relays
     */
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

    /**
     * Check if connected to relays
     */
    isConnected(): boolean {
        return this.pool !== null && this.getConnectedRelayCount() > 0;
    }

    /**
     * Get public key (Nostr pubkey)
     */
    getPublicKey(): string {
        return this.pubkey;
    }

    /**
     * Get connected relay count
     */
    getConnectedRelayCount(): number {
        return Array.from(this.relayStatus.values()).filter(r => r.connected).length;
    }

    /**
     * Publish agent presence to all connected relays
     */
    async publishPresence(content: AgentPresenceContent): Promise<string> {
        this.ensureConnected();

        const event: Partial<AgentPresenceEvent> = {
            kind: NOSTR_CONFIG.KINDS.AGENT_PRESENCE,
            pubkey: this.pubkey,
            created_at: Math.floor(Date.now() / 1000),
            content: JSON.stringify(content),
            tags: [['t', 'gradience-agent']],
        };

        const signedEvent = await this.signEvent(event);
        await this.publishWithRetry(signedEvent);

        return signedEvent.id!;
    }

    /**
     * Send encrypted DM to recipient
     */
    async sendDM(to: string, content: string): Promise<string> {
        this.ensureConnected();

        const encrypted = await nip04.encrypt(this.privateKey, to, content);

        const event: Partial<EncryptedDMEvent> = {
            kind: NOSTR_CONFIG.KINDS.ENCRYPTED_DM,
            pubkey: this.pubkey,
            created_at: Math.floor(Date.now() / 1000),
            content: encrypted,
            tags: [['p', to]],
        };

        const signedEvent = await this.signEvent(event);
        await this.publishWithRetry(signedEvent);

        return signedEvent.id!;
    }

    /**
     * Subscribe to encrypted DMs
     */
    async subscribeDMs(callback: (event: EncryptedDMEvent) => void): Promise<NostrSubscription> {
        this.ensureConnected();

        const subId = `dm-${Date.now()}`;
        this.activeSubscriptions.add(subId);

        const filter: Filter = {
            kinds: [NOSTR_CONFIG.KINDS.ENCRYPTED_DM],
            '#p': [this.pubkey],
        };

        const sub = this.pool!.subscribeMany(
            this.getConnectedRelays(),
            filter,
            {
                onevent: async (event: NostrEvent) => {
                    this.lastEventAt = Date.now();
                    try {
                        const dmEvent = event as EncryptedDMEvent;
                        callback(dmEvent);
                    } catch (error) {
                        console.error('[NostrClient] Failed to process DM:', error);
                    }
                },
                onclose: () => {
                    this.activeSubscriptions.delete(subId);
                },
            }
        );

        return {
            unsub: () => {
                sub.close();
                this.activeSubscriptions.delete(subId);
            },
        };
    }

    /**
     * Subscribe to agent presence updates
     */
    async subscribePresence(
        filter: PresenceFilter,
        callback: (event: AgentPresenceEvent) => void
    ): Promise<NostrSubscription> {
        this.ensureConnected();

        const subId = `presence-${Date.now()}`;
        this.activeSubscriptions.add(subId);

        const nostrFilter: Filter = {
            kinds: [NOSTR_CONFIG.KINDS.AGENT_PRESENCE],
        };

        // Note: Complex filtering (capabilities, reputation) is done client-side
        // as Nostr filters are limited

        const sub = this.pool!.subscribeMany(
            this.getConnectedRelays(),
            nostrFilter,
            {
                onevent: (event: NostrEvent) => {
                    this.lastEventAt = Date.now();
                    try {
                        const presenceEvent = event as AgentPresenceEvent;
                        const content: AgentPresenceContent = JSON.parse(presenceEvent.content);

                        // Apply client-side filters
                        if (filter.availableOnly && !content.available) return;
                        if (filter.minReputation && content.reputation_score < filter.minReputation) return;
                        if (filter.capabilities && !filter.capabilities.some(c => content.capabilities.includes(c))) return;

                        callback(presenceEvent);
                    } catch (error) {
                        console.error('[NostrClient] Failed to process presence:', error);
                    }
                },
                onclose: () => {
                    this.activeSubscriptions.delete(subId);
                },
            }
        );

        return {
            unsub: () => {
                sub.close();
                this.activeSubscriptions.delete(subId);
            },
        };
    }

    /**
     * Query presence history
     */
    async queryPresence(filter: PresenceFilter, limit: number = 100): Promise<AgentPresenceEvent[]> {
        this.ensureConnected();

        const events: AgentPresenceEvent[] = [];

        return new Promise((resolve) => {
            const queryFilter: Filter = {
                kinds: [NOSTR_CONFIG.KINDS.AGENT_PRESENCE],
                limit,
            };

            const sub = this.pool!.subscribeMany(
                this.getConnectedRelays(),
                queryFilter,
                {
                    onevent: (event: NostrEvent) => {
                        try {
                            const presenceEvent = event as AgentPresenceEvent;
                            const content: AgentPresenceContent = JSON.parse(presenceEvent.content);

                            // Apply filters
                            if (filter.availableOnly && !content.available) return;
                            if (filter.minReputation && content.reputation_score < filter.minReputation) return;
                            if (filter.capabilities && !filter.capabilities.some(c => content.capabilities.includes(c))) return;

                            events.push(presenceEvent);
                        } catch (error) {
                            // Skip invalid events
                        }
                    },
                    onclose: () => {
                        resolve(events.slice(0, limit));
                    },
                }
            );

            // Timeout after SUBSCRIBE timeout
            setTimeout(() => {
                sub.close();
                resolve(events.slice(0, limit));
            }, NOSTR_CONFIG.TIMEOUTS.SUBSCRIBE);
        });
    }

    /**
     * Get health status
     */
    health(): NostrHealthStatus {
        return {
            connected: this.isConnected(),
            relayCount: this.getConnectedRelayCount(),
            activeSubscriptions: this.activeSubscriptions.size,
            lastEventAt: this.lastEventAt,
            relays: Array.from(this.relayStatus.values()),
        };
    }

    // Private helpers

    private ensureConnected(): void {
        if (!this.isConnected()) {
            throw new Error(`[NostrClient] Not connected. Call connect() first.`);
        }
    }

    private getConnectedRelays(): string[] {
        return this.relays.filter(url => this.relayStatus.get(url)?.connected);
    }

    private updateRelayStatus(url: string, update: Partial<RelayStatus>): void {
        const current = this.relayStatus.get(url)!;
        this.relayStatus.set(url, {
            ...current,
            ...update,
            lastConnectedAt: update.connected ? Date.now() : current.lastConnectedAt,
        });
    }

    private async signEvent(event: Partial<NostrEvent>): Promise<NostrEvent> {
        const eventTemplate = {
            kind: event.kind!,
            created_at: event.created_at!,
            tags: event.tags ?? [],
            content: event.content ?? '',
        };
        return finalizeEvent(eventTemplate, this.privateKey);
    }

    private async publishWithRetry(event: NostrEvent): Promise<void> {
        const connectedRelays = this.getConnectedRelays();
        if (connectedRelays.length === 0) {
            throw new Error(`[NostrClient] No connected relays`);
        }

        // Publish to all connected relays using pool's publish method
        const results = await Promise.allSettled(
            connectedRelays.map(async (url) => {
                for (let attempt = 1; attempt <= NOSTR_CONFIG.RETRY.MAX_ATTEMPTS; attempt++) {
                    try {
                        await this.pool!.publish([url], event);
                        return { url, success: true };
                    } catch (error) {
                        if (attempt === NOSTR_CONFIG.RETRY.MAX_ATTEMPTS) {
                            throw error;
                        }
                        await new Promise(r => setTimeout(r, NOSTR_CONFIG.RETRY.BACKOFF_MS * attempt));
                    }
                }
            })
        );

        const successCount = results.filter(r => r.status === 'fulfilled').length;
        if (successCount === 0) {
            throw new Error(`[NostrClient] Failed to publish to all relays`);
        }

        // Warn if some relays failed
        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
            console.warn(`[NostrClient] Published to ${successCount}/${connectedRelays.length} relays`);
        }
    }
}

function fromHex(hex: string): Uint8Array {
    if (hex.length % 2 !== 0) throw new Error('Invalid hex private key length');
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
}
