/**
 * Core Service - AgentM Core SDK Integration
 *
 * Service layer that bridges the AgentM Core Solana program SDK
 * with the React application. Handles on-chain operations,
 * account fetching, and transaction management.
 *
 * @module lib/core/CoreService
 */

import type {
    CoreConfig,
    CoreConnectionState,
    CreateAgentInput,
    UpdateProfileInput,
    UpdateAgentConfigInput,
    UpdateReputationInput,
    TransactionResult,
    AgentAccountData,
    UserProfileData,
    ReputationData,
    AgentType,
} from './types.ts';

// Default configuration
const DEFAULT_CONFIG: CoreConfig = {
    rpcEndpoint: 'https://api.devnet.solana.com',
    programId: 'AgntMCorexxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // Replace with actual program ID
    network: 'devnet',
    commitment: 'confirmed',
};

// Account discriminators (match Rust program)
const DISCRIMINATORS = {
    USER_PROFILE: 'USER____',
    AGENT: 'AGENT___',
    REPUTATION: 'REPUT___',
} as const;

/**
 * Instruction discriminator values
 */
const INSTRUCTION_DISCRIMINATOR = {
    initialize: 0,
    registerUser: 1,
    updateProfile: 2,
    followUser: 3,
    unfollowUser: 4,
    sendMessage: 5,
    createAgent: 6,
    updateAgentConfig: 7,
    updateReputation: 8,
} as const;

/**
 * CoreService class
 *
 * Provides methods for interacting with the AgentM Core Solana program.
 * Manages connection state and handles transaction building/submission.
 */
export class CoreService {
    private config: CoreConfig;
    private _connectionState: CoreConnectionState = {
        connected: false,
        connecting: false,
        endpoint: null,
        error: null,
        slot: null,
    };

    constructor(config: Partial<CoreConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /** Get current connection state */
    get connectionState(): CoreConnectionState {
        return { ...this._connectionState };
    }

    /** Get current configuration */
    get currentConfig(): CoreConfig {
        return { ...this.config };
    }

    /**
     * Connect to Solana network
     */
    async connect(): Promise<void> {
        if (this._connectionState.connected) return;

        this._connectionState = {
            ...this._connectionState,
            connecting: true,
            error: null,
        };

        try {
            // Test connection by fetching latest slot
            const response = await fetch(this.config.rpcEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getSlot',
                    params: [{ commitment: this.config.commitment }],
                }),
                signal: AbortSignal.timeout(10000),
            });

            if (!response.ok) {
                throw new Error(`RPC error: ${response.status}`);
            }

            const data = await response.json() as { result?: number; error?: { message: string } };

            if (data.error) {
                throw new Error(data.error.message);
            }

            this._connectionState = {
                connected: true,
                connecting: false,
                endpoint: this.config.rpcEndpoint,
                error: null,
                slot: data.result ?? null,
            };
        } catch (error) {
            this._connectionState = {
                connected: false,
                connecting: false,
                endpoint: null,
                error: error instanceof Error ? error.message : 'Connection failed',
                slot: null,
            };
            throw error;
        }
    }

    /**
     * Disconnect from network
     */
    disconnect(): void {
        this._connectionState = {
            connected: false,
            connecting: false,
            endpoint: null,
            error: null,
            slot: null,
        };
    }

    /**
     * Build register user instruction data
     */
    buildRegisterUserData(username: string): Uint8Array {
        const encoder = new TextEncoder();
        const usernameBytes = encoder.encode(username);
        const data = new Uint8Array(1 + 4 + usernameBytes.length);
        data[0] = INSTRUCTION_DISCRIMINATOR.registerUser;
        new DataView(data.buffer).setUint32(1, usernameBytes.length, true);
        data.set(usernameBytes, 5);
        return data;
    }

    /**
     * Build update profile instruction data
     */
    buildUpdateProfileData(input: UpdateProfileInput): Uint8Array {
        const encoder = new TextEncoder();
        const displayNameBytes = encoder.encode(input.displayName);
        const bioBytes = encoder.encode(input.bio ?? '');
        const avatarBytes = encoder.encode(input.avatarUrl ?? '');
        const timestamp = BigInt(input.updatedAt ?? Date.now());

        const totalLength = 1 + 4 + displayNameBytes.length + 4 + bioBytes.length + 4 + avatarBytes.length + 8;
        const data = new Uint8Array(totalLength);
        const view = new DataView(data.buffer);

        let offset = 0;
        data[offset++] = INSTRUCTION_DISCRIMINATOR.updateProfile;

        view.setUint32(offset, displayNameBytes.length, true);
        offset += 4;
        data.set(displayNameBytes, offset);
        offset += displayNameBytes.length;

        view.setUint32(offset, bioBytes.length, true);
        offset += 4;
        data.set(bioBytes, offset);
        offset += bioBytes.length;

        view.setUint32(offset, avatarBytes.length, true);
        offset += 4;
        data.set(avatarBytes, offset);
        offset += avatarBytes.length;

        view.setBigInt64(offset, timestamp, true);

        return data;
    }

    /**
     * Build create agent instruction data
     */
    buildCreateAgentData(input: CreateAgentInput): Uint8Array {
        const encoder = new TextEncoder();
        const nameBytes = encoder.encode(input.name);
        const descBytes = encoder.encode(input.description ?? '');
        const configBytes = input.config ?? new Uint8Array(0);
        const timestamp = BigInt(input.createdAt ?? Date.now());
        const agentTypeValue = this.encodeAgentType(input.agentType ?? 'custom');

        const totalLength = 1 + 4 + nameBytes.length + 4 + descBytes.length + 1 + 4 + configBytes.length + 8;
        const data = new Uint8Array(totalLength);
        const view = new DataView(data.buffer);

        let offset = 0;
        data[offset++] = INSTRUCTION_DISCRIMINATOR.createAgent;

        view.setUint32(offset, nameBytes.length, true);
        offset += 4;
        data.set(nameBytes, offset);
        offset += nameBytes.length;

        view.setUint32(offset, descBytes.length, true);
        offset += 4;
        data.set(descBytes, offset);
        offset += descBytes.length;

        data[offset++] = agentTypeValue;

        view.setUint32(offset, configBytes.length, true);
        offset += 4;
        data.set(configBytes, offset);
        offset += configBytes.length;

        view.setBigInt64(offset, timestamp, true);

        return data;
    }

    /**
     * Build update agent config instruction data
     */
    buildUpdateAgentConfigData(input: UpdateAgentConfigInput): Uint8Array {
        const encoder = new TextEncoder();
        const descBytes = encoder.encode(input.description);
        const configBytes = input.config ?? new Uint8Array(0);
        const isActive = input.isActive ?? true;
        const timestamp = BigInt(input.updatedAt ?? Date.now());

        const totalLength = 1 + 4 + descBytes.length + 4 + configBytes.length + 1 + 8;
        const data = new Uint8Array(totalLength);
        const view = new DataView(data.buffer);

        let offset = 0;
        data[offset++] = INSTRUCTION_DISCRIMINATOR.updateAgentConfig;

        view.setUint32(offset, descBytes.length, true);
        offset += 4;
        data.set(descBytes, offset);
        offset += descBytes.length;

        view.setUint32(offset, configBytes.length, true);
        offset += 4;
        data.set(configBytes, offset);
        offset += configBytes.length;

        data[offset++] = isActive ? 1 : 0;

        view.setBigInt64(offset, timestamp, true);

        return data;
    }

    /**
     * Build update reputation instruction data
     */
    buildUpdateReputationData(input: UpdateReputationInput): Uint8Array {
        if (input.scoreBps < 0 || input.scoreBps > 10_000) {
            throw new Error('scoreBps must be in range [0, 10000]');
        }

        const timestamp = BigInt(input.updatedAt ?? Date.now());
        const data = new Uint8Array(1 + 2 + 1 + 8);
        const view = new DataView(data.buffer);

        let offset = 0;
        data[offset++] = INSTRUCTION_DISCRIMINATOR.updateReputation;
        view.setUint16(offset, input.scoreBps, true);
        offset += 2;
        data[offset++] = input.won ? 1 : 0;
        view.setBigInt64(offset, timestamp, true);

        return data;
    }

    /**
     * Simulate a transaction (for now, returns mock result)
     * In production, this would submit to the Solana network
     */
    async submitTransaction(
        _type: string,
        _instructionData: Uint8Array,
        _signerAddress: string,
    ): Promise<TransactionResult> {
        // For now, return a simulated result
        // In production, this would:
        // 1. Build the full transaction with accounts
        // 2. Request wallet signature
        // 3. Submit to network
        // 4. Confirm transaction

        const mockSignature = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

        return {
            signature: mockSignature,
            status: 'confirmed',
            slot: this._connectionState.slot ?? 0,
            blockTime: Math.floor(Date.now() / 1000),
        };
    }

    /**
     * Register a new user
     */
    async registerUser(username: string, signerAddress: string): Promise<TransactionResult> {
        const data = this.buildRegisterUserData(username);
        return this.submitTransaction('register_user', data, signerAddress);
    }

    /**
     * Update user profile
     */
    async updateProfile(input: UpdateProfileInput, signerAddress: string): Promise<TransactionResult> {
        const data = this.buildUpdateProfileData(input);
        return this.submitTransaction('update_profile', data, signerAddress);
    }

    /**
     * Create a new agent
     */
    async createAgent(input: CreateAgentInput, signerAddress: string): Promise<TransactionResult> {
        const data = this.buildCreateAgentData(input);
        return this.submitTransaction('create_agent', data, signerAddress);
    }

    /**
     * Update agent configuration
     */
    async updateAgentConfig(
        _agentAddress: string,
        input: UpdateAgentConfigInput,
        signerAddress: string,
    ): Promise<TransactionResult> {
        const data = this.buildUpdateAgentConfigData(input);
        return this.submitTransaction('update_agent', data, signerAddress);
    }

    /**
     * Update agent reputation
     */
    async updateReputation(
        _agentAddress: string,
        input: UpdateReputationInput,
        signerAddress: string,
    ): Promise<TransactionResult> {
        const data = this.buildUpdateReputationData(input);
        return this.submitTransaction('update_reputation', data, signerAddress);
    }

    /**
     * Fetch user profile from chain
     */
    async getUserProfile(address: string): Promise<UserProfileData | null> {
        if (!this._connectionState.connected) {
            throw new Error('Not connected to network');
        }

        // In production, this would derive the PDA and fetch account data
        // For now, return mock data for testing
        const mockProfile: UserProfileData = {
            address,
            username: `user_${address.slice(0, 8)}`,
            displayName: `Agent User ${address.slice(0, 4)}`,
            bio: 'A participant in the Agent Economy',
            avatarUrl: '',
            createdAt: Date.now() - 86400000,
            updatedAt: Date.now(),
        };

        return mockProfile;
    }

    /**
     * Fetch agent data from chain
     */
    async getAgent(address: string): Promise<AgentAccountData | null> {
        if (!this._connectionState.connected) {
            throw new Error('Not connected to network');
        }

        // In production, this would fetch actual account data
        const mockAgent: AgentAccountData = {
            address,
            owner: address,
            name: `Agent ${address.slice(0, 6)}`,
            description: 'An autonomous agent in the Gradience ecosystem',
            agentType: 'task_executor',
            isActive: true,
            config: {},
            createdAt: Date.now() - 86400000,
            updatedAt: Date.now(),
        };

        return mockAgent;
    }

    /**
     * Fetch reputation data from chain
     */
    async getReputation(agentAddress: string): Promise<ReputationData | null> {
        if (!this._connectionState.connected) {
            throw new Error('Not connected to network');
        }

        // In production, this would decode actual account data
        const mockReputation: ReputationData = {
            agent: agentAddress,
            totalReviews: 42,
            avgScore: 85,
            avgScoreBps: 8500,
            completed: 38,
            wins: 32,
            winRate: 0.84,
            winRateBps: 8400,
            updatedAt: Date.now(),
        };

        return mockReputation;
    }

    /**
     * Decode reputation account data
     */
    decodeReputationAccount(data: Uint8Array): ReputationData | null {
        if (data.length < 8) return null;

        const decoder = new TextDecoder();
        const disc = decoder.decode(data.slice(0, 8));
        if (disc !== DISCRIMINATORS.REPUTATION) return null;

        const view = new DataView(data.buffer, data.byteOffset);
        let offset = 8; // Skip discriminator

        offset += 1; // Skip version byte
        const agent = data.slice(offset, offset + 32);
        offset += 32;

        const totalReviews = view.getUint32(offset, true);
        offset += 4;

        offset += 8; // Skip total_score_bps (u64)

        const avgScoreBps = view.getUint16(offset, true);
        offset += 2;

        const completed = view.getUint32(offset, true);
        offset += 4;

        const wins = view.getUint32(offset, true);
        offset += 4;

        const winRateBps = view.getUint16(offset, true);
        offset += 2;

        const updatedAt = Number(view.getBigInt64(offset, true));

        // Convert agent bytes to base58 (simplified - in production use proper encoding)
        const agentAddress = Array.from(agent)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');

        return {
            agent: agentAddress,
            totalReviews,
            avgScore: avgScoreBps / 100,
            avgScoreBps,
            completed,
            wins,
            winRate: winRateBps / 10000,
            winRateBps,
            updatedAt,
        };
    }

    /**
     * List agents owned by a user
     */
    async listUserAgents(ownerAddress: string): Promise<AgentAccountData[]> {
        if (!this._connectionState.connected) {
            throw new Error('Not connected to network');
        }

        // In production, this would use getProgramAccounts with filters
        // For now, return empty array (or mock data)
        return [];
    }

    /**
     * Encode agent type to byte value
     */
    private encodeAgentType(agentType: AgentType): number {
        switch (agentType) {
            case 'task_executor':
                return 0;
            case 'social_agent':
                return 1;
            case 'trading_agent':
                return 2;
            case 'custom':
            default:
                return 3;
        }
    }

    /**
     * Check if service is available (can connect)
     */
    static isAvailable(): boolean {
        return typeof fetch !== 'undefined';
    }
}

// Singleton instance
let _service: CoreService | null = null;

/**
 * Get or create CoreService singleton
 */
export function getCoreService(config?: Partial<CoreConfig>): CoreService {
    if (!_service) {
        _service = new CoreService(config);
    }
    return _service;
}

/**
 * Reset CoreService singleton (useful for testing)
 */
export function resetCoreService(): void {
    if (_service) {
        _service.disconnect();
        _service = null;
    }
}

export default CoreService;
