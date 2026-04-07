/**
 * Shared types for the unified Gradience SDK.
 *
 * These are simplified, string-based versions of the on-chain types so that
 * callers don't need to import @solana/kit Address types directly.
 */

// Re-export on-chain / indexer types from Arena SDK for advanced use.
export type {
    GradienceSdkOptions,
    WalletAdapter,
    SendTransactionOptions,
    EnsureLookupTableRequest,
    PostTaskRequest,
    PostTaskSimpleRequest,
    PostTaskSimpleResult,
    ApplyTaskRequest,
    SubmitTaskResultRequest,
    JudgeTaskRequest,
    CancelTaskRequest,
    RefundExpiredRequest,
    ForceRefundRequest,
    StakeRefundRecipient,
    // Indexer API shapes
    TaskApi,
    SubmissionApi,
    ReputationApi,
    JudgePoolEntryApi,
    // On-chain account shapes
    ReputationOnChain,
    ReputationCategoryOnChain,
    JudgePoolMemberOnChain,
    ProgramConfigOnChain,
    // Attestation types
    TaskCompletionAttestationApi,
    TaskCompletionAttestationData,
    TaskCompletionAttestationRecord,
    // Agent profile
    AgentProfileApi,
    AgentProfileUpdate,
    AgentProfileLinks,
    ProfilePublishMode,
} from '@gradiences/arena-sdk';

// ── Unified high-level types ─────────────────────────────────────────────────

/** Options for constructing the top-level {@link Gradience} client. */
export interface GradienceClientOptions {
    /** Solana RPC endpoint (default: localhost:8899) */
    rpcEndpoint?: string;
    /** Gradience indexer endpoint (default: localhost:3001) */
    indexerEndpoint?: string;
    /** Optional attestation service endpoint (defaults to indexerEndpoint) */
    attestationEndpoint?: string;
    /** Pre-configured wallet for signing on-chain transactions */
    wallet?: import('@gradiences/arena-sdk').WalletAdapter;
    /** Override the deployed program address (advanced) */
    programAddress?: string;
}

/**
 * Simplified options for {@link Gradience.postTask}.
 *
 * Maps `description` → `evalRef` so callers don't need to know the internal
 * field name.  All other fields mirror {@link PostTaskSimpleRequest}.
 */
export interface PostTaskOptions {
    /** Human-readable description or IPFS/Arweave CID of the task spec */
    description: string;
    /** Reward in lamports (native SOL) or token base units */
    reward: number | bigint;
    /** Task category (0 = general, see docs for category registry) */
    category: number;
    /** Absolute Unix timestamp (seconds) or omit to use default offset */
    deadline?: number | bigint;
    /** Seconds from now until task deadline (default: 3600). Maps to on-chain deadline. */
    deadlineOffsetSeconds?: number | bigint;
    /** Seconds after deadline for judge decision (default: 3600) */
    judgeDeadlineOffsetSeconds?: number | bigint;
    /** Judge mode: 0 = designated, 1 = pool (default: 1) */
    judgeMode?: number;
    /** Designated judge pubkey (required when judgeMode=0) */
    judge?: string;
    /** Minimum agent stake in lamports (default: 0) */
    minStake?: number | bigint;
    /** SPL token mint address for reward (omit for native SOL) */
    mint?: string;
}

/** Result returned from {@link Gradience.postTask}. */
export interface PostTaskResult {
    /** On-chain task ID assigned by the program */
    taskId: bigint;
    /** Transaction signature */
    signature: string;
}
