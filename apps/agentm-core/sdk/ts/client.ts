import type {
    AgentType,
    CreateAgentInput,
    ReputationAccount,
    UpdateAgentConfigInput,
    UpdateProfileInput,
    UpdateReputationInput,
} from './types';

const DISCRIMINATOR = {
    initialize: 0,
    registerUser: 1,
    updateProfile: 2,
    followUser: 3,
    unfollowUser: 4,
    sendMessage: 5,
    createAgent: 6,
    updateAgentConfig: 7,
    updateReputation: 8,
} as const;

const REPUTATION_DISCRIMINATOR = 'REPUT___';

export class AgentMCoreSdk {
    buildInitializeInstructionData(): Uint8Array {
        return Uint8Array.of(DISCRIMINATOR.initialize);
    }

    buildRegisterUserInstructionData(username: string): Uint8Array {
        return concatenate(Uint8Array.of(DISCRIMINATOR.registerUser), encodeUtf8(username));
    }

    buildUpdateProfileInstructionData(input: UpdateProfileInput): Uint8Array {
        const payload = serializeUpdateProfile(input);
        return concatenate(Uint8Array.of(DISCRIMINATOR.updateProfile), payload);
    }

    buildCreateAgentInstructionData(input: CreateAgentInput): Uint8Array {
        const payload = serializeCreateAgent(input);
        return concatenate(Uint8Array.of(DISCRIMINATOR.createAgent), payload);
    }

    buildUpdateAgentConfigInstructionData(input: UpdateAgentConfigInput): Uint8Array {
        const payload = serializeUpdateAgentConfig(input);
        return concatenate(Uint8Array.of(DISCRIMINATOR.updateAgentConfig), payload);
    }

    buildUpdateReputationInstructionData(input: UpdateReputationInput): Uint8Array {
        if (input.scoreBps < 0 || input.scoreBps > 10_000) {
            throw new Error('scoreBps must be in range [0, 10000]');
        }

        const writer = new BinaryWriter();
        writer.writeU16(input.scoreBps);
        writer.writeBool(input.won);
        writer.writeI64(BigInt(input.updatedAt ?? 0));
        return concatenate(Uint8Array.of(DISCRIMINATOR.updateReputation), writer.toUint8Array());
    }

    decodeReputationAccount(data: Uint8Array): ReputationAccount | null {
        if (data.length < 8) return null;
        const disc = decodeUtf8(data.slice(0, 8));
        if (disc !== REPUTATION_DISCRIMINATOR) return null;

        const reader = new BinaryReader(data);
        reader.skip(8); // discriminator
        reader.skip(1); // version
        const agent = reader.readFixed(32);
        const totalReviews = reader.readU32();
        reader.readU64(); // total_score_bps
        const avgScoreBps = reader.readU16();
        const completed = reader.readU32();
        const wins = reader.readU32();
        const winRateBps = reader.readU16();
        const updatedAt = Number(reader.readI64());

        return {
            agent,
            totalReviews,
            avgScoreBps,
            completed,
            wins,
            winRateBps,
            updatedAt,
        };
    }
}

function serializeUpdateProfile(input: UpdateProfileInput): Uint8Array {
    const writer = new BinaryWriter();
    writer.writeString(input.displayName);
    writer.writeString(input.bio ?? '');
    writer.writeString(input.avatarUrl ?? '');
    writer.writeI64(BigInt(input.updatedAt ?? 0));
    return writer.toUint8Array();
}

function serializeCreateAgent(input: CreateAgentInput): Uint8Array {
    const writer = new BinaryWriter();
    writer.writeString(input.name);
    writer.writeString(input.description ?? '');
    writer.writeU8(encodeAgentType(input.agentType ?? 'custom'));
    writer.writeVec(input.config ?? new Uint8Array());
    writer.writeI64(BigInt(input.createdAt ?? 0));
    return writer.toUint8Array();
}

function serializeUpdateAgentConfig(input: UpdateAgentConfigInput): Uint8Array {
    const writer = new BinaryWriter();
    writer.writeString(input.description);
    writer.writeVec(input.config ?? new Uint8Array());
    writer.writeBool(input.isActive ?? true);
    writer.writeI64(BigInt(input.updatedAt ?? 0));
    return writer.toUint8Array();
}

function encodeAgentType(value: AgentType): number {
    switch (value) {
        case 'task_executor':
            return 0;
        case 'social_agent':
            return 1;
        case 'trading_agent':
            return 2;
        default:
            return 3;
    }
}

class BinaryWriter {
    private chunks: Uint8Array[] = [];

    writeU8(value: number) {
        this.chunks.push(Uint8Array.of(value & 0xff));
    }

    writeU16(value: number) {
        const buf = new ArrayBuffer(2);
        new DataView(buf).setUint16(0, value, true);
        this.chunks.push(new Uint8Array(buf));
    }

    writeU32(value: number) {
        const buf = new ArrayBuffer(4);
        new DataView(buf).setUint32(0, value, true);
        this.chunks.push(new Uint8Array(buf));
    }

    writeU64(value: bigint) {
        const buf = new ArrayBuffer(8);
        new DataView(buf).setBigUint64(0, value, true);
        this.chunks.push(new Uint8Array(buf));
    }

    writeI64(value: bigint) {
        const buf = new ArrayBuffer(8);
        new DataView(buf).setBigInt64(0, value, true);
        this.chunks.push(new Uint8Array(buf));
    }

    writeBool(value: boolean) {
        this.writeU8(value ? 1 : 0);
    }

    writeString(value: string) {
        const encoded = encodeUtf8(value);
        this.writeU32(encoded.length);
        this.chunks.push(encoded);
    }

    writeVec(value: Uint8Array) {
        this.writeU32(value.length);
        this.chunks.push(value);
    }

    toUint8Array(): Uint8Array {
        return concatenate(...this.chunks);
    }
}

class BinaryReader {
    private offset = 0;
    constructor(private readonly data: Uint8Array) {}

    skip(length: number) {
        this.offset += length;
    }

    readFixed(length: number): Uint8Array {
        const value = this.data.slice(this.offset, this.offset + length);
        this.offset += length;
        return value;
    }

    readU16(): number {
        const value = new DataView(this.data.buffer, this.data.byteOffset + this.offset, 2).getUint16(0, true);
        this.offset += 2;
        return value;
    }

    readU32(): number {
        const value = new DataView(this.data.buffer, this.data.byteOffset + this.offset, 4).getUint32(0, true);
        this.offset += 4;
        return value;
    }

    readU64(): bigint {
        const value = new DataView(this.data.buffer, this.data.byteOffset + this.offset, 8).getBigUint64(0, true);
        this.offset += 8;
        return value;
    }

    readI64(): bigint {
        const value = new DataView(this.data.buffer, this.data.byteOffset + this.offset, 8).getBigInt64(0, true);
        this.offset += 8;
        return value;
    }
}

function concatenate(...segments: Uint8Array[]): Uint8Array {
    const length = segments.reduce((total, segment) => total + segment.length, 0);
    const out = new Uint8Array(length);
    let offset = 0;
    for (const segment of segments) {
        out.set(segment, offset);
        offset += segment.length;
    }
    return out;
}

function encodeUtf8(value: string): Uint8Array {
    return new TextEncoder().encode(value);
}

function decodeUtf8(value: Uint8Array): string {
    return new TextDecoder().decode(value);
}
