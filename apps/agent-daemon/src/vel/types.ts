/**
 * Verifiable Execution Layer (VEL) — Type Definitions
 *
 * All interfaces must match apps/agent-daemon/docs/03-technical-spec-vel.md
 */

export const VEL_VERSION = 'vel-v1' as const;
export const DEFAULT_TEE_TIMEOUT_MS = 300_000;
export const MAX_ATTESTATION_SIZE_BYTES = 65_536;
export const MAX_REASON_REF_LENGTH = 200;
export const PROOF_PAYLOAD_VERSION = 1;

// ------------------------------------------------------------------
// Workflow
// ------------------------------------------------------------------

export interface WorkflowDefinition {
    version: '1.0';
    name: string;
    steps: WorkflowStep[];
}

export type WorkflowStep =
    | { type: 'swap'; params: SwapParams }
    | { type: 'transfer'; params: TransferParams }
    | { type: 'stake'; params: StakeParams }
    | { type: 'unstake'; params: UnstakeParams }
    | { type: 'tool_call'; params: ToolCallParams };

export interface SwapParams {
    inputMint: string;
    outputMint: string;
    amount: bigint;
    slippageBps?: number;
}

export interface TransferParams {
    recipient: string;
    amount: bigint;
    mint?: string;
}

export interface StakeParams {
    validatorVoteAccount?: string;
    amount: bigint;
}

export interface UnstakeParams {
    stakeAccount: string;
}

export interface ToolCallParams {
    toolName: string;
    arguments: Record<string, unknown>;
}

// ------------------------------------------------------------------
// Execution
// ------------------------------------------------------------------

export interface TeeExecutionRequest {
    workflowId: string;
    workflowDefinition: WorkflowDefinition;
    inputs: Record<string, unknown>;
    taskId: number;
    executorAddress: string;
    timeoutMs: number;
}

export interface TeeExecutionResult {
    success: boolean;
    stepResults: StepResult[];
    summary: string;
    logHash: string;
    resultHash: string;
    attestationReport: string; // base64
    executedAt: number;
}

export interface TeeExecutionEngine {
    execute(request: TeeExecutionRequest): Promise<TeeExecutionResult>;
    verifyAttestation(bundle: AttestationBundle): Promise<VerificationReport>;
}

export interface StepResult {
    stepIndex: number;
    stepType: string;
    success: boolean;
    output: unknown;
    error?: string;
    durationMs: number;
}

// ------------------------------------------------------------------
// Attestation
// ------------------------------------------------------------------

export interface AttestationBundle {
    version: typeof VEL_VERSION;
    taskId: number;
    executorAddress: string;
    resultHash: string;
    logHash: string;
    attestationReport: string; // base64
    providerName: 'gramine-local' | 'nitro-local' | string;
    pcrValues: Record<string, string>;
    timestamp: number;
}

export interface VerificationReport {
    valid: boolean;
    reason?: string;
    pcrValues?: Record<string, string>;
    signerIdentity?: string;
}

// ------------------------------------------------------------------
// Provider
// ------------------------------------------------------------------

export interface TeeProviderConfig {
    providerName: string;
    /** Gramine manifest path (local simulation) */
    manifestPath?: string;
    /** Unix socket / vsock path for enclave communication */
    socketPath: string;
    /** Allowed PCR / measurement values. Must contain at least 1 entry. */
    allowedPcrValues: string[];
    /** Optional: command override for gramine execution */
    commandOverride?: string;
    /** Optional: working directory for enclave process */
    workingDir?: string;
    /** Optional: startup timeout for enclave process (ms). Default 10000. */
    startupTimeoutMs?: number;
}

export interface EnclavePayload {
    workflowDefinition: WorkflowDefinition;
    inputs: Record<string, unknown>;
    seed: Uint8Array;
    taskId: number;
}

export interface EnclaveResponse {
    success: boolean;
    stepResults: StepResult[];
    summary: string;
    logHash: string;
    resultHash: string;
    attestationReport: string; // base64
    error?: string;
}

// ------------------------------------------------------------------
// Orchestrator
// ------------------------------------------------------------------

export interface VelOrchestratorConfig {
    bridge: {
        judgeAndPay(args: { taskId: number; winner: string; score: number; reasonRef: string }): Promise<string>;
    };
    keyManager: {
        getSeedForTask(taskId: number): Promise<Uint8Array>;
    };
    storage: {
        upload(bundle: AttestationBundle): Promise<string>; // returns URI
    };
    defaultProvider: string;
}
