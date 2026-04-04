/**
 * ⚠️ DEMO MODE: This adapter simulates cross-chain messaging.
 * Real Wormhole integration is not yet implemented.
 * All transaction hashes and sequence numbers are fake.
 * DO NOT use in production with real user funds.
 */

/**
 * Wormhole Cross-Chain Adapter
 *
 * Integration with Wormhole for cross-chain message passing
 * Wormhole uses a Guardian network to verify messages
 *
 * @module a2a-router/adapters/wormhole-adapter
 */

import type {
  ProtocolAdapter,
  ProtocolSubscription,
  A2AMessage,
  A2AResult,
  AgentInfo,
  AgentFilter,
  ProtocolHealthStatus,
} from '../../../shared/a2a-router-types.js';
import { A2A_ERROR_CODES } from '../constants.js';

const DEMO_MODE = true;

export interface WormholeAdapterOptions {
  /** Agent ID on Solana chain */
  solanaAgentId: string;
  /** Source chain name */
  sourceChain: string;
  /** Source chain ID (Wormhole chain ID) */
  sourceChainId: number;
  /** Solana chain ID (Wormhole) */
  solanaChainId: number;
  /** Agent address on source chain */
  sourceAgentAddress: string;
  /** Wormhole Core Bridge contract */
  coreBridgeAddress: string;
  /** RPC URL for source chain */
  rpcUrl: string;
  /** Guardian RPC URLs */
  guardianRpcs?: string[];
}

export interface WormholeMessage {
  version: '1.0';
  messageType: 'reputation_sync' | 'task_completion' | 'attestation';
  sourceChain: string;
  targetChain: 'solana';
  timestamp: number;
  nonce: number;
  sourceAgentAddress: string;
  solanaAgentAddress: string;
  reputationData: {
    taskCompletions: TaskCompletion[];
    attestations: Attestation[];
    scores: ChainScore[];
  };
  sequence?: bigint;
}

export interface TaskCompletion {
  taskId: string;
  taskType: 'coding' | 'audit' | 'design' | 'analysis';
  completedAt: number;
  score: number;
  reward: string;
  evaluator: string;
  metadata: string;
}

export interface Attestation {
  attestationType: 'skill' | 'reliability' | 'quality';
  attester: string;
  value: number;
  timestamp: number;
  expiresAt: number;
}

export interface ChainScore {
  chain: string;
  value: number;
  weight: number;
  updatedAt: number;
}

export interface VAA {
  version: number;
  guardianSetIndex: number;
  signatures: Signature[];
  timestamp: number;
  nonce: number;
  emitterChain: number;
  emitterAddress: string;
  sequence: bigint;
  consistencyLevel: number;
  payload: string;
  hash: string;
}

export interface Signature {
  guardianIndex: number;
  signature: string;
}

export interface BridgeResult {
  txHash: string;
  messageId: string;
  vaa?: VAA;
  status: 'pending' | 'completed' | 'failed';
  estimatedTime: number;
}

/**
 * Wormhole Adapter for cross-chain reputation sync
 */
export class WormholeAdapter implements ProtocolAdapter {
  readonly protocol = 'wormhole' as const;
  private options: Required<WormholeAdapterOptions>;
  private connected = false;
  private lastActivityAt?: number;
  private messageHandler?: (message: A2AMessage) => void | Promise<void>;
  private pendingMessages = new Map<string, BridgeResult>();
  private vaaCache = new Map<string, VAA>();

  constructor(options: WormholeAdapterOptions) {
    this.options = {
      solanaAgentId: options.solanaAgentId,
      sourceChain: options.sourceChain,
      sourceChainId: options.sourceChainId,
      solanaChainId: options.solanaChainId,
      sourceAgentAddress: options.sourceAgentAddress,
      coreBridgeAddress: options.coreBridgeAddress,
      rpcUrl: options.rpcUrl,
      guardianRpcs: options.guardianRpcs ?? [
        'https://wormhole-v2-mainnet-api.certus.one',
        'https://wormhole.inotel.ro',
        'https://wormhole-v2-mainnet-api.chainlayer.network',
      ],
    };
  }

  // ============ Lifecycle ============

  async initialize(): Promise<void> {
    await this.connectWormhole();
    this.connected = true;
    console.log(`[WormholeAdapter] Initialized on ${this.options.sourceChain}`);
  }

  async shutdown(): Promise<void> {
    this.connected = false;
    console.log('[WormholeAdapter] Shutdown');
  }

  isAvailable(): boolean {
    return this.connected;
  }

  // ============ Messaging ============

  async send(message: A2AMessage): Promise<A2AResult> {
    if (DEMO_MODE) {
      console.warn('[DEMO MODE] This is a simulated cross-chain transaction. No real assets are transferred.');
    }

    if (!this.isAvailable()) {
      return {
        success: false,
        messageId: message.id,
        protocol: 'wormhole',
        error: '[DEMO] Wormhole adapter not connected',
        errorCode: A2A_ERROR_CODES.PROTOCOL_NOT_AVAILABLE,
        timestamp: Date.now(),
        metadata: { demo: true },
      };
    }

    try {
      const wormholeMessage = this.convertToWormholeMessage(message);
      const result = await this.sendViaWormhole(wormholeMessage);

      this.pendingMessages.set(result.messageId, result);
      this.lastActivityAt = Date.now();

      return {
        success: true,
        messageId: message.id,
        protocol: 'wormhole',
        timestamp: Date.now(),
        metadata: { demo: true },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        messageId: message.id,
        protocol: 'wormhole',
        error: `[DEMO] ${err.message}`,
        errorCode: A2A_ERROR_CODES.PROTOCOL_SEND_FAILED,
        timestamp: Date.now(),
        metadata: { demo: true },
      };
    }
  }

  async subscribe(
    handler: (message: A2AMessage) => void | Promise<void>
  ): Promise<ProtocolSubscription> {
    this.messageHandler = handler;
    this.startListening();

    return {
      protocol: 'wormhole',
      unsubscribe: async () => {
        this.messageHandler = undefined;
      },
    };
  }

  // ============ Discovery ============

  async discoverAgents(_filter?: AgentFilter): Promise<AgentInfo[]> {
    return [];
  }

  async broadcastCapabilities(agentInfo: AgentInfo): Promise<void> {
    const message: WormholeMessage = {
      version: '1.0',
      messageType: 'attestation',
      sourceChain: this.options.sourceChain,
      targetChain: 'solana',
      timestamp: Date.now(),
      nonce: this.generateNonce(),
      sourceAgentAddress: this.options.sourceAgentAddress,
      solanaAgentAddress: this.options.solanaAgentId,
      reputationData: {
        taskCompletions: [],
        attestations: [
          {
            attestationType: 'skill',
            attester: 'self',
            value: agentInfo.reputationScore * 100,
            timestamp: Date.now(),
            expiresAt: Date.now() + 86400000 * 30,
          },
        ],
        scores: [
          {
            chain: this.options.sourceChain,
            value: agentInfo.reputationScore * 100,
            weight: 1,
            updatedAt: Date.now(),
          },
        ],
      },
    };

    await this.sendViaWormhole(message);
  }

  // ============ Health ============

  health(): ProtocolHealthStatus {
    return {
      available: this.isAvailable(),
      peerCount: this.pendingMessages.size,
      subscribedTopics: this.isAvailable() ? ['wormhole-messages'] : [],
      lastActivityAt: this.lastActivityAt,
    };
  }

  // ============ Wormhole Specific Methods ============

  /**
   * Sync reputation data to Solana via Wormhole
   */
  async syncReputation(
    reputationData: WormholeMessage['reputationData']
  ): Promise<BridgeResult> {
    const message: WormholeMessage = {
      version: '1.0',
      messageType: 'reputation_sync',
      sourceChain: this.options.sourceChain,
      targetChain: 'solana',
      timestamp: Date.now(),
      nonce: this.generateNonce(),
      sourceAgentAddress: this.options.sourceAgentAddress,
      solanaAgentAddress: this.options.solanaAgentId,
      reputationData,
    };

    return this.sendViaWormhole(message);
  }

  /**
   * Fetch VAA from Guardian network
   */
  async fetchVAA(
    emitterChain: number,
    emitterAddress: string,
    sequence: bigint
  ): Promise<VAA | null> {
    for (const guardianRpc of this.options.guardianRpcs) {
      try {
        const response = await fetch(
          `${guardianRpc}/v1/signed_vaa/${emitterChain}/${emitterAddress}/${sequence}`
        );

        if (response.ok) {
          const data = await response.json();
          const vaa = this.parseVAA(data.vaaBytes);
          this.vaaCache.set(vaa.hash, vaa);
          return vaa;
        }
      } catch (error) {
        console.warn(`[WormholeAdapter] Guardian ${guardianRpc} failed:`, error);
        continue;
      }
    }

    return null;
  }

  /**
   * Redeem VAA on Solana
   */
  async redeemOnSolana(vaa: VAA): Promise<{ txHash: string }> {
    // In production, this would call the Wormhole Token Bridge or custom contract
    console.log(`[WormholeAdapter] Redeeming VAA on Solana: ${vaa.hash}`);

    // Simulate transaction
    const txHash = `sol-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return { txHash };
  }

  /**
   * Check message status and fetch VAA if available
   */
  async checkMessageStatus(messageId: string): Promise<BridgeResult | null> {
    const result = this.pendingMessages.get(messageId);
    if (!result) return null;

    // If pending, try to fetch VAA
    if (result.status === 'pending' && result.vaa) {
      const vaa = await this.fetchVAA(
        this.options.sourceChainId,
        this.options.sourceAgentAddress,
        result.vaa.sequence
      );

      if (vaa) {
        result.status = 'completed';
        result.vaa = vaa;
      }
    }

    return result;
  }

  // ============ Private Methods ============

  private async connectWormhole(): Promise<void> {
    console.log(`[WormholeAdapter] Connecting to Wormhole...`);
    console.log(`[WormholeAdapter] Core Bridge: ${this.options.coreBridgeAddress}`);

    // Test connection to guardians
    for (const guardianRpc of this.options.guardianRpcs) {
      try {
        const response = await fetch(`${guardianRpc}/v1/guardianset/current`);
        if (response.ok) {
          console.log(`[WormholeAdapter] Connected to guardian: ${guardianRpc}`);
        }
      } catch {
        console.warn(`[WormholeAdapter] Guardian unavailable: ${guardianRpc}`);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async sendViaWormhole(message: WormholeMessage): Promise<BridgeResult> {
    // Encode message
    const payload = this.encodeMessage(message);

    // Publish message to Wormhole Core Bridge
    console.log(`[WormholeAdapter] Publishing message to Wormhole`);
    console.log(`[WormholeAdapter] Source chain: ${this.options.sourceChain} (${this.options.sourceChainId})`);
    console.log(`[WormholeAdapter] Target chain: solana (${this.options.solanaChainId})`);
    console.log(`[WormholeAdapter] Payload size: ${payload.length} bytes`);

    // Simulate transaction
    const txHash = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;

    const sequence = BigInt(Date.now());
    const messageId = `wh-${this.options.sourceChain}-${sequence}`;

    // Create pending result
    const result: BridgeResult = {
      txHash,
      messageId,
      status: 'pending',
      estimatedTime: 900, // 15 minutes for Wormhole finality
      vaa: {
        version: 1,
        guardianSetIndex: 0,
        signatures: [],
        timestamp: Math.floor(Date.now() / 1000),
        nonce: message.nonce,
        emitterChain: this.options.sourceChainId,
        emitterAddress: this.options.sourceAgentAddress,
        sequence,
        consistencyLevel: 15,
        payload,
        hash: `vaa-${sequence}`,
      },
    };

    this.pendingMessages.set(messageId, result);

    // Simulate async VAA generation
    setTimeout(async () => {
      const vaa = await this.simulateVAAGeneration(result.vaa!);
      const stored = this.pendingMessages.get(messageId);
      if (stored) {
        stored.status = 'completed';
        stored.vaa = vaa;
        console.log(`[WormholeAdapter] VAA generated for message ${messageId}`);
      }
    }, 10000);

    return result;
  }

  private async simulateVAAGeneration(partialVaa: VAA): Promise<VAA> {
    // Simulate guardian signatures
    const signatures: Signature[] = [];
    for (let i = 0; i < 13; i++) {
      signatures.push({
        guardianIndex: i,
        signature: `sig-${i}-${Date.now()}`,
      });
    }

    return {
      ...partialVaa,
      signatures,
      guardianSetIndex: 3,
    };
  }

  private parseVAA(vaaBytes: string): VAA {
    // In production, use wormhole-sdk to parse VAA
    // For now, return mock
    return {
      version: 1,
      guardianSetIndex: 3,
      signatures: [],
      timestamp: Math.floor(Date.now() / 1000),
      nonce: 0,
      emitterChain: this.options.sourceChainId,
      emitterAddress: this.options.sourceAgentAddress,
      sequence: BigInt(0),
      consistencyLevel: 15,
      payload: vaaBytes,
      hash: `vaa-${Date.now()}`,
    };
  }

  private encodeMessage(message: WormholeMessage): string {
    // In production, use proper serialization
    return JSON.stringify(message);
  }

  private convertToWormholeMessage(message: A2AMessage): WormholeMessage {
    return {
      version: '1.0',
      messageType: 'task_completion',
      sourceChain: this.options.sourceChain,
      targetChain: 'solana',
      timestamp: message.timestamp,
      nonce: this.generateNonce(),
      sourceAgentAddress: this.options.sourceAgentAddress,
      solanaAgentAddress: this.options.solanaAgentId,
      reputationData: {
        taskCompletions: [
          {
            taskId: message.id,
            taskType: 'coding',
            completedAt: message.timestamp,
            score: 80,
            reward: '0',
            evaluator: message.to,
            metadata: JSON.stringify(message.payload),
          },
        ],
        attestations: [],
        scores: [],
      },
    };
  }

  private generateNonce(): number {
    return Math.floor(Math.random() * 1000000);
  }

  private startListening(): void {
    console.log('[WormholeAdapter] Started listening for VAAs');
  }
}

export default WormholeAdapter;
