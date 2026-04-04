/**
 * OWS Wallet Adapter for Gradience Protocol
 *
 * Provides wallet connection, identity management, and task signing
 * via the Open Wallet Standard (OWS).
 */

import type { OWSConfig, OWSIdentity, OWSCredential, TaskAgreement } from './types';

const DEFAULT_CONFIG: OWSConfig = {
    network: 'devnet',
    defaultChain: 'solana',
};

export class OWSWalletAdapter {
    private config: OWSConfig;
    private _identity: OWSIdentity | null = null;
    private _connected = false;

    constructor(config: Partial<OWSConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    get connected(): boolean {
        return this._connected;
    }

    get identity(): OWSIdentity | null {
        return this._identity;
    }

    async connect(): Promise<OWSIdentity> {
        if (this._connected && this._identity) {
            return this._identity;
        }

        // Detect OWS wallet provider from window
        const provider = this.detectProvider();
        if (!provider) {
            throw new Error(
                'No OWS-compatible wallet found. Install an OWS wallet extension or use Privy as fallback.'
            );
        }

        const accounts = (await provider.request({ method: 'connect' })) as string[];
        const address = accounts[0];

        this._identity = {
            did: `did:ows:${this.config.defaultChain}:${address}`,
            address,
            chain: this.config.defaultChain,
            credentials: [],
        };
        this._connected = true;

        // Fetch credentials if available
        try {
            this._identity.credentials = await this.fetchCredentials(address);
        } catch {
            // Credentials are optional — wallet works without them
        }

        return this._identity;
    }

    async disconnect(): Promise<void> {
        const provider = this.detectProvider();
        if (provider) {
            try {
                await provider.request({ method: 'disconnect' });
            } catch {
                // Best-effort disconnect
            }
        }
        this._identity = null;
        this._connected = false;
    }

    async signTaskAgreement(agreement: TaskAgreement): Promise<string> {
        if (!this._connected || !this._identity) {
            throw new Error('Wallet not connected');
        }

        const provider = this.detectProvider();
        if (!provider) {
            throw new Error('No OWS provider available');
        }

        const message = this.encodeTaskAgreement(agreement);
        const signature = (await provider.request({
            method: 'signMessage',
            params: { message },
        })) as string;

        return signature;
    }

    async signMessage(message: string): Promise<string> {
        if (!this._connected) {
            throw new Error('Wallet not connected');
        }

        const provider = this.detectProvider();
        if (!provider) {
            throw new Error('No OWS provider available');
        }

        const encoded = new TextEncoder().encode(message);
        const signature = (await provider.request({
            method: 'signMessage',
            params: { message: encoded },
        })) as string;

        return signature;
    }

    async getReputationCredential(): Promise<OWSCredential | null> {
        if (!this._identity) return null;
        return (
            this._identity.credentials.find((c) => c.type === 'reputation') ?? null
        );
    }

    private detectProvider(): OWSProvider | null {
        if (typeof window === 'undefined') return null;

        // Check for standard OWS provider
        const win = window as WindowWithOWS;
        if (win.ows) return win.ows;

        // Fallback: check for Solana wallet adapters that implement OWS
        if (win.solana?.isOWS) return win.solana as unknown as OWSProvider;

        return null;
    }

    private async fetchCredentials(address: string): Promise<OWSCredential[]> {
        const url = `https://api.openwallet.sh/v1/credentials/${address}`;
        const res = await fetch(url, {
            headers: { 'X-Network': this.config.network },
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.credentials ?? [];
    }

    private encodeTaskAgreement(agreement: TaskAgreement): Uint8Array {
        const json = JSON.stringify({
            type: 'gradience:task_agreement',
            version: '1.0',
            ...agreement,
        });
        return new TextEncoder().encode(json);
    }
}

/** OWS wallet provider interface */
interface OWSProvider {
    request(args: { method: string; params?: unknown }): Promise<unknown>;
}

interface WindowWithOWS extends Window {
    ows?: OWSProvider;
    solana?: { isOWS?: boolean } & Record<string, unknown>;
}
