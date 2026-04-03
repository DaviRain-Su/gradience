/**
 * OWS Adapter for AgentM Desktop
 * 
 * This module provides integration with the Open Wallet Standard (OWS) via
 * the @gradiences/ows-adapter package. It re-exports types and provides a
 * wrapper that gracefully falls back to stub implementations when OWS is not
 * configured or available.
 * 
 * STUBBED vs REAL:
 * - If @gradiences/ows-adapter is available and properly configured, all
 *   operations use the real OWS SDK for wallet connection, identity, and signing.
 * - If the SDK is unavailable or throws on initialization, the adapter falls back
 *   to stub implementations that return placeholder values but don't crash the app.
 */

import type { Transaction, VersionedTransaction } from '@solana/web3.js';

// =============================================================================
// TYPE DEFINITIONS (local mirrors of @gradiences/ows-adapter types)
// These are kept local to avoid import errors when the package is unavailable
// =============================================================================

/** Solana transaction types */
export type SolanaTransaction = Transaction | VersionedTransaction;

export interface OWSAgentConfig {
    /** Network to connect to */
    network: 'devnet' | 'mainnet';
    /** Default chain for operations */
    defaultChain: 'solana' | 'ethereum';
    /** Optional: RPC endpoint for Solana (used by real SDK) */
    rpcEndpoint?: string;
    /** Optional: API key for OWS services (used by real SDK) */
    apiKey?: string;
    /** Optional: XMTP environment (used by real SDK) */
    xmtpEnv?: 'production' | 'dev';
}

export interface AgentCredential {
    type: string;
    issuer: string;
    data: unknown;
}

export interface AgentIdentity {
    /** Decentralized Identifier */
    did: string;
    /** Wallet address */
    address: string;
    /** Chain type */
    chain: string;
    /** Verifiable credentials */
    credentials: AgentCredential[];
}

export interface OWSCredential {
    type: string;
    issuer: string;
    data: unknown;
}

// =============================================================================
// DYNAMIC SDK IMPORT
// Attempts to import the real OWS adapter, falls back to null if unavailable
// =============================================================================

let RealOWSAdapter: typeof import('@gradiences/ows-adapter').OWSWalletAdapter | null = null;
let RealTypes: typeof import('@gradiences/ows-adapter') | null = null;

// Attempt to load the real SDK
try {
    const owsModule = await import('@gradiences/ows-adapter');
    RealOWSAdapter = owsModule.OWSWalletAdapter;
    RealTypes = owsModule;
} catch (error) {
    console.warn('[OWS Adapter] @gradiences/ows-adapter not available, using stub implementation:', error);
    RealOWSAdapter = null;
    RealTypes = null;
}

// =============================================================================
// REAL ADAPTER WRAPPER
// Uses the actual OWS SDK when available
// =============================================================================

class RealOWSAdapterWrapper {
    private adapter: InstanceType<typeof import('@gradiences/ows-adapter').OWSWalletAdapter> | null = null;
    private config: OWSAgentConfig;

    constructor(config: OWSAgentConfig) {
        this.config = config;
        if (RealOWSAdapter) {
            this.adapter = new RealOWSAdapter({
                network: config.network,
                defaultChain: config.defaultChain,
                rpcEndpoint: config.rpcEndpoint,
                apiKey: config.apiKey,
            });
        }
    }

    get connected(): boolean {
        return this.adapter?.isConnected() ?? false;
    }

    async connect(): Promise<AgentIdentity> {
        if (!this.adapter) {
            throw new Error('OWS SDK not available');
        }
        const wallet = await this.adapter.connect();
        const identity = await this.adapter.getIdentity();
        
        return {
            did: identity.did,
            address: wallet.address,
            chain: this.config.defaultChain,
            credentials: identity.credentials.map((c: { type: string; issuer: string; data: unknown }) => ({
                type: c.type,
                issuer: c.issuer,
                data: c.data,
            })),
        };
    }

    async disconnect(): Promise<void> {
        await this.adapter?.disconnect();
    }

    async getIdentity(): Promise<AgentIdentity> {
        if (!this.adapter) {
            throw new Error('OWS SDK not available');
        }
        const identity = await this.adapter.getIdentity();
        const wallet = this.adapter.getWallet();
        
        return {
            did: identity.did,
            address: wallet.address,
            chain: this.config.defaultChain,
            credentials: identity.credentials.map((c: { type: string; issuer: string; data: unknown }) => ({
                type: c.type,
                issuer: c.issuer,
                data: c.data,
            })),
        };
    }

    async signMessage(message: string): Promise<string> {
        if (!this.adapter) {
            throw new Error('OWS SDK not available');
        }
        return this.adapter.signMessage(message);
    }

    async signTransaction(tx: SolanaTransaction): Promise<unknown> {
        if (!this.adapter) {
            throw new Error('OWS SDK not available');
        }
        return this.adapter.signTransaction(tx);
    }
}

// =============================================================================
// STUB ADAPTER (Fallback)
// Used when the real OWS SDK is not available - returns placeholder values
// but maintains the same interface to prevent crashes
// =============================================================================

class StubOWSAdapter {
    private config: OWSAgentConfig;
    private _connected = false;

    constructor(config: OWSAgentConfig) {
        this.config = config;
    }

    get connected(): boolean {
        return this._connected;
    }

    async connect(): Promise<AgentIdentity> {
        this._connected = true;
        // Generate a deterministic placeholder address based on timestamp
        const placeholderId = this.generatePlaceholderId();
        
        return {
            did: `did:ows:${this.config.defaultChain}:${placeholderId}`,
            address: this.generatePlaceholderAddress(),
            chain: this.config.defaultChain,
            credentials: [],
        };
    }

    async disconnect(): Promise<void> {
        this._connected = false;
    }

    async getIdentity(): Promise<AgentIdentity> {
        const placeholderId = this.generatePlaceholderId();
        return {
            did: `did:ows:${this.config.defaultChain}:${placeholderId}`,
            address: this.generatePlaceholderAddress(),
            chain: this.config.defaultChain,
            credentials: [],
        };
    }

    async signMessage(message: string): Promise<string> {
        // Return a stub signature that encodes the message prefix
        return `sig:stub:${Buffer.from(message.slice(0, 16)).toString('base64')}`;
    }

    async signTransaction(tx: SolanaTransaction): Promise<unknown> {
        // Return the transaction with a stub signature marker
        if (tx && typeof tx === 'object') {
            return {
                ...tx,
                _stubSigned: true,
                _signedAt: Date.now(),
            };
        }
        return tx;
    }

    private generatePlaceholderId(): string {
        // Deterministic placeholder based on config to remain consistent per session
        const seed = `${this.config.network}:${this.config.defaultChain}`;
        return Buffer.from(seed).toString('base64').slice(0, 16);
    }

    private generatePlaceholderAddress(): string {
        if (this.config.defaultChain === 'solana') {
            // Generate a valid-looking base58 Solana address format (32 bytes)
            const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
            const seed = Date.now().toString(36);
            let result = '';
            for (let i = 0; i < 43; i++) {
                const charIndex = (seed.charCodeAt(i % seed.length) + i) % chars.length;
                result += chars[charIndex];
            }
            return result;
        }
        // Ethereum-style address
        return '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    }
}

// =============================================================================
// MAIN EXPORT: OWSWalletAdapter
// Automatically selects real or stub implementation based on SDK availability
// =============================================================================

export class OWSWalletAdapter {
    private impl: RealOWSAdapterWrapper | StubOWSAdapter;
    private useReal: boolean;

    constructor(config: OWSAgentConfig = { network: 'devnet', defaultChain: 'solana' }) {
        this.useReal = RealOWSAdapter !== null;
        
        if (this.useReal) {
            console.log('[OWS Adapter] Using real OWS SDK');
            this.impl = new RealOWSAdapterWrapper(config);
        } else {
            console.log('[OWS Adapter] Using stub implementation (OWS SDK not available)');
            this.impl = new StubOWSAdapter(config);
        }
    }

    /** Check if using the real OWS SDK or stub implementation */
    isReal(): boolean {
        return this.useReal;
    }

    /** Get connection status */
    get connected(): boolean {
        return this.impl.connected;
    }

    /** Connect to OWS wallet */
    async connect(): Promise<AgentIdentity> {
        return this.impl.connect();
    }

    /** Disconnect from OWS wallet */
    async disconnect(): Promise<void> {
        return this.impl.disconnect();
    }

    /** Get current identity */
    async getIdentity(): Promise<AgentIdentity> {
        return this.impl.getIdentity();
    }

    /** Sign a message */
    async signMessage(message: string): Promise<string> {
        return this.impl.signMessage(message);
    }

    /** Sign a transaction */
    async signTransaction(tx: SolanaTransaction): Promise<unknown> {
        return this.impl.signTransaction(tx);
    }
}

// =============================================================================
// UTILITY EXPORTS
// Helper functions for working with OWS identities
// =============================================================================

/**
 * Check if OWS SDK is available (real implementation loaded)
 */
export function isOWSSDKAvailable(): boolean {
    return RealOWSAdapter !== null;
}

/**
 * Get the real OWS adapter types if available
 */
export function getRealOWSTypes(): typeof import('@gradiences/ows-adapter') | null {
    return RealTypes;
}

/**
 * Create a default OWS configuration
 */
export function createDefaultOWSConfig(): OWSAgentConfig {
    return {
        network: 'devnet',
        defaultChain: 'solana',
    };
}
