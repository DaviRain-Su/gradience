/**
 * Native MagicBlock VRF Client
 *
 * Manually constructs Solana instructions for the MagicBlock ephemeral-vrf
 * program because @magicblock-labs/vrf-sdk does not exist on npm.
 *
 * Program ID : Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz
 * Default queue: 5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc
 *
 * Layout matches ephemeral-vrf Rust sources (api/src/instruction.rs).
 */

import {
  Connection,
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';

export const MAGICBLOCK_VRF_PROGRAM_ID = new PublicKey(
  'Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz',
);

export const DEFAULT_EPHEMERAL_QUEUE = new PublicKey(
  '5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc',
);

/** Build the 8-byte instruction header for RequestRandomness. */
function buildRequestRandomnessHeader(): Buffer {
  // EphemeralVrfInstruction::RequestHighPriorityRandomness = 3,
  // followed by 7 zero bytes.
  return Buffer.from([3, 0, 0, 0, 0, 0, 0, 0]);
}

/** Borsh-serializable account meta matching Rust SerializableAccountMeta. */
export interface SerializableAccountMeta {
  pubkey: Uint8Array; // 32 bytes
  isSigner: boolean;
  isWritable: boolean;
}

/** Borsh-serialized RequestRandomness args. */
export interface RequestRandomnessArgs {
  callerSeed: Uint8Array; // 32 bytes
  callbackProgramId: PublicKey;
  callbackDiscriminator: Uint8Array;
  callbackAccountsMetas: SerializableAccountMeta[];
  callbackArgs: Uint8Array;
}

function writeU32LE(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value, 0);
  return buf;
}

function borshSerializeU8Vec(data: Uint8Array): Buffer {
  return Buffer.concat([writeU32LE(data.length), Buffer.from(data)]);
}

function borshSerializeAccountMetas(
  metas: SerializableAccountMeta[],
): Buffer {
  const parts: Buffer[] = [writeU32LE(metas.length)];
  for (const m of metas) {
    if (m.pubkey.length !== 32) {
      throw new Error('SerializableAccountMeta.pubkey must be 32 bytes');
    }
    parts.push(Buffer.from(m.pubkey));
    parts.push(Buffer.from([m.isSigner ? 1 : 0]));
    parts.push(Buffer.from([m.isWritable ? 1 : 0]));
  }
  return Buffer.concat(parts);
}

export function serializeRequestRandomness(args: RequestRandomnessArgs): Buffer {
  if (args.callerSeed.length !== 32) {
    throw new Error('callerSeed must be 32 bytes');
  }
  const header = buildRequestRandomnessHeader();
  const body = Buffer.concat([
    Buffer.from(args.callerSeed),
    args.callbackProgramId.toBuffer(),
    borshSerializeU8Vec(args.callbackDiscriminator),
    borshSerializeAccountMetas(args.callbackAccountsMetas),
    borshSerializeU8Vec(args.callbackArgs),
  ]);
  return Buffer.concat([header, body]);
}

export function buildRequestRandomnessIx(
  args: RequestRandomnessArgs,
  accounts: {
    payer: PublicKey;
    programIdentity: PublicKey;
    oracleData: PublicKey;
    oracleQueue: PublicKey;
    systemProgram?: PublicKey;
  },
): TransactionInstruction {
  const data = serializeRequestRandomness(args);
  const keys = [
    { pubkey: accounts.payer, isSigner: true, isWritable: true },
    { pubkey: accounts.programIdentity, isSigner: false, isWritable: false },
    { pubkey: accounts.oracleData, isSigner: false, isWritable: false },
    { pubkey: accounts.oracleQueue, isSigner: false, isWritable: true },
  ];
  if (accounts.systemProgram) {
    keys.push({
      pubkey: accounts.systemProgram,
      isSigner: false,
      isWritable: false,
    });
  }
  return new TransactionInstruction({
    keys,
    programId: MAGICBLOCK_VRF_PROGRAM_ID,
    data,
  });
}

/** Header of a VRF queue account (after 8-byte discriminator). */
export interface QueueHeader {
  itemCount: number;
  cursor: number;
  index: number;
}

/** Single item in the queue variable region. */
export interface QueueItem {
  slot: bigint;
  id: Uint8Array; // 32 bytes
  callbackProgramId: Uint8Array; // 32 bytes
  callbackDiscriminatorOffset: number;
  metasOffset: number;
  argsOffset: number;
  callbackDiscriminatorLen: number;
  metasLen: number;
  argsLen: number;
  priorityRequest: number;
  used: number;
}

/** Parse the queue header from raw account data (includes 8-byte disc). */
export function parseQueueHeader(data: Buffer): QueueHeader {
  if (data.length < 8 + 12) {
    throw new Error('Queue data too small for header');
  }
  const view = new DataView(data.buffer, data.byteOffset + 8);
  return {
    itemCount: view.getUint32(0, true),
    cursor: view.getUint32(4, true),
    index: view.getUint8(8),
  };
}

const QUEUE_ITEM_SIZE = 8 + 32 + 32 + 4 + 4 + 4 + 2 + 2 + 2 + 1 + 1 + 4; // 96 bytes

function readQueueItem(data: Buffer, offset: number): QueueItem {
  const view = new DataView(data.buffer, data.byteOffset + offset);
  return {
    slot: view.getBigUint64(0, true),
    id: new Uint8Array(data.buffer, data.byteOffset + offset + 8, 32),
    callbackProgramId: new Uint8Array(
      data.buffer,
      data.byteOffset + offset + 40,
      32,
    ),
    callbackDiscriminatorOffset: view.getUint32(72, true),
    metasOffset: view.getUint32(76, true),
    argsOffset: view.getUint32(80, true),
    callbackDiscriminatorLen: view.getUint16(84, true),
    metasLen: view.getUint16(86, true),
    argsLen: view.getUint16(88, true),
    priorityRequest: view.getUint8(90),
    used: view.getUint8(91),
  };
}

function alignUp(x: number, align: number): number {
  return (x + align - 1) & ~(align - 1);
}

/** Iterate all used queue items. */
export function* iterateQueueItems(
  data: Buffer,
): Generator<QueueItem, void, unknown> {
  const header = parseQueueHeader(data);
  // Rust align_of::<QueueItem>() = 8 because of the u64 slot field.
  const itemAlign = 8;
  const itemsStart = alignUp(12, itemAlign); // 16
  let cursor = itemsStart;
  const end = Math.min(data.length, header.cursor);

  while (cursor + QUEUE_ITEM_SIZE <= end) {
    const item = readQueueItem(data, cursor);
    if (item.used === 1) {
      yield item;
    }
    const metasBytes = item.metasLen * 33; // CompactAccountMeta = 32 + 1
    const itemEnd =
      cursor +
      QUEUE_ITEM_SIZE +
      item.callbackDiscriminatorLen +
      metasBytes +
      item.argsLen;
    const next = alignUp(itemEnd, itemAlign);
    if (next <= cursor) break;
    cursor = next;
  }
}

/** Find a queue item by its 32-byte id (caller_seed). */
export function findQueueItemById(
  data: Buffer,
  id: Uint8Array,
): QueueItem | undefined {
  for (const item of iterateQueueItems(data)) {
    if (bufferEquals(item.id, id)) {
      return item;
    }
  }
  return undefined;
}

function bufferEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export class MagicBlockVRFClient {
  constructor(private connection: Connection) {}

  async getQueueAccountData(queue = DEFAULT_EPHEMERAL_QUEUE): Promise<Buffer> {
    const account = await this.connection.getAccountInfo(queue, 'confirmed');
    if (!account) {
      throw new Error('Queue account not found');
    }
    return Buffer.from(account.data);
  }

  /**
   * Check whether a request with the given seed is still pending in the queue.
   * Returns `true` if pending, `false` if the request has been fulfilled (or
   * never existed).
   */
  async isRequestPending(seed: Uint8Array, queue = DEFAULT_EPHEMERAL_QUEUE): Promise<boolean> {
    const data = await this.getQueueAccountData(queue);
    const item = findQueueItemById(data, seed);
    return item !== undefined && item.used === 1;
  }
}
