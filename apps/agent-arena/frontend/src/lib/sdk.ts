import { GradienceSDK, KeypairAdapter } from '@gradiences/sdk';
import type { TransactionSigner, Address } from '@solana/kit';
import type { TaskApi, SubmissionApi, ReputationApi } from '@gradiences/sdk';

import { INDEXER_ENDPOINT, RPC_ENDPOINT } from './config';
import {
    getMockTasks,
    getMockTask,
    getMockTaskSubmissions,
    getMockReputation,
    getMockAgentReputation,
    getMockAgentTasks,
} from './mock-data';

// Enhanced SDK wrapper with mock data fallback
export class EnhancedGradienceSDK extends GradienceSDK {
    private mockFallback = true; // Enable mock fallback by default

    constructor(options?: any) {
        super(options);
    }

    // Helper to make requests with timeout and fallback
    private async fetchWithFallback<T>(
        fetchFn: () => Promise<T>,
        fallbackFn: () => T | null,
        timeoutMs: number = 2000
    ): Promise<T | null> {
        if (!this.mockFallback) {
            return fetchFn();
        }

        try {
            // Create a promise that rejects after timeout
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
            });

            // Race between the actual request and timeout
            const result = await Promise.race([fetchFn(), timeoutPromise]);
            return result;
        } catch (error) {
            console.warn('Indexer request failed, falling back to mock data:', error);
            return fallbackFn();
        }
    }

    async getTasks(params?: {
        status?: 'open' | 'completed' | 'refunded';
        category?: number;
        mint?: string;
        poster?: string;
        limit?: number;
        offset?: number;
    }): Promise<TaskApi[]> {
        const result = await this.fetchWithFallback(
            () => super.getTasks(params),
            () => getMockTasks(params)
        );
        return result || [];
    }

    async getTask(taskId: number): Promise<TaskApi | null> {
        return this.fetchWithFallback(
            () => super.getTask(taskId),
            () => getMockTask(taskId)
        );
    }

    async getTaskSubmissions(
        taskId: number,
        params?: { sort?: 'score' | 'slot' }
    ): Promise<SubmissionApi[] | null> {
        return this.fetchWithFallback(
            () => super.getTaskSubmissions(taskId, params),
            () => getMockTaskSubmissions(taskId, params)
        );
    }

    async getReputation(agent: string): Promise<ReputationApi | null> {
        return this.fetchWithFallback(
            () => super.getReputation(agent),
            () => getMockReputation(agent)
        );
    }

    // Enable/disable mock fallback
    setMockFallback(enabled: boolean) {
        this.mockFallback = enabled;
    }
}

export function createSdk(): EnhancedGradienceSDK {
    return new EnhancedGradienceSDK({
        indexerEndpoint: INDEXER_ENDPOINT,
        rpcEndpoint: RPC_ENDPOINT,
    });
}

export function createWalletAdapter(signer: TransactionSigner): KeypairAdapter {
    return new KeypairAdapter({
        signer,
        rpcEndpoint: RPC_ENDPOINT,
    });
}

// Helper functions for components that fetch directly from indexer
export async function fetchWithMockFallback<T>(
    url: string,
    mockFallback: () => T | null,
    timeoutMs: number = 2000
): Promise<T | null> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.warn(`Fetch failed for ${url}, falling back to mock data:`, error);
        return mockFallback();
    }
}
