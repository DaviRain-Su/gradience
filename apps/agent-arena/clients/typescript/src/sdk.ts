/**
 * Gradience SDK
 *
 * TypeScript SDK for interacting with the Gradience protocol.
 *
 * @module @gradience/sdk
 * @deprecated Use modular imports from specific resource modules
 */

// Re-export all types
export * from './types.js';

// Re-export resource classes
export {
  TasksResource,
  ReputationResource,
  JudgePoolResource,
  ProfileResource,
} from './resources/index.js';

// Re-export generated instructions
export * from './generated/index.js';

// Import for backward-compatible GradienceSDK class
import {
  GRADIENCE_PROGRAM_ADDRESS,
  getApplyForTaskInstructionAsync,
  getApplyForTaskInstruction,
  getCancelTaskInstructionAsync,
  getCancelTaskInstruction,
  getForceRefundInstructionAsync,
  getForceRefundInstruction,
  getInitializeInstruction,
  getJudgeAndPayInstructionAsync,
  getJudgeAndPayInstruction,
  getPostTaskInstructionAsync,
  getPostTaskInstruction,
  getRefundExpiredInstructionAsync,
  getRefundExpiredInstruction,
  getRegisterJudgeInstruction,
  getSubmitResultInstructionAsync,
  getSubmitResultInstruction,
  getUnstakeJudgeInstruction,
  getUpgradeConfigInstruction,
  type RuntimeEnvInputArgs,
} from './generated/index.js';
import {
  createSolanaRpc,
  fetchEncodedAccount,
  getAddressDecoder,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit';

import {
  type GradienceSdkOptions,
  type WalletAdapter,
  type SendTransactionOptions,
  type EnsureLookupTableRequest,
  type PostTaskRequest,
  type ApplyTaskRequest,
  type SubmitTaskResultRequest,
  type JudgeTaskRequest,
  type CancelTaskRequest,
  type RefundExpiredRequest,
  type ForceRefundRequest,
  type TaskApi,
  type SubmissionApi,
  type ReputationApi,
  type JudgePoolEntryApi,
  type PostTaskSimpleRequest,
  type PostTaskSimpleResult,
  type AgentProfileApi,
  type AgentProfileUpdate,
} from './types.js';

import { TasksResource } from './resources/tasks.js';
import { ReputationResource } from './resources/reputation.js';
import { JudgePoolResource } from './resources/judge-pool.js';
import { ProfileResource } from './resources/profile.js';

/**
 * Gradience SDK - Backward Compatible Wrapper
 *
 * @deprecated Use resource classes directly: TasksResource, ReputationResource, etc.
 */
export class GradienceSDK {
  private indexerEndpoint: string;
  private attestationEndpoint: string;
  private programAddress: Address;
  private rpc: Parameters<typeof fetchEncodedAccount>[0];
  private wallet: WalletAdapter | undefined;

  // Resource instances
  readonly tasks: TasksResource;
  readonly reputation: ReputationResource;
  readonly judgePool: JudgePoolResource;
  readonly profile: ProfileResource;

  // Instructions namespace (backward compatible)
  readonly instructions: {
    initialize: typeof getInitializeInstruction;
    postTask: typeof getPostTaskInstructionAsync;
    applyForTask: typeof getApplyForTaskInstructionAsync;
    submitResult: typeof getSubmitResultInstructionAsync;
    judgeAndPay: typeof getJudgeAndPayInstructionAsync;
    cancelTask: typeof getCancelTaskInstructionAsync;
    refundExpired: typeof getRefundExpiredInstructionAsync;
    forceRefund: typeof getForceRefundInstructionAsync;
    registerJudge: typeof getRegisterJudgeInstruction;
    unstakeJudge: typeof getUnstakeJudgeInstruction;
    upgradeConfig: typeof getUpgradeConfigInstruction;
  };

  constructor(options: GradienceSdkOptions = {}) {
    this.indexerEndpoint = options.indexerEndpoint ?? 'https://api.gradiences.xyz/indexer';
    this.attestationEndpoint = options.attestationEndpoint ?? 'https://api.gradiences.xyz/attestation';
    this.programAddress = options.programAddress ?? GRADIENCE_PROGRAM_ADDRESS;
    this.rpc = options.rpc ?? createSolanaRpc(options.rpcEndpoint ?? 'https://api.devnet.solana.com');

    // Initialize resource instances
    this.tasks = new TasksResource({
      indexerEndpoint: this.indexerEndpoint,
      programAddress: this.programAddress,
      rpc: this.rpc,
    });

    this.reputation = new ReputationResource({
      indexerEndpoint: this.indexerEndpoint,
      programAddress: this.programAddress,
      rpc: this.rpc,
    });

    this.judgePool = new JudgePoolResource({
      indexerEndpoint: this.indexerEndpoint,
      programAddress: this.programAddress,
      rpc: this.rpc,
    });

    this.profile = new ProfileResource({
      indexerEndpoint: this.indexerEndpoint,
    });

    // Expose instructions (backward compatible)
    this.instructions = {
      initialize: getInitializeInstruction,
      postTask: getPostTaskInstructionAsync,
      applyForTask: getApplyForTaskInstructionAsync,
      submitResult: getSubmitResultInstructionAsync,
      judgeAndPay: getJudgeAndPayInstructionAsync,
      cancelTask: getCancelTaskInstructionAsync,
      refundExpired: getRefundExpiredInstructionAsync,
      forceRefund: getForceRefundInstructionAsync,
      registerJudge: getRegisterJudgeInstruction,
      unstakeJudge: getUnstakeJudgeInstruction,
      upgradeConfig: getUpgradeConfigInstruction,
    };
  }

  // Backward compatible setters
  setIndexerEndpoint(endpoint: string): void {
    this.indexerEndpoint = endpoint;
    // Update resources
    (this.tasks as unknown as { indexerEndpoint: string }).indexerEndpoint = endpoint;
    (this.reputation as unknown as { indexerEndpoint: string }).indexerEndpoint = endpoint;
    (this.judgePool as unknown as { indexerEndpoint: string }).indexerEndpoint = endpoint;
    (this.profile as unknown as { indexerEndpoint: string }).indexerEndpoint = endpoint;
  }

  setAttestationEndpoint(endpoint: string): void {
    this.attestationEndpoint = endpoint;
  }

  setWallet(wallet: WalletAdapter): void {
    this.wallet = wallet;
  }

  // ============================================================================
  // Task Methods (delegate to TasksResource)
  // ============================================================================

  async postTask(request: PostTaskRequest): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not set');
    return this.tasks.postTask(request, this.wallet);
  }

  async postTaskSimple(request: PostTaskSimpleRequest): Promise<PostTaskSimpleResult> {
    if (!this.wallet) throw new Error('Wallet not set');
    return this.tasks.postTaskSimple(request, this.wallet);
  }

  async applyForTask(request: ApplyTaskRequest): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not set');
    return this.tasks.applyForTask(request, this.wallet);
  }

  async submitResult(request: SubmitTaskResultRequest): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not set');
    return this.tasks.submitResult(request, this.wallet);
  }

  async judgeTask(request: JudgeTaskRequest): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not set');
    return this.tasks.judgeTask(request, this.wallet);
  }

  async cancelTask(request: CancelTaskRequest): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not set');
    return this.tasks.cancelTask(request, this.wallet);
  }

  async refundExpiredTask(request: RefundExpiredRequest): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not set');
    return this.tasks.refundExpiredTask(request, this.wallet);
  }

  async forceRefundTask(request: ForceRefundRequest): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not set');
    return this.tasks.forceRefundTask(request, this.wallet);
  }

  async getTasks(filters?: { status?: string; category?: number }): Promise<TaskApi[]> {
    return this.tasks.getTasks(filters);
  }

  async getTask(taskId: number | bigint): Promise<TaskApi | null> {
    return this.tasks.getTask(taskId);
  }

  async getTaskSubmissions(taskId: number | bigint): Promise<SubmissionApi[]> {
    return this.tasks.getTaskSubmissions(taskId);
  }

  // ============================================================================
  // Reputation Methods (delegate to ReputationResource)
  // ============================================================================

  async getReputation(agent: string): Promise<ReputationApi | null> {
    return this.reputation.getReputation(agent);
  }

  // ============================================================================
  // Judge Pool Methods (delegate to JudgePoolResource)
  // ============================================================================

  async getJudgePool(category: number): Promise<JudgePoolEntryApi[]> {
    return this.judgePool.getJudgePool(category);
  }

  // ============================================================================
  // Profile Methods (delegate to ProfileResource)
  // ============================================================================

  async getAgentProfile(agent: string): Promise<AgentProfileApi | null> {
    return this.profile.get(agent);
  }

  async updateAgentProfile(agent: string, data: AgentProfileUpdate): Promise<void> {
    return this.profile.update(agent, data);
  }
}

// ============================================================================
// Constants
// ============================================================================

/** Self-Attestation Service Program ID */
export const SAS_PROGRAM_ID = 'SAS222222222222222222222222222222222222222' as Address;
