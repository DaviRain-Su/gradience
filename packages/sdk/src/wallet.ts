/**
 * Wallet adapter utilities.
 *
 * Re-exports all wallet adapters from the Arena SDK.  Use {@link KeypairAdapter}
 * for server-side / scripted usage.  Browser-side adapters (OKX, Privy, etc.)
 * are stubbed and will throw until implemented in a future release.
 *
 * @example
 * import { createKeyPairSignerFromBytes } from '@solana/kit';
 * import { KeypairAdapter } from '@gradiences/sdk/wallet';
 *
 * const signer = await createKeyPairSignerFromBytes(secretKeyBytes);
 * const wallet = new KeypairAdapter({ signer, rpcEndpoint });
 */
export {
    KeypairAdapter,
    OpenWalletAdapter,
    OKXAdapter,
    PrivyAdapter,
    KiteAdapter,
} from '@gradiences/arena-sdk';

export type { KeypairAdapterOptions } from '@gradiences/arena-sdk';
