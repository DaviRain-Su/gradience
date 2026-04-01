/**
 * Skill Token — launched via Metaplex Genesis (bonding curve).
 *
 * Each Gradience agent can launch a skill token tied to their Metaplex
 * Core NFT identity. The key connection:
 *
 *   `creatorFeeAgentMint = agent.assetAddress`
 *
 * Genesis derives the agent's identity PDA and routes all trading fees
 * directly to the agent's on-chain wallet. This creates an automatic
 * economic flywheel: more A2A interactions → more token trading volume
 * → more fees flow to the agent.
 *
 * Token utility in Gradience A2A:
 *   - Standard rate (0 tokens):   base=100 + 2/byte microlamports
 *   - Discount rate (≥100 tokens): base=50  + 1/byte microlamports
 *
 * Holding skill tokens grants 50% discount on the agent's services.
 */

import { createAndRegisterLaunch, type GenesisApiConfig } from '@metaplex-foundation/genesis';
import type { Umi } from '@metaplex-foundation/umi';

/** Minimum token balance to qualify for the discounted micropayment rate */
export const TOKEN_THRESHOLD = 100n;

export interface SkillTokenInput {
    name: string;
    symbol: string;
    /** Must start with https://gateway.irys.xyz/ — upload image to Irys first */
    imageUri: string;
    description: string;
    /** The agent's Metaplex Core asset address — links token to agent identity */
    agentAssetAddress: string;
    /** Creator wallet public key */
    creatorWallet: string;
    network?: 'solana-mainnet' | 'solana-devnet';
}

export interface SkillToken {
    mintAddress: string;
    genesisAccount: string;
    launchLink: string;
    symbol: string;
}

/**
 * Launch an agent skill token via Metaplex Genesis (bonding curve).
 *
 * Uses `creatorFeeAgentMint` to route all trading fees to the agent's
 * MPL Core identity PDA — no manual fee routing needed.
 */
export async function launchSkillToken(
    umi: Umi,
    input: SkillTokenInput,
    apiConfig?: GenesisApiConfig,
): Promise<SkillToken> {
    console.log(`Launching ${input.symbol} skill token via Metaplex Genesis...`);
    console.log(`  Creator fee → agent identity PDA (asset: ${input.agentAssetAddress.slice(0, 8)}…)`);

    const result = await createAndRegisterLaunch(
        umi,
        apiConfig ?? {},
        {
            launchType: 'bondingCurve',
            wallet: input.creatorWallet,
            network: input.network ?? 'solana-devnet',
            token: {
                name: input.name,
                symbol: input.symbol,
                image: input.imageUri,
                description: input.description,
            },
            launch: {
                /**
                 * Routes all bonding curve creator fees to the agent's
                 * Metaplex identity PDA, derived from this asset address.
                 * This is the core economic link between the NFT identity
                 * and the skill token.
                 */
                creatorFeeAgentMint: input.agentAssetAddress,
            },
        },
    );

    console.log(`✅ ${input.symbol} launched:`);
    console.log(`   Mint:    ${result.mintAddress}`);
    console.log(`   Genesis: ${result.genesisAccount}`);
    console.log(`   Link:    ${result.launch.link}`);

    return {
        mintAddress: result.mintAddress,
        genesisAccount: result.genesisAccount,
        launchLink: result.launch.link,
        symbol: input.symbol,
    };
}

/**
 * Compute the A2A micropayment rate for a given token holder.
 *
 * @param tokenBalance  Buyer's balance of the agent's skill token (base units)
 */
export function getDiscountedRate(tokenBalance: bigint): {
    baseMicrolamports: number;
    perByteMicrolamports: number;
} {
    if (tokenBalance >= TOKEN_THRESHOLD) {
        // Token holder discount: 50% cheaper
        return { baseMicrolamports: 50, perByteMicrolamports: 1 };
    }
    // Standard rate
    return { baseMicrolamports: 100, perByteMicrolamports: 2 };
}
