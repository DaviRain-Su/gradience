/**
 * ChainHub Services Module
 *
 * New Architecture: Fine-grained service calls with X402 micropayments
 *
 * Flow:
 * 1. Discover service via ChainHub (or fallback)
 * 2. Create X402 payment channel (lock funds)
 * 3. Call service via A2A (XMTP/Nostr)
 * 4. Settlement on success / Rollback on failure
 */

import type { Database } from 'better-sqlite3';
import type { Keypair } from '@solana/web3.js';

// Service offering from a provider
export interface ServiceOffer {
    id: string;
    provider: string; // Agent address
    serviceType: string; // "translation", "calculation", etc.
    capability: string; // Detailed capability description
    pricing: {
        model: 'per_call'; // Only per-call for now
        amount: bigint; // Lamports per call
        currency: 'SOL';
    };
    ttl: number; // Time-to-live in seconds
    endpoint?: string; // Direct endpoint (optional)
    reputation: {
        score: number; // 0-100
        totalCalls: number;
        successRate: number; // 0.0-1.0
    };
}

// X402 Payment authorization
export interface X402Authorization {
    channelId: string;
    payer: string;
    recipient: string;
    maxAmount: bigint;
    validUntil: number; // Timestamp
    signature: string;
}

// Service call request
export interface ServiceCallRequest {
    serviceId: string;
    params: Record<string, any>;
    timeout: number; // Max wait time
    maxPayment: bigint; // Max willing to pay
}

// Service call result
export interface ServiceCallResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    actualPayment?: bigint; // Actual amount paid
    provider: string;
    duration: number; // Call duration in ms
}

export class ChainHubServices {
    private db: Database;
    private wallet: Keypair;
    private a2aRouter: any; // A2ARouter instance
    private x402Manager: any; // X402PaymentManager instance

    constructor(db: Database, wallet: Keypair, a2aRouter: any, x402Manager: any) {
        this.db = db;
        this.wallet = wallet;
        this.a2aRouter = a2aRouter;
        this.x402Manager = x402Manager;
        this.initTables();
    }

    private initTables(): void {
        // Service call history
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS service_calls (
        id TEXT PRIMARY KEY,
        service_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        request_params TEXT,
        response_data TEXT,
        payment_amount TEXT,
        status TEXT,              -- 'success', 'failed', 'rolled_back'
        error_message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT
      )
    `);

        // Cached service offers
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS cached_offers (
        service_id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        service_type TEXT,
        pricing_model TEXT,
        pricing_amount TEXT,
        reputation_score INTEGER,
        success_rate REAL,
        cached_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT
      )
    `);
    }

    /**
     * Step 1: Discover service
     * Priority: 1. ChainHub → 2. A2A broadcast → 3. Cache
     */
    async discoverService(
        serviceType: string,
        maxPrice: bigint,
        minReputation: number = 70,
    ): Promise<ServiceOffer | null> {
        // Priority 1: Query ChainHub
        try {
            const offer = await this.queryChainHub(serviceType, maxPrice, minReputation);
            if (offer) {
                this.cacheOffer(offer);
                return offer;
            }
        } catch (err) {
            console.warn('ChainHub discovery failed:', err);
        }

        // Priority 2: A2A broadcast discovery
        try {
            const offers = await this.broadcastDiscovery(serviceType, maxPrice);
            const validOffer = offers.find((o) => o.pricing.amount <= maxPrice && o.reputation.score >= minReputation);
            if (validOffer) {
                this.cacheOffer(validOffer);
                return validOffer;
            }
        } catch (err) {
            console.warn('A2A discovery failed:', err);
        }

        // Priority 3: Check cache
        const cached = this.getCachedOffer(serviceType);
        if (cached && cached.pricing.amount <= maxPrice) {
            // Check if still valid
            if (new Date(cached.ttl * 1000) > new Date()) {
                return cached;
            }
        }

        // Discovery failed
        return null;
    }

    /**
     * Step 2 & 3: Call service with X402 payment
     */
    async callService<T = any>(request: ServiceCallRequest): Promise<ServiceCallResult<T>> {
        const startTime = Date.now();
        const callId = crypto.randomUUID();

        try {
            // Get service offer
            const offer = await this.discoverService(request.serviceId, request.maxPayment);

            if (!offer) {
                throw new Error(`Service not found: ${request.serviceId}`);
            }

            // Step 2: Create X402 payment channel (lock funds)
            const auth = await this.x402Manager.createAuthorization({
                payer: this.wallet.publicKey.toBase58(),
                recipient: offer.provider,
                maxAmount: request.maxPayment,
                validFor: 300, // 5 minutes
            });

            // Record pending call
            this.recordCall(callId, request, offer, 'pending');

            // Step 3: Call service via A2A
            const response = await this.executeServiceCall(offer, request, auth);

            if (response.success) {
                // Settlement: Pay actual amount
                const actualPayment = offer.pricing.amount;
                await this.x402Manager.settle(auth.channelId, actualPayment);

                this.recordCall(callId, request, offer, 'success', actualPayment);

                return {
                    success: true,
                    data: response.data,
                    actualPayment,
                    provider: offer.provider,
                    duration: Date.now() - startTime,
                };
            } else {
                // Service execution failed - rollback
                await this.x402Manager.rollback(auth.channelId);

                this.recordCall(callId, request, offer, 'failed', 0n, response.error);

                return {
                    success: false,
                    error: response.error || 'Service execution failed',
                    provider: offer.provider,
                    duration: Date.now() - startTime,
                };
            }
        } catch (err) {
            // Critical error - ensure rollback
            await this.x402Manager.rollbackAll();

            this.recordCall(callId, request, null, 'failed', 0n, String(err));

            return {
                success: false,
                error: err instanceof Error ? err.message : 'Service call failed',
                duration: Date.now() - startTime,
                provider: '',
            };
        }
    }

    // Private methods...

    private async queryChainHub(
        serviceType: string,
        maxPrice: bigint,
        minReputation: number,
    ): Promise<ServiceOffer | null> {
        // Query on-chain skill registry
        // Implementation depends on chain-hub SDK
        return null; // Placeholder
    }

    private async broadcastDiscovery(serviceType: string, maxPrice: bigint): Promise<ServiceOffer[]> {
        // Broadcast via A2A (XMTP/Nostr)
        // Implementation depends on a2a-router
        return []; // Placeholder
    }

    private cacheOffer(offer: ServiceOffer): void {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cached_offers 
      (service_id, provider, service_type, pricing_model, pricing_amount,
       reputation_score, success_rate, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            offer.id,
            offer.provider,
            offer.serviceType,
            offer.pricing.model,
            offer.pricing.amount.toString(),
            offer.reputation.score,
            offer.reputation.successRate,
            new Date(Date.now() + offer.ttl * 1000).toISOString(),
        );
    }

    private getCachedOffer(serviceType: string): ServiceOffer | null {
        const stmt = this.db.prepare(`
      SELECT * FROM cached_offers 
      WHERE service_type = ? AND expires_at > CURRENT_TIMESTAMP
      ORDER BY reputation_score DESC, pricing_amount ASC
      LIMIT 1
    `);

        const row = stmt.get(serviceType) as any;
        if (!row) return null;

        return {
            id: row.service_id,
            provider: row.provider,
            serviceType: row.service_type,
            capability: row.capability ?? '',
            pricing: {
                model: row.pricing_model,
                amount: BigInt(row.pricing_amount),
                currency: 'SOL',
            },
            ttl: 0, // Cached, no TTL
            reputation: {
                score: row.reputation_score,
                totalCalls: 0, // Not cached
                successRate: row.success_rate,
            },
        };
    }

    private async executeServiceCall(
        offer: ServiceOffer,
        request: ServiceCallRequest,
        auth: X402Authorization,
    ): Promise<{ success: boolean; data?: any; error?: string }> {
        // Send request via A2A with X402 authorization
        const message = {
            type: 'SERVICE_CALL',
            serviceId: offer.id,
            params: request.params,
            x402Auth: auth,
            timeout: request.timeout,
        };

        // Implementation depends on a2a-router
        // This is a placeholder
        return { success: false, error: 'Not implemented' };
    }

    private recordCall(
        callId: string,
        request: ServiceCallRequest,
        offer: ServiceOffer | null,
        status: string,
        payment: bigint = 0n,
        error?: string,
    ): void {
        const stmt = this.db.prepare(`
      INSERT INTO service_calls 
      (id, service_id, provider, request_params, payment_amount, status, error_message, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

        stmt.run(
            callId,
            request.serviceId,
            offer?.provider || 'unknown',
            JSON.stringify(request.params),
            payment.toString(),
            status,
            error || null,
        );
    }
}

export default ChainHubServices;
