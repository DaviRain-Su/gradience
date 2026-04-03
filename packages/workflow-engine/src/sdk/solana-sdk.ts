/**
 * Solana Workflow Marketplace SDK
 * 
 * Full-featured SDK for interacting with the deployed Solana program
 */
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import type { GradienceWorkflow } from '../schema/types.js';
import { validate } from '../schema/validate.js';
import {
  PROGRAM_ID,
  getConfigPDA,
  getTreasuryPDA,
  getWorkflowPDA,
  getAccessPDA,
  getReviewPDA,
  createInitializeInstruction,
  createCreateWorkflowInstruction,
  createPurchaseWorkflowInstruction,
  createReviewWorkflowInstruction,
  createUpdateWorkflowInstruction,
  createDeactivateWorkflowInstruction,
  createActivateWorkflowInstruction,
  createDeleteWorkflowInstruction,
  type CreateWorkflowParams,
} from './solana-instructions.js';

/**
 * Solana SDK Configuration
 */
export interface SolanaSDKConfig {
  /** RPC connection */
  connection: Connection;
  /** Payer/authority keypair */
  payer: Keypair;
  /** Program ID (optional, defaults to deployed) */
  programId?: PublicKey;
}

/**
 * Workflow on-chain metadata
 */
export interface OnChainWorkflowMetadata {
  workflowId: PublicKey;
  author: PublicKey;
  contentHash: string;
  version: string;
  pricingModel: number;
  priceMint: PublicKey;
  priceAmount: bigint;
  creatorShare: number;
  totalPurchases: number;
  totalExecutions: number;
  avgRating: number;
  isPublic: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Solana Workflow Marketplace SDK
 */
export class SolanaWorkflowSDK {
  private connection: Connection;
  private payer: Keypair;
  private programId: PublicKey;

  constructor(config: SolanaSDKConfig) {
    this.connection = config.connection;
    this.payer = config.payer;
    this.programId = config.programId || PROGRAM_ID;
  }

  /**
   * Initialize the program (one-time setup)
   */
  async initialize(
    treasury: PublicKey,
    upgradeAuthority: PublicKey
  ): Promise<string> {
    const instruction = createInitializeInstruction(
      this.payer.publicKey,
      treasury,
      upgradeAuthority
    );

    const transaction = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payer]
    );

    return signature;
  }

  /**
   * Create a new workflow on-chain
   */
  async createWorkflow(
    workflow: GradienceWorkflow,
    workflowId: PublicKey
  ): Promise<string> {
    // Validate workflow schema
    const validation = validate(workflow);
    if (!validation.success) {
      throw new Error(`Invalid workflow: ${validation.error}`);
    }

    // Convert workflow to on-chain format
    const contentHash = Buffer.alloc(64);
    Buffer.from(workflow.contentHash.slice(7), 'hex').copy(contentHash); // Remove 'ipfs://' prefix

    const pricingModelMap: Record<string, number> = {
      free: 0,
      oneTime: 1,
      subscription: 2,
      perUse: 3,
      revenueShare: 4,
    };

    const params: CreateWorkflowParams = {
      workflowId,
      contentHash,
      version: workflow.version,
      pricingModel: pricingModelMap[workflow.pricing.model] || 0,
      priceMint: workflow.pricing.oneTimePrice?.mint
        ? new PublicKey(workflow.pricing.oneTimePrice.mint)
        : PublicKey.default,
      priceAmount: workflow.pricing.oneTimePrice?.amount
        ? BigInt(workflow.pricing.oneTimePrice.amount)
        : 0n,
      creatorShare: workflow.revenueShare?.creator || 0,
      isPublic: workflow.isPublic,
    };

    const instruction = createCreateWorkflowInstruction(
      this.payer.publicKey,
      params
    );

    const transaction = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payer]
    );

    return signature;
  }

  /**
   * Purchase a workflow
   */
  async purchaseWorkflow(
    workflowId: PublicKey,
    accessType: number = 0
  ): Promise<string> {
    const instruction = createPurchaseWorkflowInstruction(
      this.payer.publicKey,
      workflowId,
      accessType
    );

    const transaction = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payer]
    );

    return signature;
  }

  /**
   * Review a workflow
   */
  async reviewWorkflow(
    workflowId: PublicKey,
    rating: number,
    comment: string
  ): Promise<string> {
    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Hash comment (simplified - in production use proper IPFS hash)
    const commentHash = Buffer.alloc(32);
    Buffer.from(comment.substring(0, 32)).copy(commentHash);

    const instruction = createReviewWorkflowInstruction(
      this.payer.publicKey,
      workflowId,
      rating,
      commentHash
    );

    const transaction = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payer]
    );

    return signature;
  }

  /**
   * Update workflow metadata
   */
  async updateWorkflow(
    workflowId: PublicKey,
    newContentHash: string
  ): Promise<string> {
    const contentHash = Buffer.alloc(64);
    Buffer.from(newContentHash.slice(7), 'hex').copy(contentHash);

    const instruction = createUpdateWorkflowInstruction(
      this.payer.publicKey,
      workflowId,
      contentHash
    );

    const transaction = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payer]
    );

    return signature;
  }

  /**
   * Deactivate workflow (make unavailable for purchase)
   */
  async deactivateWorkflow(workflowId: PublicKey): Promise<string> {
    const instruction = createDeactivateWorkflowInstruction(
      this.payer.publicKey,
      workflowId
    );

    const transaction = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payer]
    );

    return signature;
  }

  /**
   * Activate workflow (make available for purchase)
   */
  async activateWorkflow(workflowId: PublicKey): Promise<string> {
    const instruction = createActivateWorkflowInstruction(
      this.payer.publicKey,
      workflowId
    );

    const transaction = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payer]
    );

    return signature;
  }

  /**
   * Delete workflow (only if no purchases)
   */
  async deleteWorkflow(workflowId: PublicKey): Promise<string> {
    const instruction = createDeleteWorkflowInstruction(
      this.payer.publicKey,
      workflowId
    );

    const transaction = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payer]
    );

    return signature;
  }

  /**
   * Check if user has access to workflow
   */
  async hasAccess(workflowId: PublicKey, user?: PublicKey): Promise<boolean> {
    const userPubkey = user || this.payer.publicKey;
    const [accessPDA] = getAccessPDA(workflowId, userPubkey);

    try {
      const accountInfo = await this.connection.getAccountInfo(accessPDA);
      return accountInfo !== null && accountInfo.data.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get workflow metadata from chain
   */
  async getWorkflow(
    workflowId: PublicKey
  ): Promise<OnChainWorkflowMetadata | null> {
    const [workflowPDA] = getWorkflowPDA(workflowId);

    try {
      const accountInfo = await this.connection.getAccountInfo(workflowPDA);
      if (!accountInfo || accountInfo.data.length === 0) {
        return null;
      }

      // Parse account data (Borsh deserialization)
      // This is simplified - in production use proper Borsh deserializer
      const data = accountInfo.data;

      return {
        workflowId,
        author: new PublicKey(data.slice(2, 34)),
        contentHash: data.slice(34, 98).toString('hex'),
        version: data.slice(98, 114).toString('utf-8').replace(/\0/g, ''),
        pricingModel: data[114],
        priceMint: new PublicKey(data.slice(115, 147)),
        priceAmount: data.readBigUInt64LE(147),
        creatorShare: data.readUInt16LE(155),
        totalPurchases: data.readUInt32LE(157),
        totalExecutions: data.readUInt32LE(161),
        avgRating: data.readUInt16LE(165),
        isPublic: data[167] === 1,
        isActive: data[168] === 1,
        createdAt: new Date(Number(data.readBigInt64LE(169)) * 1000),
        updatedAt: new Date(Number(data.readBigInt64LE(177)) * 1000),
      };
    } catch (error) {
      console.error('Failed to get workflow:', error);
      return null;
    }
  }

  /**
   * Get config PDA address
   */
  getConfigAddress(): PublicKey {
    const [configPDA] = getConfigPDA();
    return configPDA;
  }

  /**
   * Get treasury PDA address
   */
  getTreasuryAddress(): PublicKey {
    const [treasuryPDA] = getTreasuryPDA();
    return treasuryPDA;
  }

  /**
   * Get workflow PDA address
   */
  getWorkflowAddress(workflowId: PublicKey): PublicKey {
    const [workflowPDA] = getWorkflowPDA(workflowId);
    return workflowPDA;
  }

  /**
   * Get access PDA address
   */
  getAccessAddress(workflowId: PublicKey, user?: PublicKey): PublicKey {
    const userPubkey = user || this.payer.publicKey;
    const [accessPDA] = getAccessPDA(workflowId, userPubkey);
    return accessPDA;
  }

  /**
   * Get review PDA address
   */
  getReviewAddress(workflowId: PublicKey, reviewer?: PublicKey): PublicKey {
    const reviewerPubkey = reviewer || this.payer.publicKey;
    const [reviewPDA] = getReviewPDA(workflowId, reviewerPubkey);
    return reviewPDA;
  }
}

/**
 * Factory function to create SDK instance
 */
export function createSolanaWorkflowSDK(
  config: SolanaSDKConfig
): SolanaWorkflowSDK {
  return new SolanaWorkflowSDK(config);
}
