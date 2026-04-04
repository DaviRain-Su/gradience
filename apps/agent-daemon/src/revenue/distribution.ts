/**
 * Revenue Distribution Module
 *
 * Handles on-chain revenue distribution using Solana CPI (Cross-Program Invocation).
 *
 * @deprecated Use the modular exports from ./distribution/ instead
 * This file is kept for backward compatibility.
 *
 * @module revenue/distribution
 */

import { Connection, PublicKey, type Signer } from '@solana/web3.js';
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';

// Import modular components
import {
  type DistributionConfig,
  type DistributionRequest,
  type DistributionResult,
  type TokenAccountInfo,
  type DistributorOptions,
} from './distribution/types.js';
import { DistributionBuilder } from './distribution/builder.js';
import { CPICaller, distribute, distributeTokens } from './distribution/cpi-caller.js';
import { DistributionValidator } from './distribution/validator.js';

// Re-export types for backward compatibility
export type {
  DistributionConfig,
  DistributionRequest,
  DistributionResult,
  TokenAccountInfo,
  DistributorOptions,
};

/**
 * Revenue Distributor
 *
 * @deprecated Use DistributionBuilder, CPICaller, DistributionValidator from ./distribution/ instead
 */
export class RevenueDistributor {
  private connection: Connection;
  private config: DistributionConfig;
  private builder: DistributionBuilder;
  private validator: DistributionValidator;

  constructor(config: DistributionConfig) {
    // Validate percentages sum to 100%
    const total = config.percentages.agent + config.percentages.judge + config.percentages.protocol;
    if (total !== 10000) {
      throw new DaemonError(
        ErrorCodes.INVALID_CONFIG,
        `Distribution percentages must sum to 10000 (100%), got ${total}`
      );
    }

    this.connection = new Connection(config.rpcEndpoint ?? 'https://api.devnet.solana.com');
    this.config = config;
    this.builder = new DistributionBuilder(config);
    this.validator = new DistributionValidator(this.connection);

    logger.info('RevenueDistributor initialized', {
      agent: `${config.percentages.agent / 100}%`,
      judge: `${config.percentages.judge / 100}%`,
      protocol: `${config.percentages.protocol / 100}%`,
    });
  }

  /**
   * Distribute native SOL from escrow
   */
  async distribute(request: DistributionRequest, signer: Signer): Promise<DistributionResult> {
    return distribute(this.connection, this.config, request, signer);
  }

  /**
   * Distribute SPL tokens from escrow
   */
  async distributeTokens(
    request: DistributionRequest,
    signer: Signer
  ): Promise<DistributionResult> {
    return distributeTokens(this.connection, this.config, request, signer);
  }

  /**
   * Calculate distribution breakdown
   */
  calculateBreakdown(totalAmount: bigint): {
    agent: bigint;
    judge: bigint;
    protocol: bigint;
  } {
    return this.builder.calculateBreakdown(totalAmount);
  }

  /**
   * Verify a distribution transaction
   */
  async verifyDistribution(
    txSignature: string,
    request: DistributionRequest
  ): Promise<boolean> {
    return this.validator.verifyDistribution(txSignature, request);
  }

  /**
   * Get token balance
   */
  async getTokenBalance(tokenAccount: PublicKey): Promise<bigint> {
    return this.validator.getTokenBalance(tokenAccount);
  }
}

/**
 * Create revenue distributor instance
 * @deprecated Use individual modules from ./distribution/ instead
 */
export function createRevenueDistributor(options: DistributorOptions = {}): RevenueDistributor {
  const config: DistributionConfig = {
    chainHubProgramId: options.chainHubProgramId ?? new PublicKey('ChainHub111111111111111111111111111111111111'),
    protocolTreasury: options.protocolTreasury ?? new PublicKey('Treasury111111111111111111111111111111111111'),
    judgePool: options.judgePool ?? new PublicKey('JudgePool11111111111111111111111111111111111'),
    rpcEndpoint: options.rpcEndpoint ?? 'https://api.devnet.solana.com',
    percentages: {
      agent: options.percentages?.agent ?? 9500,
      judge: options.percentages?.judge ?? 300,
      protocol: options.percentages?.protocol ?? 200,
    },
  };

  return new RevenueDistributor(config);
}
