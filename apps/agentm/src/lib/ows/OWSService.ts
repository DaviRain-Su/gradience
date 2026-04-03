/**
 * OWS Service - SDK Integration
 *
 * Core service for OWS wallet operations and Chain Hub reputation integration.
 * Provides unified interface for wallet connection, identity management,
 * and reputation queries through the Chain Hub indexer.
 *
 * @module lib/ows/OWSService
 */

import type {
    OWSConfig,
    OWSIdentity,
    OWSCredential,
    ReputationData,
    CategoryReputation,
} from './types.ts';

// Default configuration
const DEFAULT_CONFIG: OWSConfig = {
    network: 'devnet',
    defaultChain: 'solana',
    chainHubBaseUrl: 'https://indexer.gradiences.xyz',
};

/**
 * OWS Wallet Provider interface (browser injected)
 */
interface OWSProvider {
    request(args: { method: string; params?: unknown }): Promise<unknown>;
}

/**
 * Window with OWS provider
 */
interface WindowWithOWS extends Window {
    ows?: OWSProvider;
    solana?: { isOWS?: boolean } & Record<string, unknown>;
}

/**
 * OWS Service class
 *
 * Handles wallet connection, identity management, and reputation integration
 * with the Chain Hub indexer.
 */
export class OWSService {
    private config: OWSConfig;
    private _identity: OWSIdentity | null = null;
    private _connected = false;
    private _provider: OWSProvider | null = null;

    constructor(config: Partial<OWSConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /** Get current connection status */
    get connected(): boolean {
        return this._connected;
    }

    /** Get current identity */
    get identity(): OWSIdentity | null {
        return this._identity;
    }

    /** Get current configuration */
    get currentConfig(): OWSConfig {
        return this.config;
    }

    /**
     * Detect OWS wallet provider in browser
     */
    private detectProvider(): OWSProvider | null {
        if (typeof window === 'undefined') return null;

        const win = window as WindowWithOWS;

        // Check for standard OWS provider
        if (win.ows) return win.ows;

        // Fallback: check for Solana wallet adapters that implement OWS
        if (win.solana?.isOWS) return win.solana as unknown as OWSProvider;

        return null;
    }

    /**
     * Connect to OWS wallet
     *
     * @returns Connected identity
     * @throws Error if no wallet found or connection fails
     */
    async connect(): Promise<OWSIdentity> {
        if (this._connected && this._identity) {
            return this._identity;
        }

        const provider = this.detectProvider();
        if (!provider) {
            throw new Error(
                'No OWS-compatible wallet found. Install an OWS wallet extension or use alternative auth.'
            );
        }

        this._provider = provider;

        try {
            const accounts = (await provider.request({ method: 'connect' })) as string[];
            const address = accounts[0];

            this._identity = {
                did: `did:ows:${this.config.defaultChain}:${address}`,
                address,
                chain: this.config.defaultChain,
                credentials: [],
            };
            this._connected = true;

            // Fetch credentials asynchronously
            this.fetchCredentials(address).then((credentials) => {
                if (this._identity) {
                    this._identity.credentials = credentials;
                }
            }).catch(() => {
                // Credentials are optional - wallet works without them
            });

            return this._identity;
        } catch (error) {
            this._connected = false;
            this._identity = null;
            throw new Error(`Failed to connect to OWS wallet: ${error}`);
        }
    }

    /**
     * Disconnect from OWS wallet
     */
    async disconnect(): Promise<void> {
        if (this._provider) {
            try {
                await this._provider.request({ method: 'disconnect' });
            } catch {
                // Best-effort disconnect
            }
        }
        this._identity = null;
        this._connected = false;
        this._provider = null;
    }

    /**
     * Sign a message with the connected wallet
     *
     * @param message - Message to sign
     * @returns Signature string
     * @throws Error if not connected
     */
    async signMessage(message: string): Promise<string> {
        if (!this._connected || !this._provider) {
            throw new Error('Wallet not connected');
        }

        const encoded = new TextEncoder().encode(message);
        const signature = (await this._provider.request({
            method: 'signMessage',
            params: { message: encoded },
        })) as string;

        return signature;
    }

    /**
     * Fetch reputation data from Chain Hub indexer
     *
     * @param address - Wallet address (defaults to connected wallet)
     * @returns Reputation data or null if not found
     */
    async getReputation(address?: string): Promise<ReputationData | null> {
        const targetAddress = address ?? this._identity?.address;
        if (!targetAddress) {
            return null;
        }

        const url = `${this.config.chainHubBaseUrl}/api/agents/${targetAddress}/reputation`;

        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(5000),
            });

            if (!response.ok) {
                if (response.status === 404) return null;
                return null;
            }

            const raw = await response.json() as {
                agent: string;
                global_avg_score: number;
                global_win_rate: number;
                global_completed: number;
                global_total_applied: number;
                total_earned: number;
                updated_slot: number;
                by_category?: Record<string, { avg_score: number; completed: number; win_rate?: number }>;
            };

            const byCategory: Record<string, CategoryReputation> | undefined = raw.by_category
                ? Object.fromEntries(
                      Object.entries(raw.by_category).map(([key, val]) => [
                          key,
                          {
                              avgScore: val.avg_score,
                              completed: val.completed,
                              winRate: val.win_rate,
                          },
                      ])
                  )
                : undefined;

            return {
                agent: raw.agent,
                globalAvgScore: raw.global_avg_score,
                globalWinRate: raw.global_win_rate,
                globalCompleted: raw.global_completed,
                globalTotalApplied: raw.global_total_applied,
                totalEarned: raw.total_earned,
                updatedSlot: raw.updated_slot,
                byCategory,
            };
        } catch {
            // Chain Hub offline or error - return null
            return null;
        }
    }

    /**
     * Fetch reputation for multiple addresses in batch
     *
     * @param addresses - Array of wallet addresses
     * @returns Map of address to reputation data
     */
    async getReputationBatch(addresses: string[]): Promise<Map<string, ReputationData>> {
        const results = new Map<string, ReputationData>();

        const promises = addresses.map(async (address) => {
            const reputation = await this.getReputation(address);
            if (reputation) {
                results.set(address, reputation);
            }
        });

        await Promise.all(promises);
        return results;
    }

    /**
     * Fetch credentials for an address from OWS API
     */
    private async fetchCredentials(address: string): Promise<OWSCredential[]> {
        const url = `https://api.openwallet.sh/v1/credentials/${address}`;

        try {
            const response = await fetch(url, {
                headers: { 'X-Network': this.config.network },
                signal: AbortSignal.timeout(5000),
            });

            if (!response.ok) return [];

            const data = await response.json() as { credentials?: OWSCredential[] };
            return data.credentials ?? [];
        } catch {
            return [];
        }
    }

    /**
     * Create a reputation credential from reputation data
     *
     * @param reputation - Reputation data
     * @returns OWS credential
     */
    createReputationCredential(reputation: ReputationData): OWSCredential {
        return {
            type: 'reputation',
            issuer: 'gradience-protocol',
            issuedAt: Date.now(),
            data: {
                agent: reputation.agent,
                avgScore: reputation.globalAvgScore,
                winRate: reputation.globalWinRate,
                completed: reputation.globalCompleted,
                totalApplied: reputation.globalTotalApplied,
                totalEarned: reputation.totalEarned,
            },
        };
    }

    /**
     * Check if OWS is available in the browser
     */
    static isAvailable(): boolean {
        if (typeof window === 'undefined') return false;
        const win = window as WindowWithOWS;
        return !!(win.ows || win.solana?.isOWS);
    }
}

// Singleton instance
let _service: OWSService | null = null;

/**
 * Get or create OWS service singleton
 *
 * @param config - Optional configuration override
 * @returns OWS service instance
 */
export function getOWSService(config?: Partial<OWSConfig>): OWSService {
    if (!_service) {
        _service = new OWSService(config);
    }
    return _service;
}

/**
 * Reset OWS service singleton (useful for testing)
 */
export function resetOWSService(): void {
    if (_service) {
        _service.disconnect().catch(() => {});
        _service = null;
    }
}
