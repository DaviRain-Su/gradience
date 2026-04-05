/**
 * P2P Soul Handshake Protocol - Discovery Service
 * 
 * Handles discovery of potential matches via Nostr relay.
 * 
 * @module p2p-soul/discovery
 */

import { EventEmitter } from 'node:events';
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
  
  constructor(config: P2pSoulConfig) {
    super();
    this.config = config;
  }
  
  /**
   * Start discovery process
   */
  async discover(options: DiscoveryOptions = {}): Promise<void> {
    this.emit('discovering', { options });
    
    // TODO: Connect to Nostr relays and publish DISCOVER message
    // For now, emit mock behavior
    
    setTimeout(() => {
      this.emit('discovering_complete', { count: this.discovered.size });
    }, 1000);
  }
  
  /**
   * Publish discovery broadcast
   */
  async publishDiscovery(
    did: string,
    reputationScore: number,
    interests: string[],
    categories: string[],
    seeking: string
  ): Promise<void> {
    const payload: DiscoverPayload = {
      publicProfile: {
        did,
        reputationScore,
        activeCategories: categories,
        seeking: seeking as any,
      },
      interestHashes: interests.map(i => this.hashInterest(i)),
      maxDisclosureLevel: DisclosureLevel.LEVEL_4_FULL,
      expiresAt: Date.now() + 3600000, // 1 hour
    };
    
    // TODO: Publish to Nostr relays
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
  getCandidates(options: {
    minReputationScore?: number;
    seeking?: string;
    limit?: number;
  } = {}): SoulDigest[] {
    let candidates = Array.from(this.discovered.values());
    
    if (options.minReputationScore !== undefined) {
      candidates = candidates.filter(
        c => c.reputationScore >= options.minReputationScore!
      );
    }
    
    if (options.seeking) {
      candidates = candidates.filter(
        c => c.seeking.toLowerCase() === options.seeking!.toLowerCase()
      );
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
    return Array.from(this.pendingInvites.values())
      .filter(invite => invite.payload?.targetDid === did || !invite.payload?.targetDid);
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
    return crypto.createHash('sha256')
      .update(`interest:${interest.toLowerCase().trim()}`)
      .digest('hex');
  }
  
  /**
   * Dispose resources
   */
  dispose(): void {
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
