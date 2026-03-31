const DEFAULT_INDEXER_ENDPOINT =
    typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.host}`
        : 'http://127.0.0.1:3001';

export const INDEXER_ENDPOINT =
    process.env.NEXT_PUBLIC_GRADIENCE_INDEXER_ENDPOINT ?? DEFAULT_INDEXER_ENDPOINT;

export const RPC_ENDPOINT =
    process.env.NEXT_PUBLIC_GRADIENCE_RPC_ENDPOINT ?? 'https://api.devnet.solana.com';
