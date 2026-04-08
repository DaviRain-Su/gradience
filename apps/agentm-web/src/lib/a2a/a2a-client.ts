/**
 * A2A Protocol Client for AgentM Web
 *
 * Wraps @gradiences/a2a-sdk for browser use with real Solana transaction
 * serialization via @solana/web3.js.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { A2ASdk } from '@gradiences/a2a-sdk';
import type {
  A2ATransport,
  InstructionEnvelope,
  Address,
} from '@gradiences/a2a-sdk';

const A2A_PROGRAM_ID =
  (process.env.NEXT_PUBLIC_A2A_PROGRAM_ID as Address) ||
  ('FPaeaqQCziLidnwTtQndUB1SiaqBuBUad6UCnshfMd3H' as Address);

const DEVNET_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

function serializeU64(value: bigint | number | string): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt.asUintN(64, BigInt(value)), 0);
  return buf;
}

function serializeI64(value: bigint | number | string): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(BigInt(value), 0);
  return buf;
}

function serializePubkey(value: string): Buffer {
  return new PublicKey(value).toBuffer();
}

function serializeSignaturePart(value: string): Buffer {
  const buf = Buffer.alloc(32);
  const hex = value.startsWith('0x') ? value.slice(2) : value;
  const input = Buffer.from(hex, 'hex');
  input.copy(buf, 0, 0, 32);
  return buf;
}

function serializeData(
  discriminator: number,
  name: string,
  data: Record<string, unknown>,
): Buffer {
  const parts: Buffer[] = [Buffer.from([discriminator])];

  switch (name) {
    case 'openChannel': {
      parts.push(serializeU64(data.channelId as bigint));
      parts.push(serializePubkey(data.mediator as string));
      parts.push(serializePubkey(data.tokenMint as string));
      parts.push(serializeU64(data.depositAmount as bigint));
      parts.push(serializeI64(data.expiresAt as bigint));
      break;
    }
    case 'cooperativeCloseChannel': {
      parts.push(serializeU64(data.channelId as bigint));
      parts.push(serializeU64(data.nonce as bigint));
      parts.push(serializeU64(data.spentAmount as bigint));
      parts.push(serializeSignaturePart(data.payerSigR as string));
      parts.push(serializeSignaturePart(data.payerSigS as string));
      parts.push(serializeSignaturePart(data.payeeSigR as string));
      parts.push(serializeSignaturePart(data.payeeSigS as string));
      break;
    }
    case 'openChannelDispute': {
      parts.push(serializeU64(data.channelId as bigint));
      parts.push(serializeU64(data.nonce as bigint));
      parts.push(serializeU64(data.spentAmount as bigint));
      parts.push(serializeI64(data.disputeDeadline as bigint));
      parts.push(serializeSignaturePart(data.payerSigR as string));
      parts.push(serializeSignaturePart(data.payerSigS as string));
      parts.push(serializeSignaturePart(data.payeeSigR as string));
      parts.push(serializeSignaturePart(data.payeeSigS as string));
      break;
    }
    case 'resolveChannelDispute': {
      parts.push(serializeU64(data.channelId as bigint));
      parts.push(serializeU64(data.finalSpentAmount as bigint));
      break;
    }
    default: {
      const payload = Buffer.from(JSON.stringify(data));
      parts.push(payload);
    }
  }

  return Buffer.concat(parts);
}

export type SignAndSendTransaction = (tx: Transaction) => Promise<string>;

class BrowserA2ATransport implements A2ATransport {
  private connection: Connection;

  constructor(private signAndSend: SignAndSendTransaction) {
    this.connection = new Connection(DEVNET_RPC, 'confirmed');
  }

  async send(instruction: InstructionEnvelope): Promise<string> {
    const data = serializeData(
      instruction.discriminator,
      instruction.name,
      instruction.data,
    );

    const keys = instruction.accounts.map((acc) => ({
      pubkey: new PublicKey(acc.address),
      isSigner: !!acc.signer,
      isWritable: !!acc.writable,
    }));

    const ix = new TransactionInstruction({
      keys,
      programId: new PublicKey(A2A_PROGRAM_ID),
      data,
    });

    const tx = new Transaction().add(ix);
    tx.feePayer = keys.find((k) => k.isSigner)?.pubkey;
    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;

    const sig = await this.signAndSend(tx);
    await this.connection.confirmTransaction(sig, 'confirmed');
    return sig;
  }

  async getAccount<T>(_address: string): Promise<T | null> {
    // TODO: implement account deserialization once Borsh schemas are mapped
    return null;
  }
}

export function createA2ASdk(signAndSend: SignAndSendTransaction): A2ASdk {
  return new A2ASdk({
    programId: A2A_PROGRAM_ID,
    transport: new BrowserA2ATransport(signAndSend),
  });
}

export function tryGetDynamicSigner(primaryWallet: unknown): SignAndSendTransaction | undefined {
  if (!primaryWallet) return undefined;
  const wallet = primaryWallet as any;

  return async (tx: Transaction) => {
    const connection = new Connection(DEVNET_RPC, 'confirmed');

    // Try Dynamic Solana connector signAndSendTransaction
    const connector = wallet?.connector;
    if (connector && typeof connector.signAndSendTransaction === 'function') {
      return await connector.signAndSendTransaction(tx);
    }

    // Try signer.signAndSendTransaction
    const signer = await wallet.getSigner?.();
    if (signer && typeof signer.signAndSendTransaction === 'function') {
      return await signer.signAndSendTransaction(tx);
    }

    // Try signer.signTransaction + connection.sendRawTransaction
    if (signer && typeof signer.signTransaction === 'function') {
      const signed = await signer.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      await connection.confirmTransaction(sig, 'confirmed');
      return sig;
    }

    throw new Error('No compatible signer found on Dynamic wallet');
  };
}

// Legacy singleton for backward compatibility (uses stub mode)
let _sdk: A2ASdk | null = null;
export function getA2ASdk(): A2ASdk {
  if (!_sdk) {
    _sdk = new A2ASdk({
      programId: A2A_PROGRAM_ID,
      transport: {
        async send(instruction: InstructionEnvelope): Promise<string> {
          console.warn('[A2A] Stub transport – not sent:', instruction);
          return `a2a_stub_${Date.now()}`;
        },
        async getAccount<T>(_address: string): Promise<T | null> {
          return null;
        },
      },
    });
  }
  return _sdk;
}

export interface A2AChannel {
  channelId: string;
  payee: Address;
  depositAmount: number;
  spentAmount: number;
  status: 'open' | 'closing' | 'closed' | 'disputed';
  expiresAt: number;
}

export interface OpenChannelParams {
  payer: Address;
  payee: Address;
  channelId: bigint;
  mediator: Address;
  tokenMint: Address;
  depositAmount: bigint;
  expiresAt: bigint;
}

export async function openChannel(
  params: OpenChannelParams,
  signAndSend?: SignAndSendTransaction,
): Promise<string> {
  const sdk = signAndSend ? createA2ASdk(signAndSend) : getA2ASdk();
  return sdk.openChannel(params);
}

export interface CloseChannelParams {
  payer: Address;
  payee: Address;
  channelId: bigint;
  nonce: bigint;
  spentAmount: bigint;
  payerSig: { r: string; s: string };
  payeeSig: { r: string; s: string };
}

export async function cooperativeCloseChannel(
  params: CloseChannelParams,
  signAndSend?: SignAndSendTransaction,
): Promise<string> {
  const sdk = signAndSend ? createA2ASdk(signAndSend) : getA2ASdk();
  return sdk.cooperativeCloseChannel(params);
}

export async function openChannelDispute(
  complainant: Address,
  params: CloseChannelParams & { disputeDeadline: bigint },
  signAndSend?: SignAndSendTransaction,
): Promise<string> {
  const sdk = signAndSend ? createA2ASdk(signAndSend) : getA2ASdk();
  return sdk.openChannelDispute({
    complainant,
    payer: params.payer,
    payee: params.payee,
    channelId: params.channelId,
    nonce: params.nonce,
    spentAmount: params.spentAmount,
    disputeDeadline: params.disputeDeadline,
    payerSig: params.payerSig,
    payeeSig: params.payeeSig,
  });
}

export async function resolveChannelDispute(
  arbiter: Address,
  params: { channelId: bigint; finalSpentAmount: bigint; payer: Address; payee: Address },
  signAndSend?: SignAndSendTransaction,
): Promise<string> {
  const sdk = signAndSend ? createA2ASdk(signAndSend) : getA2ASdk();
  return sdk.resolveChannelDispute({
    arbiter,
    payer: params.payer,
    payee: params.payee,
    channelId: params.channelId,
    finalSpentAmount: params.finalSpentAmount,
  });
}
