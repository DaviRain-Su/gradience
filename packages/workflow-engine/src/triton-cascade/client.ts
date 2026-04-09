/**
 * Triton Cascade Integration - Main Client
 *
 * @module triton-cascade/client
 */

import type {
    TritonCascadeConfig,
    CascadeTransactionResponse,
    SendTransactionOptions,
    PriorityFeeEstimate,
    ConnectionHealth,
    ClientMetrics,
    DeliveryPath,
} from './types.js';
import { TransactionQueue } from './queue.js';
import { HealthMonitor } from './health-monitor.js';
import { FeeEstimator } from './fee-estimator.js';
import { JitoBundleClient } from './jito-bundle.js';
import { createConfigFromEnv, mergeConfig, getJitoBlockEngineUrl, sanitizeConfigForLogging } from './config.js';
import { CascadeError, CascadeErrorCodes, isRetryableError } from './errors.js';
import { DEFAULTS } from './config.js';

/**
 * Triton Cascade client
 */
export class TritonCascadeClient {
    private readonly config: TritonCascadeConfig;
    private readonly queue: TransactionQueue;
    private readonly healthMonitor: HealthMonitor;
    private readonly feeEstimator: FeeEstimator;
    private readonly jitoClient?: JitoBundleClient;
    private readonly metrics: ClientMetrics;
    private closed = false;
    private requestId = 0;

    constructor(config?: Partial<TritonCascadeConfig>) {
        // Merge configuration
        this.config = config ? mergeConfig(config) : createConfigFromEnv();

        // Initialize queue
        this.queue = new TransactionQueue({
            maxConcurrent: this.config.maxConcurrentTransactions,
        });

        // Initialize health monitor
        this.healthMonitor = new HealthMonitor({
            endpoint: this.config.rpcEndpoint,
            onHealthChange: (health) => {
                this.emit('connection:health_changed', health);
            },
        });

        // Initialize fee estimator
        this.feeEstimator = new FeeEstimator({
            endpoint: this.config.rpcEndpoint,
            apiToken: this.config.apiToken,
        });

        // Initialize Jito client if enabled
        if (this.config.enableJitoBundle) {
            const jitoUrl = this.config.jitoBlockEngineUrl || getJitoBlockEngineUrl(this.config.network);
            this.jitoClient = new JitoBundleClient({
                blockEngineUrl: jitoUrl,
                bundleTimeoutMs: this.config.confirmationTimeoutMs,
            });
        }

        // Initialize metrics
        this.metrics = {
            transactionsSubmitted: 0,
            transactionsConfirmed: 0,
            transactionsFailed: 0,
            totalRetries: 0,
            averageLatencyMs: 0,
            queueSize: 0,
        };

        // Start health monitoring
        this.healthMonitor.start();

        // Log initialization
        console.log('[TritonCascade] Client initialized', {
            config: sanitizeConfigForLogging(this.config),
        });
    }

    /**
     * Send a transaction to the Cascade network
     */
    async sendTransaction(
        transaction: string,
        options: SendTransactionOptions = {},
    ): Promise<CascadeTransactionResponse> {
        if (this.closed) {
            throw new CascadeError(CascadeErrorCodes.CONNECTION_ERROR, 'Client is closed');
        }

        const startTime = Date.now();
        const maxRetries = options.maxRetries ?? this.config.maxRetries;

        // Build request
        const request = await this.buildRequest(transaction, options);

        // Try to send transaction
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await this.submitTransaction(request, options);

                // Update metrics
                this.updateMetrics(startTime, true);

                return response;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // Check if error is retryable
                if (!isRetryableError(error) || attempt >= maxRetries) {
                    break;
                }

                // Update metrics
                this.metrics.totalRetries++;

                // Wait before retry
                const delay = this.calculateRetryDelay(attempt);
                console.log(`[TritonCascade] Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
                await this.sleep(delay);
            }
        }

        // Update metrics
        this.updateMetrics(startTime, false);

        // Throw final error
        throw lastError || new CascadeError(CascadeErrorCodes.UNKNOWN_ERROR, 'Transaction failed after all retries');
    }

    /**
     * Get priority fee estimate
     */
    async getPriorityFeeEstimate(
        commitment: 'processed' | 'confirmed' | 'finalized' = 'confirmed',
    ): Promise<PriorityFeeEstimate> {
        const estimate = await this.feeEstimator.getEstimate(commitment);
        this.emit('priority_fee:updated', { estimate });
        return estimate;
    }

    /**
     * Get connection health status
     */
    async getHealthStatus(): Promise<ConnectionHealth> {
        return this.healthMonitor.forceCheck();
    }

    /**
     * Get client metrics
     */
    getMetrics(): ClientMetrics {
        return {
            ...this.metrics,
            queueSize: this.queue.getStats().queueSize,
        };
    }

    /**
     * Close the client
     */
    async close(): Promise<void> {
        if (this.closed) return;

        this.closed = true;
        this.healthMonitor.stop();
        this.queue.destroy();
        this.feeEstimator.clearCache();

        console.log('[TritonCascade] Client closed');
    }

    /**
     * Build transaction request
     */
    private async buildRequest(
        transaction: string,
        options: SendTransactionOptions,
    ): Promise<import('./types.js').CascadeTransactionRequest> {
        // Decode transaction to extract metadata
        // Note: In a real implementation, you'd use @solana/web3.js to decode
        // For now, we'll use placeholder values

        return {
            transaction,
            signature: (options.metadata?.signature as string) || '',
            recentBlockhash: (options.metadata?.recentBlockhash as string) || '',
            lastValidBlockHeight: (options.metadata?.lastValidBlockHeight as number) || 0,
            sender: (options.metadata?.sender as string) || '',
            transactionType: options.transactionType || 'other',
            useJitoBundle: options.useJitoBundle ?? this.config.enableJitoBundle,
            priorityFee: options.priorityFee,
            metadata: options.metadata,
        };
    }

    /**
     * Submit transaction to the network
     */
    private async submitTransaction(
        request: import('./types.js').CascadeTransactionRequest,
        options: SendTransactionOptions,
    ): Promise<CascadeTransactionResponse> {
        const submittedAt = Date.now();

        // Calculate priority fee
        const priorityFee = await this.feeEstimator.calculateFee({
            strategy: this.config.priorityFeeStrategy,
            fixedFee: options.priorityFee ?? this.config.fixedPriorityFeeLamports,
            commitment: options.commitment || 'confirmed',
        });

        // Try Jito Bundle if enabled
        if (request.useJitoBundle && this.jitoClient) {
            try {
                const jitoAvailable = await this.jitoClient.isAvailable();

                if (jitoAvailable) {
                    const bundleResult = await this.jitoClient.submitBundle([request.transaction], {
                        timeoutMs: this.config.confirmationTimeoutMs,
                    });

                    if (bundleResult.status === 'landed') {
                        const response: CascadeTransactionResponse = {
                            signature: request.signature,
                            status: 'confirmed',
                            confirmation: {
                                slot: bundleResult.landedSlot || 0,
                                confirmations: 1,
                                err: null,
                            },
                            priorityFeeUsed: priorityFee,
                            submittedAt,
                            confirmedAt: Date.now(),
                            deliveryPath: 'jito_bundle',
                        };

                        this.emit('transaction:submitted', {
                            signature: request.signature,
                            deliveryPath: 'jito_bundle',
                            timestamp: submittedAt,
                        });

                        this.emit('transaction:confirmed', {
                            signature: request.signature,
                            slot: bundleResult.landedSlot || 0,
                            confirmations: 1,
                        });

                        return response;
                    }
                }
            } catch (error) {
                console.log('[TritonCascade] Jito Bundle failed, falling back to RPC:', error);
                // Fall through to standard RPC
            }
        }

        // Submit via standard RPC
        const result = await this.submitViaRpc(request, options, priorityFee);

        // Wait for confirmation
        const confirmation = await this.waitForConfirmation(
            result.signature,
            request.lastValidBlockHeight,
            options.commitment || 'confirmed',
        );

        const response: CascadeTransactionResponse = {
            signature: result.signature,
            status: confirmation.err ? 'failed' : 'confirmed',
            confirmation: confirmation.err
                ? undefined
                : {
                      slot: confirmation.slot,
                      confirmations: confirmation.confirmations || 0,
                      err: confirmation.err,
                  },
            priorityFeeUsed: priorityFee,
            submittedAt,
            confirmedAt: Date.now(),
            deliveryPath: 'cascade',
            error: confirmation.err
                ? {
                      code: CascadeErrorCodes.TRANSACTION_FAILED,
                      message: JSON.stringify(confirmation.err),
                  }
                : undefined,
        };

        if (confirmation.err) {
            this.emit('transaction:failed', {
                signature: request.signature,
                error: new Error(JSON.stringify(confirmation.err)),
                retryable: false,
            });
            throw new CascadeError(CascadeErrorCodes.TRANSACTION_FAILED, JSON.stringify(confirmation.err));
        }

        this.emit('transaction:confirmed', {
            signature: request.signature,
            slot: confirmation.slot,
            confirmations: confirmation.confirmations || 0,
        });

        return response;
    }

    /**
     * Submit transaction via RPC
     */
    private async submitViaRpc(
        request: import('./types.js').CascadeTransactionRequest,
        options: SendTransactionOptions,
        priorityFee: number,
    ): Promise<{ signature: string }> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (this.config.apiToken) {
            headers['Authorization'] = `Bearer ${this.config.apiToken}`;
        }

        const params: unknown[] = [
            request.transaction,
            {
                encoding: 'base64',
                skipPreflight: options.skipPreflight ?? false,
                preflightCommitment: options.preflightCommitment || 'confirmed',
                maxRetries: 0, // We handle retries ourselves
            },
        ];

        // Add priority fee if specified
        if (priorityFee > 0) {
            // Note: Triton Cascade may support priority fees via specific parameters
            // This is a placeholder for the actual implementation
        }

        const response = await fetch(this.config.rpcEndpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: ++this.requestId,
                method: 'sendTransaction',
                params,
            }),
            signal: AbortSignal.timeout(this.config.connectionTimeoutMs),
        });

        if (!response.ok) {
            this.healthMonitor.markUnhealthy();
            throw new CascadeError(
                CascadeErrorCodes.CONNECTION_ERROR,
                `HTTP ${response.status}: ${response.statusText}`,
                { data: { status: response.status } },
            );
        }

        const data = await response.json();

        if (data.error) {
            throw new CascadeError(
                data.error.code === -32002 ? CascadeErrorCodes.SIMULATION_FAILED : CascadeErrorCodes.UNKNOWN_ERROR,
                data.error.message,
                { data: { rpcError: data.error } },
            );
        }

        this.healthMonitor.markHealthy(Date.now());

        this.emit('transaction:submitted', {
            signature: data.result,
            deliveryPath: 'cascade',
            timestamp: Date.now(),
        });

        return { signature: data.result };
    }

    /**
     * Wait for transaction confirmation
     */
    private async waitForConfirmation(
        signature: string,
        lastValidBlockHeight: number,
        commitment: 'processed' | 'confirmed' | 'finalized',
    ): Promise<{ slot: number; confirmations?: number; err: unknown }> {
        const startTime = Date.now();
        const timeoutMs = this.config.confirmationTimeoutMs;

        while (Date.now() - startTime < timeoutMs) {
            // Check if block height exceeded
            const currentBlockHeight = await this.getBlockHeight();
            if (currentBlockHeight > lastValidBlockHeight) {
                throw new CascadeError(CascadeErrorCodes.BLOCKHASH_EXPIRED, 'Transaction blockhash expired');
            }

            // Check signature status
            const status = await this.getSignatureStatus(signature);

            if (status) {
                if (status.err) {
                    return { slot: status.slot, err: status.err };
                }

                if (this.isCommitmentSatisfied(status.confirmations, commitment)) {
                    return {
                        slot: status.slot,
                        confirmations: status.confirmations || 0,
                        err: null,
                    };
                }
            }

            // Wait before next check
            await this.sleep(500);
        }

        throw new CascadeError(CascadeErrorCodes.TIMEOUT_ERROR, 'Transaction confirmation timeout');
    }

    /**
     * Get current block height
     */
    private async getBlockHeight(): Promise<number> {
        const response = await fetch(this.config.rpcEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: ++this.requestId,
                method: 'getBlockHeight',
                params: [],
            }),
        });

        const data = await response.json();
        return data.result || 0;
    }

    /**
     * Get signature status
     */
    private async getSignatureStatus(
        signature: string,
    ): Promise<{ slot: number; confirmations?: number; err: unknown } | null> {
        const response = await fetch(this.config.rpcEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: ++this.requestId,
                method: 'getSignatureStatuses',
                params: [[signature], { searchTransactionHistory: false }],
            }),
        });

        const data = await response.json();
        return data.result?.value?.[0] || null;
    }

    /**
     * Check if commitment level is satisfied
     */
    private isCommitmentSatisfied(
        confirmations: number | null | undefined,
        commitment: 'processed' | 'confirmed' | 'finalized',
    ): boolean {
        switch (commitment) {
            case 'processed':
                return confirmations !== null;
            case 'confirmed':
                return (confirmations || 0) >= 1;
            case 'finalized':
                return (confirmations || 0) >= 32;
            default:
                return false;
        }
    }

    /**
     * Calculate retry delay with exponential backoff
     */
    private calculateRetryDelay(attempt: number): number {
        const baseDelay = DEFAULTS.RETRY_BACKOFF_BASE_MS;
        const exponentialDelay = baseDelay * Math.pow(2, attempt);
        const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
        return Math.min(exponentialDelay + jitter, DEFAULTS.MAX_RETRY_DELAY_MS);
    }

    /**
     * Update client metrics
     */
    private updateMetrics(startTime: number, success: boolean): void {
        const latency = Date.now() - startTime;

        this.metrics.transactionsSubmitted++;

        if (success) {
            this.metrics.transactionsConfirmed++;
        } else {
            this.metrics.transactionsFailed++;
        }

        // Update average latency
        const total = this.metrics.transactionsConfirmed + this.metrics.transactionsFailed;
        this.metrics.averageLatencyMs = (this.metrics.averageLatencyMs * (total - 1) + latency) / total;
    }

    /**
     * Emit an event
     */
    private emit<K extends keyof import('./types.js').TransactionEvents>(
        event: K,
        data: import('./types.js').TransactionEvents[K],
    ): void {
        // In a real implementation, you might use EventEmitter
        // For now, we just log the event
        console.log(`[TritonCascade] Event: ${event}`, data);
    }

    /**
     * Sleep helper
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

/**
 * Create a new Triton Cascade client
 */
export function createTritonCascadeClient(config?: Partial<TritonCascadeConfig>): TritonCascadeClient {
    return new TritonCascadeClient(config);
}
