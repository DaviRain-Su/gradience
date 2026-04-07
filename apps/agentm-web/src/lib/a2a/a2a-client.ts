/**
 * A2A Protocol Client for AgentM Web
 *
 * Wraps @gradiences/a2a-sdk for browser use.
 * NOTE: Transport serialization is currently a stub because the on-chain
 * program serialization layout is not yet exposed for the browser bundle.
 * This wrapper captures the intent and logs the InstructionEnvelope for
 * debugging until the full transport is implemented.
 */

import { A2ASdk } from '@gradiences/a2a-sdk';
import type {
  A2ATransport,
  InstructionEnvelope,
  Address,
} from '@gradiences/a2a-sdk';

const A2A_PROGRAM_ID =
  (process.env.NEXT_PUBLIC_A2A_PROGRAM_ID as Address) ||
  ('FPaeaqQCziLidnwTtQndUB1SiaqBuBUad6UCnshfMd3H' as Address);

class BrowserA2ATransport implements A2ATransport {
  async send(instruction: InstructionEnvelope): Promise<string> {
    // eslint-disable-next-line no-console
    console.warn('[A2A] Transport stub – instruction not sent on-chain:', instruction);
    // Return a deterministic fake signature so the UI can simulate success.
    return `a2a_stub_${Date.now()}`;
  }

  async getAccount<T>(_address: string): Promise<T | null> {
    return null;
  }
}

let _sdk: A2ASdk | null = null;

export function getA2ASdk(): A2ASdk {
  if (!_sdk) {
    _sdk = new A2ASdk({
      programId: A2A_PROGRAM_ID,
      transport: new BrowserA2ATransport(),
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

export async function openChannel(params: OpenChannelParams): Promise<string> {
  const sdk = getA2ASdk();
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
): Promise<string> {
  const sdk = getA2ASdk();
  return sdk.cooperativeCloseChannel(params);
}

export async function openChannelDispute(
  complainant: Address,
  params: CloseChannelParams & { disputeDeadline: bigint },
): Promise<string> {
  const sdk = getA2ASdk();
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
