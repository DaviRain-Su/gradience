/**
 * Triton Cascade Integration - Jito Bundle Support
 *
 * @module triton-cascade/jito-bundle
 */

import type { JitoBundleConfig, JitoBundleResponse } from './types.js';
import { DEFAULTS } from './config.js';
import { CascadeError, CascadeErrorCodes } from './errors.js';

/**
 * Jito Bundle client
 */
export class JitoBundleClient {
    private readonly config: Required<JitoBundleConfig>;

    constructor(config: JitoBundleConfig) {
        this.config = {
            blockEngineUrl: config.blockEngineUrl,
            authKeypair: config.authKeypair || new Uint8Array(),
            bundleTimeoutMs: config.bundleTimeoutMs || DEFAULTS.JITO_BUNDLE_TIMEOUT_MS,
        };
    }

    /**
     * Submit a transaction as a Jito Bundle
     */
    async submitBundle(
        transactions: string[],
        options?: {
            timeoutMs?: number;
        },
    ): Promise<JitoBundleResponse> {
        const timeoutMs = options?.timeoutMs || this.config.bundleTimeoutMs;

        try {
            // Submit bundle to Jito block engine
            const bundleId = await this.sendBundle(transactions);

            // Wait for bundle to land
            const result = await this.waitForBundle(bundleId, timeoutMs);

            return result;
        } catch (error) {
            if (error instanceof CascadeError) {
                throw error;
            }

            throw new CascadeError(
                CascadeErrorCodes.JITO_BUNDLE_FAILED,
                error instanceof Error ? error.message : 'Unknown Jito error',
                { cause: error instanceof Error ? error : undefined, retryable: true },
            );
        }
    }

    /**
     * Send bundle to block engine
     */
    private async sendBundle(transactions: string[]): Promise<string> {
        const url = `${this.config.blockEngineUrl}/api/v1/bundles`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'sendBundle',
                params: [transactions],
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        // Bundle ID is returned as result
        return data.result;
    }

    /**
     * Wait for bundle to be confirmed
     */
    private async waitForBundle(bundleId: string, timeoutMs: number): Promise<JitoBundleResponse> {
        const startTime = Date.now();
        const checkInterval = 1000; // Check every second

        while (Date.now() - startTime < timeoutMs) {
            try {
                const status = await this.getBundleStatus(bundleId);

                if (status.status === 'landed') {
                    return status;
                }

                if (status.status === 'failed') {
                    throw new Error(status.error || 'Bundle failed');
                }

                // Still pending, wait and retry
                await this.sleep(checkInterval);
            } catch (error) {
                // If we can't get status, keep trying until timeout
                if (Date.now() - startTime + checkInterval >= timeoutMs) {
                    throw error;
                }
                await this.sleep(checkInterval);
            }
        }

        // Timeout - bundle may still land later
        return {
            bundleId,
            status: 'pending',
        };
    }

    /**
     * Get bundle status
     */
    private async getBundleStatus(bundleId: string): Promise<JitoBundleResponse> {
        const url = `${this.config.blockEngineUrl}/api/v1/bundles`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getBundleStatuses',
                params: [[bundleId]],
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        const result = data.result?.value?.[0];

        if (!result) {
            return { bundleId, status: 'pending' };
        }

        // Parse Jito status
        if (result.confirmationStatus === 'confirmed' || result.confirmationStatus === 'finalized') {
            return {
                bundleId,
                status: 'landed',
                landedSlot: result.slot,
            };
        }

        if (result.err) {
            return {
                bundleId,
                status: 'failed',
                error: JSON.stringify(result.err),
            };
        }

        return { bundleId, status: 'pending' };
    }

    /**
     * Check if Jito is available
     */
    async isAvailable(): Promise<boolean> {
        try {
            const url = `${this.config.blockEngineUrl}/api/v1/health`;
            const response = await fetch(url, {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Sleep helper
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Get block engine URL
     */
    getBlockEngineUrl(): string {
        return this.config.blockEngineUrl;
    }
}
