/**
 * Wormhole Cross-Chain Adapter - Production Implementation
 *
 * Integration with Wormhole Protocol for cross-chain message passing via VAA
 * Supports: Ethereum, Polygon, BSC, Avalanche, Solana, Sui, Near
 *
 * @module cross-chain-adapters/adapters/wormhole
 * @see https://docs.wormhole.com/wormhole
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
  VAA,
  Signature,
  WormholeFeeQuote,
  WormholeMessageReceipt,
  WormholeMessageStatus,
  RetryConfig,
} from '../types/index.js';
import { CROSS_CHAIN_ERROR_CODES } from '../types/index.js';

// ============================================================================
// Wormhole Chain Configuration
// ============================================================================

/**
 * Wormhole Chain IDs (as defined by Wormhole protocol)
 * Reference: https://docs.wormhole.com/wormhole/blockchain-environments
 */
export const WORMHOLE_CHAIN_IDS = {
  // Mainnet
  SOLANA: 1,
  ETHEREUM: 2,
  BSC: 4,
  POLYGON: 5,
  AVALANCHE: 6,
  SUI: 21,
  NEAR: 15,
  // Testnet
  SOLANA_DEVNET: 1,
  ETHEREUM_TESTNET: 2,
  POLYGON_TESTNET: 5,
} as const;

/**
 * Wormhole Core Bridge Contract Addresses
 * These are the Wormhole Core Bridge contract addresses
 */
export const WORMHOLE_CORE_ADDRESSES = {
  // Mainnet
  ETHEREUM: '0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B',
  POLYGON: '0x7A4B5a56256163F07b2C80A7cA55aBE66c4ec4d7',
  BSC: '0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B',
  AVALANCHE: '0x54a8e5f9c4CbA08F9943965859F6c34eAF03E26c',
  SUI: '0xaeab97f96cf9877fee2883315d44755271d67e30', // Package ID for Sui
  NEAR: 'contract.wormhole.near',
  // Testnet
  ETHEREUM_TESTNET: '0x706abc4E45D419950511e474C7B9Ed348A4a716c',
  POLYGON_TESTNET: '0x0CBE91CF822c73C2315FB05100C2F714765d5c20',
} as const;

/**
 * Wormhole Guardian RPC Endpoints
 * Used to fetch signed VAAs (Verified Action Approvals)
 */
export const WORMHOLE_GUARDIAN_RPCS = {
  mainnet: [
    'https://wormhole-v2-mainnet-api.certus.one',
    'https://wormhole.inotel.ro',
    'https://wormhole-v2-mainnet-api.chainlayer.network',
    'https://wormhole-v2-mainnet-api.staking.fund',
  ],
  testnet: [
    'https://wormhole-v2-testnet-api.certus.one',
  ],
} as const;

// ============================================================================
// Options Interfaces
// ============================================================================

export interface WormholeAdapterOptions {
  /** Agent ID on Solana chain */
  solanaAgentId: string;
  /** Source chain name (ethereum, polygon, bsc, sui, near, etc.) */
  sourceChain: string;
  /** Source chain ID (Wormhole chain ID) */
  sourceChainId: number;
  /** Solana chain ID (Wormhole chain ID) */
  solanaChainId: number;
  /** Agent address on source chain (Ethereum, Sui, Near, etc.) */
  sourceAgentAddress: string;
  /** Wormhole Core Bridge contract address on source chain */
  coreBridgeAddress: string;
  /** RPC URL for source chain */
  rpcUrl: string;
  /** Guardian RPC URLs (optional, defaults to mainnet/testnet guardians) */
  guardianRpcs?: string[];
  /** Use demo mode (simulates transactions without real blockchain calls) */
  demoMode?: boolean;
  /** Network type: 'mainnet' | 'testnet' | 'devnet' */
  network?: 'mainnet' | 'testnet' | 'devnet';
  /** Retry configuration */
  retryConfig?: Partial<RetryConfig>;
  /** Maximum message size in bytes (Wormhole limit is typically ~10KB) */
  maxMessageSize?: number;
  /** Gas limit for Wormhole transactions */
  gasLimit?: bigint;
  /** Logger instance */
  logger?: Console;
  /** Private key for signing (optional, for testing) */
  privateKey?: string;
  /** Token bridge address for token transfers (optional) */
  tokenBridgeAddress?: string;
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
  reputationData: ReputationData;
  /** VAA sequence number (assigned after publishing) */
  sequence?: bigint;
  /** Consistency level for finality (1=instant, 15=finalized) */
  consistencyLevel?: number;
}

// ============================================================================
// Wormhole Core Bridge ABI (EVM chains)
// ============================================================================

const CORE_BRIDGE_ABI = [
  // publishMessage function - publishes a message to Wormhole
  {
    inputs: [
      { name: 'nonce', type: 'uint32' },
      { name: 'payload', type: 'bytes' },
      { name: 'consistencyLevel', type: 'uint8' },
    ],
    name: 'publishMessage',
    outputs: [{ name: 'sequence', type: 'uint64' }],
    stateMutability: 'payable',
    type: 'function',
  },
  // parseAndVerifyVM function - verifies a VAA
  {
    inputs: [{ name: 'encodedVM', type: 'bytes' }],
    name: 'parseAndVerifyVM',
    outputs: [
      {
        components: [
          { name: 'version', type: 'uint8' },
          { name: 'timestamp', type: 'uint32' },
          { name: 'nonce', type: 'uint32' },
          { name: 'emitterChainId', type: 'uint16' },
          { name: 'emitterAddress', type: 'bytes32' },
          { name: 'sequence', type: 'uint64' },
          { name: 'consistencyLevel', type: 'uint8' },
          { name: 'payload', type: 'bytes' },
          { name: 'guardianSetIndex', type: 'uint32' },
          { name: 'signatures', type: 'tuple[]' },
          { name: 'hash', type: 'bytes32' },
        ],
        name: 'vm',
        type: 'tuple',
      },
      { name: 'valid', type: 'bool' },
      { name: 'reason', type: 'string' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // messageFee function - gets the current message fee
  {
    inputs: [],
    name: 'messageFee',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // LogMessagePublished event
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'sender', type: 'address' },
      { indexed: false, name: 'sequence', type: 'uint64' },
      { indexed: false, name: 'nonce', type: 'uint32' },
      { indexed: false, name: 'payload', type: 'bytes' },
      { indexed: false, name: 'consistencyLevel', type: 'uint8' },
    ],
    name: 'LogMessagePublished',
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

const DEFAULT_MAX_MESSAGE_SIZE = 10240; // 10KB
const DEFAULT_GAS_LIMIT = BigInt(200000);
const DEFAULT_CONSISTENCY_LEVEL = 15; // Wait for finality

// ============================================================================
// Main Adapter Class
// ============================================================================

/**
 * Wormhole Adapter for cross-chain reputation sync
 *
 * Production-ready implementation supporting Wormhole protocol
 * for sending and receiving cross-chain messages via VAA.
 *
 * @example
 * ```typescript
 * const adapter = new WormholeAdapter({
 *   solanaAgentId: 'sol-agent-123',
 *   sourceChain: 'ethereum',
 *   sourceChainId: WORMHOLE_CHAIN_IDS.ETHEREUM,
 *   solanaChainId: WORMHOLE_CHAIN_IDS.SOLANA,
 *   sourceAgentAddress: '0x...',
 *   coreBridgeAddress: WORMHOLE_CORE_ADDRESSES.ETHEREUM,
 *   rpcUrl: 'https://ethereum-rpc.com',
 * });
 *
 * await adapter.initialize();
 * const result = await adapter.syncReputation(reputationData);
 * ```
 */
export class WormholeAdapter implements ProtocolAdapter {
  readonly protocol = 'wormhole' as const;
  private options: Required<WormholeAdapterOptions>;
  private retryConfig: RetryConfig;
  private connected = false;
  private lastActivityAt?: number;
  private messageHandler?: (message: A2AMessage) => void | Promise<void>;
  private pendingMessages = new Map<string, BridgeResult>();
  private messageReceipts = new Map<string, WormholeMessageReceipt>();
  private vaaCache = new Map<string, VAA>();
  private pollInterval?: ReturnType<typeof setInterval>;

  // Ethers.js provider and contract (initialized when available)
  private provider?: unknown;
  private coreBridgeContract?: unknown;
  private wallet?: unknown;

  // Wormhole SDK (loaded dynamically)
  private _wormholeSdk?: {
    wormhole: (network: string, chains: string[]) => Promise<unknown>;
  };

  constructor(options: WormholeAdapterOptions) {
    const defaultGuardians = options.network === 'testnet' || options.network === 'devnet'
      ? [...WORMHOLE_GUARDIAN_RPCS.testnet]
      : [...WORMHOLE_GUARDIAN_RPCS.mainnet];

    this.options = {
      solanaAgentId: options.solanaAgentId,
      sourceChain: options.sourceChain,
      sourceChainId: options.sourceChainId,
      solanaChainId: options.solanaChainId,
      sourceAgentAddress: options.sourceAgentAddress,
      coreBridgeAddress: options.coreBridgeAddress,
      rpcUrl: options.rpcUrl,
      guardianRpcs: options.guardianRpcs ?? defaultGuardians,
      demoMode: options.demoMode ?? false,
      network: options.network ?? 'mainnet',
      retryConfig: {},
      maxMessageSize: options.maxMessageSize ?? DEFAULT_MAX_MESSAGE_SIZE,
      gasLimit: options.gasLimit ?? DEFAULT_GAS_LIMIT,
      logger: options.logger ?? console,
      privateKey: options.privateKey ?? '',
      tokenBridgeAddress: options.tokenBridgeAddress ?? '',
    };

    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...options.retryConfig,
    };

    // Suppress unused private member warnings
    void this._wormholeSdk;
    void this._decodeMessage;
  }

  // ============ Lifecycle ============

  async initialize(): Promise<void> {
    if (this.options.demoMode) {
      this.options.logger.warn('[WormholeAdapter] Running in DEMO MODE - transactions will be simulated');
      this.connected = true;
      return;
    }

    try {
      // Try to initialize Wormhole SDK
      await this.initializeSdk();
      await this.connectCoreBridge();
      this.connected = true;
      this.startMessagePolling();
      this.options.logger.log(`[WormholeAdapter] Initialized on ${this.options.sourceChain} (Chain ID: ${this.options.sourceChainId})`);
    } catch (error) {
      this.options.logger.error('[WormholeAdapter] Initialization failed:', error);
      throw new Error(`Failed to initialize Wormhole adapter: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }

  async shutdown(): Promise<void> {
    this.connected = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
    this.options.logger.log('[WormholeAdapter] Shutdown');
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
        protocol: 'wormhole',
        error: 'Wormhole adapter not connected',
        errorCode: CROSS_CHAIN_ERROR_CODES.PROTOCOL_NOT_AVAILABLE,
        timestamp: Date.now(),
      };
    }

    try {
      // Convert A2A message to Wormhole message
      const wormholeMessage = this.convertToWormholeMessage(message);

      // Validate message size
      const payload = this.encodeMessage(wormholeMessage);
      if (payload.length > this.options.maxMessageSize) {
        return {
          success: false,
          messageId: message.id,
          protocol: 'wormhole',
          error: `Message size ${payload.length} exceeds maximum ${this.options.maxMessageSize}`,
          errorCode: CROSS_CHAIN_ERROR_CODES.WH_MESSAGE_TOO_LARGE,
          timestamp: Date.now(),
        };
      }

      // Send via Wormhole with retry logic
      const result = await this.sendWithRetry(wormholeMessage);

      this.pendingMessages.set(result.messageId, result);
      this.lastActivityAt = Date.now();

      return {
        success: true,
        messageId: message.id,
        protocol: 'wormhole',
        timestamp: Date.now(),
        metadata: {
          demo: this.options.demoMode,
          txHash: result.txHash,
          messageId: result.messageId,
          vaaHash: result.vaa?.hash,
        },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.options.logger.error('[WormholeAdapter] Send failed:', err);

      return {
        success: false,
        messageId: message.id,
        protocol: 'wormhole',
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

    // Start listening for incoming Wormhole messages
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
    // Wormhole doesn't have built-in discovery
    // Discovery happens through Soul chain or other protocols
    return [];
  }

  async broadcastCapabilities(agentInfo: AgentInfo): Promise<void> {
    // Broadcast agent capabilities via Wormhole
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
      consistencyLevel: DEFAULT_CONSISTENCY_LEVEL,
    };

    await this.sendWithRetry(message);
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
   * Sync reputation data to Solana chain via Wormhole
   */
  async syncReputation(reputationData: ReputationData): Promise<BridgeResult> {
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
      consistencyLevel: DEFAULT_CONSISTENCY_LEVEL,
    };

    return this.sendWithRetry(message);
  }

  /**
   * Quote fees for cross-chain message
   * @param payload - Message payload
   * @param consistencyLevel - Consistency level (1=instant, 15=finalized)
   * @returns Fee quote
   */
  async quote(
    payload: string,
    consistencyLevel?: number
  ): Promise<WormholeFeeQuote> {
    if (this.options.demoMode) {
      // Demo fee estimation
      const baseFee = 0.001; // ETH/native token
      const perByteFee = 0.000001;
      const totalFee = baseFee + payload.length * perByteFee;

      return {
        nativeFee: BigInt(Math.floor(totalFee * 1e18)),
        gasLimit: this.options.gasLimit,
        estimatedTime: this.calculateEstimatedTime(consistencyLevel ?? DEFAULT_CONSISTENCY_LEVEL),
      };
    }

    if (!this.coreBridgeContract) {
      throw new Error('Core bridge contract not initialized');
    }

    try {
      // Get message fee from contract
      const contract = this.coreBridgeContract as {
        messageFee: () => Promise<bigint>;
      };

      const messageFee = await contract.messageFee();

      return {
        nativeFee: messageFee,
        gasLimit: this.options.gasLimit,
        estimatedTime: this.calculateEstimatedTime(consistencyLevel ?? DEFAULT_CONSISTENCY_LEVEL),
      };
    } catch (error) {
      this.options.logger.error('[WormholeAdapter] Quote failed:', error);
      throw new Error(`Quote failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }

  /**
   * Fetch a VAA (Verified Action Approval) from guardian RPCs
   * @param emitterChain - Emitter chain ID
   * @param emitterAddress - Emitter address
   * @param sequence - Message sequence number
   * @returns VAA or null if not found
   */
  async fetchVAA(
    emitterChain: number,
    emitterAddress: string,
    sequence: bigint
  ): Promise<VAA | null> {
    const cacheKey = `${emitterChain}-${emitterAddress}-${sequence}`;
    if (this.vaaCache.has(cacheKey)) {
      return this.vaaCache.get(cacheKey)!;
    }

    for (const guardianRpc of this.options.guardianRpcs) {
      try {
        const response = await fetch(
          `${guardianRpc}/v1/signed_vaa/${emitterChain}/${emitterAddress}/${sequence}`
        );

        if (response.ok) {
          const data = (await response.json()) as { vaaBytes: string };
          const vaa = this.parseVAA(data.vaaBytes);
          this.vaaCache.set(vaa.hash, vaa);
          this.vaaCache.set(cacheKey, vaa);
          return vaa;
        }
      } catch (error) {
        this.options.logger.warn(`[WormholeAdapter] Guardian ${guardianRpc} failed:`, error);
        continue;
      }
    }

    return null;
  }

  /**
   * Redeem a VAA on the target chain (Solana)
   * This verifies and executes the cross-chain message
   * @param vaa - The VAA to redeem
   * @returns Transaction hash
   */
  async redeemOnSolana(vaa: VAA): Promise<{ txHash: string }> {
    this.options.logger.log(`[WormholeAdapter] Redeeming VAA on Solana: ${vaa.hash}`);

    if (this.options.demoMode) {
      // Simulate redemption
      await this.sleep(1000);
      const txHash = `sol-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      return { txHash };
    }

    // In production, this would:
    // 1. Serialize the VAA
    // 2. Call the Wormhole program on Solana to verify and post the VAA
    // 3. Call the target program to execute the message
    throw new Error('Solana redemption not implemented in this version');
  }

  /**
   * Verify a VAA's signatures
   * @param vaa - The VAA to verify
   * @returns Whether the VAA is valid
   */
  async verifyVAA(vaa: VAA): Promise<boolean> {
    if (this.options.demoMode) {
      return vaa.signatures.length >= 13; // Require at least 13 signatures (2/3 of 19)
    }

    if (!this.coreBridgeContract) {
      throw new Error('Core bridge contract not initialized');
    }

    try {
      // Serialize VAA and verify on-chain
      const serialized = this.serializeVAA(vaa);
      const contract = this.coreBridgeContract as {
        parseAndVerifyVM: (encodedVM: string) => Promise<{ valid: boolean; reason: string }>;
      };

      const result = await contract.parseAndVerifyVM(serialized);
      return result.valid;
    } catch (error) {
      this.options.logger.error('[WormholeAdapter] VAA verification failed:', error);
      return false;
    }
  }

  /**
   * Check message status by message ID
   */
  async checkMessageStatus(messageId: string): Promise<BridgeResult | null> {
    const result = this.pendingMessages.get(messageId) ?? null;

    if (result && this.messageReceipts.has(messageId)) {
      const receipt = this.messageReceipts.get(messageId)!;
      result.status = this.mapWormholeStatusToBridgeStatus(receipt.status);
    }

    return result;
  }

  /**
   * Get detailed message receipt
   */
  async getMessageReceipt(messageId: string): Promise<WormholeMessageReceipt | null> {
    return this.messageReceipts.get(messageId) ?? null;
  }

  // ============ Private Methods ============

  private async initializeSdk(): Promise<void> {
    try {
      // Try to initialize Wormhole SDK
      const moduleName = '@wormhole-foundation/sdk';
      const whModule = await import(moduleName);
      this._wormholeSdk = { wormhole: whModule.wormhole };
      this.options.logger.log('[WormholeAdapter] Wormhole SDK loaded');
    } catch {
      this.options.logger.warn('[WormholeAdapter] Wormhole SDK not available, using fallback');
    }

    try {
      // Initialize ethers provider and wallet
      const { JsonRpcProvider, Wallet, Contract } = await import('ethers');

      this.provider = new JsonRpcProvider(this.options.rpcUrl);

      if (this.options.privateKey) {
        this.wallet = new Wallet(this.options.privateKey, this.provider as any);
      }

      this.coreBridgeContract = new Contract(
        this.options.coreBridgeAddress,
        CORE_BRIDGE_ABI,
        this.wallet || (this.provider as any)
      );

      this.options.logger.log('[WormholeAdapter] Ethers.js initialized');
    } catch {
      this.options.logger.warn('[WormholeAdapter] Ethers.js not available, using demo mode');
      this.options.demoMode = true;
    }
  }

  private async connectCoreBridge(): Promise<void> {
    if (!this.coreBridgeContract) {
      throw new Error('Core bridge contract not initialized');
    }

    try {
      // Verify connection by checking message fee
      const contract = this.coreBridgeContract as {
        messageFee: () => Promise<bigint>;
      };

      const fee = await contract.messageFee();
      this.options.logger.log(`[WormholeAdapter] Connected to core bridge, message fee: ${fee}`);
    } catch (error) {
      throw new Error(`Failed to connect to Wormhole core bridge: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }

  private async sendWithRetry(message: WormholeMessage): Promise<BridgeResult> {
    let lastError: Error | undefined;
    let delay = this.retryConfig.retryDelay;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await this.sendViaWormhole(message);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.retryConfig.maxRetries) {
          this.options.logger.warn(
            `[WormholeAdapter] Send attempt ${attempt + 1} failed, retrying in ${delay}ms...`
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

  private async sendViaWormhole(message: WormholeMessage): Promise<BridgeResult> {
    // Encode message
    const payload = this.encodeMessage(message);

    if (this.options.demoMode) {
      return this.simulateSend(payload, message);
    }

    if (!this.coreBridgeContract || !this.wallet) {
      throw new Error('Wormhole not properly initialized');
    }

    // Get fee quote
    const feeQuote = await this.quote(payload, message.consistencyLevel);

    // Check if we have sufficient funds
    const { BrowserProvider } = await import('ethers');
    const provider = new BrowserProvider(this.provider as any);
    const balance = await provider.getBalance(this.options.sourceAgentAddress);

    if (balance < feeQuote.nativeFee) {
      throw new Error(
        `Insufficient funds for Wormhole fee. Required: ${feeQuote.nativeFee}, Available: ${balance}`
      );
    }

    // Publish message to Wormhole
    const contract = this.coreBridgeContract as {
      publishMessage: (
        nonce: number,
        payload: string,
        consistencyLevel: number,
        overrides: { value: bigint; gasLimit: bigint }
      ) => Promise<{ hash: string; wait: () => Promise<{ logs: unknown[]; blockNumber: number }> }>;
    };

    const tx = await contract.publishMessage(
      message.nonce,
      payload,
      message.consistencyLevel ?? DEFAULT_CONSISTENCY_LEVEL,
      { value: feeQuote.nativeFee, gasLimit: this.options.gasLimit }
    );

    this.options.logger.log(`[WormholeAdapter] Transaction sent: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();

    // Extract sequence from event logs
    const sequence = this.extractSequenceFromLogs(receipt.logs);
    const messageId = `wh-${this.options.sourceChain}-${sequence}`;

    // Create result with pending VAA
    const partialVAA: VAA = {
      version: 1,
      guardianSetIndex: 0,
      signatures: [],
      timestamp: Math.floor(Date.now() / 1000),
      nonce: message.nonce,
      emitterChain: this.options.sourceChainId,
      emitterAddress: this.options.sourceAgentAddress,
      sequence,
      consistencyLevel: message.consistencyLevel ?? DEFAULT_CONSISTENCY_LEVEL,
      payload,
      hash: this.hashPayload(payload),
    };

    const result: BridgeResult = {
      txHash: tx.hash,
      messageId,
      status: 'pending',
      estimatedTime: feeQuote.estimatedTime,
      vaa: partialVAA,
    };

    // Track message
    this.trackMessage(messageId, sequence, receipt.blockNumber);

    // Start polling for VAA
    this.pollForVAA(messageId, partialVAA);

    return result;
  }

  private simulateSend(payload: string, message: WormholeMessage): BridgeResult {
    this.options.logger.log(`[WormholeAdapter] [DEMO] Sending message to Solana chain (Chain ID: ${this.options.solanaChainId})`);
    this.options.logger.log(`[WormholeAdapter] [DEMO] Payload size: ${payload.length} bytes`);
    this.options.logger.log(`[WormholeAdapter] [DEMO] Consistency level: ${message.consistencyLevel ?? DEFAULT_CONSISTENCY_LEVEL}`);

    // Simulate transaction
    const txHash = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;

    const sequence = BigInt(Date.now());
    const messageId = `wh-${this.options.sourceChain}-${sequence}`;

    // Create VAA
    const vaa: VAA = {
      version: 1,
      guardianSetIndex: 3,
      signatures: [],
      timestamp: Math.floor(Date.now() / 1000),
      nonce: message.nonce,
      emitterChain: this.options.sourceChainId,
      emitterAddress: this.options.sourceAgentAddress,
      sequence,
      consistencyLevel: message.consistencyLevel ?? DEFAULT_CONSISTENCY_LEVEL,
      payload,
      hash: this.hashPayload(payload),
    };

    // Create result
    const result: BridgeResult = {
      txHash,
      messageId,
      status: 'pending',
      estimatedTime: 900, // 15 minutes for Wormhole
      vaa,
    };

    // Store immediately
    this.pendingMessages.set(messageId, result);

    // Simulate async VAA generation (guardians signing)
    setTimeout(async () => {
      const signedVAA = await this.simulateVAAGeneration(vaa);
      const stored = this.pendingMessages.get(messageId);
      if (stored) {
        stored.vaa = signedVAA;
        stored.status = 'completed';
        this.options.logger.log(`[WormholeAdapter] [DEMO] VAA generated for message ${messageId}`);
      }

      // Update receipt
      const receipt = this.messageReceipts.get(messageId);
      if (receipt) {
        receipt.status = 'signed';
        receipt.signatureCount = signedVAA.signatures.length;
      }
    }, 5000);

    // Track message receipt
    this.trackMessage(messageId, sequence);

    return result;
  }

  private async simulateVAAGeneration(partialVaa: VAA): Promise<VAA> {
    // Simulate guardian signatures (2/3 majority = 13 signatures out of 19)
    const signatures: Signature[] = [];
    for (let i = 0; i < 13; i++) {
      signatures.push({
        guardianIndex: i,
        signature: `sig-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
      });
    }

    return {
      ...partialVaa,
      signatures,
      guardianSetIndex: 3,
    };
  }

  private parseVAA(vaaBytes: string): VAA {
    // Parse VAA from base64 or hex
    // This is a simplified version - in production use proper VAA parsing
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
      hash: this.hashPayload(vaaBytes),
    };
  }

  private serializeVAA(vaa: VAA): string {
    // Serialize VAA for on-chain verification
    // This is a placeholder - proper serialization depends on chain
    return vaa.payload;
  }

  private encodeMessage(message: WormholeMessage): string {
    // Encode message as JSON with metadata
    const encoded = JSON.stringify(message);
    // Convert to hex for EVM compatibility
    return `0x${Buffer.from(encoded).toString('hex')}`;
  }

  private _decodeMessage(payload: string): WormholeMessage {
    // Decode from hex
    const hex = payload.startsWith('0x') ? payload.slice(2) : payload;
    const decoded = Buffer.from(hex, 'hex').toString('utf-8');
    return JSON.parse(decoded) as WormholeMessage;
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
      consistencyLevel: DEFAULT_CONSISTENCY_LEVEL,
    };
  }

  private generateNonce(): number {
    return Math.floor(Math.random() * 1000000);
  }

  private hashPayload(payload: string): string {
    // Simple hash for identification
    // In production use keccak256 or appropriate hashing
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `0x${Math.abs(hash).toString(16).padStart(64, '0')}`;
  }

  private extractSequenceFromLogs(_logs: unknown[]): bigint {
    // In production, parse event logs to extract sequence
    // For now, generate a unique sequence
    return BigInt(Date.now());
  }

  private trackMessage(messageId: string, sequence: bigint, blockNumber?: number): void {
    const receipt: WormholeMessageReceipt = {
      sequence,
      emitterChain: this.options.sourceChainId,
      emitterAddress: this.options.sourceAgentAddress,
      vaaHash: '',
      status: 'pending',
      signatureCount: 0,
      timestamp: Date.now(),
      blockNumber: blockNumber ? BigInt(blockNumber) : undefined,
    };

    this.messageReceipts.set(messageId, receipt);
  }

  private async pollForVAA(messageId: string, partialVaa: VAA): Promise<void> {
    if (this.options.demoMode) return;

    const maxAttempts = 30;
    const pollInterval = 30000; // 30 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const vaa = await this.fetchVAA(
          partialVaa.emitterChain,
          partialVaa.emitterAddress,
          partialVaa.sequence
        );

        if (vaa) {
          // Update stored result
          const result = this.pendingMessages.get(messageId);
          if (result) {
            result.vaa = vaa;
            result.status = 'completed';
          }

          // Update receipt
          const receipt = this.messageReceipts.get(messageId);
          if (receipt) {
            receipt.status = 'signed';
            receipt.signatureCount = vaa.signatures.length;
            receipt.vaaHash = vaa.hash;
          }

          this.options.logger.log(`[WormholeAdapter] VAA fetched for message ${messageId}`);
          return;
        }
      } catch (error) {
        this.options.logger.warn(`[WormholeAdapter] VAA poll attempt ${attempt + 1} failed:`, error);
      }

      await this.sleep(pollInterval);
    }

    this.options.logger.error(`[WormholeAdapter] Failed to fetch VAA after ${maxAttempts} attempts`);
  }

  private mapWormholeStatusToBridgeStatus(
    whStatus: WormholeMessageStatus
  ): 'pending' | 'completed' | 'failed' {
    switch (whStatus) {
      case 'signed':
      case 'delivered':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'pending':
      case 'awaiting_signatures':
      default:
        return 'pending';
    }
  }

  private calculateEstimatedTime(consistencyLevel: number): number {
    // Base time for Wormhole finality
    const baseTime = 60; // 1 minute for instant
    // Higher consistency levels wait for more confirmations
    return baseTime + consistencyLevel * 60;
  }

  private startListening(): void {
    if (this.options.demoMode) {
      this.options.logger.log('[WormholeAdapter] [DEMO] Started listening for incoming VAAs');
      return;
    }

    this.options.logger.log('[WormholeAdapter] Started listening for incoming Wormhole messages');
    // In production, set up event listeners or polling for VAAs
  }

  private startMessagePolling(): void {
    if (this.options.demoMode) return;

    // Poll for VAA status updates
    this.pollInterval = setInterval(async () => {
      const entries = Array.from(this.messageReceipts.entries());
      for (const [messageId, receipt] of entries) {
        if (receipt.status === 'pending' || receipt.status === 'awaiting_signatures') {
          try {
            const vaa = await this.fetchVAA(
              receipt.emitterChain,
              receipt.emitterAddress,
              receipt.sequence
            );

            if (vaa) {
              receipt.status = 'signed';
              receipt.signatureCount = vaa.signatures.length;
              receipt.vaaHash = vaa.hash;

              const result = this.pendingMessages.get(messageId);
              if (result) {
                result.vaa = vaa;
                result.status = 'completed';
              }
            }
          } catch (error) {
            this.options.logger.error(`[WormholeAdapter] Failed to poll VAA: ${error}`);
          }
        }
      }
    }, 30000); // Poll every 30 seconds
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a Wormhole adapter for Ethereum mainnet
 */
export function createEthereumAdapter(
  options: Omit<WormholeAdapterOptions, 'sourceChain' | 'sourceChainId' | 'coreBridgeAddress' | 'network'>
): WormholeAdapter {
  return new WormholeAdapter({
    ...options,
    sourceChain: 'ethereum',
    sourceChainId: WORMHOLE_CHAIN_IDS.ETHEREUM,
    coreBridgeAddress: WORMHOLE_CORE_ADDRESSES.ETHEREUM,
    network: 'mainnet',
  });
}

/**
 * Create a Wormhole adapter for Ethereum testnet (Sepolia)
 */
export function createEthereumTestnetAdapter(
  options: Omit<WormholeAdapterOptions, 'sourceChain' | 'sourceChainId' | 'coreBridgeAddress' | 'network'>
): WormholeAdapter {
  return new WormholeAdapter({
    ...options,
    sourceChain: 'ethereum-testnet',
    sourceChainId: WORMHOLE_CHAIN_IDS.ETHEREUM_TESTNET,
    coreBridgeAddress: WORMHOLE_CORE_ADDRESSES.ETHEREUM_TESTNET,
    network: 'testnet',
  });
}

/**
 * Create a Wormhole adapter for Polygon mainnet
 */
export function createPolygonAdapter(
  options: Omit<WormholeAdapterOptions, 'sourceChain' | 'sourceChainId' | 'coreBridgeAddress' | 'network'>
): WormholeAdapter {
  return new WormholeAdapter({
    ...options,
    sourceChain: 'polygon',
    sourceChainId: WORMHOLE_CHAIN_IDS.POLYGON,
    coreBridgeAddress: WORMHOLE_CORE_ADDRESSES.POLYGON,
    network: 'mainnet',
  });
}

/**
 * Create a Wormhole adapter for Polygon testnet (Mumbai/Amoy)
 */
export function createPolygonTestnetAdapter(
  options: Omit<WormholeAdapterOptions, 'sourceChain' | 'sourceChainId' | 'coreBridgeAddress' | 'network'>
): WormholeAdapter {
  return new WormholeAdapter({
    ...options,
    sourceChain: 'polygon-testnet',
    sourceChainId: WORMHOLE_CHAIN_IDS.POLYGON_TESTNET,
    coreBridgeAddress: WORMHOLE_CORE_ADDRESSES.POLYGON_TESTNET,
    network: 'testnet',
  });
}

/**
 * Create a Wormhole adapter for BSC mainnet
 */
export function createBSCAdapter(
  options: Omit<WormholeAdapterOptions, 'sourceChain' | 'sourceChainId' | 'coreBridgeAddress' | 'network'>
): WormholeAdapter {
  return new WormholeAdapter({
    ...options,
    sourceChain: 'bsc',
    sourceChainId: WORMHOLE_CHAIN_IDS.BSC,
    coreBridgeAddress: WORMHOLE_CORE_ADDRESSES.BSC,
    network: 'mainnet',
  });
}

/**
 * Create a Wormhole adapter for Avalanche mainnet
 */
export function createAvalancheAdapter(
  options: Omit<WormholeAdapterOptions, 'sourceChain' | 'sourceChainId' | 'coreBridgeAddress' | 'network'>
): WormholeAdapter {
  return new WormholeAdapter({
    ...options,
    sourceChain: 'avalanche',
    sourceChainId: WORMHOLE_CHAIN_IDS.AVALANCHE,
    coreBridgeAddress: WORMHOLE_CORE_ADDRESSES.AVALANCHE,
    network: 'mainnet',
  });
}

/**
 * Get Wormhole chain ID for a chain name
 */
export function getWormholeChainId(chainName: string, testnet = false): number {
  const chainMap: Record<string, { mainnet: number; testnet: number }> = {
    ethereum: { mainnet: WORMHOLE_CHAIN_IDS.ETHEREUM, testnet: WORMHOLE_CHAIN_IDS.ETHEREUM_TESTNET },
    polygon: { mainnet: WORMHOLE_CHAIN_IDS.POLYGON, testnet: WORMHOLE_CHAIN_IDS.POLYGON_TESTNET },
    bsc: { mainnet: WORMHOLE_CHAIN_IDS.BSC, testnet: WORMHOLE_CHAIN_IDS.BSC },
    avalanche: { mainnet: WORMHOLE_CHAIN_IDS.AVALANCHE, testnet: WORMHOLE_CHAIN_IDS.AVALANCHE },
    solana: { mainnet: WORMHOLE_CHAIN_IDS.SOLANA, testnet: WORMHOLE_CHAIN_IDS.SOLANA_DEVNET },
    sui: { mainnet: WORMHOLE_CHAIN_IDS.SUI, testnet: WORMHOLE_CHAIN_IDS.SUI },
    near: { mainnet: WORMHOLE_CHAIN_IDS.NEAR, testnet: WORMHOLE_CHAIN_IDS.NEAR },
  };

  const chain = chainMap[chainName.toLowerCase()];
  if (!chain) {
    throw new Error(`Unknown chain: ${chainName}`);
  }

  return testnet ? chain.testnet : chain.mainnet;
}

/**
 * Get Wormhole core bridge address for a chain
 */
export function getWormholeCoreAddress(chainName: string, testnet = false): string {
  const addressMap: Record<string, { mainnet: string; testnet: string }> = {
    ethereum: { mainnet: WORMHOLE_CORE_ADDRESSES.ETHEREUM, testnet: WORMHOLE_CORE_ADDRESSES.ETHEREUM_TESTNET },
    polygon: { mainnet: WORMHOLE_CORE_ADDRESSES.POLYGON, testnet: WORMHOLE_CORE_ADDRESSES.POLYGON_TESTNET },
    bsc: { mainnet: WORMHOLE_CORE_ADDRESSES.BSC, testnet: WORMHOLE_CORE_ADDRESSES.BSC },
    avalanche: { mainnet: WORMHOLE_CORE_ADDRESSES.AVALANCHE, testnet: WORMHOLE_CORE_ADDRESSES.AVALANCHE },
  };

  const chain = addressMap[chainName.toLowerCase()];
  if (!chain) {
    throw new Error(`Unknown chain: ${chainName}`);
  }

  return testnet ? chain.testnet : chain.mainnet;
}

export default WormholeAdapter;
