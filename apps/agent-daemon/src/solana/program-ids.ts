import { PublicKey } from '@solana/web3.js';

/**
 * Gradience Arena Program ID
 * Default: Devnet deployment
 */
export const ARENA_PROGRAM_ID = new PublicKey(
    process.env.AGENTD_ARENA_PROGRAM_ID ?? '5CUY2V1odYZghA54WH7YQRPzh3JaKhe1S84CRbeKfVYs',
);

/**
 * AgentM Core Program ID
 * Devnet deployment: 2025-04-05
 * Program deployed at: 2stkfkFaFLUvSR9yydmfQ7pZReo2M38zcVtL1QffCyDA
 */
export const AGENTM_CORE_PROGRAM_ID = new PublicKey(
    process.env.AGENTD_AGENTM_CORE_PROGRAM_ID ?? '2stkfkFaFLUvSR9yydmfQ7pZReo2M38zcVtL1QffCyDA',
);
