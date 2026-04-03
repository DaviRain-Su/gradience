/**
 * Balance Checking Utility
 *
 * Check SOL and SPL token balances for Solana addresses.
 *
 * @module @gradiences/ows-adapter
 */

import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  TokenAmount
} from '@solana/web3.js';

/**
 * Account balance info
 */
export interface BalanceInfo {
  /** Address checked */
  address: string;
  /** Balance in base units (lamports for SOL) */
  balance: number;
  /** Balance in UI units */
  uiBalance: number;
  /** Decimals */
  decimals: number;
  /** Mint address (null for native SOL) */
  mint: string | null;
}

/**
 * Check the native SOL balance of an address.
 *
 * @param connection - Solana RPC connection
 * @param address - Wallet address (base58 public key)
 * @returns Balance info
 */
export async function checkBalance(connection: Connection, address: string): Promise<BalanceInfo> {
  if (!connection) {
    throw new Error('Connection is required');
  }
  if (!address || typeof address !== 'string') {
    throw new Error('Address is required');
  }

  let publicKey: PublicKey;
  try {
    publicKey = new PublicKey(address);
  } catch {
    throw new Error(`Invalid Solana address: ${address}`);
  }

  const balance = await connection.getBalance(publicKey);

  return {
    address,
    balance,
    uiBalance: balance / LAMPORTS_PER_SOL,
    decimals: 9,
    mint: null
  };
}

/**
 * Check the SPL token balance of an address for a specific mint.
 *
 * @param connection - Solana RPC connection
 * @param address - Wallet address (base58 public key)
 * @param mint - Token mint address
 * @returns Balance info
 */
export async function checkTokenBalance(
  connection: Connection,
  address: string,
  mint: string
): Promise<BalanceInfo> {
  if (!connection) {
    throw new Error('Connection is required');
  }
  if (!address || typeof address !== 'string') {
    throw new Error('Address is required');
  }
  if (!mint || typeof mint !== 'string') {
    throw new Error('Mint is required');
  }

  let ownerPublicKey: PublicKey;
  let mintPublicKey: PublicKey;

  try {
    ownerPublicKey = new PublicKey(address);
    mintPublicKey = new PublicKey(mint);
  } catch {
    throw new Error(`Invalid Solana address or mint`);
  }

  // Use getTokenAccountsByOwner to find the associated token account
  const response = await connection.getTokenAccountsByOwner(ownerPublicKey, {
    mint: mintPublicKey
  });

  if (response.value.length === 0) {
    return {
      address,
      balance: 0,
      uiBalance: 0,
      decimals: 0,
      mint
    };
  }

  // Sum balances across all token accounts for this mint
  let totalBalance = 0;
  let decimals = 0;

  for (const account of response.value) {
    const data = account.account.data as any;
    if (data && data.parsed && data.parsed.info && data.parsed.info.tokenAmount) {
      const tokenAmount: TokenAmount = data.parsed.info.tokenAmount;
      totalBalance += Number(tokenAmount.amount);
      decimals = tokenAmount.decimals;
    }
  }

  return {
    address,
    balance: totalBalance,
    uiBalance: decimals > 0 ? totalBalance / Math.pow(10, decimals) : totalBalance,
    decimals,
    mint
  };
}

/**
 * Check multiple token balances at once.
 *
 * @param connection - Solana RPC connection
 * @param address - Wallet address
 * @param mints - Array of token mint addresses
 * @returns Array of balance info (preserves order)
 */
export async function checkTokenBalances(
  connection: Connection,
  address: string,
  mints: string[]
): Promise<BalanceInfo[]> {
  if (!Array.isArray(mints)) {
    throw new Error('mints must be an array');
  }

  return Promise.all(mints.map((mint) => checkTokenBalance(connection, address, mint)));
}
