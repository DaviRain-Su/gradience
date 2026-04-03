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
 */

import type { AuthState } from '../../shared/types.ts';
import { EMPTY_AUTH } from '../../shared/types.ts';
import type { AuthProvider } from './auth.ts';
import { OWSWalletAdapter } from '../../shared/ows-adapter.ts';
import type { OWSAgentConfig, AgentIdentity } from '../../shared/ows-adapter.ts';

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
        data: any;
    }>;
}

/**
 * OWS Auth Provider
 * 
 * Uses Open Wallet Standard for authentication and wallet management.
 */
export class OWSAuthProvider implements AuthProvider {
    private state: OWSAuthState = EMPTY_AUTH;
    private owsAdapter: OWSWalletAdapter | null = null;
    private config: OWSAgentConfig;

    constructor(config: OWSAgentConfig = { network: 'devnet', defaultChain: 'solana' }) {
        this.config = config;
    }

    /**
     * Login with OWS Wallet
     */
    async login(): Promise<OWSAuthState> {
        try {
            // Initialize OWS adapter
            this.owsAdapter = new OWSWalletAdapter(this.config);
            
            // Connect to OWS Wallet
            const wallet = await this.owsAdapter.connect();
            
            // Get identity with credentials
            const identity = await this.owsAdapter.getIdentity();
            
            // Build auth state
            this.state = {
                authenticated: true,
                publicKey: wallet.address,
                email: this.extractEmailFromDID(identity.did),
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
            };

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
            await this.owsAdapter.disconnect();
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
     */
    async signMessage(message: string): Promise<string> {
        if (!this.owsAdapter) {
            throw new Error('Not authenticated with OWS');
        }
        return this.owsAdapter.signMessage(message);
    }

    /**
     * Sign a transaction with OWS Wallet
     */
    async signTransaction(tx: any): Promise<any> {
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
    getCredentials(): Array<{ type: string; issuer: string; data: any }> {
        return this.state.credentials || [];
    }

    /**
     * Extract email from DID (placeholder)
     * @private
     */
    private extractEmailFromDID(did: string): string {
        // In real implementation, this would resolve the DID
        // For now, return a placeholder
        const id = did.split(':').pop() || 'unknown';
        return `user_${id.slice(0, 8)}@ows.wallet`;
    }
}

/**
 * Create OWS auth provider
 */
export function createOWSAuthProvider(
    config: OWSAgentConfig = { network: 'devnet', defaultChain: 'solana' }
): OWSAuthProvider {
    return new OWSAuthProvider(config);
}
