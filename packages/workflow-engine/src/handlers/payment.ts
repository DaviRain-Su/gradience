/**
 * Action Handlers — Payment Operations
 *
 * Handlers:
 * - x402Payment: HTTP 402 micro-payments (Coinbase x402 protocol)
 * - mppStreamReward: Stripe/Tempo MPP streaming payments
 * - teePrivateSettle: X Layer TEE private settlement
 * - zeroGasExecute: X Layer zero-gas meta-transactions
 */
import type { ActionHandler, ExecutionContext } from '../engine/step-executor.js';
import type { SupportedChain } from '../schema/types.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * x402 payment parameters
 * @see https://x402.org/ - Coinbase x402 Payment Protocol
 * @see https://www.npmjs.com/package/@x402-solana/client
 */
export interface X402PaymentParams {
    /** Service URL requiring payment */
    url: string;
    /** Payment amount in token units */
    amount: string;
    /** Token to pay with (default: USDC) */
    token?: string;
    /** HTTP method */
    method?: 'GET' | 'POST';
    /** Additional headers */
    headers?: Record<string, string>;
    /** Request body for POST */
    body?: string;
    /** Wallet signer for transaction */
    signer: import('@solana/web3.js').Signer;
}

/**
 * MPP (Machine Payments Protocol) streaming reward parameters
 * @see https://mpp.dev/ - Stripe & Tempo MPP
 * @see https://github.com/solana-foundation/solana-mpp-sdk
 */
export interface MPPStreamRewardParams {
    /** Reward recipient address */
    recipient: string;
    /** Amount per second */
    amountPerSecond: string;
    /** Stream duration in seconds */
    duration: number;
    /** Token to stream (default: USDC) */
    token?: string;
    /** Wallet signer */
    signer: import('@solana/web3.js').Signer;
}

/**
 * TEE (Trusted Execution Environment) private settlement parameters
 * @see https://docs.xlayer.xyz/ - X Layer TEE documentation
 */
export interface TEEPrivateSettleParams {
    /** Settlement recipient */
    recipient: string;
    /** Amount to settle */
    amount: string;
    /** Token to settle in */
    token?: string;
    /** Hide amount in receipt */
    hideAmount?: boolean;
    /** ZK proof (optional) */
    proof?: string;
    /** Wallet signer */
    signer: import('@solana/web3.js').Signer;
}

/**
 * Zero gas execution parameters
 * Uses X Layer's meta-transaction relay for gasless transactions
 * @see https://docs.xlayer.xyz/ - X Layer relay documentation
 */
export interface ZeroGasExecuteParams {
    /** Target contract/address */
    target: string;
    /** Encoded call data */
    data: string;
    /** Value to send (in lamports/SOL) */
    value?: string;
    /** Wallet signer */
    signer: import('@solana/web3.js').Signer;
}

// ============================================================================
// Payment Handler Implementations
// ============================================================================

/**
 * Create x402 payment handler
 * Implements HTTP 402 Payment Required protocol for API micropayments
 *
 * **SDK Required**: `@x402-solana/client`
 * ```bash
 * npm install @x402-solana/client
 * ```
 *
 * **Protocol Flow**:
 * 1. Make request to API, receive 402 Payment Required
 * 2. Parse payment requirements (amount, token, recipient)
 * 3. Create and sign payment transaction
 * 4. Submit payment proof
 * 5. Retry request with payment authorization
 */
export function createX402PaymentHandler(
    config: {
        /** x402 facilitator URL (default: https://facilitator.x402.org) */
        facilitatorUrl?: string;
        /** Network: mainnet | devnet */
        network?: 'mainnet' | 'devnet';
    } = {},
): ActionHandler {
    const { facilitatorUrl = 'https://facilitator.x402.org', network = 'devnet' } = config;

    return {
        async execute(
            chain: SupportedChain,
            params: Record<string, unknown>,
            context: ExecutionContext,
        ): Promise<Record<string, unknown>> {
            if (chain !== 'solana') {
                throw new Error(`x402 payments on ${chain} not yet implemented`);
            }

            const {
                url,
                amount,
                token = 'USDC',
                method = 'POST',
                headers = {},
                body,
                signer,
            } = params as unknown as X402PaymentParams;

            if (!signer) {
                throw new Error('Signer is required for x402 payment');
            }

            try {
                console.log(`[x402Payment] Initiating payment: ${amount} ${token} to ${url}`);

                // Step 1: Make initial request to get 402 response
                const initialResponse = await fetch(url, {
                    method,
                    headers: {
                        ...headers,
                        'X-X402-Version': '2',
                    },
                    body,
                });

                if (initialResponse.status !== 402) {
                    // If not 402, either service is free or there's an error
                    return {
                        txHash: null,
                        url,
                        amount,
                        token,
                        status: initialResponse.ok ? 'free' : 'error',
                        responseStatus: initialResponse.status,
                    };
                }

                // Parse 402 response for payment requirements
                const paymentRequirements = await initialResponse.json();
                console.log('[x402Payment] Payment requirements:', paymentRequirements);

                // Note: Real implementation would use @x402-solana/client
                // This is a placeholder with clear integration path
                throw new Error(
                    'x402 payment requires @x402-solana/client SDK. ' +
                        'Install: npm install @x402-solana/client. ' +
                        'See: https://www.npmjs.com/package/@x402-solana/client',
                );

                /*
        // Real implementation example:
        import { createX402Client } from '@x402-solana/client';
        
        const client = createX402Client({
          facilitator: facilitatorUrl,
          network,
          signer,
        });
        
        // Create payment
        const payment = await client.createPayment({
          amount,
          token,
          recipient: paymentRequirements.recipient,
        });
        
        // Retry request with payment proof
        const finalResponse = await fetch(url, {
          method,
          headers: {
            ...headers,
            'X-X402-Payment': payment.proof,
          },
          body,
        });
        
        return {
          txHash: payment.txHash,
          url,
          amount,
          token,
          status: 'paid',
          serviceResponse: await finalResponse.json(),
        };
        */
            } catch (error) {
                console.error('[x402Payment] Error:', error);
                throw error;
            }
        },
    };
}

/**
 * Create MPP streaming reward handler
 * Integrates with Stripe/Tempo Machine Payments Protocol for streaming payments
 *
 * **SDK Required**: `@solana-foundation/solana-mpp-sdk`
 * ```bash
 * npm install @solana-foundation/solana-mpp-sdk
 * ```
 *
 * **Use Cases**:
 * - Agent-to-agent streaming rewards
 * - Per-second API usage billing
 * - Continuous service payments
 */
export function createMPPStreamRewardHandler(
    config: {
        /** Tempo API endpoint */
        tempoApiUrl?: string;
        /** Network: mainnet | devnet */
        network?: 'mainnet' | 'devnet';
    } = {},
): ActionHandler {
    const { tempoApiUrl = 'https://api.tempo.xyz', network = 'devnet' } = config;

    return {
        async execute(
            chain: SupportedChain,
            params: Record<string, unknown>,
            context: ExecutionContext,
        ): Promise<Record<string, unknown>> {
            if (chain !== 'solana') {
                throw new Error(`MPP streaming on ${chain} not yet implemented`);
            }

            const {
                recipient,
                amountPerSecond,
                duration,
                token = 'USDC',
                signer,
            } = params as unknown as MPPStreamRewardParams;

            if (!signer) {
                throw new Error('Signer is required for MPP streaming');
            }

            try {
                const totalAmount = String(Number(amountPerSecond) * duration);
                console.log(
                    `[MPPStreamReward] Creating stream: ${amountPerSecond}/sec for ${duration}s (total: ${totalAmount})`,
                );

                // Note: Real implementation would use @solana-foundation/solana-mpp-sdk
                throw new Error(
                    'MPP streaming requires @solana-foundation/solana-mpp-sdk. ' +
                        'Install: npm install @solana-foundation/solana-mpp-sdk. ' +
                        'See: https://github.com/solana-foundation/solana-mpp-sdk',
                );

                /*
        // Real implementation example:
        import { MPPClient, StreamConfig } from '@solana-foundation/solana-mpp-sdk';
        
        const client = new MPPClient({
          endpoint: tempoApiUrl,
          network,
          signer,
        });
        
        const streamConfig: StreamConfig = {
          recipient,
          amountPerSecond,
          duration,
          token,
        };
        
        const stream = await client.createStream(streamConfig);
        
        return {
          streamId: stream.id,
          recipient,
          amountPerSecond,
          duration,
          totalAmount,
          token,
          status: 'streaming',
          startTime: Date.now(),
          estimatedEndTime: Date.now() + duration * 1000,
        };
        */
            } catch (error) {
                console.error('[MPPStreamReward] Error:', error);
                throw error;
            }
        },
    };
}

/**
 * Create TEE private settlement handler
 * Uses X Layer's Trusted Execution Environment for privacy-preserving settlement
 *
 * **SDK Required**: X Layer TEE SDK (contact X Layer team)
 * ```bash
 * npm install @xlayer/tee-sdk  # Package name may vary
 * ```
 *
 * **Features**:
 * - Private amount hiding
 * - ZK proof verification
 * - TEE attestation
 */
export function createTEEPrivateSettleHandler(
    config: {
        /** X Layer TEE endpoint */
        teeEndpoint?: string;
        /** Network: mainnet | devnet */
        network?: 'mainnet' | 'devnet';
    } = {},
): ActionHandler {
    const { teeEndpoint = 'https://tee.xlayer.xyz', network = 'devnet' } = config;

    return {
        async execute(
            chain: SupportedChain,
            params: Record<string, unknown>,
            context: ExecutionContext,
        ): Promise<Record<string, unknown>> {
            if (chain !== 'solana') {
                throw new Error(`TEE settlement on ${chain} not yet implemented`);
            }

            const {
                recipient,
                amount,
                token = 'USDC',
                hideAmount = true,
                proof,
                signer,
            } = params as unknown as TEEPrivateSettleParams;

            if (!signer) {
                throw new Error('Signer is required for TEE settlement');
            }

            try {
                console.log(
                    `[TEEPrivateSettle] Private settle ${hideAmount ? '***' : amount} ${token} to ${recipient}`,
                );

                // Note: Real implementation requires X Layer TEE SDK
                throw new Error(
                    'TEE settlement requires X Layer TEE SDK. ' +
                        'Contact X Layer team for SDK access. ' +
                        'See: https://docs.xlayer.xyz/',
                );

                /*
        // Real implementation example:
        import { TEEClient } from '@xlayer/tee-sdk';
        
        const client = new TEEClient({
          endpoint: teeEndpoint,
          network,
          signer,
        });
        
        const settlement = await client.settle({
          recipient,
          amount,
          token,
          hideAmount,
          proof,
        });
        
        return {
          txHash: settlement.txHash,
          recipient,
          amount: hideAmount ? 'hidden' : amount,
          token,
          proofVerified: settlement.proofVerified,
          teeAttestation: settlement.attestation,
          status: 'settled',
        };
        */
            } catch (error) {
                console.error('[TEEPrivateSettle] Error:', error);
                throw error;
            }
        },
    };
}

/**
 * Create zero gas execution handler
 * Uses X Layer's meta-transaction relay for gasless transactions
 *
 * **SDK Required**: X Layer Relay SDK (contact X Layer team)
 * ```bash
 * npm install @xlayer/relay-sdk  # Package name may vary
 * ```
 *
 * **Use Cases**:
 * - Gasless transactions for users without SOL
 * - Sponsored transactions
 * - Meta-transactions
 */
export function createZeroGasExecuteHandler(
    config: {
        /** X Layer relay endpoint */
        relayEndpoint?: string;
        /** Network: mainnet | devnet */
        network?: 'mainnet' | 'devnet';
    } = {},
): ActionHandler {
    const { relayEndpoint = 'https://relay.xlayer.xyz', network = 'devnet' } = config;

    return {
        async execute(
            chain: SupportedChain,
            params: Record<string, unknown>,
            context: ExecutionContext,
        ): Promise<Record<string, unknown>> {
            if (chain !== 'solana') {
                throw new Error(`Zero-gas execution on ${chain} not yet implemented`);
            }

            const { target, data, value = '0', signer } = params as unknown as ZeroGasExecuteParams;

            if (!signer) {
                throw new Error('Signer is required for zero-gas execution');
            }

            try {
                console.log(`[ZeroGasExecute] Execute on ${target} with value ${value}`);

                // Note: Real implementation requires X Layer Relay SDK
                throw new Error(
                    'Zero-gas execution requires X Layer Relay SDK. ' +
                        'Contact X Layer team for SDK access. ' +
                        'See: https://docs.xlayer.xyz/',
                );

                /*
        // Real implementation example:
        import { RelayClient } from '@xlayer/relay-sdk';
        
        const client = new RelayClient({
          endpoint: relayEndpoint,
          network,
        });
        
        const metaTx = await client.createMetaTransaction({
          signer: signer.publicKey,
          target,
          data,
          value: BigInt(value),
        });
        
        // Sign meta-transaction
        const signedTx = await metaTx.sign(signer);
        
        // Submit to relay
        const result = await client.submit(signedTx);
        
        return {
          txHash: result.txHash,
          target,
          data: data.slice(0, 20) + '...',
          value,
          gasPaidBy: 'relayer',
          status: 'executed',
        };
        */
            } catch (error) {
                console.error('[ZeroGasExecute] Error:', error);
                throw error;
            }
        },
    };
}

// ============================================================================
// Handler Factory Functions
// ============================================================================

/**
 * Create all payment handlers as a map
 */
export function createPaymentHandlers(config?: {
    /** x402 facilitator URL */
    facilitatorUrl?: string;
    /** Tempo API URL */
    tempoApiUrl?: string;
    /** X Layer TEE endpoint */
    teeEndpoint?: string;
    /** X Layer relay endpoint */
    relayEndpoint?: string;
    /** Network: mainnet | devnet */
    network?: 'mainnet' | 'devnet';
}): Map<string, ActionHandler> {
    return new Map([
        ['x402Payment', createX402PaymentHandler(config)],
        ['mppStreamReward', createMPPStreamRewardHandler(config)],
        ['teePrivateSettle', createTEEPrivateSettleHandler(config)],
        ['zeroGasExecute', createZeroGasExecuteHandler(config)],
    ]);
}

/**
 * Create real payment handlers with actual SDK integration
 * Note: Requires SDK installation:
 * - npm install @x402-solana/client
 * - npm install @solana-foundation/solana-mpp-sdk
 * - Contact X Layer for TEE and Relay SDKs
 */
export function createRealPaymentHandlers(config?: {
    facilitatorUrl?: string;
    tempoApiUrl?: string;
    teeEndpoint?: string;
    relayEndpoint?: string;
    network?: 'mainnet' | 'devnet';
}): Map<string, ActionHandler> {
    // Currently same as createPaymentHandlers
    // When SDKs are installed, this can use real implementations
    return createPaymentHandlers(config);
}
