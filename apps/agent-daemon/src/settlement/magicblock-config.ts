import { z } from 'zod';

export interface MagicBlockConfig {
    /** MagicBlock cluster endpoint */
    erEndpoint: string;
    /** Solana L1 RPC URL (for commit transactions) */
    solanaRpcUrl: string;
    /** Program ID that owns the delegated state */
    ownerProgramId: string;
    /** Validator pubkey to delegate to (optional) */
    validatorPubkey?: string;
    /** Commit frequency in milliseconds */
    commitFrequencyMs: number;
    /** Whether MagicBlock settlement is enabled */
    enabled: boolean;
}

const MagicBlockEnvSchema = z.object({
    MAGICBLOCK_ER_ENDPOINT: z.string().url().optional(),
    MAGICBLOCK_SOLANA_RPC: z.string().url().optional(),
    MAGICBLOCK_OWNER_PROGRAM_ID: z.string().optional(),
    MAGICBLOCK_VALIDATOR_PUBKEY: z.string().optional(),
    MAGICBLOCK_COMMIT_FREQUENCY_MS: z.coerce.number().default(30_000),
    MAGICBLOCK_ENABLED: z.enum(['true', 'false']).default('false'),
});

export function loadMagicBlockConfig(): MagicBlockConfig {
    const env = MagicBlockEnvSchema.parse(process.env);
    return {
        erEndpoint: env.MAGICBLOCK_ER_ENDPOINT || 'https://devnet.magicblock.app',
        solanaRpcUrl: env.MAGICBLOCK_SOLANA_RPC || 'https://api.devnet.solana.com',
        ownerProgramId: env.MAGICBLOCK_OWNER_PROGRAM_ID || '',
        validatorPubkey: env.MAGICBLOCK_VALIDATOR_PUBKEY,
        commitFrequencyMs: env.MAGICBLOCK_COMMIT_FREQUENCY_MS,
        enabled: env.MAGICBLOCK_ENABLED === 'true',
    };
}
