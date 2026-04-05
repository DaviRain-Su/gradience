/**
 * Solana Agent Registry Client - GRA-228a
 * 
 * Integration with Solana's official Agent Registry protocol.
 * 
 * Note: Contract addresses are placeholders until officially published by Solana.
 * See: https://solana.com/agent-registry
 * 
 * This client implements the expected interface based on:
 * - Solana Agent Registry documentation
 * - ERC-8004 compatible structures
 * - Metaplex Core integration patterns
 */

import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  ComputeBudgetProgram,
  Keypair,
} from '@solana/web3.js';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { logger } from '../utils/logger.js';

// ============================================================================
// Contract Addresses (PLACEHOLDERS - Update when officially published)
// ============================================================================

const SOLANA_AGENT_REGISTRY_ADDRESSES = {
  // Mainnet - To be confirmed by Solana Foundation
  mainnet: {
    programId: 'AgentXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', // Placeholder
    reputationProgramId: 'ReputXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', // Placeholder
  },
  // Devnet - To be confirmed by Solana Foundation  
  devnet: {
    programId: 'AgentXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', // Placeholder
    reputationProgramId: 'ReputXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', // Placeholder
  },
};

// ============================================================================
// IDL (Based on expected interface from solana.com/agent-registry)
// ============================================================================

export const SOLANA_AGENT_REGISTRY_IDL = {
  version: '0.1.0',
  name: 'solana_agent_registry',
  instructions: [
    {
      name: 'registerAgent',
      accounts: [
        { name: 'agent', isMut: true, isSigner: false },
        { name: 'agentPda', isMut: true, isSigner: false },
        { name: 'owner', isMut: true, isSigner: true },
        { name: 'systemProgram', isMut: false, isSigner: false },
        { name: 'rent', isMut: false, isSigner: false },
      ],
      args: [
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'avatar', type: { option: 'string' } },
        { name: 'website', type: { option: 'string' } },
        { name: 'metadata', type: { vec: { defined: 'MetadataEntry' } } },
      ],
    },
    {
      name: 'updateAgentMetadata',
      accounts: [
        { name: 'agent', isMut: true, isSigner: false },
        { name: 'owner', isMut: false, isSigner: true },
      ],
      args: [
        { name: 'metadata', type: { vec: { defined: 'MetadataEntry' } } },
      ],
    },
    {
      name: 'submitReputation',
      accounts: [
        { name: 'reputation', isMut: true, isSigner: false },
        { name: 'agent', isMut: false, isSigner: false },
        { name: 'oracle', isMut: false, isSigner: true },
        { name: 'systemProgram', isMut: false, isSigner: false },
      ],
      args: [
        { name: 'score', type: 'u8' }, // 0-100
        { name: 'category', type: 'string' },
        { name: 'proof', type: 'string' },
        { name: 'timestamp', type: 'i64' },
      ],
    },
    {
      name: 'updateReputation',
      accounts: [
        { name: 'reputation', isMut: true, isSigner: false },
        { name: 'oracle', isMut: false, isSigner: true },
      ],
      args: [
        { name: 'score', type: 'u8' },
        { name: 'proof', type: 'string' },
      ],
    },
  ],
  accounts: [
    {
      name: 'Agent',
      type: {
        kind: 'struct',
        fields: [
          { name: 'owner', type: 'publicKey' },
          { name: 'name', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'avatar', type: { option: 'string' } },
          { name: 'website', type: { option: 'string' } },
          { name: 'metadata', type: { vec: { defined: 'MetadataEntry' } } },
          { name: 'createdAt', type: 'i64' },
          { name: 'updatedAt', type: 'i64' },
          { name: 'bump', type: 'u8' },
        ],
      },
    },
    {
      name: 'Reputation',
      type: {
        kind: 'struct',
        fields: [
          { name: 'agent', type: 'publicKey' },
          { name: 'overallScore', type: 'u8' },
          { name: 'feedbackCount', type: 'u32' },
          { name: 'lastUpdated', type: 'i64' },
          { name: 'history', type: { vec: { defined: 'ReputationEntry' } } },
          { name: 'bump', type: 'u8' },
        ],
      },
    },
  ],
  types: [
    {
      name: 'MetadataEntry',
      type: {
        kind: 'struct',
        fields: [
          { name: 'key', type: 'string' },
          { name: 'value', type: 'string' },
        ],
      },
    },
    {
      name: 'ReputationEntry',
      type: {
        kind: 'struct',
        fields: [
          { name: 'score', type: 'u8' },
          { name: 'category', type: 'string' },
          { name: 'proof', type: 'string' },
          { name: 'timestamp', type: 'i64' },
          { name: 'oracle', type: 'publicKey' },
        ],
      },
    },
  ],
  errors: [
    { code: 6000, name: 'InvalidScore', msg: 'Score must be between 0 and 100' },
    { code: 6001, name: 'InvalidName', msg: 'Name too long' },
    { code: 6002, name: 'InvalidDescription', msg: 'Description too long' },
    { code: 6003, name: 'UnauthorizedOracle', msg: 'Not an authorized oracle' },
    { code: 6004, name: 'AgentNotFound', msg: 'Agent not found' },
  ],
};

// ============================================================================
// Types
// ============================================================================

export interface SolanaAgentRegistryConfig {
  network: 'mainnet' | 'devnet';
  rpcUrl: string;
  oracleKeypair: web3.Keypair;
  programId?: string;
  reputationProgramId?: string;
}

export interface AgentRegistrationParams {
  name: string;
  description: string;
  avatar?: string;
  website?: string;
  metadata?: Record<string, string>;
  owner: PublicKey;
}

export interface AgentRegistrationResult {
  agentPDA: string;
  signature: string;
  timestamp: number;
}

export interface ReputationSubmissionParams {
  agentPDA: string;
  score: number; // 0-100
  category: string;
  proof: string;
  timestamp?: number;
}

export interface ReputationData {
  agentPDA: string;
  overallScore: number;
  feedbackCount: number;
  lastUpdated: number;
  history: Array<{
    score: number;
    category: string;
    proof: string;
    timestamp: number;
    oracle: string;
  }>;
}

export interface AgentData {
  owner: string;
  name: string;
  description: string;
  avatar: string | null;
  website: string | null;
  metadata: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Client Implementation
// ============================================================================

export class SolanaAgentRegistryClient {
  private connection: Connection;
  private provider: AnchorProvider;
  private program: Program;
  private oracleKeypair: web3.Keypair;
  private config: SolanaAgentRegistryConfig;

  constructor(config: SolanaAgentRegistryConfig) {
    this.config = config;
    this.oracleKeypair = config.oracleKeypair;

    // Initialize connection
    this.connection = new Connection(config.rpcUrl, 'confirmed');

    // Initialize provider
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.provider = new AnchorProvider(
      this.connection,
      {
        publicKey: this.oracleKeypair.publicKey,
        signTransaction: async (tx: any) => {
          tx.partialSign(this.oracleKeypair);
          return tx;
        },
        signAllTransactions: async (txs: any[]) => {
          txs.forEach(tx => tx.partialSign(this.oracleKeypair));
          return txs;
        },
      } as any,
      { commitment: 'confirmed' }
    );

    // Get program ID
    const addresses = config.network === 'mainnet' 
      ? SOLANA_AGENT_REGISTRY_ADDRESSES.mainnet 
      : SOLANA_AGENT_REGISTRY_ADDRESSES.devnet;

    const programId = new PublicKey(
      config.programId || addresses.programId
    );

    // Check if using placeholder
    if (programId.toBase58().includes('XXX') || programId.toBase58().includes('AgentX')) {
      logger.warn(
        { programId: programId.toBase58() },
        'Using placeholder Solana Agent Registry program ID. Real integration pending official address publication.'
      );
    }

    // Initialize program
    this.program = new Program(
      SOLANA_AGENT_REGISTRY_IDL as any,
      programId as any,
      this.provider as any
    ) as any;

    logger.info(
      {
        network: config.network,
        programId: programId.toBase58(),
        oracle: this.oracleKeypair.publicKey.toBase58(),
      },
      'Solana Agent Registry client initialized'
    );
  }

  /**
   * Register a new agent on Solana Agent Registry
   */
  async registerAgent(params: AgentRegistrationParams): Promise<AgentRegistrationResult> {
    try {
      // Derive agent PDA
      const [agentPDA, bump] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('agent'),
          params.owner.toBuffer(),
          Buffer.from(params.name),
        ],
        this.program.programId
      );

      // Convert metadata to program format
      const metadataEntries = Object.entries(params.metadata || {}).map(([key, value]) => ({
        key,
        value,
      }));

      logger.info(
        { name: params.name, owner: params.owner.toBase58(), agentPDA: agentPDA.toBase58() },
        'Registering agent on Solana Agent Registry'
      );

      // Build transaction
      const tx = await this.program.methods
        .registerAgent(
          params.name,
          params.description,
          params.avatar || null,
          params.website || null,
          metadataEntries
        )
        .accounts({
          agent: this.oracleKeypair.publicKey, // Placeholder - actual account structure may differ
          agentPda: agentPDA,
          owner: params.owner,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .transaction();

      // Add compute budget
      tx.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 })
      );

      // Send transaction
      const signature = await this.provider.sendAndConfirm(tx);

      logger.info(
        { agentPDA: agentPDA.toBase58(), signature },
        'Agent registered on Solana Agent Registry'
      );

      return {
        agentPDA: agentPDA.toBase58(),
        signature,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error({ error, params }, 'Failed to register agent on Solana Agent Registry');
      throw error;
    }
  }

  /**
   * Submit reputation score for an agent
   */
  async submitReputation(params: ReputationSubmissionParams): Promise<string> {
    try {
      const agentPDA = new PublicKey(params.agentPDA);
      const timestamp = params.timestamp || Math.floor(Date.now() / 1000);

      // Derive reputation PDA
      const [reputationPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('reputation'), agentPDA.toBuffer()],
        this.program.programId
      );

      logger.info(
        {
          agentPDA: params.agentPDA,
          score: params.score,
          category: params.category,
        },
        'Submitting reputation to Solana Agent Registry'
      );

      // Build transaction
      const tx = await this.program.methods
        .submitReputation(
          params.score,
          params.category,
          params.proof,
          new BN(timestamp)
        )
        .accounts({
          reputation: reputationPDA,
          agent: agentPDA,
          oracle: this.oracleKeypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      // Send transaction
      const signature = await this.provider.sendAndConfirm(tx);

      logger.info(
        { agentPDA: params.agentPDA, signature, score: params.score },
        'Reputation submitted to Solana Agent Registry'
      );

      return signature;
    } catch (error) {
      logger.error({ error, params }, 'Failed to submit reputation');
      throw error;
    }
  }

  /**
   * Get agent data from registry
   */
  async getAgent(agentPDA: string): Promise<AgentData | null> {
    try {
      const pda = new PublicKey(agentPDA);
      const account = await (this.program.account as any).agent.fetch(pda);

      if (!account) {
        return null;
      }

      // Convert metadata entries to record
      const metadata: Record<string, string> = {};
      for (const entry of (account.metadata as any[]) || []) {
        metadata[entry.key] = entry.value;
      }

      return {
        owner: (account.owner as PublicKey).toBase58(),
        name: account.name as string,
        description: account.description as string,
        avatar: account.avatar as string | null,
        website: account.website as string | null,
        metadata,
        createdAt: (account.createdAt as BN).toNumber() * 1000,
        updatedAt: (account.updatedAt as BN).toNumber() * 1000,
      };
    } catch (error) {
      logger.error({ error, agentPDA }, 'Failed to fetch agent data');
      return null;
    }
  }

  /**
   * Get reputation data for an agent
   */
  async getReputation(agentPDA: string): Promise<ReputationData | null> {
    try {
      const pda = new PublicKey(agentPDA);
      
      // Derive reputation PDA
      const [reputationPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('reputation'), pda.toBuffer()],
        this.program.programId
      );

      const account = await (this.program.account as any).reputation.fetch(reputationPDA);

      if (!account) {
        return null;
      }

      return {
        agentPDA,
        overallScore: account.overallScore as number,
        feedbackCount: account.feedbackCount as number,
        lastUpdated: (account.lastUpdated as BN).toNumber() * 1000,
        history: ((account.history as any[]) || []).map((entry) => ({
          score: entry.score,
          category: entry.category,
          proof: entry.proof,
          timestamp: (entry.timestamp as BN).toNumber() * 1000,
          oracle: (entry.oracle as PublicKey).toBase58(),
        })),
      };
    } catch (error) {
      logger.error({ error, agentPDA }, 'Failed to fetch reputation data');
      return null;
    }
  }

  /**
   * Check if agent is registered
   */
  async isRegistered(agentPDA: string): Promise<boolean> {
    try {
      const pda = new PublicKey(agentPDA);
      const account = await this.connection.getAccountInfo(pda);
      return account !== null;
    } catch {
      return false;
    }
  }

  /**
   * Update agent metadata
   */
  async updateAgentMetadata(
    agentPDA: string,
    metadata: Record<string, string>
  ): Promise<string> {
    try {
      const pda = new PublicKey(agentPDA);
      
      // Convert metadata to program format
      const metadataEntries = Object.entries(metadata).map(([key, value]) => ({
        key,
        value,
      }));

      logger.info({ agentPDA, metadataKeys: Object.keys(metadata) }, 'Updating agent metadata');

      // Build transaction
      const tx = await this.program.methods
        .updateAgentMetadata(metadataEntries)
        .accounts({
          agent: pda,
          owner: this.oracleKeypair.publicKey,
        })
        .transaction();

      // Send transaction
      const signature = await this.provider.sendAndConfirm(tx);

      logger.info({ agentPDA, signature }, 'Agent metadata updated');

      return signature;
    } catch (error) {
      logger.error({ error, agentPDA }, 'Failed to update agent metadata');
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    network: string;
    programId: string;
    slot: number;
    oracle: string;
  }> {
    try {
      const slot = await this.connection.getSlot();
      const programAccount = await this.connection.getAccountInfo(this.program.programId);

      return {
        healthy: programAccount !== null && slot > 0,
        network: this.config.network,
        programId: this.program.programId.toBase58(),
        slot,
        oracle: this.oracleKeypair.publicKey.toBase58(),
      };
    } catch (error) {
      return {
        healthy: false,
        network: this.config.network,
        programId: this.program.programId.toBase58(),
        slot: 0,
        oracle: this.oracleKeypair.publicKey.toBase58(),
      };
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createSolanaAgentRegistryClient(
  config: SolanaAgentRegistryConfig
): SolanaAgentRegistryClient {
  return new SolanaAgentRegistryClient(config);
}

// ============================================================================
// Placeholder Warning
// ============================================================================

logger.warn(
  'Solana Agent Registry integration uses PLACEHOLDER contract addresses. ' +
  'Real integration requires official program IDs from https://solana.com/agent-registry'
);
