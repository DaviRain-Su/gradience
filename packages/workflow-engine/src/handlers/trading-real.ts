/**
 * Real Solana Trading Handlers
 * 
 * Actual implementation using @solana/web3.js and Triton Cascade
 * - swap: Jupiter API integration with Triton Cascade transaction delivery
 * - bridge: Wormhole SDK (placeholder for now)
 * - transfer: Native SOL and SPL token transfers via Triton Cascade
 * - stake: Solana native staking
 */
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  type Signer,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import type { ActionHandler, ExecutionContext } from '../engine/step-executor.js';
import type { SupportedChain } from '../schema/types.js';
import {
  TritonCascadeClient,
  createConfigFromEnv,
  type SendTransactionOptions,
} from '../triton-cascade/index.js';

// Jupiter API types
interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: null | { amount: string; feeBps: number };
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

interface JupiterSwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
}

/**
 * Get Solana connection (legacy - kept for backward compatibility)
 * @deprecated Use getCascadeClient instead
 */
function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Get Triton Cascade client for high-performance transaction delivery
 */
function getCascadeClient(): TritonCascadeClient {
  return new TritonCascadeClient({
    rpcEndpoint: process.env.TRITON_RPC_ENDPOINT || 'https://api.triton.one/rpc',
    apiToken: process.env.TRITON_API_TOKEN,
    network: (process.env.SOLANA_NETWORK as 'mainnet' | 'devnet') || 'devnet',
    connectionTimeoutMs: 10000,
    confirmationTimeoutMs: 60000,
    maxRetries: 3,
    enableJitoBundle: process.env.ENABLE_JITO_BUNDLE === 'true',
    priorityFeeStrategy: 'auto',
  });
}

/**
 * Get signer from context or environment
 */
async function getSigner(context: ExecutionContext): Promise<Signer> {
  // In real implementation, this would come from wallet adapter
  // For now, we'll need to implement a proper key management system
  throw new Error('Signer not provided. Please set up wallet connection.');
}

/**
 * Create a real swap handler using Jupiter API with Triton Cascade
 */
export function createRealSwapHandler(
  config: {
    jupiterApiUrl?: string;
    defaultSlippage?: number;
    connection?: Connection;
    useTritonCascade?: boolean;
  } = {}
): ActionHandler {
  const {
    jupiterApiUrl = 'https://quote-api.jup.ag/v6',
    defaultSlippage = 0.5,
    connection = getConnection(),
    useTritonCascade = true,
  } = config;

  // Initialize Triton Cascade client if enabled
  const cascadeClient = useTritonCascade ? getCascadeClient() : null;

  return {
    async execute(
      chain: SupportedChain,
      params: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<Record<string, unknown>> {
      if (chain !== 'solana') {
        throw new Error(`Swap on ${chain} not yet implemented`);
      }

      const {
        from,
        to,
        amount,
        slippage = defaultSlippage,
        signer,
        useJitoBundle = false,
      } = params as {
        from: string;
        to: string;
        amount: string;
        slippage?: number;
        signer: Signer;
        useJitoBundle?: boolean;
      };

      if (!signer) {
        throw new Error('Signer is required for swap. Please provide a valid keypair or wallet adapter.');
      }

      try {
        // Step 1: Get quote from Jupiter (with retry)
        const slippageBps = Math.floor(slippage * 100);
        const quoteUrl = `${jupiterApiUrl}/quote?inputMint=${from}&outputMint=${to}&amount=${amount}&slippageBps=${slippageBps}`;
        
        // Retry logic for network issues
        let quoteResponse;
        let lastError;
        for (let i = 0; i < 3; i++) {
          try {
            quoteResponse = await fetch(quoteUrl, { 
              signal: AbortSignal.timeout(10000)
            });
            if (quoteResponse.ok) break;
          } catch (e) {
            lastError = e;
            console.log(`[Swap] Retry ${i + 1}/3...`);
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
          }
        }
        
        if (!quoteResponse || !quoteResponse.ok) {
          throw new Error(`Jupiter quote failed after 3 retries: ${lastError?.message || quoteResponse?.statusText}`);
        }
        
        const quote: JupiterQuote = await quoteResponse.json();

        // Step 2: Get swap transaction
        const swapUrl = `${jupiterApiUrl}/swap`;
        const swapBody = {
          quoteResponse: quote,
          userPublicKey: signer.publicKey.toBase58(),
          wrapAndUnwrapSol: true,
          prioritizationFeeLamports: 'auto',
        };

        const swapResponse = await fetch(swapUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(swapBody),
        });

        if (!swapResponse.ok) {
          throw new Error(`Jupiter swap failed: ${swapResponse.statusText}`);
        }

        const swapData: JupiterSwapResponse = await swapResponse.json();

        // Step 3: Deserialize and sign transaction
        const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
        const transaction = Transaction.from(swapTransactionBuf);
        
        // Sign the transaction
        transaction.sign(signer);

        // Step 4: Send transaction via Triton Cascade or standard RPC
        let signature: string;
        let deliveryPath = 'standard_rpc';
        
        if (cascadeClient) {
          // Use Triton Cascade for high-performance delivery
          const cascadeResponse = await cascadeClient.sendTransaction(
            transaction.serialize().toString('base64'),
            {
              transactionType: 'swap',
              useJitoBundle,
              commitment: 'confirmed',
              metadata: {
                signature: transaction.signatures[0]?.signature?.toString('base64'),
                recentBlockhash: transaction.recentBlockhash,
                lastValidBlockHeight: swapData.lastValidBlockHeight,
                sender: signer.publicKey.toBase58(),
              },
            }
          );
          
          signature = cascadeResponse.signature;
          deliveryPath = cascadeResponse.deliveryPath;
          
          if (cascadeResponse.status === 'failed') {
            throw new Error(`Transaction failed: ${cascadeResponse.error?.message}`);
          }
        } else {
          // Fallback to standard RPC
          signature = await connection.sendRawTransaction(transaction.serialize(), {
            maxRetries: 3,
            skipPreflight: false,
          });
          
          // Confirm transaction
          const confirmation = await connection.confirmTransaction({
            signature,
            blockhash: transaction.recentBlockhash!,
            lastValidBlockHeight: swapData.lastValidBlockHeight,
          }, 'confirmed');

          if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${confirmation.value.err}`);
          }
        }

        return {
          txHash: signature,
          inputAmount: amount,
          outputAmount: quote.outAmount,
          from,
          to,
          slippage,
          priceImpact: quote.priceImpactPct,
          route: quote.routePlan.map(r => r.swapInfo.label),
          deliveryPath,
          explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
        };
      } catch (error) {
        console.error('[Swap] Error:', error);
        throw error;
      }
    },
  };
}

/**
 * Create a real transfer handler for SOL and SPL tokens with Triton Cascade
 */
export function createRealTransferHandler(
  config: {
    connection?: Connection;
    useTritonCascade?: boolean;
  } = {}
): ActionHandler {
  const { connection = getConnection(), useTritonCascade = true } = config;
  
  // Initialize Triton Cascade client if enabled
  const cascadeClient = useTritonCascade ? getCascadeClient() : null;

  return {
    async execute(
      chain: SupportedChain,
      params: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<Record<string, unknown>> {
      if (chain !== 'solana') {
        throw new Error(`Transfer on ${chain} not yet implemented`);
      }

      const {
        token,
        to,
        amount,
        signer,
        useJitoBundle = false,
      } = params as {
        token: string;
        to: string;
        amount: string;
        signer: Signer;
        useJitoBundle?: boolean;
      };

      if (!signer) {
        throw new Error('Signer is required for transfer');
      }

      try {
        const recipient = new PublicKey(to);
        const lamports = BigInt(amount);
        let signature: string;
        let deliveryPath = 'standard_rpc';

        if (token === 'SOL' || token === '11111111111111111111111111111111') {
          // Native SOL transfer
          const transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: signer.publicKey,
              toPubkey: recipient,
              lamports: Number(lamports),
            })
          );

          if (cascadeClient) {
            // Use Triton Cascade
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.sign(signer);
            
            const cascadeResponse = await cascadeClient.sendTransaction(
              transaction.serialize().toString('base64'),
              {
                transactionType: 'transfer',
                useJitoBundle,
                commitment: 'confirmed',
                metadata: {
                  signature: transaction.signatures[0]?.signature?.toString('base64'),
                  recentBlockhash: blockhash,
                  lastValidBlockHeight,
                  sender: signer.publicKey.toBase58(),
                },
              }
            );
            
            signature = cascadeResponse.signature;
            deliveryPath = cascadeResponse.deliveryPath;
          } else {
            // Fallback to standard RPC
            signature = await connection.sendTransaction(transaction, [signer]);
            await connection.confirmTransaction(signature, 'confirmed');
          }
        } else {
          // SPL token transfer
          const mint = new PublicKey(token);
          
          // Get or create sender's ATA
          const senderAta = await getOrCreateAssociatedTokenAccount(
            connection,
            signer,
            mint,
            signer.publicKey
          );

          // Get or create recipient's ATA
          const recipientAta = await getOrCreateAssociatedTokenAccount(
            connection,
            signer,
            mint,
            recipient
          );

          const transaction = new Transaction().add(
            createTransferInstruction(
              senderAta.address,
              recipientAta.address,
              signer.publicKey,
              Number(lamports)
            )
          );

          if (cascadeClient) {
            // Use Triton Cascade
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.sign(signer);
            
            const cascadeResponse = await cascadeClient.sendTransaction(
              transaction.serialize().toString('base64'),
              {
                transactionType: 'transfer',
                useJitoBundle,
                commitment: 'confirmed',
                metadata: {
                  signature: transaction.signatures[0]?.signature?.toString('base64'),
                  recentBlockhash: blockhash,
                  lastValidBlockHeight,
                  sender: signer.publicKey.toBase58(),
                },
              }
            );
            
            signature = cascadeResponse.signature;
            deliveryPath = cascadeResponse.deliveryPath;
          } else {
            // Fallback to standard RPC
            signature = await connection.sendTransaction(transaction, [signer]);
            await connection.confirmTransaction(signature, 'confirmed');
          }
        }

        return {
          txHash: signature,
          token,
          to,
          amount,
          from: signer.publicKey.toBase58(),
          deliveryPath,
          explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
        };
      } catch (error) {
        console.error('[Transfer] Error:', error);
        throw error;
      }
    },
  };
}

/**
 * Create a real staking handler for Solana native staking
 */
export function createRealStakeHandler(
  config: {
    connection?: Connection;
  } = {}
): ActionHandler {
  const { connection = getConnection() } = config;

  return {
    async execute(
      chain: SupportedChain,
      params: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<Record<string, unknown>> {
      if (chain !== 'solana') {
        throw new Error(`Staking on ${chain} not yet implemented`);
      }

      const {
        validator,
        amount,
        signer,
      } = params as {
        validator?: string;
        amount: string;
        signer: Signer;
      };

      if (!signer) {
        throw new Error('Signer is required for staking');
      }

      try {
        const lamports = BigInt(amount);
        
        // For now, we'll use a simple stake account creation
        // In production, you'd want to use the StakeProgram from @solana/web3.js
        // and handle stake account management properly
        
        // This is a simplified version - real implementation would:
        // 1. Create stake account
        // 2. Delegate to validator
        // 3. Handle stake account keys
        
        throw new Error('Native staking implementation requires stake account management. Please use stake pools (e.g., Marinade, Jito) for easier staking.');
        
        /* Full implementation would look like:
        import { StakeProgram, Lockup } from '@solana/web3.js';
        
        const validatorPubkey = validator ? new PublicKey(validator) : null;
        const stakeAccount = Keypair.generate();
        
        const transaction = StakeProgram.createAccount({
          fromPubkey: signer.publicKey,
          stakePubkey: stakeAccount.publicKey,
          authorized: {
            staker: signer.publicKey,
            withdrawer: signer.publicKey,
          },
          lockup: new Lockup(0, 0, signer.publicKey),
          lamports: Number(lamports),
        });
        
        if (validatorPubkey) {
          transaction.add(
            StakeProgram.delegate({
              stakePubkey: stakeAccount.publicKey,
              authorizedPubkey: signer.publicKey,
              votePubkey: validatorPubkey,
            })
          );
        }
        
        const signature = await connection.sendTransaction(transaction, [signer, stakeAccount]);
        */
      } catch (error) {
        console.error('[Stake] Error:', error);
        throw error;
      }
    },
  };
}

/**
 * Create a real bridge handler (placeholder - Wormhole integration)
 */
export function createRealBridgeHandler(
  config: {
    connection?: Connection;
  } = {}
): ActionHandler {
  const { connection = getConnection() } = config;

  return {
    async execute(
      chain: SupportedChain,
      params: Record<string, unknown>,
      context: ExecutionContext
    ): Promise<Record<string, unknown>> {
      const {
        fromChain,
        toChain,
        token,
        amount,
        recipient,
        signer,
      } = params as {
        fromChain: SupportedChain;
        toChain: SupportedChain;
        token: string;
        amount: string;
        recipient?: string;
        signer: Signer;
      };

      if (!signer) {
        throw new Error('Signer is required for bridge');
      }

      // Wormhole integration requires @wormhole-foundation/sdk
      // This is a placeholder for the actual implementation
      throw new Error(
        'Bridge implementation requires Wormhole SDK. ' +
        'Please install @wormhole-foundation/sdk and implement the bridge logic. ' +
        'See: https://docs.wormhole.com/wormhole/quick-start/sdks'
      );
    },
  };
}

/**
 * Export all real handlers
 */
export function createRealTradingHandlers(config?: {
  connection?: Connection;
  jupiterApiUrl?: string;
  useTritonCascade?: boolean;
}): Map<string, ActionHandler> {
  return new Map([
    ['swap', createRealSwapHandler(config)],
    ['bridge', createRealBridgeHandler(config)],
    ['transfer', createRealTransferHandler(config)],
    ['stake', createRealStakeHandler(config)],
    // Note: unstake, yieldFarm, borrow, repay need additional implementation
  ]);
}

// Re-export types
export type { SwapParams, BridgeParams, TransferParams, StakeParams } from './trading.js';
