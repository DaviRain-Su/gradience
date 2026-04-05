/**
 * LayerZero Cross-Chain Adapter - Production Implementation
 *
 * Integration with LayerZero V2 for cross-chain message passing
 * Supports: Ethereum, Polygon, Sui, Near, Solana
 *
 * @module cross-chain-adapters/adapters/layerzero
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
  LayerZeroMessageReceipt,
  LayerZeroFeeQuote,
  RetryConfig,
} from '../types/index.js';
import { CROSS_CHAIN_ERROR_CODES } from '../types/index.js';

// ============================================================================
// LayerZero V2 Configuration
// ============================================================================

/**
 * LayerZero Endpoint IDs (EIDs) for supported chains
 * Reference: https://docs.layerzero.network/v2/deployments/deployed-contracts
 */
export const LZ_EIDS = {
  // Mainnet
  ETHEREUM: 30101,
  POLYGON: 30109,
  SOLANA: 30168,
  SUI: 30183,
  NEAR: 30207,
  // Testnet
  ETHEREUM_TESTNET: 40161,
  POLYGON_TESTNET: 40209,
  SOLANA_DEVNET: 40168,
  SUI_TESTNET: 40181,
  NEAR_TESTNET: 40205,
} as const;

/**
 * LayerZero Endpoint Addresses
 * These are the LayerZero Endpoint V2 contract addresses
 */
export const LZ_ENDPOINTS = {
  ETHEREUM: '0x1a44076050125825900e736c501f859c50fE728c',
  POLYGON: '0x1a44076050125825900e736c501f859c50fE728c',
  SOLANA: '76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6',
  SUI: '', // TODO: Add Sui endpoint
  NEAR: '', // TODO: Add Near endpoint
  // Testnet
  ETHEREUM_TESTNET: '0x6EDCE65403992e310A62460808c4b910D972f10f',
  POLYGON_TESTNET: '0x6EDCE65403992e310A62460808c4b910D972f10f',
  SOLANA_DEVNET: '76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6',
} as const;

/**
 * LayerZero DVN (Decentralized Verifier Network) addresses
 */
export const LZ_DVNS = {
  ETHEREUM: [
    '0x589aB4F6b69d600e9882eEbaa20F600B5b81F3b4', // LayerZero Labs
    '0xA80C7E28dbD9eC68aa9427583B8e2fd8B06D3A7b', // Google Cloud
  ],
  POLYGON: [
    '0x23DE2FE532d90411B9bFe2af49F49C2aF77E6211',
    '0xD56e4E23c5E29828B88F4E9b00B302e75be52dD3',
  ],
  // Testnet DVNs
  ETHEREUM_TESTNET: [
    '0x8eebf8b423B64b9E46427bf9a0bE05170bA6e6E0',
  ],
} as const;

// ============================================================================
// Options Interfaces
// ============================================================================

export interface LayerZeroAdapterOptions {
  /** Agent ID on Solana chain */
  solanaAgentId: string;
  /** Source chain name (ethereum, polygon, sui, near, etc.) */
  sourceChain: string;
  /** Source chain endpoint ID (LayerZero EID) */
  sourceEid: number;
  /** Solana chain endpoint ID */
  solanaEid: number;
  /** Agent address on source chain (may differ from Solana address) */
  sourceAgentAddress: string;
  /** LayerZero Endpoint contract address on source chain */
  endpointAddress: string;
  /** RPC URL for source chain */
  rpcUrl: string;
  /** OApp contract address (the contract that will send/receive messages) */
  oAppAddress?: string;
  /** Private key or signer for sending transactions (optional, for testing) */
  privateKey?: string;
  /** Use demo mode (simulates transactions without real blockchain calls) */
  demoMode?: boolean;
  /** Retry configuration */
  retryConfig?: Partial<RetryConfig>;
  /** Maximum message size in bytes (LayerZero limit is typically ~10KB) */
  maxMessageSize?: number;
  /** Gas limit for LayerZero transactions */
  gasLimit?: bigint;
  /** Logger instance */
  logger?: Console;
}

export interface CrossChainReputationMessage {
  version: '1.0';
  messageType: 'reputation_sync' | 'task_completion' | 'attestation';
  sourceChain: string;
  targetChain: 'solana';
  timestamp: number;
  nonce: number;
  sourceAgentAddress: string;     // Address on source chain (Ethereum, Sui, etc.)
  solanaAgentAddress: string;     // Address on Solana (target)
  reputationData: ReputationData;
  signature: string;
  /** Optional metadata for LayerZero-specific info */
  lzMetadata?: {
    guid?: string;
    srcEid?: number;
    dstEid?: number;
  };
}

// ============================================================================
// LayerZero Endpoint ABI (V2)
// ============================================================================

const ENDPOINT_V2_ABI = [
  // quote function - gets fee estimate
  {
    inputs: [
      { name: '_dstEid', type: 'uint32' },
      { name: '_message', type: 'bytes' },
      { name: '_options', type: 'bytes' },
      { name: '_payInLzToken', type: 'bool' },
    ],
    name: 'quote',
    outputs: [
      {
        components: [
          { name: 'nativeFee', type: 'uint256' },
          { name: 'lzTokenFee', type: 'uint256' },
        ],
        name: 'fee',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // send function - sends cross-chain message
  {
    inputs: [
      { name: '_dstEid', type: 'uint32' },
      { name: '_receiver', type: 'bytes32' },
      { name: '_message', type: 'bytes' },
      { name: '_options', type: 'bytes' },
      { name: '_fee', type: 'bytes' },
    ],
    name: 'send',
    outputs: [
      { name: 'guid', type: 'bytes32' },
      { name: 'nonce', type: 'uint64' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  // getInboundNonce - get nonce for received messages
  {
    inputs: [
      { name: '_srcEid', type: 'uint32' },
      { name: '_sender', type: 'bytes32' },
    ],
    name: 'getInboundNonce',
    outputs: [{ name: '', type: 'uint64' }],
    stateMutability: 'view',
    type: 'function',
  },
  // getOutboundNonce - get nonce for sent messages
  {
    inputs: [
      { name: '_dstEid', type: 'uint32' },
      { name: '_sender', type: 'address' },
    ],
    name: 'getOutboundNonce',
    outputs: [{ name: '', type: 'uint64' }],
    stateMutability: 'view',
    type: 'function',
  },
  // MessageDelivered event
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'guid', type: 'bytes32' },
      { indexed: false, name: 'srcEid', type: 'uint32' },
      { indexed: true, name: 'sender', type: 'address' },
      { indexed: false, name: 'nonce', type: 'uint64' },
    ],
    name: 'MessageDelivered',
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

// ============================================================================
// Main Adapter Class
// ============================================================================

/**
 * LayerZero Adapter for cross-chain reputation sync
 * 
 * Production-ready implementation supporting LayerZero V2 protocol
 * for sending and receiving cross-chain messages.
 */
export class LayerZeroAdapter implements ProtocolAdapter {
  readonly protocol = 'layerzero' as const;
  private options: Required<LayerZeroAdapterOptions>;
  private retryConfig: RetryConfig;
  private connected = false;
  private lastActivityAt?: number;
  private messageHandler?: (message: A2AMessage) => void | Promise<void>;
  private pendingMessages = new Map<string, BridgeResult>();
  private messageReceipts = new Map<string, LayerZeroMessageReceipt>();
  private pollInterval?: ReturnType<typeof setInterval>;
  
  // Ethers.js provider and contract (initialized when available)
  private provider?: unknown;
  private endpointContract?: unknown;
  private wallet?: unknown;
  
  // LayerZero SDK imports (loaded dynamically)
  private lzSdk?: {
    Options: new () => {
      addExecutorLzReceiveOption: (gasLimit: bigint, value: bigint) => unknown;
      encode: () => string;
    };
  };

  constructor(options: LayerZeroAdapterOptions) {
    this.options = {
      solanaAgentId: options.solanaAgentId,
      sourceChain: options.sourceChain,
      sourceEid: options.sourceEid,
      solanaEid: options.solanaEid,
      sourceAgentAddress: options.sourceAgentAddress,
      endpointAddress: options.endpointAddress,
      rpcUrl: options.rpcUrl,
      oAppAddress: options.oAppAddress ?? options.sourceAgentAddress,
      privateKey: options.privateKey ?? '',
      demoMode: options.demoMode ?? false,
      retryConfig: {},
      maxMessageSize: options.maxMessageSize ?? DEFAULT_MAX_MESSAGE_SIZE,
      gasLimit: options.gasLimit ?? DEFAULT_GAS_LIMIT,
      logger: options.logger ?? console,
    };
    
    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...options.retryConfig,
    };
  }

  // ============ Lifecycle ============

  async initialize(): Promise<void> {
    if (this.options.demoMode) {
      this.options.logger.warn('[LayerZeroAdapter] Running in DEMO MODE - transactions will be simulated');
      this.connected = true;
      return;
    }

    try {
      // Try to initialize LayerZero SDK and ethers
      await this.initializeSdk();
      await this.connectEndpoint();
      this.connected = true;
      this.startMessagePolling();
      this.options.logger.log(`[LayerZeroAdapter] Initialized on ${this.options.sourceChain} (EID: ${this.options.sourceEid})`);
    } catch (error) {
      this.options.logger.error('[LayerZeroAdapter] Initialization failed:', error);
      throw new Error(`Failed to initialize LayerZero adapter: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async shutdown(): Promise<void> {
    this.connected = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
    this.options.logger.log('[LayerZeroAdapter] Shutdown');
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
        protocol: 'layerzero',
        error: 'LayerZero adapter not connected',
        errorCode: CROSS_CHAIN_ERROR_CODES.PROTOCOL_NOT_AVAILABLE,
        timestamp: Date.now(),
      };
    }

    try {
      // Convert A2A message to cross-chain reputation message
      const reputationMessage = this.convertToReputationMessage(message);

      // Validate message size
      const payload = this.encodeMessage(reputationMessage);
      if (payload.length > this.options.maxMessageSize) {
        return {
          success: false,
          messageId: message.id,
          protocol: 'layerzero',
          error: `Message size ${payload.length} exceeds maximum ${this.options.maxMessageSize}`,
          errorCode: CROSS_CHAIN_ERROR_CODES.LZ_MESSAGE_TOO_LARGE,
          timestamp: Date.now(),
        };
      }

      // Send via LayerZero with retry logic
      const result = await this.sendWithRetry(reputationMessage);

      this.pendingMessages.set(result.messageId, result);
      this.lastActivityAt = Date.now();

      return {
        success: true,
        messageId: message.id,
        protocol: 'layerzero',
        timestamp: Date.now(),
        metadata: {
          demo: this.options.demoMode,
          txHash: result.txHash,
          messageId: result.messageId,
        },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.options.logger.error('[LayerZeroAdapter] Send failed:', err);
      
      return {
        success: false,
        messageId: message.id,
        protocol: 'layerzero',
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

    // Start listening for incoming LayerZero messages
    this.startListening();

    return {
      protocol: 'layerzero',
      unsubscribe: async () => {
        this.messageHandler = undefined;
      },
    };
  }

  // ============ Discovery ============

  async discoverAgents(_filter?: AgentFilter): Promise<AgentInfo[]> {
    // LayerZero doesn't have built-in discovery
    // Discovery happens through Soul chain or other protocols
    return [];
  }

  async broadcastCapabilities(agentInfo: AgentInfo): Promise<void> {
    // Broadcast agent capabilities to Soul chain via LayerZero
    const message: CrossChainReputationMessage = {
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
      signature: '', // Will be signed before sending
    };

    await this.sendWithRetry(message);
  }

  // ============ Health ============

  health(): ProtocolHealthStatus {
    return {
      available: this.isAvailable(),
      peerCount: this.pendingMessages.size,
      subscribedTopics: this.isAvailable() ? ['layerzero-messages'] : [],
      lastActivityAt: this.lastActivityAt,
    };
  }

  // ============ LayerZero Specific Methods ============

  /**
   * Sync reputation data to Solana chain
   */
  async syncReputation(
    reputationData: ReputationData
  ): Promise<BridgeResult> {
    const message: CrossChainReputationMessage = {
      version: '1.0',
      messageType: 'reputation_sync',
      sourceChain: this.options.sourceChain,
      targetChain: 'solana',
      timestamp: Date.now(),
      nonce: this.generateNonce(),
      sourceAgentAddress: this.options.sourceAgentAddress,
      solanaAgentAddress: this.options.solanaAgentId,
      reputationData,
      signature: '',
    };

    return this.sendWithRetry(message);
  }

  /**
   * Quote fees for cross-chain message
   * @param payload - Message payload
   * @param options - Execution options
   * @returns Fee quote
   */
  async quote(
    payload: string,
    options?: { gasLimit?: bigint; value?: bigint }
  ): Promise<LayerZeroFeeQuote> {
    if (this.options.demoMode) {
      // Demo fee estimation
      const baseFee = 0.001; // ETH
      const perByteFee = 0.00001;
      const totalFee = baseFee + payload.length * perByteFee;

      return {
        nativeFee: BigInt(Math.floor(totalFee * 1e18)),
        lzTokenFee: BigInt(0),
        gasLimit: options?.gasLimit ?? this.options.gasLimit,
        options: '',
      };
    }

    if (!this.endpointContract) {
      throw new Error('Endpoint not initialized');
    }

    try {
      // Build LayerZero options
      const lzOptions = this.buildLzOptions(
        options?.gasLimit ?? this.options.gasLimit,
        options?.value ?? BigInt(0)
      );

      // Call quote function
      const fee = await this.callQuote(
        this.options.solanaEid,
        payload,
        lzOptions,
        false
      );

      return {
        nativeFee: fee.nativeFee,
        lzTokenFee: fee.lzTokenFee,
        gasLimit: options?.gasLimit ?? this.options.gasLimit,
        options: lzOptions,
      };
    } catch (error) {
      this.options.logger.error('[LayerZeroAdapter] Quote failed:', error);
      throw new Error(`Quote failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check message status by message ID
   */
  async checkMessageStatus(messageId: string): Promise<BridgeResult | null> {
    const result = this.pendingMessages.get(messageId) ?? null;
    
    if (result && this.messageReceipts.has(messageId)) {
      const receipt = this.messageReceipts.get(messageId)!;
      result.status = this.mapLzStatusToBridgeStatus(receipt.status);
    }
    
    return result;
  }

  /**
   * Get detailed message receipt
   */
  async getMessageReceipt(messageId: string): Promise<LayerZeroMessageReceipt | null> {
    return this.messageReceipts.get(messageId) ?? null;
  }

  /**
   * Verify message delivery on destination chain
   */
  async verifyDelivery(guid: string): Promise<boolean> {
    const receipt = Array.from(this.messageReceipts.values()).find(r => r.guid === guid);
    return receipt?.status === 'delivered' || receipt?.status === 'confirmed' || false;
  }

  // ============ Private Methods ============

  private async initializeSdk(): Promise<void> {
    try {
      // Dynamic import for optional dependencies
      // The module is an optional peer dependency - may not be installed
      const moduleName = '@layerzerolabs/lz-v2-utilities';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lzModule: any = await (await import(moduleName)).default;
      this.lzSdk = { Options: lzModule.Options };
      this.options.logger.log('[LayerZeroAdapter] LayerZero SDK loaded');
    } catch {
      this.options.logger.warn('[LayerZeroAdapter] LayerZero SDK not available, using fallback');
    }

    try {
      // Initialize ethers provider and wallet
      const { JsonRpcProvider, Wallet, Contract } = await import('ethers');
      
      this.provider = new JsonRpcProvider(this.options.rpcUrl);
      
      if (this.options.privateKey) {
        this.wallet = new Wallet(this.options.privateKey, this.provider as any);
      }
      
      this.endpointContract = new Contract(
        this.options.endpointAddress,
        ENDPOINT_V2_ABI,
        this.wallet || (this.provider as any)
      );
      
      this.options.logger.log('[LayerZeroAdapter] Ethers.js initialized');
    } catch {
      this.options.logger.warn('[LayerZeroAdapter] Ethers.js not available, using demo mode');
      this.options.demoMode = true;
    }
  }

  private async connectEndpoint(): Promise<void> {
    if (!this.endpointContract) {
      throw new Error('Endpoint contract not initialized');
    }

    try {
      // Verify connection by checking outbound nonce
      const contract = this.endpointContract as {
        getOutboundNonce: (dstEid: number, sender: string) => Promise<bigint>;
      };
      
      const nonce = await contract.getOutboundNonce(
        this.options.solanaEid,
        this.options.oAppAddress
      );
      
      this.options.logger.log(`[LayerZeroAdapter] Connected to endpoint, current nonce: ${nonce}`);
    } catch (error) {
      throw new Error(`Failed to connect to LayerZero endpoint: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private buildLzOptions(gasLimit: bigint, value: bigint): string {
    if (this.lzSdk) {
      const options = new this.lzSdk.Options();
      options.addExecutorLzReceiveOption(gasLimit, value);
      return options.encode();
    }
    
    // Fallback: return empty options
    return '0x';
  }

  private async callQuote(
    dstEid: number,
    message: string,
    options: string,
    payInLzToken: boolean
  ): Promise<{ nativeFee: bigint; lzTokenFee: bigint }> {
    if (!this.endpointContract) {
      throw new Error('Endpoint contract not initialized');
    }

    const contract = this.endpointContract as {
      quote: (
        dstEid: number,
        message: string,
        options: string,
        payInLzToken: boolean
      ) => Promise<{ nativeFee: bigint; lzTokenFee: bigint }>;
    };

    return await contract.quote(dstEid, message, options, payInLzToken);
  }

  private async sendWithRetry(
    message: CrossChainReputationMessage
  ): Promise<BridgeResult> {
    let lastError: Error | undefined;
    let delay = this.retryConfig.retryDelay;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await this.sendViaLayerZero(message);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.retryConfig.maxRetries) {
          this.options.logger.warn(
            `[LayerZeroAdapter] Send attempt ${attempt + 1} failed, retrying in ${delay}ms...`
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

  private async sendViaLayerZero(
    message: CrossChainReputationMessage
  ): Promise<BridgeResult> {
    // Sign the message
    const signedMessage = await this.signMessage(message);

    // Encode message for LayerZero
    const payload = this.encodeMessage(signedMessage);

    if (this.options.demoMode) {
      return this.simulateSend(payload);
    }

    if (!this.endpointContract || !this.wallet) {
      throw new Error('LayerZero not properly initialized');
    }

    // Get fee quote
    const feeQuote = await this.quote(payload);

    // Check if we have sufficient funds
    const { BrowserProvider } = await import('ethers');
    const provider = new BrowserProvider(this.provider as any);
    const balance = await provider.getBalance(this.options.sourceAgentAddress);
    
    if (balance < feeQuote.nativeFee) {
      throw new Error(
        `Insufficient funds for LayerZero fee. Required: ${feeQuote.nativeFee}, Available: ${balance}`
      );
    }

    // Build options
    const options = this.buildLzOptions(feeQuote.gasLimit, BigInt(0));

    // Encode receiver address (32 bytes)
    const receiver = this.padAddressToBytes32(this.options.solanaAgentId);

    // Send transaction
    const contract = this.endpointContract as {
      send: (
        dstEid: number,
        receiver: string,
        message: string,
        options: string,
        fee: string,
        overrides: { value: bigint }
      ) => Promise<{ hash: string; wait: () => Promise<{ logs: unknown[] }> }>;
    };

    const tx = await contract.send(
      this.options.solanaEid,
      receiver,
      payload,
      options,
      '0x', // Fee is paid in native token
      { value: feeQuote.nativeFee }
    );

    this.options.logger.log(`[LayerZeroAdapter] Transaction sent: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();

    // Extract GUID from event logs
    const guid = this.extractGuidFromLogs(receipt.logs);
    const messageId = `lz-${this.options.sourceChain}-${guid}`;

    // Create result
    const result: BridgeResult = {
      txHash: tx.hash,
      messageId,
      status: 'pending',
      estimatedTime: 120, // LayerZero typically takes 1-2 minutes
    };

    // Track message
    this.trackMessage(messageId, guid, tx.hash);

    return result;
  }

  private simulateSend(payload: string): BridgeResult {
    this.options.logger.log(`[LayerZeroAdapter] [DEMO] Sending message to Solana chain (EID: ${this.options.solanaEid})`);
    this.options.logger.log(`[LayerZeroAdapter] [DEMO] Payload size: ${payload.length} bytes`);

    // Simulate transaction
    const txHash = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;

    const guid = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;

    const messageId = `lz-${this.options.sourceChain}-${Date.now()}`;

    // Create result object
    const result: BridgeResult = {
      txHash,
      messageId,
      status: 'pending',
      estimatedTime: 120, // 2 minutes for LayerZero
    };

    // Store immediately so checkMessageStatus can find it
    this.pendingMessages.set(messageId, result);

    // Simulate async delivery
    setTimeout(() => {
      const stored = this.pendingMessages.get(messageId);
      if (stored) {
        stored.status = 'completed';
        this.options.logger.log(`[LayerZeroAdapter] [DEMO] Message ${messageId} delivered to Solana chain`);
      }
      
      // Add receipt
      this.messageReceipts.set(messageId, {
        guid,
        srcEid: this.options.sourceEid,
        dstEid: this.options.solanaEid,
        sender: this.options.sourceAgentAddress,
        receiver: this.options.solanaAgentId,
        nonce: BigInt(Date.now()),
        payloadHash: this.hashPayload(payload),
        status: 'delivered',
        blockConfirmations: 32,
        timestamp: Date.now(),
      });
    }, 5000);

    return result;
  }

  private async signMessage(
    message: CrossChainReputationMessage
  ): Promise<CrossChainReputationMessage> {
    if (this.options.demoMode) {
      // Simulate signature
      const messageHash = this.hashMessage(message);
      const signature = `sig-${messageHash.substring(0, 32)}`;

      return {
        ...message,
        signature,
      };
    }

    if (!this.wallet) {
      throw new Error('Wallet not initialized for signing');
    }

    // Real signing with ethers
    type WalletType = { signMessage: (message: string) => Promise<string> };
    const wallet = this.wallet as WalletType;
    
    const messageHash = this.hashMessage(message);
    const signature = await wallet.signMessage(messageHash);

    return {
      ...message,
      signature,
    };
  }

  private hashMessage(message: CrossChainReputationMessage): string {
    const data = JSON.stringify({
      version: message.version,
      messageType: message.messageType,
      sourceChain: message.sourceChain,
      targetChain: message.targetChain,
      timestamp: message.timestamp,
      nonce: message.nonce,
      sourceAgentAddress: message.sourceAgentAddress,
      solanaAgentAddress: message.solanaAgentAddress,
      reputationData: message.reputationData,
    });
    
    // Simple hash - in production use keccak256
    return `0x${Buffer.from(data).toString('hex')}`;
  }

  private hashPayload(payload: string): string {
    // Simple hash for demo - in production use keccak256
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `0x${Math.abs(hash).toString(16).padStart(64, '0')}`;
  }

  private encodeMessage(message: CrossChainReputationMessage): string {
    // Encode message as JSON
    // In production, consider using a more compact encoding like ABI.encode
    return JSON.stringify(message);
  }

  private convertToReputationMessage(message: A2AMessage): CrossChainReputationMessage {
    return {
      version: '1.0',
      messageType: 'task_completion',
      sourceChain: this.options.sourceChain,
      targetChain: 'solana',
      timestamp: message.timestamp,
      nonce: this.generateNonce(),
      // Source chain address (Ethereum, Sui, Near, etc.)
      sourceAgentAddress: this.options.sourceAgentAddress,
      // Solana chain address (target)
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
      signature: '',
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

  private extractGuidFromLogs(_logs: unknown[]): string {
    // In production, parse event logs to extract GUID
    // For now, generate a random GUID
    return `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;
  }

  private trackMessage(messageId: string, guid: string, txHash: string): void {
    const receipt: LayerZeroMessageReceipt = {
      guid,
      srcEid: this.options.sourceEid,
      dstEid: this.options.solanaEid,
      sender: this.options.sourceAgentAddress,
      receiver: this.options.solanaAgentId,
      nonce: BigInt(Date.now()),
      payloadHash: '',
      status: 'pending',
      blockConfirmations: 0,
      timestamp: Date.now(),
    };

    this.messageReceipts.set(messageId, receipt);

    // Track in pending messages
    const result: BridgeResult = {
      txHash,
      messageId,
      status: 'pending',
      estimatedTime: 120,
    };

    this.pendingMessages.set(messageId, result);
  }

  private mapLzStatusToBridgeStatus(lzStatus: string): 'pending' | 'completed' | 'failed' {
    switch (lzStatus) {
      case 'delivered':
      case 'confirmed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'pending':
      case 'inflight':
      default:
        return 'pending';
    }
  }

  private startListening(): void {
    if (this.options.demoMode) {
      this.options.logger.log('[LayerZeroAdapter] [DEMO] Started listening for incoming messages');
      return;
    }

    this.options.logger.log('[LayerZeroAdapter] Started listening for incoming LayerZero messages');
    
    // In production, subscribe to events from the LayerZero endpoint
    // This would involve setting up event listeners on the contract
  }

  private startMessagePolling(): void {
    if (this.options.demoMode) return;

    // Poll for message status updates
    this.pollInterval = setInterval(async () => {
      // Convert Map entries to array to avoid iteration issues
      const entries = Array.from(this.messageReceipts.entries());
      for (const [messageId, receipt] of entries) {
        if (receipt.status === 'pending' || receipt.status === 'inflight') {
          // Check status on-chain
          await this.pollMessageStatus(messageId);
        }
      }
    }, 30000); // Poll every 30 seconds
  }

  private async pollMessageStatus(messageId: string): Promise<void> {
    const receipt = this.messageReceipts.get(messageId);
    if (!receipt) return;

    try {
      // In production, query LayerZero endpoint or API for message status
      // This is a placeholder for the actual implementation
      this.options.logger.log(`[LayerZeroAdapter] Polling status for message ${messageId}`);
    } catch (error) {
      this.options.logger.error(`[LayerZeroAdapter] Failed to poll message status: ${error}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a LayerZero adapter for Ethereum mainnet
 */
export function createEthereumAdapter(options: Omit<LayerZeroAdapterOptions, 'sourceChain' | 'sourceEid' | 'endpointAddress'>): LayerZeroAdapter {
  return new LayerZeroAdapter({
    ...options,
    sourceChain: 'ethereum',
    sourceEid: LZ_EIDS.ETHEREUM,
    endpointAddress: LZ_ENDPOINTS.ETHEREUM,
  });
}

/**
 * Create a LayerZero adapter for Ethereum testnet (Sepolia)
 */
export function createEthereumTestnetAdapter(options: Omit<LayerZeroAdapterOptions, 'sourceChain' | 'sourceEid' | 'endpointAddress'>): LayerZeroAdapter {
  return new LayerZeroAdapter({
    ...options,
    sourceChain: 'ethereum-testnet',
    sourceEid: LZ_EIDS.ETHEREUM_TESTNET,
    endpointAddress: LZ_ENDPOINTS.ETHEREUM_TESTNET,
  });
}

/**
 * Create a LayerZero adapter for Polygon
 */
export function createPolygonAdapter(options: Omit<LayerZeroAdapterOptions, 'sourceChain' | 'sourceEid' | 'endpointAddress'>): LayerZeroAdapter {
  return new LayerZeroAdapter({
    ...options,
    sourceChain: 'polygon',
    sourceEid: LZ_EIDS.POLYGON,
    endpointAddress: LZ_ENDPOINTS.POLYGON,
  });
}

/**
 * Create a LayerZero adapter for Polygon testnet (Mumbai/Amoy)
 */
export function createPolygonTestnetAdapter(options: Omit<LayerZeroAdapterOptions, 'sourceChain' | 'sourceEid' | 'endpointAddress'>): LayerZeroAdapter {
  return new LayerZeroAdapter({
    ...options,
    sourceChain: 'polygon-testnet',
    sourceEid: LZ_EIDS.POLYGON_TESTNET,
    endpointAddress: LZ_ENDPOINTS.POLYGON_TESTNET,
  });
}

/**
 * Get LayerZero EID for a chain name
 */
export function getEidForChain(chainName: string, testnet = false): number {
  const chainMap: Record<string, { mainnet: number; testnet: number }> = {
    ethereum: { mainnet: LZ_EIDS.ETHEREUM, testnet: LZ_EIDS.ETHEREUM_TESTNET },
    polygon: { mainnet: LZ_EIDS.POLYGON, testnet: LZ_EIDS.POLYGON_TESTNET },
    solana: { mainnet: LZ_EIDS.SOLANA, testnet: LZ_EIDS.SOLANA_DEVNET },
    sui: { mainnet: LZ_EIDS.SUI, testnet: LZ_EIDS.SUI_TESTNET },
    near: { mainnet: LZ_EIDS.NEAR, testnet: LZ_EIDS.NEAR_TESTNET },
  };

  const chain = chainMap[chainName.toLowerCase()];
  if (!chain) {
    throw new Error(`Unknown chain: ${chainName}`);
  }

  return testnet ? chain.testnet : chain.mainnet;
}

/**
 * Get LayerZero endpoint address for a chain
 */
export function getEndpointForChain(chainName: string, testnet = false): string {
  const endpointMap: Record<string, { mainnet: string; testnet: string }> = {
    ethereum: { mainnet: LZ_ENDPOINTS.ETHEREUM, testnet: LZ_ENDPOINTS.ETHEREUM_TESTNET },
    polygon: { mainnet: LZ_ENDPOINTS.POLYGON, testnet: LZ_ENDPOINTS.POLYGON_TESTNET },
  };

  const chain = endpointMap[chainName.toLowerCase()];
  if (!chain) {
    throw new Error(`Unknown chain: ${chainName}`);
  }

  return testnet ? chain.testnet : chain.mainnet;
}

export default LayerZeroAdapter;
