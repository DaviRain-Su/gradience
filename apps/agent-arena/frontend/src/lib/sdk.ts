import { GradienceSDK, KeypairAdapter } from '@gradience/sdk';
import type { TransactionSigner } from '@solana/kit';

import { INDEXER_ENDPOINT, RPC_ENDPOINT } from './config';

export function createSdk(): GradienceSDK {
    return new GradienceSDK({
        indexerEndpoint: INDEXER_ENDPOINT,
        rpcEndpoint: RPC_ENDPOINT,
    });
}

export function createWalletAdapter(signer: TransactionSigner): KeypairAdapter {
    return new KeypairAdapter({
        signer,
        rpcEndpoint: RPC_ENDPOINT,
    });
}
