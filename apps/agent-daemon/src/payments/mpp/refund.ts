/**
 * MPP Refund Module
 *
 * Handles fund releases and refunds for Multi-Party Payments:
 * - Fund release to participants
 * - Individual participant claims
 * - Refund to payer (when payment is rejected or expired)
 *
 * @module payments/mpp/refund
 */

import { Connection, PublicKey, Transaction, SystemProgram, type Signer } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';
import { logger } from '../../utils/logger.js';
import { DaemonError, ErrorCodes } from '../../utils/errors.js';
import type { MPPPayment, MPPParticipant, MPPStatus } from './types.js';

// ============================================================================
// MPP Refund Handler
// ============================================================================

export class MPPRefund {
    private connection: Connection;

    constructor(rpcEndpoint: string) {
        this.connection = new Connection(rpcEndpoint, 'confirmed');
    }

    // -------------------------------------------------------------------------
    // Fund Release
    // -------------------------------------------------------------------------

    /**
     * Release funds to participants
     *
     * Releases allocated funds to all participants who haven't claimed yet.
     * Updates participant released amounts and claim status.
     *
     * @param payment - The MPP payment to release funds from
     * @param signer - The transaction signer
     * @returns Array of transaction signatures
     * @throws DaemonError if payment not found or invalid state
     */
    async releaseFunds(payment: MPPPayment, signer: Signer): Promise<{ txSignatures: string[]; newStatus: MPPStatus }> {
        if (payment.status !== 'approved' && payment.status !== 'partially_released') {
            throw new DaemonError(ErrorCodes.PAYMENT_INVALID_STATE, `Cannot release in state: ${payment.status}`, 400);
        }

        const txSignatures: string[] = [];

        // Release to each participant who hasn't claimed
        for (const participant of payment.participants) {
            if (participant.hasClaimed || participant.releasedAmount >= participant.allocatedAmount) {
                continue;
            }

            const releaseAmount = participant.allocatedAmount - participant.releasedAmount;

            try {
                const transaction = new Transaction();

                transaction.add(
                    SystemProgram.transfer({
                        fromPubkey: new PublicKey(payment.escrow),
                        toPubkey: new PublicKey(participant.address),
                        lamports: releaseAmount,
                    }),
                );

                const { blockhash } = await this.connection.getLatestBlockhash();
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = signer.publicKey;

                transaction.sign(signer);

                const txSignature = await this.connection.sendRawTransaction(transaction.serialize(), {
                    skipPreflight: false,
                    preflightCommitment: 'confirmed',
                });

                await this.connection.confirmTransaction(txSignature, 'confirmed');

                participant.releasedAmount = releaseAmount;
                participant.hasClaimed = true;
                txSignatures.push(txSignature);

                logger.info(
                    {
                        paymentId: payment.paymentId,
                        participant: participant.address,
                        amount: releaseAmount.toString(),
                    },
                    'Funds released to participant',
                );
            } catch (error) {
                logger.error(
                    { error, paymentId: payment.paymentId, participant: participant.address },
                    'Failed to release funds',
                );
            }
        }

        // Determine new payment status
        const allReleased = payment.participants.every((p) => p.releasedAmount >= p.allocatedAmount);
        const newStatus: MPPStatus = allReleased ? 'fully_released' : 'partially_released';

        return { txSignatures, newStatus };
    }

    // -------------------------------------------------------------------------
    // Individual Claims
    // -------------------------------------------------------------------------

    /**
     * Claim funds as a participant
     *
     * Allows an individual participant to claim their allocated funds.
     * Updates the participant's claim status and payment status.
     *
     * @param payment - The MPP payment to claim from
     * @param participantAddress - Address of the participant claiming funds
     * @param signer - The transaction signer
     * @returns Transaction signature and claimed amount
     * @throws DaemonError if participant not found, already claimed, or invalid state
     */
    async claimFunds(
        payment: MPPPayment,
        participantAddress: string,
        signer: Signer,
    ): Promise<{ txSignature: string; amount: bigint; newStatus: MPPStatus }> {
        if (payment.status !== 'approved' && payment.status !== 'partially_released') {
            throw new DaemonError(ErrorCodes.PAYMENT_INVALID_STATE, `Cannot claim in state: ${payment.status}`, 400);
        }

        const participant = payment.participants.find((p) => p.address === participantAddress);
        if (!participant) {
            throw new DaemonError(ErrorCodes.MPP_NOT_A_PARTICIPANT, 'Not a participant', 403);
        }

        if (participant.hasClaimed) {
            throw new DaemonError(ErrorCodes.MPP_ALREADY_CLAIMED, 'Already claimed', 400);
        }

        const claimAmount = participant.allocatedAmount - participant.releasedAmount;

        const transaction = new Transaction();

        transaction.add(
            SystemProgram.transfer({
                fromPubkey: new PublicKey(payment.escrow),
                toPubkey: new PublicKey(participant.address),
                lamports: claimAmount,
            }),
        );

        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = signer.publicKey;

        transaction.sign(signer);

        const txSignature = await this.connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
        });

        await this.connection.confirmTransaction(txSignature, 'confirmed');

        participant.releasedAmount = claimAmount;
        participant.hasClaimed = true;

        // Determine new payment status
        const allClaimed = payment.participants.every((p) => p.hasClaimed);
        let newStatus: MPPStatus;
        if (allClaimed) {
            newStatus = 'fully_released';
        } else if (payment.status === 'approved') {
            newStatus = 'partially_released';
        } else {
            newStatus = payment.status;
        }

        logger.info(
            { paymentId: payment.paymentId, participant: participantAddress, amount: claimAmount.toString() },
            'Participant claimed funds',
        );

        return { txSignature, amount: claimAmount, newStatus };
    }

    // -------------------------------------------------------------------------
    // Refund Logic
    // -------------------------------------------------------------------------

    /**
     * Refund to payer (if payment rejected or expired)
     *
     * Returns remaining funds in escrow back to the original payer.
     * Only allowed when payment status is 'rejected' or 'expired'.
     *
     * @param payment - The MPP payment to refund
     * @param signer - The transaction signer
     * @returns Transaction signature and refund amount
     * @throws DaemonError if payment not in refundable state
     */
    async refund(payment: MPPPayment, signer: Signer): Promise<{ txSignature: string; amount: bigint }> {
        if (payment.status !== 'rejected' && payment.status !== 'expired') {
            throw new DaemonError(ErrorCodes.PAYMENT_INVALID_STATE, `Cannot refund in state: ${payment.status}`, 400);
        }

        // Calculate remaining funds in escrow
        const releasedTotal = payment.participants.reduce((sum, p) => sum + p.releasedAmount, 0n);
        const refundAmount = payment.totalAmount - releasedTotal;

        const transaction = new Transaction();

        transaction.add(
            SystemProgram.transfer({
                fromPubkey: new PublicKey(payment.escrow),
                toPubkey: new PublicKey(payment.payer),
                lamports: refundAmount,
            }),
        );

        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = signer.publicKey;

        transaction.sign(signer);

        const txSignature = await this.connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
        });

        await this.connection.confirmTransaction(txSignature, 'confirmed');

        logger.info({ paymentId: payment.paymentId, amount: refundAmount.toString() }, 'Payment refunded');

        return { txSignature, amount: refundAmount };
    }

    // -------------------------------------------------------------------------
    // Utility Methods
    // -------------------------------------------------------------------------

    /**
     * Calculate the total amount available for refund
     *
     * @param payment - The MPP payment
     * @returns The amount that can be refunded
     */
    calculateRefundAmount(payment: MPPPayment): bigint {
        const releasedTotal = payment.participants.reduce((sum, p) => sum + p.releasedAmount, 0n);
        return payment.totalAmount - releasedTotal;
    }

    /**
     * Check if a participant can claim funds
     *
     * @param payment - The MPP payment
     * @param participantAddress - Address of the participant
     * @returns Whether the participant can claim
     */
    canClaim(payment: MPPPayment, participantAddress: string): boolean {
        // Check payment status allows claiming
        if (payment.status !== 'approved' && payment.status !== 'partially_released') {
            return false;
        }

        const participant = payment.participants.find((p) => p.address === participantAddress);
        if (!participant) {
            return false;
        }

        return !participant.hasClaimed && participant.releasedAmount < participant.allocatedAmount;
    }

    /**
     * Check if payment can be refunded
     *
     * @param payment - The MPP payment
     * @returns Whether the payment can be refunded
     */
    canRefund(payment: MPPPayment): boolean {
        return payment.status === 'rejected' || payment.status === 'expired';
    }

    /**
     * Get claimable amount for a participant
     *
     * @param payment - The MPP payment
     * @param participantAddress - Address of the participant
     * @returns The amount the participant can claim, or 0n if not claimable
     */
    getClaimableAmount(payment: MPPPayment, participantAddress: string): bigint {
        const participant = payment.participants.find((p) => p.address === participantAddress);
        if (!participant || participant.hasClaimed) {
            return 0n;
        }
        return participant.allocatedAmount - participant.releasedAmount;
    }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a new MPPRefund instance
 *
 * @param rpcEndpoint - Solana RPC endpoint URL
 * @returns MPPRefund instance
 */
export function createMPPRefund(rpcEndpoint: string): MPPRefund {
    return new MPPRefund(rpcEndpoint);
}
