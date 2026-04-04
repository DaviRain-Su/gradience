/**
 * Solana Devnet Deployment Configuration
 *
 * Configuration for deploying and testing on Solana devnet
 *
 * @module a2a-router/solana-devnet-config
 */

export interface SolanaDevnetConfig {
  /** Solana RPC endpoint */
  rpcUrl: string;
  /** WebSocket endpoint */
  wsUrl: string;
  /** Commitment level */
  commitment: 'processed' | 'confirmed' | 'finalized';
  /** Program IDs */
  programs: {
    reputationAggregator: string;
    wormhole: string;
    layerzero: string;
  };
  /** Token mints */
  tokens: {
    /** Wrapped SOL */
    wSOL: string;
    /** USDC devnet */
    USDC: string;
  };
  /** Test accounts */
  accounts: {
    /** Fee payer (deployer) */
    payer: string;
    /** Agent account */
    agent: string;
    /** Authority */
    authority: string;
  };
}

/**
 * Default devnet configuration
 */
export const DEVNET_CONFIG: SolanaDevnetConfig = {
  rpcUrl: 'https://api.devnet.solana.com',
  wsUrl: 'wss://api.devnet.solana.com',
  commitment: 'confirmed',
  programs: {
    // ChainHub program deployed to devnet
    reputationAggregator: '6G39W7JGQz7A6L5dAvotFuRP9UbFdCJg2BqDuj6WJWec',
    wormhole: 'worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth',
    layerzero: 'LZ1111111111111111111111111111111111111111',
  },
  tokens: {
    wSOL: 'So11111111111111111111111111111111111111112',
    USDC: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  },
  accounts: {
    // These would be generated or loaded from environment
    payer: process.env.SOLANA_PAYER_KEY || '',
    agent: process.env.SOLANA_AGENT_KEY || '',
    authority: process.env.SOLANA_AUTHORITY_KEY || '',
  },
};

/**
 * Test configuration for local testing
 */
export const LOCAL_TEST_CONFIG: SolanaDevnetConfig = {
  rpcUrl: 'http://localhost:8899',
  wsUrl: 'ws://localhost:8900',
  commitment: 'confirmed',
  programs: {
    reputationAggregator: 'Rep2222222222222222222222222222222222222222',
    wormhole: 'worm2222222222222222222222222222222222222222',
    layerzero: 'LZ2222222222222222222222222222222222222222',
  },
  tokens: {
    wSOL: 'So11111111111111111111111111111111111111112',
    USDC: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  },
  accounts: {
    payer: '',
    agent: '',
    authority: '',
  },
};

/**
 * Get configuration based on environment
 */
export function getConfig(environment: 'devnet' | 'local' = 'devnet'): SolanaDevnetConfig {
  switch (environment) {
    case 'local':
      return LOCAL_TEST_CONFIG;
    case 'devnet':
    default:
      return DEVNET_CONFIG;
  }
}

export default DEVNET_CONFIG;
