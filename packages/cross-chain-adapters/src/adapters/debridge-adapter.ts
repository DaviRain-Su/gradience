/**
 * Debridge Cross-Chain Adapter
 * 
 * @module cross-chain-adapters/adapters/debridge
 */

import type {
  ProtocolAdapter,
  ProtocolSubscription,
  A2AMessage,
  A2AResult,
  AgentInfo,
  AgentFilter,
  ProtocolHealthStatus,
  ReputationData,
  TaskCompletion,
  Attestation,
  ChainScore,
  BridgeResult,
  SubmissionStatus,
} from '../types/index.js';
import { CROSS_CHAIN_ERROR_CODES } from '../types/index.js';

const DEMO_MODE = true;

export interface DebridgeAdapterOptions {
  solanaAgentId: string;
  sourceChain: string;
  sourceChainId: number;
  solanaChainId: number;
  sourceAgentAddress: string;
  gateAddress: string;
  dlnAddress?: string;
  rpcUrl: string;
  apiKey?: string;
}

export interface DebridgeMessage {
  version: '1.0';
  messageType: 'reputation_sync' | 'task_completion' | 'attestation';
  sourceChain: string;
  targetChain: 'solana';
  timestamp: number;
  nonce: number;
  sourceAgentAddress: string;
  solanaAgentAddress: string;
  reputationData: ReputationData;
  submissionId?: string;
}

export class DebridgeAdapter implements ProtocolAdapter {
  readonly protocol = 'debridge' as const;
  private options: Required<DebridgeAdapterOptions>;
  private connected = false;
  private lastActivityAt?: number;
  private messageHandler?: (message: A2AMessage) => void | Promise<void>;
  private pendingMessages = new Map<string, BridgeResult>();

  constructor(options: DebridgeAdapterOptions) {
    this.options = {
      solanaAgentId: options.solanaAgentId,
      sourceChain: options.sourceChain,
      sourceChainId: options.sourceChainId,
      solanaChainId: options.solanaChainId,
      sourceAgentAddress: options.sourceAgentAddress,
      gateAddress: options.gateAddress,
      dlnAddress: options.dlnAddress ?? '',
      rpcUrl: options.rpcUrl,
      apiKey: options.apiKey ?? '',
    };
  }

  async initialize(): Promise<void> {
    await this.connectDebridge();
    this.connected = true;
    console.log(`[DebridgeAdapter] Initialized on ${this.options.sourceChain}`);
  }

  async shutdown(): Promise<void> {
    this.connected = false;
    console.log('[DebridgeAdapter] Shutdown');
  }

  isAvailable(): boolean {
    return this.connected;
  }

  async send(message: A2AMessage): Promise<A2AResult> {
    if (DEMO_MODE) {
      console.warn('[DEMO MODE] Simulated cross-chain transaction');
    }

    if (!this.isAvailable()) {
      return {
        success: false,
        messageId: message.id,
        protocol: 'debridge',
        error: '[DEMO] Debridge adapter not connected',
        errorCode: CROSS_CHAIN_ERROR_CODES.PROTOCOL_NOT_AVAILABLE,
        timestamp: Date.now(),
        metadata: { demo: true },
      };
    }

    try {
      const debridgeMessage = this.convertToDebridgeMessage(message);
      const result = await this.sendViaDebridge(debridgeMessage);

      this.pendingMessages.set(result.messageId, result);
      this.lastActivityAt = Date.now();

      return {
        success: true,
        messageId: message.id,
        protocol: 'debridge',
        timestamp: Date.now(),
        metadata: { demo: true },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        messageId: message.id,
        protocol: 'debridge',
        error: `[DEMO] ${err.message}`,
        errorCode: CROSS_CHAIN_ERROR_CODES.PROTOCOL_SEND_FAILED,
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
      protocol: 'debridge',
      unsubscribe: async () => {
        this.messageHandler = undefined;
      },
    };
  }

  async discoverAgents(_filter?: AgentFilter): Promise<AgentInfo[]> {
    return [];
  }

  async broadcastCapabilities(agentInfo: AgentInfo): Promise<void> {
    const message: DebridgeMessage = {
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

    await this.sendViaDebridge(message);
  }

  health(): ProtocolHealthStatus {
    return {
      available: this.isAvailable(),
      peerCount: this.pendingMessages.size,
      subscribedTopics: this.isAvailable() ? ['debridge-messages'] : [],
      lastActivityAt: this.lastActivityAt,
    };
  }

  async syncReputation(reputationData: ReputationData): Promise<BridgeResult> {
    const message: DebridgeMessage = {
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

    return this.sendViaDebridge(message);
  }

  async checkSubmissionStatus(submissionId: string): Promise<SubmissionStatus | null> {
    try {
      const response = await fetch(
        `https://api.debridge.finance/api/Submission/${submissionId}`,
        {
          headers: this.options.apiKey ? { 'X-API-Key': this.options.apiKey } : {},
        }
      );

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('[DebridgeAdapter] Failed to check submission:', error);
      return null;
    }
  }

  async checkMessageStatus(messageId: string): Promise<BridgeResult | null> {
    const result = this.pendingMessages.get(messageId);
    if (!result) return null;

    if (result.submissionId) {
      const status = await this.checkSubmissionStatus(result.submissionId);
      if (status) {
        if (status.status === 'executed') {
          result.status = 'completed';
        } else if (status.status === 'cancelled') {
          result.status = 'failed';
        }
      }
    }

    return result;
  }

  async estimateFees(payload: string): Promise<{
    fixedFee: bigint;
    executionFee: bigint;
    totalFee: bigint;
  }> {
    const baseFee = 0.0005;
    const executionFee = 0.001;
    const perByteFee = 0.000001;

    const dataFee = payload.length * perByteFee;
    const totalEth = baseFee + executionFee + dataFee;

    return {
      fixedFee: BigInt(Math.floor(baseFee * 1e18)),
      executionFee: BigInt(Math.floor((executionFee + dataFee) * 1e18)),
      totalFee: BigInt(Math.floor(totalEth * 1e18)),
    };
  }

  private async connectDebridge(): Promise<void> {
    console.log(`[DebridgeAdapter] Connecting to Debridge...`);
    console.log(`[DebridgeAdapter] Gate: ${this.options.gateAddress}`);

    if (this.options.apiKey) {
      try {
        const response = await fetch('https://api.debridge.finance/api/Chain', {
          headers: { 'X-API-Key': this.options.apiKey },
        });
        if (response.ok) {
          console.log('[DebridgeAdapter] API connection successful');
        }
      } catch {
        console.warn('[DebridgeAdapter] API connection failed, using fallback');
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async sendViaDebridge(message: DebridgeMessage): Promise<BridgeResult> {
    const payload = this.encodeMessage(message);
    const fees = await this.estimateFees(payload);

    console.log(`[DebridgeAdapter] Sending message via Debridge`);
    console.log(`[DebridgeAdapter] Source: ${this.options.sourceChain} (${this.options.sourceChainId})`);
    console.log(`[DebridgeAdapter] Target: solana (${this.options.solanaChainId})`);
    console.log(`[DebridgeAdapter] Fixed fee: ${fees.fixedFee}`);
    console.log(`[DebridgeAdapter] Execution fee: ${fees.executionFee}`);
    console.log(`[DebridgeAdapter] Payload size: ${payload.length} bytes`);

    const txHash = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;

    const submissionId = `db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const messageId = `debridge-${this.options.sourceChain}-${Date.now()}`;

    const result: BridgeResult = {
      txHash,
      messageId,
      submissionId,
      status: 'pending',
      estimatedTime: 300,
    };

    this.pendingMessages.set(messageId, result);

    setTimeout(() => {
      const stored = this.pendingMessages.get(messageId);
      if (stored) {
        stored.status = 'completed';
        console.log(`[DebridgeAdapter] Message ${messageId} executed on Solana`);
      }
    }, 8000);

    return result;
  }

  private encodeMessage(message: DebridgeMessage): string {
    return JSON.stringify(message);
  }

  private convertToDebridgeMessage(message: A2AMessage): DebridgeMessage {
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
    console.log('[DebridgeAdapter] Started listening for submissions');
  }
}

export default DebridgeAdapter;
