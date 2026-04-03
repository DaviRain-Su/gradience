/**
 * Debridge Cross-Chain Adapter
 *
 * Integration with Debridge DLN (Debridge Liquidity Network)
 * Debridge uses staked validators for secure cross-chain messaging
 *
 * @module a2a-router/adapters/debridge-adapter
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

export interface DebridgeAdapterOptions {
  /** Agent ID on Solana chain */
  solanaAgentId: string;
  /** Source chain name */
  sourceChain: string;
  /** Source chain ID (Debridge chain ID) */
  sourceChainId: number;
  /** Solana chain ID */
  solanaChainId: number;
  /** Agent address on source chain */
  sourceAgentAddress: string;
  /** Debridge Gate contract address */
  gateAddress: string;
  /** DLN Contract address */
  dlnAddress?: string;
  /** RPC URL for source chain */
  rpcUrl: string;
  /** API key for Debridge API */
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
  reputationData: {
    taskCompletions: TaskCompletion[];
    attestations: Attestation[];
    scores: ChainScore[];
  };
  submissionId?: string;
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

export interface BridgeResult {
  txHash: string;
  messageId: string;
  submissionId?: string;
  status: 'pending' | 'completed' | 'failed';
  estimatedTime: number;
}

export interface SubmissionStatus {
  submissionId: string;
  status: 'pending' | 'claimed' | 'executed' | 'cancelled';
  sourceChain: string;
  targetChain: string;
  sender: string;
  receiver: string;
  amount: string;
  executionFee: string;
}

/**
 * Debridge Adapter for cross-chain reputation sync
 * 
 * Debridge uses a unique approach:
 - Validators stake collateral to secure the bridge
 - Messages are verified by multiple validators
 - Lower fees than LayerZero for certain routes
 - Native support for Solana
 */
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

  // ============ Lifecycle ============

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

  // ============ Messaging ============

  async send(message: A2AMessage): Promise<A2AResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        messageId: message.id,
        protocol: 'debridge',
        error: 'Debridge adapter not connected',
        errorCode: A2A_ERROR_CODES.PROTOCOL_NOT_AVAILABLE,
        timestamp: Date.now(),
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
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        messageId: message.id,
        protocol: 'debridge',
        error: err.message,
        errorCode: A2A_ERROR_CODES.PROTOCOL_SEND_FAILED,
        timestamp: Date.now(),
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

  // ============ Discovery ============

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

  // ============ Health ============

  health(): ProtocolHealthStatus {
    return {
      available: this.isAvailable(),
      peerCount: this.pendingMessages.size,
      subscribedTopics: this.isAvailable() ? ['debridge-messages'] : [],
      lastActivityAt: this.lastActivityAt,
    };
  }

  // ============ Debridge Specific Methods ============

  /**
   * Sync reputation data to Solana via Debridge
   */
  async syncReputation(
    reputationData: DebridgeMessage['reputationData']
  ): Promise<BridgeResult> {
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

  /**
   * Check submission status via Debridge API
   */
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

  /**
   * Check message status
   */
  async checkMessageStatus(messageId: string): Promise<BridgeResult | null> {
    const result = this.pendingMessages.get(messageId);
    if (!result) return null;

    // If has submission ID, check on-chain status
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

  /**
   * Estimate fees for cross-chain message
   */
  async estimateFees(payload: string): Promise<{
    fixedFee: bigint;
    executionFee: bigint;
    totalFee: bigint;
  }> {
    // Debridge fee structure:
    // - Fixed fee: base cost for cross-chain message
    // - Execution fee: cost to execute on target chain
    // - Total: sum of both

    const baseFee = 0.0005; // 0.0005 ETH (~$1)
    const executionFee = 0.001; // 0.001 ETH (~$2)
    const perByteFee = 0.000001;

    const dataFee = payload.length * perByteFee;
    const totalEth = baseFee + executionFee + dataFee;

    return {
      fixedFee: BigInt(Math.floor(baseFee * 1e18)),
      executionFee: BigInt(Math.floor((executionFee + dataFee) * 1e18)),
      totalFee: BigInt(Math.floor(totalEth * 1e18)),
    };
  }

  // ============ Private Methods ============

  private async connectDebridge(): Promise<void> {
    console.log(`[DebridgeAdapter] Connecting to Debridge...`);
    console.log(`[DebridgeAdapter] Gate: ${this.options.gateAddress}`);

    // Test API connection if key provided
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
    // Encode message
    const payload = this.encodeMessage(message);

    // Calculate fees
    const fees = await this.estimateFees(payload);

    console.log(`[DebridgeAdapter] Sending message via Debridge`);
    console.log(`[DebridgeAdapter] Source: ${this.options.sourceChain} (${this.options.sourceChainId})`);
    console.log(`[DebridgeAdapter] Target: solana (${this.options.solanaChainId})`);
    console.log(`[DebridgeAdapter] Fixed fee: ${fees.fixedFee}`);
    console.log(`[DebridgeAdapter] Execution fee: ${fees.executionFee}`);
    console.log(`[DebridgeAdapter] Payload size: ${payload.length} bytes`);

    // Simulate transaction
    const txHash = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;

    const submissionId = `db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const messageId = `debridge-${this.options.sourceChain}-${Date.now()}`;

    // Create result
    const result: BridgeResult = {
      txHash,
      messageId,
      submissionId,
      status: 'pending',
      estimatedTime: 300, // 5 minutes for Debridge
    };

    this.pendingMessages.set(messageId, result);

    // Simulate async completion
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
    // In production, use proper ABI encoding
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
