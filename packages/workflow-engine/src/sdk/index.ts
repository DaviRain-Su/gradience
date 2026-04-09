/**
 * SDK module exports
 */

export {
    WorkflowSDK,
    createWorkflowSDK,
    type WorkflowSDKConfig,
    type WalletAdapter,
    type BrowseFilters,
    type WorkflowListing,
} from './marketplace.js';

export {
    SolanaWorkflowSDK,
    createSolanaWorkflowSDK,
    type SolanaSDKConfig,
    type OnChainWorkflowMetadata,
} from './solana-sdk.js';

export {
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

// Enhanced SDK with caching, batching, and retry logic
export {
    EnhancedWorkflowSDK,
    createEnhancedSDK,
    type EnhancedSDKConfig,
    type BatchOperationResult,
    type CachedWorkflow,
    type WorkflowEvent,
    type ExecutionOptions,
} from './enhanced.js';
