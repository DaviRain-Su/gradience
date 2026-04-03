/**
 * Triton Cascade Integration - Priority Fee Estimator
 *
 * @module triton-cascade/fee-estimator
 */

import type { PriorityFeeEstimate, SolanaNetwork } from './types.js';
import { DEFAULTS } from './config.js';
import { CascadeError, CascadeErrorCodes } from './errors.js';

/**
 * Fee estimator options
 */
export interface FeeEstimatorOptions {
  /** RPC endpoint */
  endpoint: string;
  /** API token for authentication */
  apiToken?: string;
  /** Cache TTL in milliseconds */
  cacheTtlMs?: number;
  /** Default fee in microLamports */
  defaultFee?: number;
}

/**
 * Priority fee estimator
 */
export class FeeEstimator {
  private readonly options: Required<FeeEstimatorOptions>;
  private cachedEstimate: PriorityFeeEstimate | null = null;
  private lastFetchTime = 0;

  constructor(options: FeeEstimatorOptions) {
    this.options = {
      endpoint: options.endpoint,
      apiToken: options.apiToken || '',
      cacheTtlMs: options.cacheTtlMs || DEFAULTS.PRIORITY_FEE_CACHE_TTL_MS,
      defaultFee: options.defaultFee || DEFAULTS.DEFAULT_PRIORITY_FEE,
    };
  }

  /**
   * Get priority fee estimate
   */
  async getEstimate(
    commitment: 'processed' | 'confirmed' | 'finalized' = 'confirmed'
  ): Promise<PriorityFeeEstimate> {
    // Check cache
    if (this.isCacheValid()) {
      return this.cachedEstimate!;
    }

    // Fetch new estimate
    try {
      const estimate = await this.fetchEstimate(commitment);
      this.cachedEstimate = estimate;
      this.lastFetchTime = Date.now();
      return estimate;
    } catch (error) {
      // Return cached estimate if available, otherwise return default
      if (this.cachedEstimate) {
        return this.cachedEstimate;
      }

      return this.getDefaultEstimate();
    }
  }

  /**
   * Calculate priority fee based on strategy
   */
  async calculateFee(options: {
    strategy: 'auto' | 'fixed' | 'none';
    fixedFee?: number;
    commitment?: 'processed' | 'confirmed' | 'finalized';
  }): Promise<number> {
    const { strategy, fixedFee, commitment = 'confirmed' } = options;

    switch (strategy) {
      case 'none':
        return 0;

      case 'fixed':
        return fixedFee ?? this.options.defaultFee;

      case 'auto': {
        const estimate = await this.getEstimate(commitment);
        return this.selectFeeFromEstimate(estimate);
      }

      default:
        return this.options.defaultFee;
    }
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cachedEstimate = null;
    this.lastFetchTime = 0;
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    if (!this.cachedEstimate) return false;

    const age = Date.now() - this.lastFetchTime;
    return age < this.options.cacheTtlMs;
  }

  /**
   * Fetch estimate from API
   */
  private async fetchEstimate(
    commitment: 'processed' | 'confirmed' | 'finalized'
  ): Promise<PriorityFeeEstimate> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.options.apiToken) {
      headers['Authorization'] = `Bearer ${this.options.apiToken}`;
    }

    const response = await fetch(this.options.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getPriorityFeeEstimate',
        params: [
          {
            commitment,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new CascadeError(
        CascadeErrorCodes.CONNECTION_ERROR,
        `Failed to fetch priority fee estimate: ${response.statusText}`,
        { data: { status: response.status } }
      );
    }

    const data = await response.json();

    if (data.error) {
      throw new CascadeError(
        CascadeErrorCodes.UNKNOWN_ERROR,
        data.error.message,
        { data: { rpcError: data.error } }
      );
    }

    // Parse response - Triton returns priorityFeeLamports
    const result = data.result;

    return {
      recommended: result.priorityFeeLamports || this.options.defaultFee,
      min: result.min || result.priorityFeeLamports * 0.5 || this.options.defaultFee * 0.5,
      medium: result.medium || result.priorityFeeLamports || this.options.defaultFee,
      high: result.high || result.priorityFeeLamports * 2 || this.options.defaultFee * 2,
      veryHigh: result.veryHigh || result.priorityFeeLamports * 5 || this.options.defaultFee * 5,
      timestamp: Date.now(),
    };
  }

  /**
   * Select appropriate fee from estimate based on network conditions
   */
  private selectFeeFromEstimate(estimate: PriorityFeeEstimate): number {
    // Calculate congestion ratio
    const congestionRatio = estimate.recommended / Math.max(estimate.min, 1);

    if (congestionRatio > 5) {
      // High congestion - use very high fee
      return estimate.veryHigh;
    } else if (congestionRatio > 2) {
      // Medium congestion - use high fee
      return estimate.high;
    } else {
      // Normal - use recommended fee
      return estimate.recommended;
    }
  }

  /**
   * Get default estimate when API fails
   */
  private getDefaultEstimate(): PriorityFeeEstimate {
    const defaultFee = this.options.defaultFee;

    return {
      recommended: defaultFee,
      min: Math.floor(defaultFee * 0.5),
      medium: defaultFee,
      high: defaultFee * 2,
      veryHigh: defaultFee * 5,
      timestamp: Date.now(),
    };
  }

  /**
   * Get cached estimate (if available)
   */
  getCachedEstimate(): PriorityFeeEstimate | null {
    return this.cachedEstimate;
  }

  /**
   * Check if estimate is stale
   */
  isStale(): boolean {
    return !this.isCacheValid();
  }
}
