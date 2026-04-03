/**
 * Workflow Marketplace SDK
 * 
 * Client-side SDK for interacting with the Workflow Marketplace program
 */
import type { 
  GradienceWorkflow, 
  WorkflowExecutionResult,
  ValidationResult 
} from '../schema/types.js';
import { validate } from '../schema/validate.js';
import { WorkflowEngine } from '../engine/workflow-engine.js';
import { createAllHandlers } from '../handlers/index.js';

/**
 * SDK Configuration
 */
export interface WorkflowSDKConfig {
  /** RPC endpoint */
  rpcEndpoint: string;
  /** Program ID */
  programId?: string;
  /** Indexer endpoint (optional) */
  indexerEndpoint?: string;
  /** Wallet adapter (for signing transactions) */
  wallet?: WalletAdapter;
}

/**
 * Wallet adapter interface
 */
export interface WalletAdapter {
  publicKey: string | null;
  signTransaction: (tx: unknown) => Promise<unknown>;
  signAllTransactions: (txs: unknown[]) => Promise<unknown[]>;
}

/**
 * Browse filters
 */
export interface BrowseFilters {
  tags?: string[];
  chains?: string[];
  pricingModel?: string;
  minRating?: number;
  author?: string;
  sortBy?: 'popular' | 'newest' | 'rating' | 'price';
  limit?: number;
  offset?: number;
}

/**
 * Workflow listing (from indexer)
 */
export interface WorkflowListing {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  pricing: {
    model: string;
    price?: { mint: string; amount: string };
  };
  tags: string[];
  totalPurchases: number;
  totalExecutions: number;
  avgRating: number;
  createdAt: number;
}

/**
 * Workflow SDK
 * 
 * High-level SDK for workflow operations
 */
export class WorkflowSDK {
  private config: WorkflowSDKConfig;
  private engine: WorkflowEngine;

  constructor(config: WorkflowSDKConfig) {
    this.config = {
      programId: 'WF1oWsPHQQVKTgL7t1Q4X9YK9gH6T8X7yZ3pQ4rS5tU',
      ...config,
    };
    
    // Initialize workflow engine with default handlers
    this.engine = new WorkflowEngine(createAllHandlers());
  }

  /**
   * Create a new workflow
   * 
   * Steps:
   * 1. Validate workflow definition
   * 2. Upload to IPFS/Arweave
   * 3. Create on-chain metadata
   */
  async create(workflow: GradienceWorkflow): Promise<string> {
    // Validate workflow
    const validation = validate(workflow);
    if (!validation.success) {
      throw new Error(`Invalid workflow: ${validation.error?.message}`);
    }

    // TODO: Upload to IPFS/Arweave
    // const contentHash = await uploadToIPFS(workflow);
    
    // TODO: Create on-chain transaction
    // const tx = await createWorkflowTx({ ...workflow, contentHash });
    // const signature = await this.config.wallet?.signTransaction(tx);
    
    // Register locally for now
    this.engine.registerWorkflow(workflow);
    
    return workflow.id;
  }

  /**
   * Get workflow by ID
   */
  async get(workflowId: string): Promise<GradienceWorkflow | null> {
    // Try local first
    const local = this.engine.getWorkflow(workflowId);
    if (local) return local;

    // TODO: Fetch from chain or indexer
    // return fetchFromIndexer(workflowId);
    
    return null;
  }

  /**
   * Purchase a workflow
   */
  async purchase(workflowId: string): Promise<string> {
    if (!this.config.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    // TODO: Create purchase transaction
    // const tx = await createPurchaseTx(workflowId, this.config.wallet.publicKey);
    // const signature = await this.config.wallet.signTransaction(tx);
    
    console.log(`[SDK] Purchase workflow ${workflowId}`);
    
    // Return access PDA address (mock)
    return `access-${workflowId}-${this.config.wallet.publicKey}`;
  }

  /**
   * Check if user has access to workflow
   */
  async hasAccess(workflowId: string, user?: string): Promise<boolean> {
    const userKey = user || this.config.wallet?.publicKey;
    if (!userKey) return false;

    // TODO: Check on-chain access PDA
    // return checkAccessPDA(workflowId, userKey);
    
    // Mock: always true for now
    return true;
  }

  /**
   * Execute a workflow
   */
  async execute(
    workflowId: string,
    config?: Record<string, unknown>,
    options?: {
      onStepStart?: (stepId: string) => void;
      onStepComplete?: (result: { stepId: string; status: string }) => void;
    }
  ): Promise<WorkflowExecutionResult> {
    // Check access
    const hasAccess = await this.hasAccess(workflowId);
    if (!hasAccess) {
      throw new Error('No access to workflow');
    }

    // Execute via engine
    return this.engine.execute(workflowId, {
      config,
      executor: this.config.wallet?.publicKey || 'anonymous',
      onStepStart: options?.onStepStart,
      onStepComplete: options?.onStepComplete,
    });
  }

  /**
   * Simulate a workflow (dry run)
   */
  async simulate(
    workflow: GradienceWorkflow,
    config?: Record<string, unknown>
  ): Promise<WorkflowExecutionResult> {
    return this.engine.simulate(workflow, config);
  }

  /**
   * Review a workflow
   */
  async review(
    workflowId: string,
    rating: number,
    comment: string
  ): Promise<void> {
    if (!this.config.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // TODO: Upload comment to IPFS
    // const commentHash = await uploadToIPFS(comment);
    
    // TODO: Create review transaction
    // const tx = await createReviewTx(workflowId, rating, commentHash);
    // await this.config.wallet.signTransaction(tx);
    
    console.log(`[SDK] Review workflow ${workflowId}: ${rating} stars`);
  }

  /**
   * Browse marketplace
   */
  async browse(filters: BrowseFilters = {}): Promise<WorkflowListing[]> {
    // TODO: Query indexer
    // return queryIndexer(filters);
    
    // Mock data for now
    return [
      {
        id: 'wf-1',
        name: 'Cross-chain Arbitrage',
        description: 'Automated arbitrage across Solana, Arbitrum, and Base',
        author: '5Y3d...',
        version: '1.0.0',
        pricing: { model: 'oneTime', price: { mint: 'SOL', amount: '1000000000' } },
        tags: ['arbitrage', 'cross-chain', 'defi'],
        totalPurchases: 42,
        totalExecutions: 1337,
        avgRating: 4.5,
        createdAt: Date.now() - 86400000,
      },
    ];
  }

  /**
   * Get user's workflows (created)
   */
  async getMyWorkflows(): Promise<WorkflowListing[]> {
    if (!this.config.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    // TODO: Query indexer by author
    return this.browse({ author: this.config.wallet.publicKey });
  }

  /**
   * Get user's purchased workflows
   */
  async getMyPurchases(): Promise<WorkflowListing[]> {
    if (!this.config.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    // TODO: Query indexer by access records
    return [];
  }

  /**
   * Update workflow metadata
   */
  async update(
    workflowId: string,
    updates: Partial<Pick<GradienceWorkflow, 'description' | 'isPublic'>>
  ): Promise<void> {
    if (!this.config.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    // TODO: Create update transaction
    console.log(`[SDK] Update workflow ${workflowId}`, updates);
  }

  /**
   * Deactivate a workflow
   */
  async deactivate(workflowId: string): Promise<void> {
    if (!this.config.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    // TODO: Create deactivate transaction
    console.log(`[SDK] Deactivate workflow ${workflowId}`);
  }

  /**
   * Activate a workflow
   */
  async activate(workflowId: string): Promise<void> {
    if (!this.config.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    // TODO: Create activate transaction
    console.log(`[SDK] Activate workflow ${workflowId}`);
  }

  /**
   * Delete a workflow
   */
  async delete(workflowId: string): Promise<void> {
    if (!this.config.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    // TODO: Create delete transaction
    console.log(`[SDK] Delete workflow ${workflowId}`);
  }

  /**
   * Get execution history
   */
  async getExecutions(workflowId: string): Promise<WorkflowExecutionResult[]> {
    return this.engine.getExecutions(workflowId);
  }
}

/**
 * Create SDK instance
 */
export function createWorkflowSDK(config: WorkflowSDKConfig): WorkflowSDK {
  return new WorkflowSDK(config);
}
