/**
 * Local OWS Adapter shim for AgentM Desktop
 * Provides the same interface as @gradience/ows-adapter
 */

export interface OWSAgentConfig {
    network: 'devnet' | 'mainnet';
    defaultChain: 'solana' | 'ethereum';
}

export interface AgentIdentity {
    did: string;
    address: string;
    chain: string;
    credentials: Array<{
        type: string;
        issuer: string;
        data: unknown;
    }>;
}

export interface OWSCredential {
    type: string;
    issuer: string;
    data: unknown;
}

export class OWSWalletAdapter {
    private config: OWSAgentConfig;
    private _connected = false;

    constructor(config: OWSAgentConfig = { network: 'devnet', defaultChain: 'solana' }) {
        this.config = config;
    }

    get connected(): boolean {
        return this._connected;
    }

    async connect(): Promise<AgentIdentity> {
        this._connected = true;
        return {
            did: `did:ows:${this.config.defaultChain}:placeholder`,
            address: 'placeholder',
            chain: this.config.defaultChain,
            credentials: [],
        };
    }

    async disconnect(): Promise<void> {
        this._connected = false;
    }

    async getIdentity(): Promise<AgentIdentity> {
        return {
            did: `did:ows:${this.config.defaultChain}:placeholder`,
            address: 'placeholder',
            chain: this.config.defaultChain,
            credentials: [],
        };
    }

    async signMessage(message: string): Promise<string> {
        return `sig:${message.slice(0, 8)}`;
    }

    async signTransaction(tx: unknown): Promise<unknown> {
        return tx;
    }
}
