export interface MPPPayment {
  /** Payment ID */
  paymentId: string;
  /** Task ID associated with this payment */
  taskId: string;
  /** Total amount in smallest token unit */
  totalAmount: bigint;
  /** Token mint */
  token: string;
  /** Token symbol */
  tokenSymbol: string;
  /** Decimals */
  decimals: number;
  /** Payer address */
  payer: string;
  /** Escrow account */
  escrow: string;
  /** Participants and their shares */
  participants: MPPParticipant[];
  /** Judges for dispute resolution */
  judges: MPPJudge[];
  /** Release conditions */
  releaseConditions: MPPReleaseCondition;
  /** Payment status */
  status: MPPStatus;
  /** Created timestamp */
  createdAt: number;
  /** Expires at */
  expiresAt: number;
}

export interface MPPParticipant {
  /** Participant address */
  address: string;
  /** Share in basis points (10000 = 100%) */
  shareBps: number;
  /** Participant role */
  role: 'agent' | 'provider' | 'contributor' | 'stakeholder';
  /** Amount allocated */
  allocatedAmount: bigint;
  /** Amount released */
  releasedAmount: bigint;
  /** Whether they have claimed */
  hasClaimed: boolean;
}

export interface MPPJudge {
  /** Judge address */
  address: string;
  /** Judge weight in voting (default: 1) */
  weight: number;
  /** Whether judge has voted */
  hasVoted: boolean;
  /** Judge's vote */
  vote?: 'approve' | 'reject' | 'abstain';
}

export interface MPPReleaseCondition {
  /** Type of release condition */
  type: 'unanimous' | 'majority' | 'threshold' | 'milestone' | 'time';
  /** Required approval threshold (for threshold type) */
  thresholdBps?: number;
  /** Required number of judges (for majority type) */
  requiredJudges?: number;
  /** Milestones for milestone-based release */
  milestones?: MPPMilestone[];
  /** Release time (for time-based) */
  releaseTime?: number;
}

export interface MPPMilestone {
  /** Milestone ID */
  id: string;
  /** Description */
  description: string;
  /** Amount to release */
  amount: bigint;
  /** Whether completed */
  completed: boolean;
  /** Completion proof */
  proof?: string;
  /** Approved by judges */
  approved: boolean;
}

export type MPPStatus =
  | 'pending_funding'      // Waiting for payer to fund escrow
  | 'funded'               // Escrow funded, work can begin
  | 'in_progress'          // Work in progress
  | 'pending_judgment'     // Waiting for judge votes
  | 'approved'             // Approved for release
  | 'rejected'             // Rejected, refund to payer
  | 'partially_released'   // Some funds released
  | 'fully_released'       // All funds released
  | 'disputed'             // Under dispute
  | 'refunded'             // Refunded to payer
  | 'expired';             // Payment expired

export interface MPPVote {
  /** Payment ID */
  paymentId: string;
  /** Judge address */
  judgeAddress: string;
  /** Vote */
  vote: 'approve' | 'reject' | 'abstain';
  /** Reason */
  reason?: string;
  /** Timestamp */
  timestamp: number;
  /** Signature */
  signature: string;
}

export interface MPPClaim {
  /** Payment ID */
  paymentId: string;
  /** Participant address */
  participantAddress: string;
  /** Amount to claim */
  amount: bigint;
  /** Timestamp */
  timestamp: number;
  /** Transaction signature */
  txSignature?: string;
}

export interface MPPConfig {
  /** Solana RPC endpoint */
  rpcEndpoint: string;
  /** Maximum number of participants */
  maxParticipants: number;
  /** Maximum number of judges */
  maxJudges: number;
  /** Default timeout (ms) */
  defaultTimeoutMs: number;
  /** Minimum judge threshold (basis points) */
  minJudgeThresholdBps: number;
}
