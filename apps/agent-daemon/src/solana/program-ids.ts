import { PublicKey } from '@solana/web3.js';
import { address, type Address } from '@solana/kit';

const ARENA_PROGRAM_ID_STR =
    process.env.AGENTD_ARENA_PROGRAM_ID ?? '5CUY2V1odYZghA54WH7YQRPzh3JaKhe1S84CRbeKfVYs';
const AGENTM_CORE_PROGRAM_ID_STR =
    process.env.AGENTD_AGENTM_CORE_PROGRAM_ID ?? '2stkfkFaFLUvSR9yydmfQ7pZReo2M38zcVtL1QffCyDA';

/**
 * Gradience Arena Program ID (web3.js PublicKey)
 * Default: Devnet deployment
 */
export const ARENA_PROGRAM_ID = new PublicKey(ARENA_PROGRAM_ID_STR);

/**
 * Gradience Arena Program ID (@solana/kit Address)
 */
export const ARENA_PROGRAM_ADDRESS: Address = address(ARENA_PROGRAM_ID_STR);

/**
 * AgentM Core Program ID (web3.js PublicKey)
 * Devnet deployment: 2025-04-05
 * Program deployed at: 2stkfkFaFLUvSR9yydmfQ7pZReo2M38zcVtL1QffCyDA
 */
export const AGENTM_CORE_PROGRAM_ID = new PublicKey(AGENTM_CORE_PROGRAM_ID_STR);

/**
 * AgentM Core Program ID (@solana/kit Address)
 */
export const AGENTM_CORE_PROGRAM_ADDRESS: Address = address(AGENTM_CORE_PROGRAM_ID_STR);
