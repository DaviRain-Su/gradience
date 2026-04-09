/**
 * x402 Payment Protocol Handler
 *
 * Implements the x402 payment protocol for agent-to-agent micropayments.
 * x402 allows agents to request payment before completing a service.
 *
 * Protocol Flow:
 * 1. Client sends request without payment
 * 2. Server responds with 402 Payment Required + x402 headers
 * 3. Client creates and sends payment authorization
 * 4. Server verifies payment and completes request
 *
 * @module payments/x402-handler
 */

import { EventEmitter } from 'node:events';
import { Connection, PublicKey, Transaction, SystemProgram, type Signer } from '@solana/web3.js';
import { logger } from '../utils/logger.js';
import { DaemonError, ErrorCodes } from '../utils/errors.js';

// ============================================================================
// Types
// ============================================================================

export interface X402PaymentRequirements {
    /** Payment amount in smallest unit */
    amount: string;
    /** Token mint address */
    token: string;
    /** Token symbol */
    tokenSymbol: string;
    /** Token decimals */
    decimals: number;
    /** Payment recipient address */
    recipient: string;
    /** Payment deadline (timestamp) */
    deadline: number;
    /** Unique payment identifier */
    paymentId: string;
    /** Service description */
    description: string;
    /** Required capabilities */
    requiredCapabilities?: string[];
}

export interface X402Authorization {
    /** Payment ID from requirements */
    paymentId: string;
    /** Payer address */
    payer: string;
    /** Signed transaction or authorization proof */
    authorization: string;
    /** Authorization type */
    type: 'solana_transaction' | 'evm_transaction' | 'evm_permit' | 'signature';
    /** Timestamp */
    timestamp: number;
    /** Expiration timestamp */
    expiresAt: number;
}

export interface X402PaymentResult {
    /** Payment ID */
    paymentId: string;
    /** Transaction signature */
    txSignature: string;
    /** Block time */
    blockTime: number;
    /** Slot */
    slot: number;
    /** Amount paid */
    amount: string;
    /** Status */
    status: 'confirmed' | 'failed' | 'pending';
    /** Error message if failed */
    error?: string;
}

export interface X402Config {
    /** Solana RPC endpoint */
    rpcEndpoint: string;
    /** Accepted tokens */
    acceptedTokens: AcceptedToken[];
    /** Default payment timeout (ms) */
    defaultTimeoutMs: number;
    /** Minimum payment amount */
    minAmount: bigint;
    /** Maximum payment amount */
    maxAmount: bigint;
}

export interface AcceptedToken {
    /** Token mint address */
    mint: string;
    /** Token symbol */
    symbol: string;
    /** Token decimals */
    decimals: number;
    /** Token name */
    name: string;
}

export interface X402Session {
    /** Session ID */
    sessionId: string;
    /** Payment requirements */
    requirements: X402PaymentRequirements;
    /** Authorization (if received) */
    authorization?: X402Authorization;
    /** Payment result (if processed) */
    result?: X402PaymentResult;
    /** Session status */
    status: 'pending' | 'authorized' | 'processing' | 'completed' | 'expired' | 'failed';
    /** Created timestamp */
    createdAt: number;
    /** Expires at */
    expiresAt: number;
}

// ============================================================================
// x402 Handler
// ============================================================================

import type { X402EvmClient } from './x402-evm.js';

export class X402Handler extends EventEmitter {
    private sessions: Map<string, X402Session> = new Map();
    private connection: Connection;
    private config: X402Config;
    private evmClient?: X402EvmClient;

    constructor(config: Partial<X402Config> = {}, evmClient?: X402EvmClient) {
        super();

        this.evmClient = evmClient;
        this.config = {
            rpcEndpoint: config.rpcEndpoint || 'https://api.devnet.solana.com',
            acceptedTokens: config.acceptedTokens || [
                {
                    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mainnet
                    symbol: 'USDC',
                    decimals: 6,
                    name: 'USD Coin',
                },
                {
                    mint: 'So11111111111111111111111111111111111111112', // Wrapped SOL
                    symbol: 'SOL',
                    decimals: 9,
                    name: 'Wrapped SOL',
                },
            ],
            defaultTimeoutMs: config.defaultTimeoutMs || 5 * 60 * 1000, // 5 minutes
            minAmount: config.minAmount || 1000n, // 0.001 USDC
            maxAmount: config.maxAmount || 1000000000n, // 1000 USDC
            ...config,
        };

        this.connection = new Connection(this.config.rpcEndpoint, 'confirmed');
    }

    // -------------------------------------------------------------------------
    // Server-side: Creating Payment Requirements
    // -------------------------------------------------------------------------

    /**
     * Create payment requirements for a service
     */
    createPaymentRequirements(params: {
        amount: string;
        token: string;
        recipient: string;
        description: string;
        deadline?: number;
    }): X402PaymentRequirements {
        const amount = BigInt(params.amount);

        // Validate amount
        if (amount < this.config.minAmount) {
            throw new DaemonError(
                ErrorCodes.PAYMENT_AMOUNT_TOO_SMALL,
                `Amount below minimum: ${this.config.minAmount}`,
                400,
            );
        }

        if (amount > this.config.maxAmount) {
            throw new DaemonError(
                ErrorCodes.PAYMENT_AMOUNT_TOO_LARGE,
                `Amount above maximum: ${this.config.maxAmount}`,
                400,
            );
        }

        // Validate token
        const tokenInfo = this.config.acceptedTokens.find((t) => t.mint === params.token);
        if (!tokenInfo) {
            throw new DaemonError(ErrorCodes.PAYMENT_TOKEN_NOT_SUPPORTED, `Token not supported: ${params.token}`, 400);
        }

        const requirements: X402PaymentRequirements = {
            amount: params.amount,
            token: params.token,
            tokenSymbol: tokenInfo.symbol,
            decimals: tokenInfo.decimals,
            recipient: params.recipient,
            deadline: params.deadline || Date.now() + this.config.defaultTimeoutMs,
            paymentId: this.generatePaymentId(),
            description: params.description,
        };

        // Create session
        const session: X402Session = {
            sessionId: `x402_${requirements.paymentId}`,
            requirements,
            status: 'pending',
            createdAt: Date.now(),
            expiresAt: requirements.deadline,
        };

        this.sessions.set(session.sessionId, session);

        logger.info(
            { paymentId: requirements.paymentId, amount: params.amount, token: tokenInfo.symbol },
            'x402 payment requirements created',
        );

        this.emit('requirements_created', { sessionId: session.sessionId, requirements });

        return requirements;
    }

    /**
     * Generate HTTP 402 response headers
     */
    generate402Headers(requirements: X402PaymentRequirements): Record<string, string> {
        return {
            'X-Payment-Version': 'x402-1.0',
            'X-Payment-Amount': requirements.amount,
            'X-Payment-Token': requirements.token,
            'X-Payment-Token-Symbol': requirements.tokenSymbol,
            'X-Payment-Decimals': requirements.decimals.toString(),
            'X-Payment-Recipient': requirements.recipient,
            'X-Payment-Deadline': requirements.deadline.toString(),
            'X-Payment-Id': requirements.paymentId,
            'X-Payment-Description': encodeURIComponent(requirements.description),
        };
    }

    // -------------------------------------------------------------------------
    // Client-side: Creating Authorization
    // -------------------------------------------------------------------------

    /**
     * Create payment authorization (client-side)
     */
    async createAuthorization(requirements: X402PaymentRequirements, payer: Signer): Promise<X402Authorization> {
        // Create Solana transaction
        const transaction = new Transaction();

        // Add transfer instruction
        transaction.add(
            SystemProgram.transfer({
                fromPubkey: payer.publicKey,
                toPubkey: new PublicKey(requirements.recipient),
                lamports: BigInt(requirements.amount),
            }),
        );

        // Get recent blockhash
        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = payer.publicKey;

        // Sign transaction
        transaction.sign(payer);

        // Serialize
        const serialized = transaction.serialize();
        const authorization = Buffer.from(serialized).toString('base64');

        const auth: X402Authorization = {
            paymentId: requirements.paymentId,
            payer: payer.publicKey.toBase58(),
            authorization,
            type: 'solana_transaction',
            timestamp: Date.now(),
            expiresAt: requirements.deadline,
        };

        logger.info({ paymentId: requirements.paymentId, payer: auth.payer }, 'x402 authorization created');

        return auth;
    }

    // -------------------------------------------------------------------------
    // Server-side: Processing Payment
    // -------------------------------------------------------------------------

    /**
     * Process payment authorization (server-side)
     */
    async processAuthorization(authorization: X402Authorization): Promise<X402PaymentResult> {
        const session = this.findSessionByPaymentId(authorization.paymentId);

        if (!session) {
            throw new DaemonError(
                ErrorCodes.PAYMENT_NOT_FOUND,
                `Payment session not found: ${authorization.paymentId}`,
                404,
            );
        }

        if (session.status !== 'pending') {
            throw new DaemonError(
                ErrorCodes.PAYMENT_INVALID_STATE,
                `Payment already processed: ${session.status}`,
                400,
            );
        }

        if (Date.now() > session.expiresAt) {
            session.status = 'expired';
            throw new DaemonError(ErrorCodes.PAYMENT_EXPIRED, 'Payment authorization expired', 400);
        }

        session.status = 'processing';
        session.authorization = authorization;

        try {
            let txSignature: string;

            if (authorization.type === 'solana_transaction') {
                // Deserialize and send transaction
                const transactionBuffer = Buffer.from(authorization.authorization, 'base64');

                txSignature = await this.connection.sendRawTransaction(transactionBuffer, {
                    skipPreflight: false,
                    preflightCommitment: 'confirmed',
                });

                // Wait for confirmation
                const confirmation = await this.connection.confirmTransaction(txSignature, 'confirmed');

                if (confirmation.value.err) {
                    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
                }
            } else if (authorization.type === 'evm_permit') {
                if (!this.evmClient) {
                    throw new DaemonError(ErrorCodes.PAYMENT_TYPE_NOT_SUPPORTED, 'EVM client not configured', 400);
                }
                const permitPayload = JSON.parse(authorization.authorization);
                txSignature = await this.evmClient.lockWithPermit({
                    channelId: permitPayload.channelId,
                    payer: authorization.payer as `0x${string}`,
                    recipient: session.requirements.recipient as `0x${string}`,
                    token: permitPayload.token,
                    maxAmount: BigInt(permitPayload.maxAmount),
                    deadline: BigInt(permitPayload.deadline),
                    nonce: permitPayload.nonce,
                    v: permitPayload.v,
                    r: permitPayload.r,
                    s: permitPayload.s,
                });
            } else {
                throw new DaemonError(
                    ErrorCodes.PAYMENT_TYPE_NOT_SUPPORTED,
                    `Authorization type not supported: ${authorization.type}`,
                    400,
                );
            }

            // Get transaction details
            let blockTime: number;
            let slot: number;
            if (authorization.type === 'solana_transaction') {
                const tx = await this.connection.getTransaction(txSignature, {
                    commitment: 'confirmed',
                });
                blockTime = tx?.blockTime || Date.now();
                slot = tx?.slot || 0;
            } else {
                blockTime = Date.now();
                slot = 0;
            }

            const result: X402PaymentResult = {
                paymentId: authorization.paymentId,
                txSignature,
                blockTime,
                slot,
                amount: session.requirements.amount,
                status: 'confirmed',
            };

            session.result = result;
            session.status = 'completed';

            logger.info({ paymentId: authorization.paymentId, txSignature }, 'x402 payment processed successfully');

            this.emit('payment_completed', { sessionId: session.sessionId, result });

            return result;
        } catch (error) {
            session.status = 'failed';

            logger.error({ error, paymentId: authorization.paymentId }, 'x402 payment processing failed');

            return {
                paymentId: authorization.paymentId,
                txSignature: '',
                blockTime: 0,
                slot: 0,
                amount: session.requirements.amount,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Verify payment was successful
     */
    async verifyPayment(paymentId: string): Promise<{
        verified: boolean;
        result?: X402PaymentResult;
        error?: string;
    }> {
        const session = this.findSessionByPaymentId(paymentId);

        if (!session) {
            return { verified: false, error: 'Payment not found' };
        }

        if (!session.result || session.result.status !== 'confirmed') {
            return { verified: false, error: 'Payment not confirmed' };
        }

        // Verify on-chain
        try {
            const tx = await this.connection.getTransaction(session.result.txSignature, {
                commitment: 'confirmed',
            });

            if (!tx) {
                return { verified: false, error: 'Transaction not found on-chain' };
            }

            if (tx.meta?.err) {
                return { verified: false, error: 'Transaction failed on-chain' };
            }

            return { verified: true, result: session.result };
        } catch (error) {
            return {
                verified: false,
                error: error instanceof Error ? error.message : 'Verification failed',
            };
        }
    }

    // -------------------------------------------------------------------------
    // Session Management
    // -------------------------------------------------------------------------

    getSession(sessionId: string): X402Session | undefined {
        return this.sessions.get(sessionId);
    }

    private findSessionByPaymentId(paymentId: string): X402Session | undefined {
        return Array.from(this.sessions.values()).find((s) => s.requirements.paymentId === paymentId);
    }

    /**
     * Clean up expired sessions
     */
    cleanupExpiredSessions(): number {
        const now = Date.now();
        let cleaned = 0;

        for (const [sessionId, session] of this.sessions) {
            if (now > session.expiresAt && session.status === 'pending') {
                session.status = 'expired';
                cleaned++;
                this.emit('session_expired', { sessionId });
            }
        }

        return cleaned;
    }

    // -------------------------------------------------------------------------
    // Utilities
    // -------------------------------------------------------------------------

    private generatePaymentId(): string {
        return `x402_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    /**
     * Get accepted tokens
     */
    getAcceptedTokens(): AcceptedToken[] {
        return [...this.config.acceptedTokens];
    }

    /**
     * Add accepted token
     */
    addAcceptedToken(token: AcceptedToken): void {
        const exists = this.config.acceptedTokens.find((t) => t.mint === token.mint);
        if (!exists) {
            this.config.acceptedTokens.push(token);
        }
    }

    /**
     * Close handler and cleanup
     */
    async close(): Promise<void> {
        this.sessions.clear();
        this.removeAllListeners();
    }
}

// ============================================================================
// Factory
// ============================================================================

export function createX402Handler(config?: Partial<X402Config>): X402Handler {
    return new X402Handler(config);
}
