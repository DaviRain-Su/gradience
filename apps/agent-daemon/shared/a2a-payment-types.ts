// A2A Payment Types - Chain Hub Settlement Integration

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
  /** Submission URL for evaluation */
  submissionUrl?: string;
  /** Solana account addresses for on-chain settlement */
  taskAccount?: string;
  escrowAccount?: string;
  evaluation?: {
    evaluatorId?: string;
    score?: number;
    type?: string;
    minScore?: number;
    criteria?: {
      requiredChecks?: string[];
      optionalChecks?: string[];
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
