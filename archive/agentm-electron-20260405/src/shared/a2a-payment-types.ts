/**
 * A2A Payment Message Types
 *
 * XMTP-based payment confirmation protocol for Gradience Agent economy.
 *
 * Payment Flow:
 * 1. Agent A (payer) ──XMTP──→ Agent B (payee): PaymentRequest
 * 2. Agent B completes service
 * 3. Evaluator verifies (off-chain)
 * 4. Chain Hub settles (on-chain)
 * 5. Agent A ──XMTP──→ Agent B: PaymentConfirmation (with txHash)
 * 6. Agent B verifies settlement, sends Receipt
 * 7. Both parties have cryptographic proof
 *
 * @module shared/a2a-payment-types
 */

import { z } from 'zod';

// ============ Payment Request ============

/**
 * Payment request message
 * Sent by payer to initiate payment agreement
 */
export interface PaymentRequest {
    /** Unique payment ID */
    paymentId: string;
    /** Associated task ID */
    taskId: string;
    /** Payer address (Solana) */
    payer: string;
    /** Payee address (Solana) */
    payee: string;
    /** Payment amount in smallest unit */
    amount: string;
    /** Token mint address */
    token: string;
    /** Token symbol (e.g., 'USDC') */
    tokenSymbol: string;
    /** Number of decimals */
    decimals: number;
    /** Human-readable amount */
    displayAmount: string;
    /** Payment deadline (Unix ms) */
    deadline: number;
    /** Service description */
    description: string;
    /** Chain Hub escrow address (if using escrow) */
    escrowAddress?: string;
    /** Evaluator requirements */
    evaluation?: {
        /** Required evaluator type */
        type: 'automated' | 'human' | 'hybrid';
        /** Minimum score to release payment (0-100) */
        minScore: number;
        /** Evaluation criteria */
        criteria: string[];
    };
}

export const PaymentRequestSchema = z.object({
    paymentId: z.string().uuid(),
    taskId: z.string(),
    payer: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/), // Solana address
    payee: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
    amount: z.string().regex(/^\d+$/), // Numeric string
    token: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
    tokenSymbol: z.string().min(1).max(10),
    decimals: z.number().int().min(0).max(18),
    displayAmount: z.string(),
    deadline: z.number().int().positive(),
    description: z.string().min(1).max(1000),
    escrowAddress: z
        .string()
        .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
        .optional(),
    evaluation: z
        .object({
            type: z.enum(['automated', 'human', 'hybrid']),
            minScore: z.number().int().min(0).max(100),
            criteria: z.array(z.string()),
        })
        .optional(),
});

// ============ Payment Confirmation ============

/**
 * Payment confirmation message
 * Sent by payer after on-chain settlement
 */
export interface PaymentConfirmation {
    /** Payment ID (matches request) */
    paymentId: string;
    /** Task ID */
    taskId: string;
    /** Solana transaction signature */
    txHash: string;
    /** Block timestamp */
    blockTime: number;
    /** Slot number */
    slot: number;
    /** Actual amount transferred */
    amount: string;
    /** Token mint */
    token: string;
    /** Payer address */
    payer: string;
    /** Payee address */
    payee: string;
    /** Chain Hub instruction index */
    instructionIndex: number;
    /** Evaluator score (0-100) */
    evaluatorScore: number;
    /** Evaluator proof hash */
    evaluationProof?: string;
    /** Settlement timestamp */
    settledAt: number;
}

export const PaymentConfirmationSchema = z.object({
    paymentId: z.string().uuid(),
    taskId: z.string(),
    txHash: z.string().regex(/^[A-Za-z0-9]{88}$/), // Solana signature
    blockTime: z.number().int().positive(),
    slot: z.number().int().positive(),
    amount: z.string().regex(/^\d+$/),
    token: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
    payer: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
    payee: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
    instructionIndex: z.number().int().nonnegative(),
    evaluatorScore: z.number().int().min(0).max(100),
    evaluationProof: z.string().optional(),
    settledAt: z.number().int().positive(),
});

// ============ Payment Receipt ============

/**
 * Payment receipt message
 * Sent by payee to acknowledge confirmed payment
 */
export interface PaymentReceipt {
    /** Payment ID */
    paymentId: string;
    /** Task ID */
    taskId: string;
    /** Transaction hash */
    txHash: string;
    /** Receipt status */
    status: 'confirmed' | 'disputed' | 'refunded';
    /** Confirmation timestamp */
    confirmedAt: number;
    /** Receipt signature (payee signs confirmation) */
    signature: string;
    /** Optional note */
    note?: string;
}

export const PaymentReceiptSchema = z.object({
    paymentId: z.string().uuid(),
    taskId: z.string(),
    txHash: z.string().regex(/^[A-Za-z0-9]{88}$/),
    status: z.enum(['confirmed', 'disputed', 'refunded']),
    confirmedAt: z.number().int().positive(),
    signature: z.string().min(1),
    note: z.string().max(500).optional(),
});

// ============ Payment Dispute ============

/**
 * Payment dispute message
 * Sent by either party to initiate dispute resolution
 */
export interface PaymentDispute {
    /** Payment ID */
    paymentId: string;
    /** Task ID */
    taskId: string;
    /** Dispute initiator */
    initiator: 'payer' | 'payee';
    /** Dispute reason */
    reason: string;
    /** Evidence hash (IPFS or Arweave) */
    evidenceHash?: string;
    /** Requested resolution */
    requestedResolution: 'refund' | 'partial_refund' | 'release';
    /** Requested amount (for partial refund) */
    requestedAmount?: string;
    /** Dispute timestamp */
    disputedAt: number;
}

export const PaymentDisputeSchema = z.object({
    paymentId: z.string().uuid(),
    taskId: z.string(),
    initiator: z.enum(['payer', 'payee']),
    reason: z.string().min(10).max(2000),
    evidenceHash: z.string().optional(),
    requestedResolution: z.enum(['refund', 'partial_refund', 'release']),
    requestedAmount: z.string().regex(/^\d+$/).optional(),
    disputedAt: z.number().int().positive(),
});

// ============ A2A Message Payloads ============

/**
 * A2A message payload for payment_request
 */
export interface PaymentRequestPayload {
    type: 'payment_request';
    request: PaymentRequest;
}

/**
 * A2A message payload for payment_confirm
 */
export interface PaymentConfirmationPayload {
    type: 'payment_confirm';
    confirmation: PaymentConfirmation;
}

/**
 * A2A message payload for payment_receipt
 */
export interface PaymentReceiptPayload {
    type: 'payment_receipt';
    receipt: PaymentReceipt;
}

/**
 * A2A message payload for payment_dispute
 */
export interface PaymentDisputePayload {
    type: 'payment_dispute';
    dispute: PaymentDispute;
}

/** Union type for all payment payloads */
export type PaymentPayload =
    | PaymentRequestPayload
    | PaymentConfirmationPayload
    | PaymentReceiptPayload
    | PaymentDisputePayload;

// ============ Validation Functions ============

/**
 * Validate payment request
 */
export function validatePaymentRequest(data: unknown): PaymentRequest {
    return PaymentRequestSchema.parse(data);
}

/**
 * Validate payment confirmation
 */
export function validatePaymentConfirmation(data: unknown): PaymentConfirmation {
    return PaymentConfirmationSchema.parse(data);
}

/**
 * Validate payment receipt
 */
export function validatePaymentReceipt(data: unknown): PaymentReceipt {
    return PaymentReceiptSchema.parse(data);
}

/**
 * Validate payment dispute
 */
export function validatePaymentDispute(data: unknown): PaymentDispute {
    return PaymentDisputeSchema.parse(data);
}

/**
 * Safe validation - returns null instead of throwing
 */
export function safeValidate<T>(validator: (data: unknown) => T, data: unknown): T | null {
    try {
        return validator(data);
    } catch {
        return null;
    }
}

// ============ Utility Functions ============

/**
 * Generate unique payment ID
 */
export function generatePaymentId(): string {
    return crypto.randomUUID();
}

/**
 * Format amount for display
 */
export function formatDisplayAmount(amount: string, decimals: number, symbol: string): string {
    const value = BigInt(amount);
    const divisor = BigInt(10 ** decimals);
    const integerPart = (value / divisor).toString();
    const fractionalPart = (value % divisor).toString().padStart(decimals, '0');
    const trimmedFractional = fractionalPart.replace(/0+$/, '');

    if (trimmedFractional.length > 0) {
        return `${integerPart}.${trimmedFractional} ${symbol}`;
    }
    return `${integerPart} ${symbol}`;
}

/**
 * Check if payment is expired
 */
export function isPaymentExpired(deadline: number): boolean {
    return Date.now() > deadline;
}

/**
 * Calculate time until deadline
 */
export function timeUntilDeadline(deadline: number): number {
    return Math.max(0, deadline - Date.now());
}

// ============ Receipt Verification ============

/**
 * Verify payment receipt signature
 * (Placeholder - actual implementation uses Solana web3.js)
 */
export async function verifyReceiptSignature(receipt: PaymentReceipt, payeePublicKey: string): Promise<boolean> {
    // Implementation would use @solana/web3.js to verify signature
    // For now, return true as placeholder
    console.log(`Verifying receipt signature for ${receipt.paymentId} from ${payeePublicKey}`);
    return true;
}

/**
 * Verify payment on-chain
 * (Placeholder - actual implementation queries Solana RPC)
 */
export async function verifyPaymentOnChain(
    confirmation: PaymentConfirmation,
    rpcUrl?: string,
): Promise<{
    valid: boolean;
    details?: {
        blockTime: number;
        slot: number;
        fee: number;
    };
    error?: string;
}> {
    // Implementation would query Solana RPC
    console.log(`Verifying payment ${confirmation.paymentId} on-chain: ${confirmation.txHash}`);
    return { valid: true };
}
