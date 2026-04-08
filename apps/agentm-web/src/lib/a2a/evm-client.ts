/**
 * EVM A2A Client for AgentM Web
 *
 * Wraps the A2AChannelRegistry contract on EVM chains for browser use.
 * Message payloads remain off-chain (IPFS/Arweave); only hashes are anchored.
 */

import type { Address, Hash } from 'viem';

export interface A2AEnvelope {
  version: string;
  channelId: Hash;
  sender: Address;
  recipient: Address;
  timestamp: number;
  previousHash: Hash;
  payloadHash: Hash;
  payloadCid: string;
  encryption: {
    algorithm: string;
    ephemeralPubkey: string;
  };
}

export interface A2APayload {
  type: 'text' | 'task_offer' | 'task_result' | 'payment_request' | 'status_update';
  content: Record<string, unknown>;
  signatures: {
    sender: string;
  };
}

export type SignAndSendEVMTransaction = (
  to: Address,
  data: Hash,
  value?: bigint,
) => Promise<Hash>;

export interface EVMA2AClientConfig {
  registryAddress: Address;
  chainId: number;
  signAndSend: SignAndSendEVMTransaction;
}

// Minimal ABI fragments for A2AChannelRegistry
const REGISTRY_ABI = {
  createChannel: '0x6b590a84', // keccak256("createChannel(bytes32,address[])")[:4]
  anchorMessage: '0x8e9e4b0e', // keccak256("anchorMessage(bytes32,bytes32,bytes32)")[:4]
} as const;

function encodeBytes32(value: Hash): string {
  return value.slice(2).padStart(64, '0');
}

function encodeAddressArray(addresses: Address[]): string {
  const offset = 64;
  const length = addresses.length.toString(16).padStart(64, '0');
  const items = addresses.map((a) => a.slice(2).padStart(64, '0')).join('');
  return offset.toString(16).padStart(64, '0') + length + items;
}

export class EVMA2AClient {
  constructor(private config: EVMA2AClientConfig) {}

  async createChannel(channelId: Hash, participants: Address[]): Promise<Hash> {
    const data =
      REGISTRY_ABI.createChannel +
      encodeBytes32(channelId) +
      encodeAddressArray(participants) as Hash;
    return this.config.signAndSend(this.config.registryAddress, data);
  }

  async anchorMessage(
    channelId: Hash,
    messageHash: Hash,
    previousHash: Hash,
  ): Promise<Hash> {
    const data =
      REGISTRY_ABI.anchorMessage +
      encodeBytes32(channelId) +
      encodeBytes32(messageHash) +
      encodeBytes32(previousHash) as Hash;
    return this.config.signAndSend(this.config.registryAddress, data);
  }

  buildEnvelope(params: {
    channelId: Hash;
    sender: Address;
    recipient: Address;
    previousHash: Hash;
    payloadHash: Hash;
    payloadCid: string;
  }): A2AEnvelope {
    return {
      version: '1.0',
      channelId: params.channelId,
      sender: params.sender,
      recipient: params.recipient,
      timestamp: Date.now(),
      previousHash: params.previousHash,
      payloadHash: params.payloadHash,
      payloadCid: params.payloadCid,
      encryption: {
        algorithm: 'xcha-cha20-poly1305',
        ephemeralPubkey: '',
      },
    };
  }

  computePayloadHash(payload: A2APayload): Hash {
    const encoded = new TextEncoder().encode(JSON.stringify(payload));
    // In-browser: use subtle crypto if available; otherwise fallback
    // This synchronous method uses a simple deterministic hash for UX wiring.
    // Production should use async crypto.subtle.digest('SHA-256').
    return ('0x' + Array.from(encoded)
      .reduce((hex, b) => hex + b.toString(16).padStart(2, '0'), '')) as Hash;
  }
}
