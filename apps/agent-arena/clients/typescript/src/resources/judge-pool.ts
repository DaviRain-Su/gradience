import { fetchMaybeJudgePool } from '../generated/index.js';
import type { Address } from '@solana/kit';
import { getProgramDerivedAddress, getAddressDecoder, fetchEncodedAccount } from '@solana/kit';

const TEXT_ENCODER = new TextEncoder();

async function findJudgePoolPda(programAddress: Address, category: number): Promise<readonly [Address, number]> {
    return getProgramDerivedAddress({
        programAddress,
        seeds: [TEXT_ENCODER.encode('judge_pool'), Uint8Array.of(category)],
    });
}

function bytesToAddress(value: number[] | Uint8Array): Address {
    const bytes = value instanceof Uint8Array ? value : Uint8Array.from(value);
    return getAddressDecoder().decode(bytes as unknown as Uint8Array);
}

export interface JudgePoolEntryApi {
    judge: string;
    stake: number;
    weight: number;
}

export interface JudgePoolMemberOnChain {
    judge: Address;
    weight: number;
}

export interface JudgePoolResourceOptions {
    programAddress: Address;
    rpc: Parameters<typeof fetchEncodedAccount>[0];
    indexerEndpoint: string;
}

type QueryValue = string | number | undefined;

export class JudgePoolResource {
    private programAddress: Address;
    private rpc: Parameters<typeof fetchEncodedAccount>[0];
    private indexerEndpoint: string;

    constructor(options: JudgePoolResourceOptions) {
        this.programAddress = options.programAddress;
        this.rpc = options.rpc;
        this.indexerEndpoint = options.indexerEndpoint;
    }

    /**
     * Fetch judge pool for a category from indexer.
     * Returns `null` when the pool is not found.
     */
    async getJudgePool(category: number): Promise<JudgePoolEntryApi[] | null> {
        return this.getJsonOrNull<JudgePoolEntryApi[]>(`/api/judge-pool/${category}`);
    }

    /**
     * Fetch on-chain judge pool PDA members for a category.
     * Returns `null` when the pool account does not exist.
     */
    async getJudgePoolOnChain(category: number): Promise<JudgePoolMemberOnChain[] | null> {
        const [poolPda] = await findJudgePoolPda(this.programAddress, category);
        const maybePool = await fetchMaybeJudgePool(this.rpc, poolPda);
        if (!maybePool.exists) {
            return null;
        }

        return maybePool.data.entries.map(entry => ({
            judge: bytesToAddress(entry.judge),
            weight: entry.weight,
        }));
    }

    private async getJson<T>(path: string, query: Record<string, QueryValue> = {}): Promise<T> {
        const url = new URL(path, `${this.indexerEndpoint}/`);
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined) {
                params.set(key, String(value));
            }
        }
        if (params.size > 0) {
            url.search = params.toString();
        }

        const response = await fetch(url.toString());
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Indexer request failed (${response.status}): ${text}`);
        }
        return (await response.json()) as T;
    }

    private async getJsonOrNull<T>(path: string, query: Record<string, QueryValue> = {}): Promise<T | null> {
        try {
            return await this.getJson<T>(path, query);
        } catch (error) {
            if (error instanceof Error && error.message.includes('404')) {
                return null;
            }
            throw error;
        }
    }
}
