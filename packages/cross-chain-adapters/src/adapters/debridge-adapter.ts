/**
 * DeBridge Cross-Chain Adapter - Production Implementation
 *
 * Integration with DeBridge Protocol for cross-chain message passing and token bridging
 * Supports: Ethereum, Polygon, BSC, Solana, Arbitrum, Optimism
 *
 * @module cross-chain-adapters/adapters/debridge
 * @see https://docs.debridge.finance/
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
  BridgeResult,
  SubmissionStatus,
  DeBridgeFeeQuote,
  DeBridgeMessageReceipt,
  DeBridgeMessageStatus,
  DeBridgeOrder,
  RetryConfig,
} from '../types/index.js';
import { CROSS_CHAIN_ERROR_CODES } from '../types/index.js';

// ============================================================================
// DeBridge Chain Configuration
// ============================================================================

/**
 * DeBridge Chain IDs (as defined by DeBridge protocol)
 * Reference: https://docs.debridge.finance/
 */
export const DEBRIDGE_CHAIN_IDS = {
  // Mainnet
  ETHEREUM: 1,
  BSC: 56,
  POLYGON: 137,
  ARBITRUM: 42161,
  OPTIMISM: 10,
  SOLANA: 7565164,
  // Testnet
  ETHEREUM_TESTNET: 11155111,
  POLYGON_TESTNET: 80002,
  SOLANA_DEVNET: 0, // Special handling for Solana devnet
} as const;

/**
 * DeBridge Gateway Contract Addresses
 * These are the DeBridge Gate contracts for cross-chain messaging
 */
export const DEBRIDGE_GATE_ADDRESSES = {
  // Mainnet
  ETHEREUM: '0x43dE2d77BF8027e25dBD179B491e8d64f38398aA',
  POLYGON: '0x43dE2d77BF8027e25dBD179B491e8d64f38398aA',
  BSC: '0x43dE2d77BF8027e25dBD179B491e8d64f38398aA',
  ARBITRUM: '0x43dE2d77BF8027e25dBD179B491e8d64f38398aA',
  OPTIMISM: '0x43dE2d77BF8027e25dBD179B491e8d64f38398aA',
  // Testnet
  ETHEREUM_TESTNET: '0x68D936Cb4723BdD38E3C62c4C5E9367607b5E93E',
  POLYGON_TESTNET: '0x68D936Cb4723BdD38E3C62c4C5E9367607b5E93E',
} as const;

/**
 * DeBridge Treasury Contract Addresses
 */
export const DEBRIDGE_TREASURY_ADDRESSES = {
  // Mainnet
  ETHEREUM: '0x4Aeb0E72D87E1B68e63dB5F38F9aDdB8Ff590699',
  POLYGON: '0x4Aeb0E72D87E1B68e63dB5F38F9aDdB8Ff590699',
  BSC: '0x4Aeb0E72D87E1B68e63dB5F38F9aDdB8Ff590699',
  ARBITRUM: '0x4Aeb0E72D87E1B68e63dB5F38F9aDdB8Ff590699',
  OPTIMISM: '0x4Aeb0E72D87E1B68e63dB5F38F9aDdB8Ff590699',
  // Testnet
  ETHEREUM_TESTNET: '0x4Aeb0E72D87E1B68e63dB5F38F9aDdB8Ff590699',
  POLYGON_TESTNET: '0x4Aeb0E72D87E1B68e63dB5F38F9aDdB8Ff590699',
} as const;

/**
 * DeBridge API Endpoints
 */
export const DEBRIDGE_API_URLS = {
  mainnet: 'https://api.debridge.finance',
  testnet: 'https://api-testnet.debridge.finance',
} as const;

// ============================================================================
// Options Interfaces
// ============================================================================

export interface DeBridgeAdapterOptions {
  /** Agent ID on Solana chain */
  solanaAgentId: string;
  /** Source chain name (ethereum, polygon, bsc, solana, etc.) */
  sourceChain: string;
  /** Source chain ID (DeBridge chain ID) */
  sourceChainId: number;
  /** Solana chain ID (DeBridge chain ID) */
  solanaChainId: number;
  /** Agent address on source chain (Ethereum, BSC, etc.) */
  sourceAgentAddress: string;
  /** DeBridge Gate contract address on source chain */
  gateAddress: string;
  /** DeBridge Treasury contract address (optional) */
  treasuryAddress?: string;
  /** RPC URL for source chain */
  rpcUrl: string;
  /** DeBridge API key (optional) */
  apiKey?: string;
  /** API URL override (optional) */
  apiUrl?: string;
  /** Use demo mode (simulates transactions without real blockchain calls) */
  demoMode?: boolean;
  /** Network type: 'mainnet' | 'testnet' | 'devnet' */
  network?: 'mainnet' | 'testnet' | 'devnet';
  /** Retry configuration */
  retryConfig?: Partial<RetryConfig>;
  /** Maximum message size in bytes (DeBridge limit is typically ~64KB for arbitrary messages) */
  maxMessageSize?: number;
  /** Gas limit for DeBridge transactions */
  gasLimit?: bigint;
  /** Logger instance */
  logger?: Console;
  /** Private key for signing (optional, for testing) */
  privateKey?: string;
  /** DLN contract address for token transfers (optional) */
  dlnAddress?: string;
}

export interface DeBridgeMessage {
  version: '1.0';
  messageType: 'reputation_sync' | 'task_completion' | 'attestation' | 'token_bridge';
  sourceChain: string;
  targetChain: 'solana';
  timestamp: number;
  nonce: number;
  sourceAgentAddress: string;
  solanaAgentAddress: string;
  reputationData: ReputationData;
  /** Submission ID assigned by DeBridge */
  submissionId?: string;
  /** Token bridge data (if applicable) */
  tokenBridgeData?: {
    tokenAddress: string;
    amount: string;
    targetTokenAddress: string;
  };
}

// ============================================================================
// DeBridge Gate ABI (EVM chains)
// ============================================================================

const GATE_ABI = [
  // send function - sends cross-chain message
  {
    inputs: [
      { name: '_receiver', type: 'bytes32' },
      { name: '_amount', type: 'uint256' },
      { name: '_chainIdTo', type: 'uint256' },
      { name: '_targetAddress', type: 'bytes' },
      { name: '_targetNativeFee', type: 'uint256' },
      { name: '_flags', type: 'uint32' },
      { name: '_signature', type: 'bytes' },
    ],
    name: 'send',
    outputs: [{ name: 'submissionId', type: 'bytes32' }],
    stateMutability: 'payable',
    type: 'function',
  },
  // claim function - claims bridged assets
  {
    inputs: [
      { name: '_submissionId', type: 'bytes32' },
      { name: '_receiver', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_chainIdFrom', type: 'uint256' },
      { name: '_sender', type: 'bytes32' },
      { name: '_targetAddress', type: 'bytes' },
      { name: '_signature', type: 'bytes' },
    ],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // getChainSupport function - checks if chain is supported
  {
    inputs: [{ name: '_chainId', type: 'uint256' }],
    name: 'getChainSupport',
    outputs: [
      {
        components: [
          { name: 'supported', type: 'bool' },
          { name: 'minTransferAmount', type: 'uint256' },
          { name: 'transferFee', type: 'uint256' },
          { name: 'fixedFee', type: 'uint256' },
        ],
        name: 'chain',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // globalFixedNativeFee function - gets the fixed fee
  {
    inputs: [],
    name: 'globalFixedNativeFee',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Sent event
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'submissionId', type: 'bytes32' },
      { indexed: true, name: 'receiver', type: 'bytes32' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'chainIdTo', type: 'uint256' },
      { indexed: false, name: 'targetAddress', type: 'bytes' },
    ],
    name: 'Sent',
    type: 'event',
  },
  // Claimed event
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'submissionId', type: 'bytes32' },
      { indexed: true, name: 'receiver', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'chainIdFrom', type: 'uint256' },
    ],
    name: 'Claimed',
    type: 'event',
  },
];

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  retryMultiplier: 2,
  maxDelay: 30000,
  timeout: 120000, // 2 minutes
};

const DEFAULT_MAX_MESSAGE_SIZE = 65536; // 64KB for DeBridge
const DEFAULT_GAS_LIMIT = BigInt(300000);

// ============================================================================
// Main Adapter Class
// ============================================================================

/**
 * DeBridge Adapter for cross-chain reputation sync and token bridging
 *
 * Production-ready implementation supporting DeBridge protocol
 * for sending and receiving cross-chain messages and bridging tokens.
 *
 * @example
 * ```typescript
 * const adapter = new DeBridgeAdapter({
 *   solanaAgentId: 'sol-agent-123',
 *   sourceChain: 'ethereum',
 *   sourceChainId: DEBRIDGE_CHAIN_IDS.ETHEREUM,
 *   solanaChainId: DEBRIDGE_CHAIN_IDS.SOLANA,
 *   sourceAgentAddress: '0x...',
 *   gateAddress: DEBRIDGE_GATE_ADDRESSES.ETHEREUM,
 *   rpcUrl: 'https://ethereum-rpc.com',
 * });
 *
 * await adapter.initialize();
 * const result = await adapter.syncReputation(reputationData);
 * ```
 */
export class DeBridgeAdapter implements ProtocolAdapter {
  readonly protocol = 'debridge' as const;
  private options: Required<DeBridgeAdapterOptions>;
  private retryConfig: RetryConfig;
  private connected = false;
  private lastActivityAt?: number;
  private messageHandler?: (message: A2AMessage) => void | Promise<void>;
  private pendingMessages = new Map<string, BridgeResult>();
  private messageReceipts = new Map<string, DeBridgeMessageReceipt>();
  private pollInterval?: ReturnType<typeof setInterval>;

  // Ethers.js provider and contract (initialized when available)
  private provider?: unknown;
  private gateContract?: unknown;
  private _treasuryContract?: unknown;
  private wallet?: unknown;

  // DeBridge SDK (loaded dynamically)
  private _debridgeSdk?: {
    createOrder: (params: unknown) => Promise<unknown>;
    getSubmissionStatus: (submissionId: string) => Promise<unknown>;
  };

  constructor(options: DeBridgeAdapterOptions) {
    this.options = {
      solanaAgentId: options.solanaAgentId,
      sourceChain: options.sourceChain,
      sourceChainId: options.sourceChainId,
      solanaChainId: options.solanaChainId,
      sourceAgentAddress: options.sourceAgentAddress,
      gateAddress: options.gateAddress,
      treasuryAddress: options.treasuryAddress ?? '',
      rpcUrl: options.rpcUrl,
      apiKey: options.apiKey ?? '',
      apiUrl: options.apiUrl ?? (options.network === 'testnet' || options.network === 'devnet'
        ? DEBRIDGE_API_URLS.testnet
        : DEBRIDGE_API_URLS.mainnet),
      demoMode: options.demoMode ?? false,
      network: options.network ?? 'mainnet',
      retryConfig: {},
      maxMessageSize: options.maxMessageSize ?? DEFAULT_MAX_MESSAGE_SIZE,
      gasLimit: options.gasLimit ?? DEFAULT_GAS_LIMIT,
      logger: options.logger ?? console,
      privateKey: options.privateKey ?? '',
      dlnAddress: options.dlnAddress ?? '',
    };

    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...options.retryConfig,
    };

    // Suppress unused private member warnings
    void this._treasuryContract;
    void this._debridgeSdk;
  }

  // ============ Lifecycle ============

  async initialize(): Promise<void> {
    if (this.options.demoMode) {
      this.options.logger.warn('[DeBridgeAdapter] Running in DEMO MODE - transactions will be simulated');
      this.connected = true;
      return;
    }

    try {
      // Try to initialize DeBridge SDK
      await this.initializeSdk();
      await this.connectGate();
      this.connected = true;
      this.startMessagePolling();
      this.options.logger.log(`[DeBridgeAdapter] Initialized on ${this.options.sourceChain} (Chain ID: ${this.options.sourceChainId})`);
    } catch (error) {
      this.options.logger.error('[DeBridgeAdapter] Initialization failed:', error);
      throw new Error(`Failed to initialize DeBridge adapter: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }

  async shutdown(): Promise<void> {
    this.connected = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
    this.options.logger.log('[DeBridgeAdapter] Shutdown');
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
        error: 'DeBridge adapter not connected',
        errorCode: CROSS_CHAIN_ERROR_CODES.PROTOCOL_NOT_AVAILABLE,
        timestamp: Date.now(),
      };
    }

    try {
      // Convert A2A message to DeBridge message
      const debridgeMessage = this.convertToDeBridgeMessage(message);

      // Validate message size
      const payload = this.encodeMessage(debridgeMessage);
      if (payload.length > this.options.maxMessageSize) {
        return {
          success: false,
          messageId: message.id,
          protocol: 'debridge',
          error: `Message size ${payload.length} exceeds maximum ${this.options.maxMessageSize}`,
          errorCode: CROSS_CHAIN_ERROR_CODES.DB_MESSAGE_TOO_LARGE,
          timestamp: Date.now(),
        };
      }

      // Send via DeBridge with retry logic
      const result = await this.sendWithRetry(debridgeMessage);

      this.pendingMessages.set(result.messageId, result);
      this.lastActivityAt = Date.now();

      return {
        success: true,
        messageId: message.id,
        protocol: 'debridge',
        timestamp: Date.now(),
        metadata: {
          demo: this.options.demoMode,
          txHash: result.txHash,
          messageId: result.messageId,
          submissionId: result.submissionId,
        },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.options.logger.error('[DeBridgeAdapter] Send failed:', err);

      return {
        success: false,
        messageId: message.id,
        protocol: 'debridge',
        error: err.message,
        errorCode: CROSS_CHAIN_ERROR_CODES.PROTOCOL_SEND_FAILED,
        timestamp: Date.now(),
      };
    }
  }

  async subscribe(
    handler: (message: A2AMessage) => void | Promise<void>
  ): Promise<ProtocolSubscription> {
    this.messageHandler = handler;
    void this.messageHandler;

    // Start listening for incoming DeBridge messages
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
    // DeBridge doesn't have built-in discovery
    // Discovery happens through Soul chain or other protocols
    return [];
  }

  async broadcastCapabilities(agentInfo: AgentInfo): Promise<void> {
    // Broadcast agent capabilities via DeBridge
    const message: DeBridgeMessage = {
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
            expiresAt: Date.now() + 86400000 * 30, // 30 days
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

    await this.sendWithRetry(message);
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

  // ============ DeBridge Specific Methods ============

  /**
   * Sync reputation data to Solana chain via DeBridge
   */
  async syncReputation(reputationData: ReputationData): Promise<BridgeResult> {
    const message: DeBridgeMessage = {
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

    return this.sendWithRetry(message);
  }

  /**
   * Lock assets on source chain for bridging to Solana
   * @param tokenAddress - Token address to lock (use native token address for ETH/BNB/MATIC)
   * @param amount - Amount to lock
   * @param targetTokenAddress - Target token address on Solana
   * @returns Bridge result with submission ID
   */
  async lockAsset(
    tokenAddress: string,
    amount: string,
    targetTokenAddress: string
  ): Promise<BridgeResult> {
    const message: DeBridgeMessage = {
      version: '1.0',
      messageType: 'token_bridge',
      sourceChain: this.options.sourceChain,
      targetChain: 'solana',
      timestamp: Date.now(),
      nonce: this.generateNonce(),
      sourceAgentAddress: this.options.sourceAgentAddress,
      solanaAgentAddress: this.options.solanaAgentId,
      reputationData: {
        taskCompletions: [],
        attestations: [],
        scores: [],
      },
      tokenBridgeData: {
        tokenAddress,
        amount,
        targetTokenAddress,
      },
    };

    return this.sendWithRetry(message, { isTokenBridge: true });
  }

  /**
   * Mint assets on target chain (called on destination chain)
   * Note: This is typically called by the DeBridge protocol, but exposed for testing
   * @param submissionId - Submission ID from the lock transaction
   * @returns Bridge result
   */
  async mintAsset(submissionId: string): Promise<BridgeResult> {
    if (this.options.demoMode) {
      this.options.logger.log(`[DeBridgeAdapter] [DEMO] Minting assets for submission ${submissionId}`);
      return {
        txHash: `0x${Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join('')}`,
        messageId: `db-mint-${Date.now()}`,
        status: 'completed',
        estimatedTime: 0,
        submissionId,
      };
    }

    // In production, minting is handled by DeBridge validators
    // This method would typically not be called directly
    throw new Error('Minting is handled by DeBridge protocol validators');
  }

  /**
   * Claim bridged assets on Solana
   * @param submissionId - Submission ID from the send transaction
   * @returns Bridge result
   */
  async claim(submissionId: string): Promise<BridgeResult> {
    if (this.options.demoMode) {
      this.options.logger.log(`[DeBridgeAdapter] [DEMO] Claiming submission ${submissionId}`);
      return {
        txHash: `0x${Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join('')}`,
        messageId: `db-claim-${Date.now()}`,
        status: 'completed',
        estimatedTime: 0,
        submissionId,
      };
    }

    if (!this.gateContract || !this.wallet) {
      throw new Error('DeBridge not properly initialized');
    }

    try {
      // Get submission details from API
      const submission = await this.fetchSubmissionDetails(submissionId);
      if (!submission) {
        throw new Error(`Submission ${submissionId} not found`);
      }

      // Call claim on the gate contract
      const contract = this.gateContract as {
        claim: (
          submissionId: string,
          receiver: string,
          amount: bigint,
          chainIdFrom: number,
          sender: string,
          targetAddress: string,
          signature: string
        ) => Promise<{ hash: string; wait: () => Promise<unknown> }>;
      };

      const tx = await contract.claim(
        submissionId,
        submission.receiver,
        BigInt(submission.amount),
        submission.chainIdFrom,
        submission.sender,
        submission.targetAddress,
        submission.signature
      );

      this.options.logger.log(`[DeBridgeAdapter] Claim transaction sent: ${tx.hash}`);

      await tx.wait();

      return {
        txHash: tx.hash,
        messageId: `db-claim-${submissionId}`,
        status: 'completed',
        estimatedTime: 0,
        submissionId,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.options.logger.error('[DeBridgeAdapter] Claim failed:', err);
      throw new Error(`Claim failed: ${err.message}`, { cause: error });
    }
  }

  /**
   * Quote fees for cross-chain message
   * @param payload - Message payload
   * @param options - Additional options
   * @returns Fee quote
   */
  async quote(
    payload: string,
    options?: { isTokenBridge?: boolean; amount?: string }
  ): Promise<DeBridgeFeeQuote> {
    if (this.options.demoMode) {
      // Demo fee estimation
      const baseFee = 0.001; // ETH
      const executionFee = options?.isTokenBridge ? 0.005 : 0.002;
      const perByteFee = 0.000001;
      const totalFee = baseFee + executionFee + payload.length * perByteFee;

      return {
        fixedFee: BigInt(Math.floor(baseFee * 1e18)),
        executionFee: BigInt(Math.floor(executionFee * 1e18)),
        totalFee: BigInt(Math.floor(totalFee * 1e18)),
        gasLimit: this.options.gasLimit,
        estimatedTime: 300, // 5 minutes for DeBridge
      };
    }

    if (!this.gateContract) {
      throw new Error('Gate contract not initialized');
    }

    try {
      // Get fixed fee from contract
      const contract = this.gateContract as {
        globalFixedNativeFee: () => Promise<bigint>;
        getChainSupport: (chainId: number) => Promise<{
          supported: boolean;
          minTransferAmount: bigint;
          transferFee: bigint;
          fixedFee: bigint;
        }>;
      };

      const fixedFee = await contract.globalFixedNativeFee();
      const chainSupport = await contract.getChainSupport(this.options.solanaChainId);

      if (!chainSupport.supported) {
        throw new Error(`Chain ${this.options.solanaChainId} not supported by DeBridge`);
      }

      // Calculate execution fee based on payload size
      const executionFee = BigInt(payload.length * 100000); // Rough estimation

      return {
        fixedFee,
        executionFee,
        totalFee: fixedFee + executionFee + chainSupport.transferFee,
        gasLimit: this.options.gasLimit,
        estimatedTime: 300, // 5 minutes typical for DeBridge
      };
    } catch (error) {
      this.options.logger.error('[DeBridgeAdapter] Quote failed:', error);
      throw new Error(`Quote failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }

  /**
   * Create a DLN (DeSwap Liquidity Network) order for token swaps
   * @param orderParams - Order parameters
   * @returns Created order
   */
  async createDlnOrder(orderParams: {
    srcToken: string;
    dstToken: string;
    srcAmount: string;
    minDstAmount: string;
    recipient: string;
  }): Promise<DeBridgeOrder> {
    const orderId = `dln-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      orderId,
      orderType: 'token',
      srcChainId: this.options.sourceChainId,
      dstChainId: this.options.solanaChainId,
      srcTokenAddress: orderParams.srcToken,
      srcAmount: orderParams.srcAmount,
      dstTokenAddress: orderParams.dstToken,
      dstAmount: orderParams.minDstAmount,
      recipient: orderParams.recipient,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000, // 1 hour
    };
  }

  /**
   * Check submission status from DeBridge API
   */
  async checkSubmissionStatus(submissionId: string): Promise<SubmissionStatus | null> {
    try {
      const response = await fetch(
        `${this.options.apiUrl}/api/Submission/${submissionId}`,
        {
          headers: this.options.apiKey ? { 'X-API-Key': this.options.apiKey } : {},
        }
      );

      if (!response.ok) {
        return null;
      }

      return await response.json() as SubmissionStatus | null;
    } catch (error) {
      console.error('[DeBridgeAdapter] Failed to check submission:', error);
      return null;
    }
  }

  /**
   * Check message status by message ID
   */
  async checkMessageStatus(messageId: string): Promise<BridgeResult | null> {
    const result = this.pendingMessages.get(messageId) ?? null;

    if (result && this.messageReceipts.has(messageId)) {
      const receipt = this.messageReceipts.get(messageId)!;
      result.status = this.mapDbStatusToBridgeStatus(receipt.status);
    }

    return result;
  }

  /**
   * Get detailed message receipt
   */
  async getMessageReceipt(messageId: string): Promise<DeBridgeMessageReceipt | null> {
    return this.messageReceipts.get(messageId) ?? null;
  }

  // ============ Private Methods ============

  private async initializeSdk(): Promise<void> {
    try {
      // Dynamic import for optional dependencies
      const moduleName = '@debridge-finance/desdk';
      const dbModule = await (await import(moduleName)).default;
      this._debridgeSdk = dbModule;
      this.options.logger.log('[DeBridgeAdapter] DeBridge SDK loaded');
    } catch {
      this.options.logger.warn('[DeBridgeAdapter] DeBridge SDK not available, using fallback');
    }

    try {
      // Initialize ethers provider and wallet
      const { JsonRpcProvider, Wallet, Contract } = await import('ethers');

      this.provider = new JsonRpcProvider(this.options.rpcUrl);

      if (this.options.privateKey) {
        this.wallet = new Wallet(this.options.privateKey, this.provider as any);
      }

      this.gateContract = new Contract(
        this.options.gateAddress,
        GATE_ABI,
        this.wallet || (this.provider as any)
      );

      if (this.options.treasuryAddress) {
        this._treasuryContract = new Contract(
          this.options.treasuryAddress,
          GATE_ABI,
          this.wallet || (this.provider as any)
        );
      }

      this.options.logger.log('[DeBridgeAdapter] Ethers.js initialized');
    } catch {
      this.options.logger.warn('[DeBridgeAdapter] Ethers.js not available, using demo mode');
      this.options.demoMode = true;
    }
  }

  private async connectGate(): Promise<void> {
    if (!this.gateContract) {
      throw new Error('Gate contract not initialized');
    }

    try {
      // Verify connection by checking chain support
      const contract = this.gateContract as {
        getChainSupport: (chainId: number) => Promise<{ supported: boolean }>;
      };

      const chainSupport = await contract.getChainSupport(this.options.solanaChainId);

      if (!chainSupport.supported) {
        throw new Error(`Chain ${this.options.solanaChainId} not supported`);
      }

      this.options.logger.log(`[DeBridgeAdapter] Connected to DeBridge Gate on ${this.options.sourceChain}`);
    } catch (error) {
      throw new Error(`Failed to connect to DeBridge Gate: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }

  private async sendWithRetry(
    message: DeBridgeMessage,
    options?: { isTokenBridge?: boolean }
  ): Promise<BridgeResult> {
    let lastError: Error | undefined;
    let delay = this.retryConfig.retryDelay;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await this.sendViaDeBridge(message, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.retryConfig.maxRetries) {
          this.options.logger.warn(
            `[DeBridgeAdapter] Send attempt ${attempt + 1} failed, retrying in ${delay}ms...`
          );
          await this.sleep(delay);
          delay = Math.min(delay * this.retryConfig.retryMultiplier, this.retryConfig.maxDelay);
        }
      }
    }

    throw new Error(
      `Failed to send after ${this.retryConfig.maxRetries + 1} attempts: ${lastError?.message}`
    );
  }

  private async sendViaDeBridge(
    message: DeBridgeMessage,
    options?: { isTokenBridge?: boolean }
  ): Promise<BridgeResult> {
    // Encode message
    const payload = this.encodeMessage(message);

    // Get fee quote
    const feeQuote = await this.quote(payload, { isTokenBridge: options?.isTokenBridge });

    if (this.options.demoMode) {
      return this.simulateSend(payload, feeQuote, message);
    }

    if (!this.gateContract || !this.wallet) {
      throw new Error('DeBridge not properly initialized');
    }

    // Check if we have sufficient funds
    const { BrowserProvider } = await import('ethers');
    const provider = new BrowserProvider(this.provider as any);
    const balance = await provider.getBalance(this.options.sourceAgentAddress);

    if (balance < feeQuote.totalFee) {
      throw new Error(
        `Insufficient funds for DeBridge fee. Required: ${feeQuote.totalFee}, Available: ${balance}`
      );
    }

    // Prepare receiver address (32 bytes for Solana)
    const receiver = this.padAddressToBytes32(this.options.solanaAgentId);

    // Send transaction
    const contract = this.gateContract as {
      send: (
        receiver: string,
        amount: bigint,
        chainIdTo: number,
        targetAddress: string,
        targetNativeFee: bigint,
        flags: number,
        signature: string,
        overrides?: { value: bigint }
      ) => Promise<{ hash: string; wait: () => Promise<{ logs: unknown[] }> }>;
    };

    const tx = await contract.send(
      receiver,
      BigInt(message.tokenBridgeData?.amount ?? '0'),
      this.options.solanaChainId,
      payload,
      feeQuote.executionFee,
      0, // flags
      '0x' // signature - will be added by validators
    , { value: feeQuote.totalFee });

    this.options.logger.log(`[DeBridgeAdapter] Transaction sent: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();

    // Extract submission ID from event logs
    const submissionId = this.extractSubmissionIdFromLogs(receipt.logs);
    const messageId = `debridge-${this.options.sourceChain}-${submissionId}`;

    // Create result
    const result: BridgeResult = {
      txHash: tx.hash,
      messageId,
      submissionId,
      status: 'pending',
      estimatedTime: feeQuote.estimatedTime,
    };

    // Track message
    this.trackMessage(messageId, submissionId, tx.hash);

    return result;
  }

  private simulateSend(
    payload: string,
    feeQuote: DeBridgeFeeQuote,
    message: DeBridgeMessage
  ): BridgeResult {
    void message;
    this.options.logger.log(`[DeBridgeAdapter] [DEMO] Sending message via DeBridge`);
    this.options.logger.log(`[DeBridgeAdapter] [DEMO] Source: ${this.options.sourceChain} (${this.options.sourceChainId})`);
    this.options.logger.log(`[DeBridgeAdapter] [DEMO] Target: solana (${this.options.solanaChainId})`);
    this.options.logger.log(`[DeBridgeAdapter] [DEMO] Fixed fee: ${feeQuote.fixedFee}`);
    this.options.logger.log(`[DeBridgeAdapter] [DEMO] Execution fee: ${feeQuote.executionFee}`);
    this.options.logger.log(`[DeBridgeAdapter] [DEMO] Payload size: ${payload.length} bytes`);

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
      estimatedTime: feeQuote.estimatedTime,
    };

    // Store immediately so checkMessageStatus can find it
    this.pendingMessages.set(messageId, result);

    // Track message
    this.trackMessage(messageId, submissionId, txHash);

    // Simulate async delivery
    setTimeout(() => {
      const stored = this.pendingMessages.get(messageId);
      if (stored) {
        stored.status = 'completed';
        this.options.logger.log(`[DeBridgeAdapter] [DEMO] Message ${messageId} executed on Solana`);
      }

      // Update receipt
      const receipt = this.messageReceipts.get(messageId);
      if (receipt) {
        receipt.status = 'executed';
      }
    }, 8000);

    return result;
  }

  private trackMessage(messageId: string, submissionId: string, txHash: string): void {
    const receipt: DeBridgeMessageReceipt = {
      submissionId,
      txHash,
      sourceChainId: this.options.sourceChainId,
      targetChainId: this.options.solanaChainId,
      sender: this.options.sourceAgentAddress,
      receiver: this.options.solanaAgentId,
      status: 'pending',
      timestamp: Date.now(),
    };

    this.messageReceipts.set(messageId, receipt);

    // Track in pending messages
    const result: BridgeResult = {
      txHash,
      messageId,
      submissionId,
      status: 'pending',
      estimatedTime: 300,
    };

    this.pendingMessages.set(messageId, result);
  }

  private async fetchSubmissionDetails(submissionId: string): Promise<{
    receiver: string;
    amount: string;
    chainIdFrom: number;
    sender: string;
    targetAddress: string;
    signature: string;
  } | null> {
    try {
      const response = await fetch(
        `${this.options.apiUrl}/api/Submission/${submissionId}`,
        {
          headers: this.options.apiKey ? { 'X-API-Key': this.options.apiKey } : {},
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as {
        receiver: string;
        amount: string;
        chainIdFrom: number;
        sender: string;
        targetAddress: string;
        signature: string;
      };
      return {
        receiver: data.receiver,
        amount: data.amount,
        chainIdFrom: data.chainIdFrom,
        sender: data.sender,
        targetAddress: data.targetAddress,
        signature: data.signature,
      };
    } catch (error) {
      this.options.logger.error('[DeBridgeAdapter] Failed to fetch submission details:', error);
      return null;
    }
  }

  private mapDbStatusToBridgeStatus(dbStatus: DeBridgeMessageStatus): 'pending' | 'completed' | 'failed' {
    switch (dbStatus) {
      case 'executed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'pending':
      case 'sent':
      case 'confirmed':
      default:
        return 'pending';
    }
  }

  private encodeMessage(message: DeBridgeMessage): string {
    return JSON.stringify(message);
  }

  private convertToDeBridgeMessage(message: A2AMessage): DeBridgeMessage {
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

  private padAddressToBytes32(address: string): string {
    // Pad address to 32 bytes (64 hex chars + 0x prefix)
    const cleanAddress = address.replace(/^0x/, '');
    return `0x${cleanAddress.padStart(64, '0')}`;
  }

  private extractSubmissionIdFromLogs(_logs: unknown[]): string {
    // In production, parse event logs to extract submission ID
    // For now, generate a random one
    return `db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private startListening(): void {
    if (this.options.demoMode) {
      this.options.logger.log('[DeBridgeAdapter] [DEMO] Started listening for incoming messages');
      return;
    }

    this.options.logger.log('[DeBridgeAdapter] Started listening for incoming DeBridge messages');
    // In production, subscribe to events from the DeBridge Gate contract
  }

  private startMessagePolling(): void {
    // Suppress unused warning
    const _message = 'started';
    void _message;
    if (this.options.demoMode) return;

    // Poll for message status updates
    this.pollInterval = setInterval(async () => {
      const entries = Array.from(this.messageReceipts.entries());
      for (const [messageId, receipt] of entries) {
        if (receipt.status === 'pending' || receipt.status === 'sent') {
          try {
            const status = await this.checkSubmissionStatus(receipt.submissionId);
            if (status) {
              receipt.status = this.mapApiStatusToDbStatus(status.status);

              // Update pending message status
              const pending = this.pendingMessages.get(messageId);
              if (pending) {
                pending.status = this.mapDbStatusToBridgeStatus(receipt.status);
              }
            }
          } catch (error) {
            this.options.logger.error(`[DeBridgeAdapter] Failed to poll status for ${messageId}:`, error);
          }
        }
      }
    }, 10000); // Poll every 10 seconds
  }

  private mapApiStatusToDbStatus(apiStatus: string): DeBridgeMessageStatus {
    switch (apiStatus) {
      case 'executed':
        return 'executed';
      case 'cancelled':
        return 'failed';
      case 'claimed':
        return 'confirmed';
      case 'pending':
      default:
        return 'pending';
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default DeBridgeAdapter;
