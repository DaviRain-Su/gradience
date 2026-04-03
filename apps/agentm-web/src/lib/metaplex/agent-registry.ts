/**
 * Metaplex Agent Registry
 *
 * Registers AI agents on-chain using Metaplex Core Assets.
 * Each agent gets a unique on-chain identity (NFT Asset) with
 * capability attributes — enabling discovery, reputation, and A2A interactions.
 *
 * Real path: uses @metaplex-foundation/mpl-core createV1 + DAS queries
 * Demo path: deterministic mock (no wallet required) — used for hackathon demo
 *
 * Tech Spec: docs/metaplex-agent-registry-03-technical-spec.md
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetaplexAgentAsset {
    /** Metaplex Core Asset public key (base58) */
    assetAddress: string;
    /** Human-readable agent name (≤32 chars) */
    name: string;
    /** Metadata URI (data URI in demo, Arweave/IPFS in production) */
    uri: string;
    /** Owner wallet (base58) */
    owner: string;
    /** Registration timestamp (ms) */
    registeredAt: number;
    /** Capabilities derived from metadata attributes */
    capabilities: string[];
    /** Unique agent ID: `mplx-agent:<first8ofAddress>` */
    agentId: string;
}

export interface AgentRegistrationInput {
    /** Wallet address (base58) — used as owner field */
    walletAddress: string;
    /** Display name, 1–32 chars */
    name: string;
    /** Agent capability tags, e.g. ['nft-analysis', 'pricing'] */
    capabilities: string[];
    /** Optional: override the metadata URI (skips buildAgentMetadataUri) */
    metadataUri?: string;
}

// ---------------------------------------------------------------------------
// Static demo registry (fallback when no RPC / wallet available)
// ---------------------------------------------------------------------------

const DEMO_REGISTRY: MetaplexAgentAsset[] = [
    {
        assetAddress: '7xKxMnPqR9YzF4v1A7qY1jYf2nn89mFn4QjTqD4Y9Yz1',
        name: 'MarketAnalyzer_v1',
        uri: buildAgentMetadataUri('MarketAnalyzer_v1', ['nft-analysis', 'pricing', 'tensor-trading']),
        owner: 'F4v1A7qY1jYf2nn89mFn4QjTqD4Y9Za9zVn2C1xTa111',
        registeredAt: 1743638400000,
        capabilities: ['nft-analysis', 'pricing', 'tensor-trading'],
        agentId: 'mplx-agent:7xkxmnpq',
    },
    {
        assetAddress: '4FqR2MN8xbWPp1Ck5jVQxM7x7mG3gQqQe8fTQ5zB1nW2',
        name: 'TaskExecutor_v1',
        uri: buildAgentMetadataUri('TaskExecutor_v1', ['task-execution', 'code-review', 'qa-testing']),
        owner: '5jVQxM7x7mG3gQqQe8fTQ5zB1nWfU7sW2u5W9h5wB222',
        registeredAt: 1743638460000,
        capabilities: ['task-execution', 'code-review', 'qa-testing'],
        agentId: 'mplx-agent:4fqr2mn8',
    },
    {
        assetAddress: '9BWp1CK5rA2WcQ8p2eQxQ26n9tAqD5cK1Yf5x8zQe9w3',
        name: 'DataIndexer_v1',
        uri: buildAgentMetadataUri('DataIndexer_v1', ['data-indexing', 'collection-analytics', 'metadata-repair']),
        owner: '9rA2WcQ8p2eQxQ26n9tAqD5cK1Yf5x8zQe9wP7mTa333',
        registeredAt: 1743638520000,
        capabilities: ['data-indexing', 'collection-analytics', 'metadata-repair'],
        agentId: 'mplx-agent:9bwp1ck5',
    },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a base64-encoded data URI containing agent metadata in NFT JSON format.
 * In production, this would be uploaded to Arweave/IPFS.
 */
export function buildAgentMetadataUri(name: string, capabilities: string[]): string {
    const attributes = capabilities.map((cap) => ({
        trait_type: 'capability',
        value: cap,
    }));

    const metadata = {
        name,
        description: 'Gradience Protocol Agent — registered on Metaplex Core',
        image: 'https://gradience.xyz/agent-placeholder.png',
        attributes: [
            { trait_type: 'protocol', value: 'gradience' },
            { trait_type: 'registry', value: 'metaplex-core' },
            ...attributes,
        ],
        properties: {
            category: 'agent',
            files: [],
        },
    };

    const encoded =
        typeof btoa !== 'undefined'
            ? btoa(JSON.stringify(metadata))
            : Buffer.from(JSON.stringify(metadata)).toString('base64');

    return `data:application/json;base64,${encoded}`;
}

/** Deterministic mock asset address derived from name + capabilities */
function mockAssetAddress(name: string, capabilities: string[]): string {
    const seed = `${name}:${capabilities.join(',')}`;
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    const hex = hash.toString(16).padStart(8, '0');
    // Produce a plausible-looking base58-ish address (44 chars)
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let addr = '';
    let h = hash;
    for (let i = 0; i < 44; i++) {
        addr += chars[h % chars.length];
        h = Math.imul(h ^ (h >>> 7), 0x45d9f3b) >>> 0;
    }
    return addr + hex.slice(0, 0); // keep 44 chars
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register a new agent on-chain using Metaplex Core.
 *
 * Real path (TODO — requires @metaplex-foundation/mpl-core):
 * ```ts
 * // TODO: integrate real on-chain registration
 * // import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
 * // import { create, mplCore } from '@metaplex-foundation/mpl-core'
 * // import { generateSigner } from '@metaplex-foundation/umi'
 * //
 * // const umi = createUmi(process.env.NEXT_PUBLIC_SOLANA_RPC!).use(mplCore())
 * // const assetSigner = generateSigner(umi)
 * // await create(umi, {
 * //   asset: assetSigner,
 * //   name: input.name,
 * //   uri: metadataUri,
 * // }).sendAndConfirm(umi)
 * // assetAddress = assetSigner.publicKey.toString()
 * ```
 *
 * Demo path: returns a deterministic mock (no wallet or RPC required).
 */
export async function registerAgent(input: AgentRegistrationInput): Promise<MetaplexAgentAsset> {
    const name = input.name.trim();
    if (name.length === 0 || name.length > 32) {
        throw new Error('agent name must be ≤ 32 characters');
    }
    if (!input.capabilities || input.capabilities.length === 0) {
        throw new Error('at least one capability is required');
    }

    const capabilities = input.capabilities.map((c) => c.trim().toLowerCase());
    const uri = input.metadataUri ?? buildAgentMetadataUri(name, capabilities);

    // TODO: replace mock with real on-chain call (see docstring above)
    const assetAddress = mockAssetAddress(name, capabilities);
    const agentId = `mplx-agent:${assetAddress.slice(0, 8).toLowerCase()}`;

    return {
        assetAddress,
        name,
        uri,
        owner: input.walletAddress,
        registeredAt: Date.now(),
        capabilities,
        agentId,
    };
}

/**
 * Fetch a registered agent by its Metaplex Core Asset address.
 *
 * Real path (TODO):
 * ```ts
 * // TODO: fetch from chain
 * // import { fetchAsset } from '@metaplex-foundation/mpl-core'
 * // const asset = await fetchAsset(umi, publicKey(assetAddress))
 * ```
 *
 * Returns null for unknown addresses — never throws.
 */
export async function getAgentInfo(assetAddress: string): Promise<MetaplexAgentAsset | null> {
    // TODO: replace with real on-chain fetch (see docstring above)
    return DEMO_REGISTRY.find((a) => a.assetAddress === assetAddress) ?? null;
}

/**
 * List registered agents, optionally filtered by owner wallet.
 *
 * Real path (TODO — uses Metaplex DAS API):
 * ```ts
 * // TODO: query DAS
 * // const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC
 * // const response = await fetch(rpc, {
 * //   method: 'POST',
 * //   body: JSON.stringify({
 * //     jsonrpc: '2.0', id: 1, method: 'getAssetsByOwner',
 * //     params: { ownerAddress: options?.owner, limit: options?.limit ?? 20 },
 * //   }),
 * // })
 * // const { result } = await response.json()
 * // return result.items.map(parseAssetToAgent)
 * ```
 */
export async function listAgents(options?: {
    owner?: string;
    limit?: number;
}): Promise<MetaplexAgentAsset[]> {
    const limit = options?.limit ?? 20;

    // TODO: replace with real DAS query (see docstring above)
    let results = DEMO_REGISTRY;
    if (options?.owner) {
        results = results.filter((a) => a.owner === options.owner);
    }
    return results.slice(0, limit);
}
