/**
 * Swap Handler
 *
 * Real implementation using Jupiter API with Triton Cascade transaction delivery
 */
import {
  Connection,
  Transaction,
  type Signer,
} from '@solana/web3.js';
import { z } from 'zod';
import type { ActionHandler } from '../../engine/step-executor.js';
import type { SupportedChain } from '../../schema/types.js';
import {
  getConnection,
  getCascadeClient,
} from './utils.js';
import type {
  SwapHandlerConfig,
  JupiterQuote,
  JupiterSwapResponse,
} from './types.js';

const SwapParamsSchema = z.object({
  from: z.string().min(1, 'from mint is required'),
  to: z.string().min(1, 'to mint is required'),
  amount: z.string().regex(/^\d+$/, 'amount must be a positive integer string'),
  slippage: z.number().min(0).max(100).optional(),
  signer: z.custom<Signer>((val) => val != null, 'signer is required'),
  useJitoBundle: z.boolean().optional(),
});

/**
 * Create a real swap handler using Jupiter API with Triton Cascade
 */
export function createRealSwapHandler(
  config: SwapHandlerConfig = {}
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
      } = SwapParamsSchema.parse(params);

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
          throw new Error(`Jupiter quote failed after 3 retries: ${(lastError as Error)?.message || quoteResponse?.statusText}`);
        }
        
        const quote = await quoteResponse.json() as JupiterQuote;

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

        const swapData = await swapResponse.json() as JupiterSwapResponse;

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
