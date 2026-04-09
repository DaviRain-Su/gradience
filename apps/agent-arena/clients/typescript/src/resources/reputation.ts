import type { Address } from '@solana/kit';
import type { ReputationApi, ReputationOnChain } from '../types.js';

export interface ReputationResourceOptions {
    indexerEndpoint: string;
    programAddress: Address;
    rpc: Parameters<typeof import('@solana/kit').fetchEncodedAccount>[0];
}

export class ReputationResource {
    private indexerEndpoint: string;
    private programAddress: Address;
    private rpc: Parameters<typeof import('@solana/kit').fetchEncodedAccount>[0];

    constructor(options: ReputationResourceOptions) {
        this.indexerEndpoint = options.indexerEndpoint;
        this.programAddress = options.programAddress;
        this.rpc = options.rpc;
    }

    /**
     * Fetch reputation from indexer API.
     * Returns `null` when the agent is not found.
     */
    async getReputation(agent: string): Promise<ReputationApi | null> {
        const url = `${this.indexerEndpoint}/api/agents/${encodeURIComponent(agent)}/reputation`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                const text = await response.text();
                throw new Error(`Indexer request failed (${response.status}): ${text}`);
            }
            return (await response.json()) as ReputationApi;
        } catch (error) {
            if (error instanceof Error && error.message.includes('404')) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Fetch on-chain reputation PDA.
     * Returns `null` when the account does not exist.
     */
    async getReputationOnChain(agent: Address): Promise<ReputationOnChain | null> {
        const { getProgramDerivedAddress, fetchEncodedAccount, getAddressEncoder, getAddressDecoder } =
            await import('@solana/kit');

        const TEXT_ENCODER = new TextEncoder();
        const REPUTATION_DISCRIMINATOR = 0x05;
        const MAX_CATEGORIES = 8;

        async function findReputationPda(
            programAddress: Address,
            agentAddress: Address,
        ): Promise<readonly [Address, number]> {
            return getProgramDerivedAddress({
                programAddress,
                seeds: [TEXT_ENCODER.encode('reputation'), getAddressEncoder().encode(agentAddress)],
            });
        }

        function bytesToAddress(value: number[] | Uint8Array): Address {
            const bytes = value instanceof Uint8Array ? value : Uint8Array.from(value);
            return getAddressDecoder().decode(Uint8Array.from(bytes) as unknown as Uint8Array);
        }

        class ByteReader {
            private readonly view: DataView;
            private offset = 0;

            constructor(private readonly data: Uint8Array) {
                this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
            }

            readU8(): number {
                const value = this.view.getUint8(this.offset);
                this.offset += 1;
                return value;
            }

            readU16(): number {
                const value = this.view.getUint16(this.offset, true);
                this.offset += 2;
                return value;
            }

            readU32(): number {
                const value = this.view.getUint32(this.offset, true);
                this.offset += 4;
                return value;
            }

            readU64(): bigint {
                const value = this.view.getBigUint64(this.offset, true);
                this.offset += 8;
                return value;
            }

            readFixedArray(size: number): Uint8Array {
                const start = this.offset;
                this.offset += size;
                return this.data.slice(start, this.offset);
            }
        }

        function parseReputationAccount(data: Uint8Array): ReputationOnChain {
            const reader = new ByteReader(data);
            const discriminator = reader.readU8();
            if (discriminator !== REPUTATION_DISCRIMINATOR) {
                throw new Error(`Invalid reputation discriminator: ${discriminator}`);
            }
            reader.readU8(); // version

            const agentAddress = bytesToAddress(reader.readFixedArray(32));
            const totalEarned = reader.readU64();
            const completed = reader.readU32();
            const totalApplied = reader.readU32();
            const avgScore = reader.readU16();
            const winRate = reader.readU16();

            const byCategory: import('../types.js').ReputationCategoryOnChain[] = [];
            for (let i = 0; i < MAX_CATEGORIES; i += 1) {
                byCategory.push({
                    category: reader.readU8(),
                    avgScore: reader.readU16(),
                    completed: reader.readU32(),
                });
            }

            const bump = reader.readU8();
            return {
                agent: agentAddress,
                totalEarned,
                completed,
                totalApplied,
                avgScore,
                winRate,
                byCategory,
                bump,
            };
        }

        const [reputationPda] = await findReputationPda(this.programAddress, agent);
        const maybeAccount = await fetchEncodedAccount(this.rpc, reputationPda);
        if (!maybeAccount.exists) {
            return null;
        }
        return parseReputationAccount(maybeAccount.data);
    }
}
