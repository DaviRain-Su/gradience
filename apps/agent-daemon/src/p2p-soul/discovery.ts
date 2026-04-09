/**
 * P2P Soul Handshake Protocol - Discovery Service
 *
 * Handles discovery of potential matches via Nostr relay.
 *
 * @module p2p-soul/discovery
 */

import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import type { SoulDigest, DiscoverPayload, P2pSoulConfig } from './types.js';
import { DisclosureLevel } from './types.js';

// ============================================================================
// Discovery Service
// ============================================================================

export interface DiscoveryOptions {
    seeking?: string;
    categories?: string[];
    minReputationScore?: number;
    maxResults?: number;
}

export class DiscoveryService extends EventEmitter {
    private config: P2pSoulConfig;
    private discovered: Map<string, SoulDigest> = new Map();
    private pendingInvites: Map<string, any> = new Map();
    private relayConnections = new Map<string, WebSocket>();
    private subscribed = false;

    constructor(config: P2pSoulConfig) {
        super();
        this.config = config;
    }

    /**
     * Connect to configured Nostr relays
     */
    async connectRelays(): Promise<void> {
        if (this.relayConnections.size > 0) return;
        const relays = this.config.nostrRelays || [];
        if (relays.length === 0) return;

        const connectPromises = relays.map(
            (url) =>
                new Promise<void>((resolve) => {
                    try {
                        const ws = new WebSocket(url);
                        ws.on('open', () => {
                            this.relayConnections.set(url, ws);
                            resolve();
                        });
                        ws.on('error', () => resolve());
                        ws.on('close', () => this.relayConnections.delete(url));
                    } catch {
                        resolve();
                    }
                }),
        );

        await Promise.all(connectPromises);
    }

    /**
     * Disconnect from all relays
     */
    disconnectRelays(): void {
        for (const ws of this.relayConnections.values()) {
            try {
                ws.close();
            } catch {}
        }
        this.relayConnections.clear();
        this.subscribed = false;
    }

    /**
     * Start discovery process
     */
    async discover(options: DiscoveryOptions = {}): Promise<void> {
        this.emit('discovering', { options });

        await this.connectRelays();

        if (this.relayConnections.size === 0) {
            setTimeout(() => {
                this.emit('discovering_complete', { count: this.discovered.size });
            }, 1000);
            return;
        }

        // Subscribe to discovery events on all connected relays
        if (!this.subscribed) {
            for (const ws of this.relayConnections.values()) {
                this.attachRelayHandler(ws);
                ws.send(JSON.stringify(['REQ', 'p2p-soul-discovery', { kinds: [42001] }]));
            }
            this.subscribed = true;
        }

        setTimeout(() => {
            this.emit('discovering_complete', { count: this.discovered.size });
        }, this.config.discoverTimeoutMs || 5000);
    }

    private attachRelayHandler(ws: WebSocket): void {
        ws.on('message', (data: WebSocket.RawData) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg[0] === 'EVENT' && msg[2]?.kind === 42001) {
                    const digest: SoulDigest | undefined = msg[2]?.content ? JSON.parse(msg[2].content) : undefined;
                    if (digest && digest.did) {
                        this.handleDiscovery(digest);
                    }
                }
            } catch {
                // ignore malformed relay messages
            }
        });
    }

    /**
     * Publish discovery broadcast
     */
    async publishDiscovery(
        did: string,
        reputationScore: number,
        interests: string[],
        categories: string[],
        seeking: string,
    ): Promise<void> {
        const payload: DiscoverPayload = {
            publicProfile: {
                did,
                reputationScore,
                activeCategories: categories,
                seeking: seeking as any,
            },
            interestHashes: interests.map((i) => this.hashInterest(i)),
            maxDisclosureLevel: DisclosureLevel.LEVEL_4_FULL,
            expiresAt: Date.now() + 3600000, // 1 hour
        };

        await this.connectRelays();

        if (this.relayConnections.size > 0) {
            const event = [
                'EVENT',
                {
                    kind: 42001,
                    created_at: Math.floor(Date.now() / 1000),
                    tags: [['d', did]],
                    content: JSON.stringify({
                        did,
                        reputationScore,
                        activeCategories: categories,
                        seeking,
                        interestHashes: payload.interestHashes,
                        skillsRoot: '',
                        maxDisclosureLevel: DisclosureLevel.LEVEL_4_FULL,
                    } as SoulDigest),
                },
            ];
            for (const ws of this.relayConnections.values()) {
                try {
                    ws.send(JSON.stringify(event));
                } catch {}
            }
        }

        this.emit('published', { did, payload });
    }

    /**
     * Handle incoming discovery
     */
    handleDiscovery(digest: SoulDigest): void {
        // Check if already discovered
        if (this.discovered.has(digest.did)) {
            return;
        }

        this.discovered.set(digest.did, digest);
        this.emit('candidate_found', digest);
    }

    /**
     * Get discovered candidates
     */
    getCandidates(
        options: {
            minReputationScore?: number;
            seeking?: string;
            limit?: number;
        } = {},
    ): SoulDigest[] {
        let candidates = Array.from(this.discovered.values());

        if (options.minReputationScore !== undefined) {
            candidates = candidates.filter((c) => c.reputationScore >= options.minReputationScore!);
        }

        if (options.seeking) {
            candidates = candidates.filter((c) => c.seeking.toLowerCase() === options.seeking!.toLowerCase());
        }

        if (options.limit) {
            candidates = candidates.slice(0, options.limit);
        }

        return candidates;
    }

    /**
     * Get a specific candidate by DID
     */
    getCandidate(did: string): SoulDigest | undefined {
        return this.discovered.get(did);
    }

    /**
     * Store pending invite
     */
    storePendingInvite(inviteId: string, invite: any): void {
        this.pendingInvites.set(inviteId, {
            ...invite,
            receivedAt: Date.now(),
        });
        this.emit('invite_received', { inviteId, invite });
    }

    /**
     * Get pending invites
     */
    getPendingInvites(did: string): any[] {
        return Array.from(this.pendingInvites.values()).filter(
            (invite) => invite.payload?.targetDid === did || !invite.payload?.targetDid,
        );
    }

    /**
     * Get a specific pending invite
     */
    getPendingInvite(inviteId: string): any | undefined {
        return this.pendingInvites.get(inviteId);
    }

    /**
     * Remove pending invite
     */
    removePendingInvite(inviteId: string): void {
        this.pendingInvites.delete(inviteId);
    }

    /**
     * Clear all discoveries
     */
    clear(): void {
        this.discovered.clear();
        this.pendingInvites.clear();
    }

    /**
     * Hash an interest tag
     */
    private hashInterest(interest: string): string {
        // Simple hash - should match the one in crypto.ts
        const crypto = require('node:crypto');
        return crypto.createHash('sha256').update(`interest:${interest.toLowerCase().trim()}`).digest('hex');
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.disconnectRelays();
        this.clear();
        this.removeAllListeners();
    }
}

// ============================================================================
// Factory
// ============================================================================

export function createDiscoveryService(config: P2pSoulConfig): DiscoveryService {
    return new DiscoveryService(config);
}
