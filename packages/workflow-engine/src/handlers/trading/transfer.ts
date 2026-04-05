/**
 * Transfer Handler
 * 
 * Real transfer handler for SOL and SPL tokens with Triton Cascade support
 */
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  type Signer,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';
import type { ActionHandler, ExecutionContext } from '../../engine/step-executor.js';
import type { SupportedChain } from '../../schema/types.js';
import type { TransferParams, TransferHandlerConfig } from './types.js';
import { getConnection, getCascadeClient } from './utils.js';

/**
 * Create a real transfer handler for SOL and SPL tokens with Triton Cascade
 */
export function createRealTransferHandler(
  config: TransferHandlerConfig = {}
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
      } = params as TransferParams;

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
