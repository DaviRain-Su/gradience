import { describe, it, expect } from 'vitest';
import {
  MAGICBLOCK_VRF_PROGRAM_ID,
  DEFAULT_EPHEMERAL_QUEUE,
  buildRequestRandomnessIx,
  serializeRequestRandomness,
  parseQueueHeader,
  iterateQueueItems,
  findQueueItemById,
  type SerializableAccountMeta,
} from '../../src/settlement/magicblock-vrf-client.js';
import { PublicKey } from '@solana/web3.js';

describe('MagicBlockVRFClient', () => {
  const programId = MAGICBLOCK_VRF_PROGRAM_ID;
  const queue = DEFAULT_EPHEMERAL_QUEUE;
  const callbackProgramId = new PublicKey('DRa2PkgPiLZEATXgAXN8sjXMU3BWzkkgesQhGvPY9TLH');

  it('should serialize RequestRandomness correctly', () => {
    const args = {
      callerSeed: new Uint8Array(32).fill(1),
      callbackProgramId,
      callbackDiscriminator: Buffer.from([0xab, 0xcd]),
      callbackAccountsMetas: [
        {
          pubkey: callbackProgramId.toBuffer(),
          isSigner: true,
          isWritable: false,
        } as unknown as SerializableAccountMeta,
      ],
      callbackArgs: Buffer.from([0x01, 0x02]),
    };
    const data = serializeRequestRandomness(args);

    // 8-byte header + 32 seed + 32 pubkey + borsh vec(2) + borsh vec(1 meta) + borsh vec(2)
    expect(data[0]).toBe(3); // RequestHighPriorityRandomness
    expect(data.length).toBeGreaterThan(8 + 32 + 32);
  });

  it('should build a RequestRandomness instruction with correct programId', () => {
    const ix = buildRequestRandomnessIx(
      {
        callerSeed: new Uint8Array(32).fill(2),
        callbackProgramId,
        callbackDiscriminator: Buffer.from([]),
        callbackAccountsMetas: [],
        callbackArgs: Buffer.from([]),
      },
      {
        payer: callbackProgramId,
        programIdentity: callbackProgramId,
        oracleData: callbackProgramId,
        oracleQueue: queue,
        systemProgram: PublicKey.default,
      }
    );
    expect(ix.programId.equals(programId)).toBe(true);
    expect(ix.keys.length).toBe(5);
    expect(ix.keys[3].pubkey.equals(queue)).toBe(true);
  });

  it('should parse an empty queue header', () => {
    // Discriminator (8) + header (12) = 20 bytes minimum
    const data = Buffer.alloc(20);
    const header = parseQueueHeader(data);
    expect(header.itemCount).toBe(0);
    expect(header.cursor).toBe(0);
    expect(header.index).toBe(0);
  });

  it('should iterate queue items and find by id', () => {
    // Build a minimal queue account:
    // discriminator(8) + header(12, aligned to 16) + item(96) + discriminator payload(2)
    const data = Buffer.alloc(8 + 16 + 96 + 2);

    // Header at offset 8
    data.writeUInt32LE(1, 8); // itemCount = 1
    data.writeUInt32LE(8 + 16 + 96 + 2, 12); // cursor = 122
    data.writeUInt8(0, 16); // index = 0

    // Item at offset 16 (aligned)
    const itemOffset = 16;
    const id = Buffer.alloc(32).fill(0xab);
    id.copy(data, itemOffset + 8); // id at item offset 8
    data.writeUInt32LE(8 + 16 + 96, itemOffset + 72); // callbackDiscriminatorOffset = 120
    data.writeUInt16LE(2, itemOffset + 84); // callbackDiscriminatorLen = 2
    data.writeUInt16LE(0, itemOffset + 86); // metasLen = 0
    data.writeUInt16LE(0, itemOffset + 88); // argsLen = 0
    data.writeUInt8(1, itemOffset + 90); // priorityRequest
    data.writeUInt8(1, itemOffset + 91); // used = 1

    // Payload at offset 112
    data.fill(0xcd, 112, 114);

    const parsedHeader = parseQueueHeader(data);
    expect(parsedHeader.itemCount).toBe(1);

    const items = Array.from(iterateQueueItems(data));
    expect(items.length).toBe(1);
    expect(items[0].used).toBe(1);
    expect(Array.from(items[0].id)).toEqual(Array.from(id));

    const found = findQueueItemById(data, new Uint8Array(id));
    expect(found).toBeDefined();
    expect(found!.used).toBe(1);

    const notFound = findQueueItemById(data, new Uint8Array(32).fill(0x00));
    expect(notFound).toBeUndefined();
  });
});
