/**
 * Workflow Marketplace SDK
 *
 * Client-side SDK for interacting with the Workflow Marketplace program
 * Integrates with Solana SDK for on-chain operations
 */
import type { GradienceWorkflow, WorkflowExecutionResult, ValidationResult } from '../schema/types.js';
import { validate } from '../schema/validate.js';
import { WorkflowEngine } from '../engine/workflow-engine.js';
import { createAllHandlers } from '../handlers/index.js';
import { Connection, PublicKey, Keypair, type Transaction } from '@solana/web3.js';
import { address } from '@solana/kit';
import { SolanaWorkflowSDK, createSolanaWorkflowSDK, type OnChainWorkflowMetadata } from './solana-sdk.js';

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
    /** Solana connection (optional - will create from rpcEndpoint if not provided) */
    connection?: Connection;
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
 * Purchase result
 */
export interface PurchaseResult {
    /** Transaction signature */
    signature: string;
    /** Access PDA address */
    accessPDA: string;
    /** Workflow ID */
    workflowId: string;
    /** Purchase timestamp */
    timestamp: number;
}

/**
 * Review result
 */
export interface ReviewResult {
    /** Transaction signature */
    signature: string;
    /** Workflow ID */
    workflowId: string;
    /** Rating (1-5) */
    rating: number;
    /** Comment hash (IPFS) */
    commentHash: string;
    /** Review timestamp */
    timestamp: number;
}

/**
 * Update result
 */
export interface UpdateResult {
    /** Transaction signature */
    signature: string;
    /** Workflow ID */
    workflowId: string;
    /** Update timestamp */
    timestamp: number;
}

/**
 * Workflow SDK
 *
 * High-level SDK for workflow operations
 */
export class WorkflowSDK {
    private config: WorkflowSDKConfig;
    private engine: WorkflowEngine;
    private solanaSDK: SolanaWorkflowSDK | null = null;

    constructor(config: WorkflowSDKConfig) {
        this.config = {
            programId: '3QRayGY5SHYnD5cb2qegEoNx7dPXJJyHJD3shzAQ75UW',
            ...config,
        };

        // Initialize workflow engine with default handlers
        this.engine = new WorkflowEngine(createAllHandlers());

        // Initialize Solana SDK if connection is available
        this.initializeSolanaSDK();
    }

    /**
     * Initialize Solana SDK if wallet and connection are available
     * @deprecated Auto-initialization is disabled during @solana/kit migration.
     *             Pass an initialized SolanaWorkflowSDK instance directly if needed.
     */
    private initializeSolanaSDK(): void {
        // Disabled: SolanaWorkflowSDK now requires a TransactionSigner which
        // cannot be derived from the legacy WalletAdapter interface.
        // External callers should inject a pre-built SolanaWorkflowSDK instance.
        this.solanaSDK = null as unknown as SolanaWorkflowSDK;
    }

    /**
     * Create a Keypair from wallet adapter
     * Note: This is a simplified approach. Real implementation would use
     * a proper wallet adapter that can sign transactions.
     */

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

        // If Solana SDK is available, create on-chain
        if (this.solanaSDK) {
            try {
                const workflowId = address(Keypair.generate().publicKey.toBase58());
                const signature = await this.solanaSDK.createWorkflow(workflow, workflowId);
                console.log(`[SDK] Workflow created on-chain: ${signature}`);
                return workflowId;
            } catch (error) {
                console.warn('[SDK] On-chain creation failed, using local:', error);
            }
        }

        // Register locally
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

        // If Solana SDK is available, try on-chain
        if (this.solanaSDK) {
            try {
                const metadata = await this.solanaSDK.getWorkflow(address(workflowId));
                if (metadata) {
                    // Convert on-chain metadata to GradienceWorkflow format
                    return this.convertOnChainToWorkflow(metadata, workflowId);
                }
            } catch (error) {
                console.warn('[SDK] Failed to fetch from chain:', error);
            }
        }

        return null;
    }

    /**
     * Convert on-chain metadata to GradienceWorkflow
     */
    private convertOnChainToWorkflow(metadata: OnChainWorkflowMetadata, workflowId: string): GradienceWorkflow {
        const pricingModelMap: Record<number, 'free' | 'oneTime' | 'subscription' | 'perUse' | 'revenueShare'> = {
            0: 'free',
            1: 'oneTime',
            2: 'subscription',
            3: 'perUse',
            4: 'revenueShare',
        };

        return {
            id: workflowId,
            name: `Workflow ${workflowId.slice(0, 8)}`,
            description: `On-chain workflow by ${metadata.author.slice(0, 8)}...`,
            version: metadata.version,
            contentHash: `ipfs://${metadata.contentHash}`,
            steps: [], // Would fetch full content from IPFS
            pricing: {
                model: pricingModelMap[metadata.pricingModel] || 'free',
                oneTimePrice:
                    metadata.priceAmount > 0n
                        ? {
                              mint: metadata.priceMint,
                              amount: metadata.priceAmount.toString(),
                          }
                        : undefined,
            },
            revenueShare: {
                creator: metadata.creatorShare,
                user: 6000,
                agent: 500,
                protocol: 200,
                judge: 300,
            },
            isPublic: metadata.isPublic,
            isTemplate: false,
            author: metadata.author,
            createdAt: metadata.createdAt.getTime(),
            updatedAt: metadata.updatedAt.getTime(),
            requirements: {
                minReputation: 0,
                tokens: [],
                zkProofs: [],
                whitelist: [],
            },
            signature: '',
            tags: [],
        };
    }

    /**
     * Purchase a workflow
     *
     * If Solana SDK is available, performs on-chain purchase with payment.
     * Otherwise, returns a mock access PDA.
     */
    async purchase(workflowId: string, author?: string): Promise<PurchaseResult> {
        if (!this.config.wallet?.publicKey) {
            throw new Error('Wallet not connected');
        }

        // If Solana SDK is available, use it
        if (this.solanaSDK) {
            try {
                const workflowAddr = address(workflowId);
                const authorAddr = author
                    ? address(author)
                    : // Fetch author from on-chain metadata
                      (await this.solanaSDK.getWorkflow(workflowAddr))?.author ||
                      (await this.solanaSDK.getTreasuryAddress()); // Fallback to treasury

                const signature = await this.solanaSDK.purchaseWorkflowWithPayment(
                    workflowAddr,
                    authorAddr,
                    0, // purchased
                );

                const accessPDA = await this.solanaSDK.getAccessAddress(
                    workflowAddr,
                    address(this.config.wallet.publicKey),
                );

                console.log(`[SDK] Workflow purchased: ${signature}`);

                return {
                    signature,
                    accessPDA: accessPDA,
                    workflowId,
                    timestamp: Date.now(),
                };
            } catch (error) {
                console.warn('[SDK] On-chain purchase failed:', error);
                throw new Error(`Purchase failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        // Fallback: return mock result
        console.log(`[SDK] Purchase workflow ${workflowId} (mock)`);

        return {
            signature: 'mock-purchase-tx',
            accessPDA: `access-${workflowId}-${this.config.wallet.publicKey}`,
            workflowId,
            timestamp: Date.now(),
        };
    }

    /**
     * Check if user has access to workflow
     */
    async hasAccess(workflowId: string, user?: string): Promise<boolean> {
        const userKey = user || this.config.wallet?.publicKey;
        if (!userKey) return false;

        // If Solana SDK is available, check on-chain
        if (this.solanaSDK) {
            try {
                const hasAccess = await this.solanaSDK.hasAccess(address(workflowId), address(userKey));
                return hasAccess;
            } catch (error) {
                console.warn('[SDK] Failed to check access on-chain:', error);
            }
        }

        // Mock: check local engine
        return this.engine.getWorkflow(workflowId) !== null;
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
        },
    ): Promise<WorkflowExecutionResult> {
        // Check access
        const hasAccess = await this.hasAccess(workflowId);
        if (!hasAccess) {
            throw new Error('No access to workflow. Please purchase first.');
        }

        // Record execution on-chain if SDK available
        if (this.solanaSDK) {
            try {
                const signature = await this.solanaSDK.recordExecution(address(workflowId));
                console.log(`[SDK] Execution recorded on-chain: ${signature}`);
            } catch (error) {
                console.warn('[SDK] Failed to record execution on-chain:', error);
            }
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
    async simulate(workflow: GradienceWorkflow, config?: Record<string, unknown>): Promise<WorkflowExecutionResult> {
        return this.engine.simulate(workflow, config);
    }

    /**
     * Review a workflow
     *
     * If Solana SDK is available, submits review on-chain.
     */
    async review(workflowId: string, rating: number, comment: string): Promise<ReviewResult> {
        if (!this.config.wallet?.publicKey) {
            throw new Error('Wallet not connected');
        }

        if (rating < 1 || rating > 5) {
            throw new Error('Rating must be between 1 and 5');
        }

        // TODO: Upload comment to IPFS/Arweave
        const commentHash = await this.uploadComment(comment);

        // If Solana SDK is available, submit on-chain
        if (this.solanaSDK) {
            try {
                const signature = await this.solanaSDK.reviewWorkflow(address(workflowId), rating, comment);

                console.log(`[SDK] Review submitted on-chain: ${signature}`);

                return {
                    signature,
                    workflowId,
                    rating,
                    commentHash,
                    timestamp: Date.now(),
                };
            } catch (error) {
                console.warn('[SDK] On-chain review failed:', error);
                throw new Error(`Review failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        // Fallback: mock result
        console.log(`[SDK] Review workflow ${workflowId}: ${rating} stars (mock)`);

        return {
            signature: 'mock-review-tx',
            workflowId,
            rating,
            commentHash,
            timestamp: Date.now(),
        };
    }

    /**
     * Upload comment to IPFS/Arweave
     * Placeholder for actual upload
     */
    private async uploadComment(comment: string): Promise<string> {
        // TODO: Implement IPFS/Arweave upload
        // For now, return a mock hash
        return `ipfs:${Buffer.from(comment).toString('base64').slice(0, 32)}`;
    }

    /**
     * Browse marketplace
     */
    async browse(filters: BrowseFilters = {}): Promise<WorkflowListing[]> {
        // TODO: Query indexer
        // This would call the indexer API with filters

        // Mock data for demonstration
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
     *
     * If Solana SDK is available, submits update on-chain.
     */
    async update(
        workflowId: string,
        updates: Partial<Pick<GradienceWorkflow, 'description' | 'isPublic'>>,
    ): Promise<UpdateResult> {
        if (!this.config.wallet?.publicKey) {
            throw new Error('Wallet not connected');
        }

        // If Solana SDK is available and contentHash is provided
        if (this.solanaSDK && updates.description) {
            try {
                // Note: On-chain update only supports contentHash changes
                // This is a simplified implementation
                const newContentHash = await this.uploadComment(updates.description);
                const signature = await this.solanaSDK.updateWorkflow(address(workflowId), newContentHash);

                console.log(`[SDK] Workflow updated on-chain: ${signature}`);

                return {
                    signature,
                    workflowId,
                    timestamp: Date.now(),
                };
            } catch (error) {
                console.warn('[SDK] On-chain update failed:', error);
                throw new Error(`Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        // Fallback: local update
        console.log(`[SDK] Update workflow ${workflowId}`, updates);

        return {
            signature: 'mock-update-tx',
            workflowId,
            timestamp: Date.now(),
        };
    }

    /**
     * Deactivate a workflow
     *
     * If Solana SDK is available, submits deactivate on-chain.
     */
    async deactivate(workflowId: string): Promise<UpdateResult> {
        if (!this.config.wallet?.publicKey) {
            throw new Error('Wallet not connected');
        }

        if (this.solanaSDK) {
            try {
                const signature = await this.solanaSDK.deactivateWorkflow(address(workflowId));

                console.log(`[SDK] Workflow deactivated on-chain: ${signature}`);

                return {
                    signature,
                    workflowId,
                    timestamp: Date.now(),
                };
            } catch (error) {
                console.warn('[SDK] On-chain deactivate failed:', error);
                throw new Error(`Deactivate failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        console.log(`[SDK] Deactivate workflow ${workflowId} (mock)`);

        return {
            signature: 'mock-deactivate-tx',
            workflowId,
            timestamp: Date.now(),
        };
    }

    /**
     * Activate a workflow
     *
     * If Solana SDK is available, submits activate on-chain.
     */
    async activate(workflowId: string): Promise<UpdateResult> {
        if (!this.config.wallet?.publicKey) {
            throw new Error('Wallet not connected');
        }

        if (this.solanaSDK) {
            try {
                const signature = await this.solanaSDK.activateWorkflow(address(workflowId));

                console.log(`[SDK] Workflow activated on-chain: ${signature}`);

                return {
                    signature,
                    workflowId,
                    timestamp: Date.now(),
                };
            } catch (error) {
                console.warn('[SDK] On-chain activate failed:', error);
                throw new Error(`Activate failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        console.log(`[SDK] Activate workflow ${workflowId} (mock)`);

        return {
            signature: 'mock-activate-tx',
            workflowId,
            timestamp: Date.now(),
        };
    }

    /**
     * Delete a workflow
     *
     * If Solana SDK is available, submits delete on-chain.
     * Note: Can only delete if no purchases.
     */
    async delete(workflowId: string): Promise<UpdateResult> {
        if (!this.config.wallet?.publicKey) {
            throw new Error('Wallet not connected');
        }

        if (this.solanaSDK) {
            try {
                const signature = await this.solanaSDK.deleteWorkflow(address(workflowId));

                console.log(`[SDK] Workflow deleted on-chain: ${signature}`);

                return {
                    signature,
                    workflowId,
                    timestamp: Date.now(),
                };
            } catch (error) {
                console.warn('[SDK] On-chain delete failed:', error);
                throw new Error(`Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        console.log(`[SDK] Delete workflow ${workflowId} (mock)`);

        return {
            signature: 'mock-delete-tx',
            workflowId,
            timestamp: Date.now(),
        };
    }

    /**
     * Get execution history
     */
    async getExecutions(workflowId: string): Promise<WorkflowExecutionResult[]> {
        return this.engine.getExecutions(workflowId);
    }

    /**
     * Get Solana SDK instance (for advanced operations)
     */
    getSolanaSDK(): SolanaWorkflowSDK | null {
        return this.solanaSDK;
    }
}

/**
 * Create SDK instance
 */
export function createWorkflowSDK(config: WorkflowSDKConfig): WorkflowSDK {
    return new WorkflowSDK(config);
}
