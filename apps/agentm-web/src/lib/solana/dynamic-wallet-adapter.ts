/**
 * Dynamic Wallet -> Arena SDK WalletAdapter Bridge
 *
 * Bridges the Dynamic Labs v1 wallet signer to the @solana/kit based
 * WalletAdapter interface that @gradiences/arena-sdk requires.
 */

import {
  appendTransactionMessageInstructions,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  createNoopSigner,
  type Address,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit';
import type { WalletAdapter, SendTransactionOptions } from '@gradiences/arena-sdk';

function getRpcEndpoint(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem('agentm:settings');
      if (stored) {
        const settings = JSON.parse(stored);
        if (settings.rpcEndpoint) return settings.rpcEndpoint;
      }
    } catch {}
  }
  return process.env.NEXT_PUBLIC_GRADIENCE_RPC_ENDPOINT || 'https://api.devnet.solana.com';
}

/**
 * Create a WalletAdapter from a Dynamic wallet address.
 * Uses createNoopSigner since actual signing goes through Dynamic's connector.
 */
export function createDynamicAdapter(walletAddress: string): WalletAdapter {
  const address = walletAddress as Address;
  const signer = createNoopSigner(address);
  const rpc = createSolanaRpc(getRpcEndpoint() as Parameters<typeof createSolanaRpc>[0]);

  return {
    signer,

    async signAndSendTransaction(
      instructions: readonly Instruction[],
      _options?: SendTransactionOptions,
    ): Promise<string> {
      const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: 'confirmed' }).send();

      const message = createTransactionMessage({ version: 0 });
      const withFeePayer = setTransactionMessageFeePayerSigner(signer, message);
      const withLifetime = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, withFeePayer);
      const withInstructions = appendTransactionMessageInstructions(
        instructions as Instruction[],
        withLifetime,
      );

      const signedTx = await signTransactionMessageWithSigners(withInstructions);
      const wireTransaction = getBase64EncodedWireTransaction(signedTx);

      return rpc
        .sendTransaction(wireTransaction, {
          encoding: 'base64',
          preflightCommitment: 'confirmed',
        })
        .send();
    },
  };
}
