/**
 * Solana Transaction Signing Wrapper
 *
 * Wraps OWS wallet signing for Solana transactions.
 *
 * @module @gradiences/ows-adapter
 */

import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { OWSWallet } from './types';

/**
 * Transaction sign result
 */
export interface SignTransactionResult {
  /** Signed transaction (base64 serialized) */
  serializedTx: string;
  /** Transaction signatures */
  signatures: string[];
}

/**
 * Supported transaction types
 */
export type SolanaTransaction = Transaction | VersionedTransaction;

/**
 * Check if a value is a Solana Transaction
 */
export function isTransaction(tx: unknown): tx is Transaction {
  return tx instanceof Transaction;
}

/**
 * Check if a value is a Solana VersionedTransaction
 */
export function isVersionedTransaction(tx: unknown): tx is VersionedTransaction {
  return tx instanceof VersionedTransaction;
}

/**
 * Serialize a Solana transaction to base64
 *
 * @param tx - Solana transaction
 * @returns Base64-encoded serialized transaction
 */
export function serializeTransaction(tx: SolanaTransaction): string {
  if (isTransaction(tx)) {
    return Buffer.from(tx.serialize({ requireAllSignatures: false })).toString('base64');
  }
  if (isVersionedTransaction(tx)) {
    return Buffer.from(tx.serialize()).toString('base64');
  }
  throw new Error('Unsupported transaction type');
}

/**
 * Deserialize a base64 transaction string back to a Solana transaction.
 *
 * @param serialized - Base64-encoded serialized transaction
 * @param versioned - Whether the transaction is versioned
 * @returns Deserialized transaction
 */
export function deserializeTransaction(serialized: string, versioned: boolean = false): SolanaTransaction {
  const buffer = Buffer.from(serialized, 'base64');
  if (versioned) {
    return VersionedTransaction.deserialize(buffer);
  }
  return Transaction.from(buffer);
}

/**
 * Sign a Solana transaction via an OWS wallet.
 *
 * This is a wrapper around the wallet's generic signTransaction method
 * with Solana-specific type safety and serialization helpers.
 *
 * @param wallet - OWS wallet instance
 * @param transaction - Solana transaction to sign
 * @returns Signed transaction result with base64 serialization
 */
export async function signSolanaTransaction(
  wallet: OWSWallet,
  transaction: SolanaTransaction
): Promise<SignTransactionResult> {
  if (!wallet) {
    throw new Error('Wallet is required');
  }
  if (!transaction) {
    throw new Error('Transaction is required');
  }

  // Serialize the transaction for the OWS wallet
  const serializedTx = serializeTransaction(transaction);

  // Request signature from the wallet
  const signed = await wallet.signTransaction({
    chain: 'solana',
    serializedTx
  });

  // Validate response
  if (!signed || typeof signed !== 'object') {
    throw new Error('Invalid transaction signature response from wallet');
  }

  const signatures: string[] = signed.signatures || [];

  return {
    serializedTx: signed.serializedTx || serializedTx,
    signatures
  };
}

/**
 * Create a transaction signing handler bound to an OWS wallet.
 *
 * @param wallet - OWS wallet instance
 * @returns Function that signs Solana transactions
 */
export function createSignTransactionHandler(
  wallet: OWSWallet
): (transaction: SolanaTransaction) => Promise<SignTransactionResult> {
  return (transaction: SolanaTransaction) => signSolanaTransaction(wallet, transaction);
}

/**
 * Partially sign a transaction with the OWS wallet.
 *
 * Useful for multi-signature transactions where the wallet is one of several signers.
 *
 * @param wallet - OWS wallet instance
 * @param transaction - Solana transaction to partially sign
 * @returns Updated transaction with partial signatures
 */
export async function partialSignSolanaTransaction(
  wallet: OWSWallet,
  transaction: SolanaTransaction
): Promise<SolanaTransaction> {
  const result = await signSolanaTransaction(wallet, transaction);
  return deserializeTransaction(result.serializedTx, isVersionedTransaction(transaction));
}
