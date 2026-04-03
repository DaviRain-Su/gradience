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
 * Note: No fixed program ID is declared in the source; set via environment variable.
 * Default: System Program (placeholder - must be configured for actual usage)
 */
export const AGENTM_CORE_PROGRAM_ID = new PublicKey(
    process.env.AGENTD_AGENTM_CORE_PROGRAM_ID ?? '11111111111111111111111111111111',
);
