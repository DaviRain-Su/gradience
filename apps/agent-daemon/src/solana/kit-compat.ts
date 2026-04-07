import { PublicKey } from '@solana/web3.js';
import { type Address } from '@solana/kit';

/**
 * Thin compatibility bridge between @solana/kit Address and @solana/web3.js PublicKey.
 *
 * NOTE: The daemon still has legacy code using web3.js for transaction construction.
 * These helpers allow that code to consume the canonical kit-based program IDs from
 * program-ids.ts without duplicating constants in both formats.
 *
 * Target: all legacy web3.js usage in the daemon should eventually be rewritten to kit.
 */

export function addressToPublicKey(addr: Address): PublicKey {
    return new PublicKey(addr);
}

export function publicKeyToAddress(pk: PublicKey): Address {
    return pk.toBase58() as Address;
}
