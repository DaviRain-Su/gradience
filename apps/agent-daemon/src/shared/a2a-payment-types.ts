// Stub: a2a-payment-types -- will be fully implemented with A2A payment system

export interface PaymentRequest {
  paymentId: string;
  taskId: string;
  payer: string;
  payee: string;
  amount: string;
  token: string;
  tokenSymbol: string;
  decimals: number;
  displayAmount: string;
  deadline: number;
  description?: string;
  submissionUrl?: string;
  /** On-chain task account (PDA) for bridge settlement */
  taskAccount?: string;
  /** On-chain escrow account (PDA) for bridge settlement */
  escrowAccount?: string;
  /** Optional reason reference for the judgement */
  reasonRef?: string;
  /** Optional loser stake refund pairs */
  losers?: Array<{ agent: string; account?: string }>;
  /** Execution mode for settlement (l1 / er / per) */
  executionMode?: 'l1' | 'er' | 'per';
  evaluation?: {
    evaluatorId?: string;
    score?: number;
    type?: 'code_review' | 'ui_ux' | 'api_testing' | 'content_quality' | 'manual';
    minScore?: number;
    criteria?: {
      requiredChecks?: string[];
      optionalChecks?: string[];
      rubric?: {
        categories: Array<{
          name: string;
          description: string;
          maxScore: number;
          weight: number;
        }>;
      };
    };
  };
}

export interface PaymentConfirmation {
  paymentId: string;
  taskId: string;
  txHash: string;
  blockTime: number;
  slot: number;
  amount: string;
  token: string;
  payer: string;
  payee: string;
  instructionIndex: number;
  evaluatorScore: number;
  settledAt: number;
  status?: string;
  metadata?: {
    evaluated?: boolean;
    requiresReview?: boolean;
    evaluationCost?: number;
    [key: string]: unknown;
  };
}

export interface PaymentReceipt {
  paymentId: string;
  taskId: string;
  txHash: string;
  status: string;
  confirmedAt: number;
  signature: string;
}

export interface PaymentDispute {
  paymentId: string;
  taskId: string;
  reason: string;
  initiator?: string;
  disputedAt?: number;
  requestedResolution?: string;
}

export function validatePaymentRequest(_req: unknown): _req is PaymentRequest {
  return true;
}

export function validatePaymentConfirmation(_conf: unknown): _conf is PaymentConfirmation {
  return true;
}

export function validatePaymentReceipt(_receipt: unknown): _receipt is PaymentReceipt {
  return true;
}

export function generatePaymentId(): string {
  return `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
