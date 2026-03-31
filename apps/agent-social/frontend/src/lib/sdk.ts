import { GradienceSDK } from '@gradience/sdk';

const INDEXER_ENDPOINT =
    process.env.NEXT_PUBLIC_GRADIENCE_INDEXER_ENDPOINT ?? 'http://127.0.0.1:3001';
const RPC_ENDPOINT =
    process.env.NEXT_PUBLIC_GRADIENCE_RPC_ENDPOINT ?? 'https://api.devnet.solana.com';

export function createSdk(): GradienceSDK {
    return new GradienceSDK({
        indexerEndpoint: INDEXER_ENDPOINT,
        rpcEndpoint: RPC_ENDPOINT,
    });
}
