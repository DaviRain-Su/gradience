/**
 * Gradience agent registration via Metaplex Core.
 *
 * Each agent gets a Metaplex Core NFT as its on-chain identity.
 * The NFT metadata URI points to a JSON file describing the agent's
 * capabilities, specialty, and Gradience reputation endpoint.
 */

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplCore, createV1 } from '@metaplex-foundation/mpl-core';
import { mplAgentIdentity } from '@metaplex-foundation/mpl-agent-registry';
import { generateSigner, publicKey, type Umi, type KeypairSigner } from '@metaplex-foundation/umi';

export interface GradienceAgent {
    umi: Umi;
    /** Wallet keypair */
    keypair: KeypairSigner;
    /** Metaplex Core asset signer (agent's on-chain identity NFT) */
    assetSigner: KeypairSigner;
    /** Asset public key string — used as the agent's canonical ID */
    assetAddress: string;
    name: string;
    specialty: string;
}

/**
 * Create a UMI instance with Gradience-required plugins.
 */
export function makeUmi(rpcUrl: string): Umi {
    return createUmi(rpcUrl).use(mplCore()).use(mplAgentIdentity());
}

/**
 * Register a Gradience agent on-chain.
 *
 * Creates a Metaplex Core NFT that serves as the agent's permanent,
 * verifiable on-chain identity. The asset address becomes the agent's
 * canonical ID across the Gradience A2A protocol.
 *
 * Metadata URI format:
 * {
 *   name: "Alice — DeFi Oracle",
 *   symbol: "ALICE",
 *   description: "Specialized DeFi analysis agent",
 *   attributes: [
 *     { trait_type: "specialty", value: "defi" },
 *     { trait_type: "gradience_endpoint", value: "https://api.gradience.xyz/agents/alice" }
 *   ]
 * }
 */
export async function registerGradienceAgent(
    umi: Umi,
    opts: {
        name: string;
        specialty: string;
        metadataUri: string;
        /** Metaplex Core collection (shared across all Gradience agents) */
        collectionAddress?: string;
    },
): Promise<GradienceAgent> {
    const kp = umi.identity as KeypairSigner;
    const assetSigner = generateSigner(umi);

    const createArgs: Parameters<typeof createV1>[1] = {
        asset: assetSigner,
        name: opts.name,
        uri: opts.metadataUri,
    };

    if (opts.collectionAddress) {
        createArgs.collection = publicKey(opts.collectionAddress);
    }

    console.log(`[${opts.name}] Minting agent identity NFT — ${assetSigner.publicKey}`);
    await createV1(umi, createArgs).sendAndConfirm(umi);
    console.log(`[${opts.name}] ✅ Registered on-chain`);

    return {
        umi,
        keypair: kp,
        assetSigner,
        assetAddress: assetSigner.publicKey.toString(),
        name: opts.name,
        specialty: opts.specialty,
    };
}
