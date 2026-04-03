/**
 * OWS Auth Provider for AgentM
 * 
 * Integrates Open Wallet Standard (OWS) as an authentication provider,
 * enabling users to login with their OWS Wallet instead of Privy.
 * 
 * Features:
 * - Multi-chain wallet support (Solana, Ethereum, etc.)
 * - Unified identity across chains
 * - Credential management
 * - Reputation-based access control
 * - Graceful fallback when OWS SDK is not available
 */

import type { AuthState } from '../../shared/types.ts';
import { EMPTY_AUTH } from '../../shared/types.ts';
import type { AuthProvider } from './auth.ts';
import { 
    OWSWalletAdapter, 
    isOWSSDKAvailable,
    createDefaultOWSConfig,
    type OWSAgentConfig, 
    type AgentIdentity,
    type SolanaTransaction
} from '../../shared/ows-adapter.ts';

/**
 * OWS Auth State extends AuthState with OWS-specific fields
 */
export interface OWSAuthState extends AuthState {
    /** OWS DID */
    owsDID?: string;
    /** Multi-chain addresses */
    addresses?: {
        solana?: string;
        ethereum?: string;
    };
    /** Credentials from OWS */
    credentials?: Array<{
        type: string;
        issuer: string;
        data: unknown;
    }>;
    /** Whether using real OWS SDK or stub */
    usingRealOWS?: boolean;
}

/**
 * OWS Auth Provider
 * 
 * Uses Open Wallet Standard for authentication and wallet management.
 * Falls back gracefully to stub implementation if OWS SDK is unavailable.
 */
export class OWSAuthProvider implements AuthProvider {
    private state: OWSAuthState = EMPTY_AUTH;
    private owsAdapter: OWSWalletAdapter | null = null;
    private config: OWSAgentConfig;

    constructor(config?: OWSAgentConfig) {
        this.config = config ?? createDefaultOWSConfig();
    }

    /**
     * Check if real OWS SDK is available
     */
    isRealOWSAvailable(): boolean {
        return isOWSSDKAvailable();
    }

    /**
     * Login with OWS Wallet
     * 
     * If OWS SDK is available, connects to real wallet.
     * If not available, uses stub implementation (marked in state.usingRealOWS).
     */
    async login(): Promise<OWSAuthState> {
        try {
            // Initialize OWS adapter (automatically selects real or stub)
            this.owsAdapter = new OWSWalletAdapter(this.config);
            const usingRealOWS = this.owsAdapter.isReal();
            
            // Connect to OWS Wallet
            const wallet = await this.owsAdapter.connect();
            
            // Get identity with credentials
            const identity = await this.owsAdapter.getIdentity();
            
            // Build auth state
            this.state = {
                authenticated: true,
                publicKey: wallet.address,
                email: this.extractEmailFromIdentity(identity),
                privyUserId: null, // Not using Privy
                owsDID: identity.did,
                addresses: {
                    solana: this.config.defaultChain === 'solana' ? wallet.address : undefined,
                    ethereum: this.config.defaultChain === 'ethereum' ? wallet.address : undefined,
                },
                credentials: identity.credentials.map((c: { type: string; issuer: string; data: unknown }) => ({
                    type: c.type,
                    issuer: c.issuer,
                    data: c.data,
                })),
                usingRealOWS,
            };

            // Log which implementation is being used
            if (usingRealOWS) {
                console.log('[OWS Auth] Logged in with real OWS SDK');
            } else {
                console.log('[OWS Auth] Logged in with stub implementation (OWS SDK not available)');
            }

            return this.state;
        } catch (error) {
            console.error('OWS login failed:', error);
            throw new Error(`OWS authentication failed: ${error}`);
        }
    }

    /**
     * Logout and disconnect from OWS
     */
    async logout(): Promise<void> {
        if (this.owsAdapter) {
            try {
                await this.owsAdapter.disconnect();
            } catch (error) {
                console.warn('[OWS Auth] Error during disconnect:', error);
            }
            this.owsAdapter = null;
        }
        this.state = EMPTY_AUTH;
    }

    /**
     * Get current auth state
     */
    getState(): OWSAuthState {
        return this.state;
    }

    /**
     * Check if authenticated
     */
    isAuthenticated(): boolean {
        return this.state.authenticated && !!this.owsAdapter;
    }

    /**
     * Get OWS adapter instance
     */
    getOWSAdapter(): OWSWalletAdapter | null {
        return this.owsAdapter;
    }

    /**
     * Sign a message with OWS Wallet
     * 
     * @throws Error if not authenticated
     */
    async signMessage(message: string): Promise<string> {
        if (!this.owsAdapter) {
            throw new Error('Not authenticated with OWS');
        }
        return this.owsAdapter.signMessage(message);
    }

    /**
     * Sign a transaction with OWS Wallet
     * 
     * @throws Error if not authenticated
     */
    async signTransaction(tx: SolanaTransaction): Promise<unknown> {
        if (!this.owsAdapter) {
            throw new Error('Not authenticated with OWS');
        }
        return this.owsAdapter.signTransaction(tx);
    }

    /**
     * Get multi-chain addresses
     */
    getAddresses(): { solana?: string; ethereum?: string } {
        return this.state.addresses || {};
    }

    /**
     * Get credentials
     */
    getCredentials(): Array<{ type: string; issuer: string; data: unknown }> {
        return this.state.credentials || [];
    }

    /**
     * Extract email from identity
     * @private
     */
    private extractEmailFromIdentity(identity: AgentIdentity): string {
        // Extract identifier from DID
        const id = identity.did.split(':').pop() || 'unknown';
        // Return placeholder email format
        return `user_${id.slice(0, 16)}@ows.wallet`;
    }
}

/**
 * Create OWS auth provider
 * 
 * @param config - Optional OWS configuration. If not provided, uses defaults.
 * @returns Configured OWSAuthProvider instance
 */
export function createOWSAuthProvider(config?: OWSAgentConfig): OWSAuthProvider {
    return new OWSAuthProvider(config);
}

/**
 * Check if OWS authentication is available (real SDK loaded)
 */
export function isOWSAuthAvailable(): boolean {
    return isOWSSDKAvailable();
}
