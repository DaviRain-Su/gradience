/**
 * Solana Workflow Marketplace SDK (@solana/kit)
 *
 * Full-featured SDK for interacting with the deployed Solana program
 */
import {
  address,
  createSolanaRpc,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction,
  getBase58Decoder,
  type Address,
  type Instruction,
  type TransactionSigner,
  type Blockhash,
} from '@solana/kit';
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
  createPurchaseWorkflowV2Instruction,
  createReviewWorkflowInstruction,
  createUpdateWorkflowInstruction,
  createDeactivateWorkflowInstruction,
  createActivateWorkflowInstruction,
  createDeleteWorkflowInstruction,
  createRecordExecutionInstruction,
  type CreateWorkflowParams,
} from './solana-instructions.js';

type RpcClient = ReturnType<typeof createSolanaRpc>;

async function sendInstruction(
  instruction: Instruction,
  signer: TransactionSigner,
  rpc: RpcClient
): Promise<string> {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const transactionMessage = appendTransactionMessageInstructions(
    [instruction],
    setTransactionMessageLifetimeUsingBlockhash(
      latestBlockhash,
      setTransactionMessageFeePayerSigner(signer, createTransactionMessage({ version: 0 }))
    )
  );
  const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);
  const wireTransaction = getBase64EncodedWireTransaction(signedTransaction);
  return rpc.sendTransaction(wireTransaction, { encoding: 'base64' }).send();
}

async function fetchAccountData(rpc: RpcClient, addr: Address): Promise<Uint8Array | null> {
  const result = await rpc.getAccountInfo(addr, { encoding: 'base64' }).send();
  const encoded = result.value?.data;
  if (!encoded || typeof encoded !== 'string') return null;
  // In @solana/kit v6 base64 encoding returns [string, 'base64'] tuple; handle both shapes
  const base64Str = Array.isArray(encoded) ? encoded[0] : encoded;
  return Uint8Array.from(Buffer.from(base64Str, 'base64'));
}

/**
 * Solana SDK Configuration
 */
export interface SolanaSDKConfig {
  /** RPC endpoint */
  rpcEndpoint: string;
  /** Payer/authority signer */
  payer: TransactionSigner;
  /** Program ID (optional, defaults to deployed) */
  programId?: Address;
}

/**
 * Workflow on-chain metadata
 */
export interface OnChainWorkflowMetadata {
  workflowId: Address;
  author: Address;
  contentHash: string;
  version: string;
  pricingModel: number;
  priceMint: Address;
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
  private rpc: RpcClient;
  private payer: TransactionSigner;
  private programId: Address;

  constructor(config: SolanaSDKConfig) {
    this.rpc = createSolanaRpc(config.rpcEndpoint);
    this.payer = config.payer;
    this.programId = config.programId || PROGRAM_ID;
  }

  /**
   * Initialize the program (one-time setup)
   */
  async initialize(
    treasury: Address,
    upgradeAuthority: Address
  ): Promise<string> {
    const instruction = await createInitializeInstruction(
      this.payer.address,
      treasury,
      upgradeAuthority
    );
    return sendInstruction(instruction, this.payer, this.rpc);
  }

  /**
   * Create a new workflow on-chain
   */
  async createWorkflow(
    workflow: GradienceWorkflow,
    workflowId: Address
  ): Promise<string> {
    const validation = validate(workflow);
    if (!validation.success) {
      throw new Error(`Invalid workflow: ${validation.error}`);
    }

    const contentHash = new Uint8Array(64);
    const hashBytes = Buffer.from(workflow.contentHash.slice(7), 'hex');
    contentHash.set(hashBytes, 0);

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
        ? address(workflow.pricing.oneTimePrice.mint)
        : address('11111111111111111111111111111111'),
      priceAmount: workflow.pricing.oneTimePrice?.amount
        ? BigInt(workflow.pricing.oneTimePrice.amount)
        : 0n,
      creatorShare: workflow.revenueShare?.creator || 0,
      isPublic: workflow.isPublic,
    };

    const instruction = await createCreateWorkflowInstruction(
      this.payer.address,
      params
    );
    return sendInstruction(instruction, this.payer, this.rpc);
  }

  /**
   * Purchase a workflow
   */
  async purchaseWorkflow(
    workflowId: Address,
    accessType: number = 0
  ): Promise<string> {
    const instruction = await createPurchaseWorkflowInstruction(
      this.payer.address,
      workflowId,
      accessType
    );
    return sendInstruction(instruction, this.payer, this.rpc);
  }

  /**
   * Purchase a workflow with payment (V2)
   */
  async purchaseWorkflowWithPayment(
    workflowId: Address,
    author: Address,
    accessType: number = 0
  ): Promise<string> {
    const instruction = await createPurchaseWorkflowV2Instruction(
      this.payer.address,
      workflowId,
      author,
      accessType
    );
    return sendInstruction(instruction, this.payer, this.rpc);
  }

  /**
   * Record workflow execution
   */
  async recordExecution(workflowId: Address): Promise<string> {
    const instruction = await createRecordExecutionInstruction(
      this.payer.address,
      workflowId
    );
    return sendInstruction(instruction, this.payer, this.rpc);
  }

  /**
   * Review a workflow
   */
  async reviewWorkflow(
    workflowId: Address,
    rating: number,
    comment: string
  ): Promise<string> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const commentHash = new Uint8Array(32);
    const commentBytes = Buffer.from(comment.substring(0, 32));
    commentHash.set(commentBytes, 0);

    const instruction = await createReviewWorkflowInstruction(
      this.payer.address,
      workflowId,
      rating,
      commentHash
    );
    return sendInstruction(instruction, this.payer, this.rpc);
  }

  /**
   * Update workflow metadata
   */
  async updateWorkflow(
    workflowId: Address,
    newContentHash: string
  ): Promise<string> {
    const contentHash = new Uint8Array(64);
    const hashBytes = Buffer.from(newContentHash.slice(7), 'hex');
    contentHash.set(hashBytes, 0);

    const instruction = await createUpdateWorkflowInstruction(
      this.payer.address,
      workflowId,
      contentHash
    );
    return sendInstruction(instruction, this.payer, this.rpc);
  }

  /**
   * Deactivate workflow
   */
  async deactivateWorkflow(workflowId: Address): Promise<string> {
    const instruction = await createDeactivateWorkflowInstruction(
      this.payer.address,
      workflowId
    );
    return sendInstruction(instruction, this.payer, this.rpc);
  }

  /**
   * Activate workflow
   */
  async activateWorkflow(workflowId: Address): Promise<string> {
    const instruction = await createActivateWorkflowInstruction(
      this.payer.address,
      workflowId
    );
    return sendInstruction(instruction, this.payer, this.rpc);
  }

  /**
   * Delete workflow (only if no purchases)
   */
  async deleteWorkflow(workflowId: Address): Promise<string> {
    const instruction = await createDeleteWorkflowInstruction(
      this.payer.address,
      workflowId
    );
    return sendInstruction(instruction, this.payer, this.rpc);
  }

  /**
   * Check if user has access to workflow
   */
  async hasAccess(workflowId: Address, user?: Address): Promise<boolean> {
    const userAddr = user || this.payer.address;
    const [accessPDA] = await getAccessPDA(workflowId, userAddr);

    try {
      const data = await fetchAccountData(this.rpc, accessPDA);
      return data !== null && data.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get workflow metadata from chain
   */
  async getWorkflow(
    workflowId: Address
  ): Promise<OnChainWorkflowMetadata | null> {
    const [workflowPDA] = await getWorkflowPDA(workflowId);

    try {
      const data = await fetchAccountData(this.rpc, workflowPDA);
      if (!data || data.length === 0) {
        return null;
      }

      const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const base58Decoder = getBase58Decoder();
      const toBase58 = (bytes: Uint8Array) => base58Decoder.decode(bytes);
      const hexSlice = (start: number, end: number) =>
        Buffer.from(data.slice(start, end)).toString('hex');
      const utf8Slice = (start: number, end: number) =>
        Buffer.from(data.slice(start, end)).toString('utf-8').replace(/\0/g, '');

      return {
        workflowId,
        author: address(toBase58(data.slice(2, 34))),
        contentHash: hexSlice(34, 98),
        version: utf8Slice(98, 114),
        pricingModel: data[114],
        priceMint: address(toBase58(data.slice(115, 147))),
        priceAmount: dv.getBigUint64(147, true),
        creatorShare: dv.getUint16(155, true),
        totalPurchases: dv.getUint32(157, true),
        totalExecutions: dv.getUint32(161, true),
        avgRating: dv.getUint16(165, true),
        isPublic: data[167] === 1,
        isActive: data[168] === 1,
        createdAt: new Date(Number(dv.getBigInt64(169, true)) * 1000),
        updatedAt: new Date(Number(dv.getBigInt64(177, true)) * 1000),
      };
    } catch (error) {
      console.error('Failed to get workflow:', error);
      return null;
    }
  }

  /**
   * Get config PDA address
   */
  async getConfigAddress(): Promise<Address> {
    const [configPDA] = await getConfigPDA();
    return configPDA;
  }

  /**
   * Get treasury PDA address
   */
  async getTreasuryAddress(): Promise<Address> {
    const [treasuryPDA] = await getTreasuryPDA();
    return treasuryPDA;
  }

  /**
   * Get workflow PDA address
   */
  async getWorkflowAddress(workflowId: Address): Promise<Address> {
    const [workflowPDA] = await getWorkflowPDA(workflowId);
    return workflowPDA;
  }

  /**
   * Get access PDA address
   */
  async getAccessAddress(workflowId: Address, user?: Address): Promise<Address> {
    const userAddr = user || this.payer.address;
    const [accessPDA] = await getAccessPDA(workflowId, userAddr);
    return accessPDA;
  }

  /**
   * Get review PDA address
   */
  async getReviewAddress(workflowId: Address, reviewer?: Address): Promise<Address> {
    const reviewerAddr = reviewer || this.payer.address;
    const [reviewPDA] = await getReviewPDA(workflowId, reviewerAddr);
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
