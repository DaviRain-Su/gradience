/**
 * OWS (Open Wallet Standard) Adapter Types
 *
 * @module @gradiences/ows-adapter
 */

/**
 * OWS Wallet interface
 */
export interface OWSWallet {
  /** Wallet address */
  address: string;
  /** Public key */
  publicKey: string;
  /** Sign a message */
  signMessage(message: string): Promise<string>;
  /** Sign a transaction */
  signTransaction(tx: any): Promise<any>;
}

/**
 * OWS Identity interface
 */
export interface OWSIdentity {
  /** Decentralized Identifier */
  did: string;
  /** Associated wallet */
  wallet: OWSWallet;
  /** Verifiable credentials */
  credentials: OWSCredential[];
}

/**
 * OWS Credential interface
 */
export interface OWSCredential {
  /** Credential type */
  type: string;
  /** Credential issuer */
  issuer: string;
  /** Credential data */
  data: any;
  /** Signature */
  signature: string;
  /** Issued at timestamp */
  issuedAt: number;
}

/**
 * Agent Credential types
 */
export type AgentCredentialType = 'reputation' | 'skill' | 'verification';

/**
 * Agent Credential interface
 */
export interface AgentCredential {
  type: AgentCredentialType;
  issuer: string;
  data: any;
  issuedAt: number;
}

/**
 * OWS Agent Configuration
 */
export interface OWSAgentConfig {
  /** API Key (optional) */
  apiKey?: string;
  /** Network */
  network: 'mainnet' | 'devnet';
  /** Default chain */
  defaultChain: 'solana' | 'ethereum';
  /** XMTP environment */
  xmtpEnv?: 'production' | 'dev';
  /** Solana RPC endpoint (optional) */
  rpcEndpoint?: string;
}

/**
 * Agent Identity with OWS integration
 */
export interface AgentIdentity {
  /** Solana address */
  solanaAddress: string;
  /** OWS Wallet address (optional) */
  owsWallet?: string;
  /** OWS DID (optional) */
  owsDID?: string;
  /** Credentials */
  credentials?: AgentCredential[];
}

/**
 * Task Agreement for signing
 */
export interface TaskAgreement {
  /** Task ID */
  taskId: string;
  /** Task hash */
  hash: string;
  /** Agent address */
  agent: string;
  /** Reward amount */
  reward: number;
  /** Deadline */
  deadline: number;
}

/**
 * Connection status
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * OWS Adapter events
 */
export interface OWSEvents {
  onConnect: (identity: OWSIdentity) => void;
  onDisconnect: () => void;
  onError: (error: Error) => void;
}
