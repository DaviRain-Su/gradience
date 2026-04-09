/**
 * Chain Hub Integration Module
 *
 * Provides seamless integration between Agent Daemon and Chain Hub:
 * - Reputation sync
 * - Task settlement
 * - Payment routing
 * - Cross-chain bridging
 *
 * @module integrations/chain-hub
 */

import { EventEmitter } from 'node:events';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { ChainHubClient, type ReputationData } from '@gradiences/chain-hub-sdk';
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';

// ============================================================================
// Types
// ============================================================================

export interface ChainHubIntegrationConfig {
    /** Chain Hub RPC endpoint */
    chainHubEndpoint: string;
    /** Solana RPC endpoint */
    solanaRpcEndpoint: string;
    /** Program ID */
    programId?: string;
    /** API key for Chain Hub */
    apiKey?: string;
    /** Enable automatic sync */
    enableAutoSync?: boolean;
    /** Sync interval (ms) */
    syncIntervalMs?: number;
}

export interface TaskSettlementRequest {
    /** Task ID */
    taskId: string;
    /** Agent address */
    agentAddress: string;
    /** Payer address */
    payerAddress: string;
    /** Amount in lamports */
    amount: bigint;
    /** Token mint */
    tokenMint: string;
    /** Evaluation score */
    score: number;
    /** Evaluation proof */
    proof: string;
}

export interface SettlementResult {
    /** Settlement ID */
    settlementId: string;
    /** Transaction signature */
    txSignature: string;
    /** Block time */
    blockTime: number;
    /** Status */
    status: 'confirmed' | 'failed';
    /** Error if failed */
    error?: string;
}

export interface ReputationSyncResult {
    /** Agent address */
    agentAddress: string;
    /** On-chain reputation */
    onChain: ReputationData | null;
    /** Off-chain reputation */
    offChain: ReputationData | null;
    /** Sync status */
    synced: boolean;
    /** Last sync time */
    lastSyncAt: number;
}

export interface PaymentRoute {
    /** Source chain */
    sourceChain: string;
    /** Destination chain */
    destChain: string;
    /** Token address on source */
    sourceToken: string;
    /** Token address on destination */
    destToken: string;
    /** Route type */
    routeType: 'direct' | 'bridge' | 'swap';
    /** Estimated fee */
    estimatedFee: bigint;
    /** Estimated time (seconds) */
    estimatedTimeSeconds: number;
}

// ============================================================================
// Chain Hub Integration
// ============================================================================

export class ChainHubIntegration extends EventEmitter {
    private config: Required<ChainHubIntegrationConfig>;
    private client: ChainHubClient;
    private solanaConnection: Connection;
    private syncInterval?: NodeJS.Timeout;
    private reputationCache: Map<string, ReputationSyncResult> = new Map();

    constructor(config: ChainHubIntegrationConfig) {
        super();

        this.config = {
            programId: '6G39W7JGQz7A6L5dAvotFuRP9UbFdCJg2BqDuj6WJWec',
            enableAutoSync: true,
            syncIntervalMs: 5 * 60 * 1000, // 5 minutes
            apiKey: '',
            ...config,
        };

        this.client = new ChainHubClient({
            baseUrl: this.config.chainHubEndpoint,
        });

        this.solanaConnection = new Connection(this.config.solanaRpcEndpoint, 'confirmed');

        if (this.config.enableAutoSync) {
            this.startAutoSync();
        }
    }

    // -------------------------------------------------------------------------
    // Settlement
    // -------------------------------------------------------------------------

    /**
     * Settle a task payment through Chain Hub
     */
    async settleTask(request: TaskSettlementRequest): Promise<SettlementResult> {
        const settlementId = `ch-${request.taskId}-${Date.now()}`;

        logger.info(
            {
                settlementId,
                taskId: request.taskId,
                agent: request.agentAddress,
                amount: request.amount.toString(),
            },
            'Initiating Chain Hub settlement',
        );

        try {
            // Call Chain Hub to record settlement
            const result = await this.client.recordSettlement({
                taskId: request.taskId,
                agentAddress: request.agentAddress,
                amount: request.amount.toString(),
                tokenMint: request.tokenMint,
                score: request.score,
                proof: request.proof,
            });

            if (!result.success) {
                throw new Error(result.error || 'Settlement failed');
            }

            // Update reputation
            await this.syncReputation(request.agentAddress);

            logger.info({ settlementId, txSignature: result.txSignature }, 'Chain Hub settlement completed');

            this.emit('settlement_completed', {
                settlementId,
                taskId: request.taskId,
                agentAddress: request.agentAddress,
            });

            return {
                settlementId,
                txSignature: result.txSignature || '',
                blockTime: Date.now(),
                status: 'confirmed',
            };
        } catch (error) {
            logger.error({ error, settlementId }, 'Chain Hub settlement failed');

            return {
                settlementId,
                txSignature: '',
                blockTime: 0,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    // -------------------------------------------------------------------------
    // Reputation
    // -------------------------------------------------------------------------

    /**
     * Get agent reputation (with caching)
     */
    async getReputation(agentAddress: string): Promise<ReputationData | null> {
        // Check cache
        const cached = this.reputationCache.get(agentAddress);
        if (cached && Date.now() - cached.lastSyncAt < this.config.syncIntervalMs) {
            return cached.onChain;
        }

        // Fetch from Chain Hub
        return this.syncReputation(agentAddress);
    }

    /**
     * Sync reputation from Chain Hub
     */
    async syncReputation(agentAddress: string): Promise<ReputationData | null> {
        try {
            // Fetch from Chain Hub
            const reputation = await this.client.getReputation(agentAddress);

            // Update cache
            const syncResult: ReputationSyncResult = {
                agentAddress,
                onChain: reputation,
                offChain: null,
                synced: true,
                lastSyncAt: Date.now(),
            };

            this.reputationCache.set(agentAddress, syncResult);

            this.emit('reputation_synced', { agentAddress, reputation });

            return reputation;
        } catch (error) {
            logger.error({ error, agentAddress }, 'Failed to sync reputation');
            return null;
        }
    }

    /**
     * Batch sync reputations
     */
    async batchSyncReputations(agentAddresses: string[]): Promise<{
        successful: string[];
        failed: string[];
    }> {
        const successful: string[] = [];
        const failed: string[] = [];

        // Process in batches of 10
        const batchSize = 10;
        for (let i = 0; i < agentAddresses.length; i += batchSize) {
            const batch = agentAddresses.slice(i, i + batchSize);

            const results = await Promise.allSettled(batch.map((address) => this.syncReputation(address)));

            results.forEach((result, index) => {
                const address = batch[index];
                if (result.status === 'fulfilled') {
                    successful.push(address);
                } else {
                    failed.push(address);
                }
            });
        }

        return { successful, failed };
    }

    /**
     * Get reputations for all agents under a master wallet
     * GRA-225a: Chain Hub Reputation Integration
     */
    async getReputationsByMaster(masterWallet: string): Promise<
        Array<{
            agentAddress: string;
            reputation: ReputationData;
        }>
    > {
        try {
            // Fetch all agents under master wallet from Chain Hub
            const agents = await this.client.getAgentsByMaster({
                masterWallet,
                includeReputation: true,
            });

            return agents
                .filter((a) => a.reputation !== null)
                .map((a) => ({
                    agentAddress: a.address,
                    reputation: a.reputation!,
                }));
        } catch (error) {
            logger.error({ error, masterWallet }, 'Failed to get reputations by master');
            return [];
        }
    }
    async getReputationRanking(
        category?: string,
        limit: number = 100,
    ): Promise<Array<{ agentAddress: string; reputation: ReputationData }>> {
        try {
            const rankings = await this.client.getRankings({
                category,
                limit,
            });

            return rankings.map((r) => ({
                agentAddress: r.agentAddress,
                reputation: r.reputation,
            }));
        } catch (error) {
            logger.error({ error }, 'Failed to get reputation ranking');
            return [];
        }
    }

    // -------------------------------------------------------------------------
    // Payment Routing
    // -------------------------------------------------------------------------

    /**
     * Find optimal payment route
     */
    async findPaymentRoute(
        sourceChain: string,
        destChain: string,
        token: string,
        amount: bigint,
    ): Promise<PaymentRoute | null> {
        try {
            const routes = await this.client.queryRoutes({
                sourceChain,
                destChain,
                token,
                amount: amount.toString(),
            });

            if (routes.length === 0) {
                return null;
            }

            // Return best route (lowest fee)
            const bestRoute = routes.reduce((best, current) =>
                current.estimatedFee < best.estimatedFee ? current : best,
            );

            return {
                sourceChain: bestRoute.sourceChain,
                destChain: bestRoute.destChain,
                sourceToken: bestRoute.sourceToken,
                destToken: bestRoute.destToken,
                routeType: bestRoute.routeType as 'direct' | 'bridge' | 'swap',
                estimatedFee: BigInt(bestRoute.estimatedFee),
                estimatedTimeSeconds: bestRoute.estimatedTimeSeconds,
            };
        } catch (error) {
            logger.error({ error }, 'Failed to find payment route');
            return null;
        }
    }

    /**
     * Execute cross-chain payment
     */
    async executeCrossChainPayment(params: {
        route: PaymentRoute;
        sender: string;
        recipient: string;
        amount: bigint;
    }): Promise<{ txSignature: string; status: string }> {
        try {
            const result = await this.client.executeCrossChainTransfer({
                sourceChain: params.route.sourceChain,
                destChain: params.route.destChain,
                sourceToken: params.route.sourceToken,
                destToken: params.route.destToken,
                sender: params.sender,
                recipient: params.recipient,
                amount: params.amount.toString(),
            });

            return {
                txSignature: result.txSignature,
                status: result.status,
            };
        } catch (error) {
            logger.error({ error }, 'Cross-chain payment failed');
            throw error;
        }
    }

    // -------------------------------------------------------------------------
    // Auto Sync
    // -------------------------------------------------------------------------

    private startAutoSync(): void {
        this.syncInterval = setInterval(() => {
            this.syncAllReputations();
        }, this.config.syncIntervalMs);

        logger.info({ intervalMs: this.config.syncIntervalMs }, 'Started auto reputation sync');
    }

    private async syncAllReputations(): Promise<void> {
        const addresses = Array.from(this.reputationCache.keys());

        if (addresses.length === 0) {
            return;
        }

        logger.info({ count: addresses.length }, 'Auto-syncing reputations');

        const { successful, failed } = await this.batchSyncReputations(addresses);

        logger.info({ successful: successful.length, failed: failed.length }, 'Reputation sync completed');
    }

    // -------------------------------------------------------------------------
    // Health Check
    // -------------------------------------------------------------------------

    /**
     * Check Chain Hub health
     */
    async healthCheck(): Promise<{
        healthy: boolean;
        chainHub: boolean;
        solana: boolean;
        latencyMs: number;
    }> {
        const startTime = Date.now();

        try {
            const [chainHubHealth, solanaHealth] = await Promise.all([
                this.client.healthCheck(),
                this.solanaConnection.getHealth().then(
                    () => true,
                    () => false,
                ),
            ]);

            return {
                healthy: chainHubHealth && solanaHealth,
                chainHub: chainHubHealth,
                solana: solanaHealth,
                latencyMs: Date.now() - startTime,
            };
        } catch (error) {
            return {
                healthy: false,
                chainHub: false,
                solana: false,
                latencyMs: Date.now() - startTime,
            };
        }
    }

    // -------------------------------------------------------------------------
    // Stats
    // -------------------------------------------------------------------------

    /**
     * Get integration stats
     */
    getStats(): {
        cachedReputations: number;
        autoSyncEnabled: boolean;
        lastSyncAt: number | null;
    } {
        const lastSync = Array.from(this.reputationCache.values()).reduce(
            (latest, current) => (current.lastSyncAt > latest ? current.lastSyncAt : latest),
            0,
        );

        return {
            cachedReputations: this.reputationCache.size,
            autoSyncEnabled: this.config.enableAutoSync,
            lastSyncAt: lastSync || null,
        };
    }

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------

    async close(): Promise<void> {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        this.reputationCache.clear();
        this.removeAllListeners();

        logger.info('Chain Hub integration closed');
    }
}

// ============================================================================
// Factory
// ============================================================================

export function createChainHubIntegration(config: ChainHubIntegrationConfig): ChainHubIntegration {
    return new ChainHubIntegration(config);
}
