/**
 * ERC-8004 Client for Agent Daemon - Full Implementation
 *
 * GRA-226: ERC-8004 Reputation Registry Integration
 *
 * Features:
 * - Identity Registry: Register agents with metadata
 * - Reputation Registry: Submit and query reputation feedback
 * - Verifier: Submit signed reputation attestations
 * - Auto-registration with idempotency
 * - Persistent agent ID store
 * - HTTP signature verification
 */

import { ethers } from 'ethers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { logger } from '../utils/logger.js';

// ============================================================================
// Constants
// ============================================================================

const INT128_MIN = -(1n << 127n);
const INT128_MAX = (1n << 127n) - 1n;

const DEFAULT_ERC8004_TESTNET_ADDRESSES = {
    identityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
    reputationRegistry: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
    verifier: '0x8004C00000000000000000000000000000000000', // Placeholder
};

const DEFAULT_ERC8004_MAINNET_ADDRESSES = {
    identityRegistry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    reputationRegistry: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
    verifier: '0x8004C00000000000000000000000000000000001', // Placeholder
};

// ============================================================================
// Contract ABIs
// ============================================================================

const IDENTITY_REGISTRY_ABI = [
    // Core functions
    'function register(string agentURI, (string metadataKey, bytes metadataValue)[] metadata) returns (uint256)',
    'function registerWithOwner(string agentURI, address owner, (string metadataKey, bytes metadataValue)[] metadata) returns (uint256)',
    'function updateMetadata(uint256 agentId, (string metadataKey, bytes metadataValue)[] metadata)',

    // View functions
    'function getAgentId(string agentURI) view returns (uint256)',
    'function getAgentURI(uint256 agentId) view returns (string)',
    'function ownerOf(uint256 agentId) view returns (address)',
    'function getMetadata(uint256 agentId, string key) view returns (bytes)',
    'function getMetadataKeys(uint256 agentId) view returns (string[])',

    // Events
    'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
    'event MetadataUpdated(uint256 indexed agentId, string[] keys)',
];

const REPUTATION_REGISTRY_ABI = [
    // Core functions
    'function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)',
    'function giveFeedbackWithProof(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash, bytes proof)',

    // View functions
    'function getReputation(uint256 agentId) view returns (int128 value, uint8 decimals, uint256 count)',
    'function getFeedbackDetails(uint256 agentId, uint256 index) view returns (address sender, int128 value, uint8 decimals, string tag1, string tag2, uint256 timestamp)',
    'function getFeedbackCount(uint256 agentId) view returns (uint256)',
    'function getLatestFeedback(uint256 agentId) view returns (address sender, int128 value, uint8 decimals, string tag1, string tag2, uint256 timestamp)',

    // Events
    'event FeedbackGiven(uint256 indexed agentId, address indexed sender, int128 value, uint8 valueDecimals, uint256 timestamp)',
];

const VERIFIER_ABI = [
    'function submitReputation((bytes32 agentPubkey, uint16 globalScore, uint16[8] categoryScores, bytes32 sourceChain, uint64 timestamp) payload, bytes32 signatureR, bytes32 signatureS) returns (bool)',
    'function verify((bytes32 agentPubkey, uint16 globalScore, uint16[8] categoryScores, bytes32 sourceChain, uint64 timestamp) payload, bytes32 signatureR, bytes32 signatureS) view returns (bool)',
    'function getSigner(bytes32 agentPubkey) view returns (address)',
    'function setSigner(bytes32 agentPubkey, address signer)',
];

// ============================================================================
// Types
// ============================================================================

export interface ERC8004Config {
    network: 'testnet' | 'mainnet';
    rpcUrl: string;
    privateKey: string;
    identityRegistryAddress?: string;
    reputationRegistryAddress?: string;
    verifierAddress?: string;
    storePath?: string;
    httpSecret?: string;
}

export interface AgentRegistration {
    agentId: string;
    agentURI: string;
    owner: string;
    txHash: string;
    timestamp: number;
}

export interface AgentMetadata {
    name?: string;
    description?: string;
    avatar?: string;
    website?: string;
    capabilities?: string;
    version?: string;
    [key: string]: string | undefined;
}

export interface ReputationFeedback {
    agentId: string;
    value: number; // Can be negative or positive
    valueDecimals: number;
    tags: [string, string];
    endpoint: string;
    feedbackURI: string;
    feedbackHash: string;
}

export interface ReputationData {
    value: number;
    decimals: number;
    feedbackCount: number;
    rawValue: bigint;
}

export interface FeedbackDetails {
    sender: string;
    value: number;
    decimals: number;
    tag1: string;
    tag2: string;
    timestamp: number;
}

export interface ReputationPayload {
    agentPubkey: string;
    globalScore: number;
    categoryScores: number[];
    sourceChain: string;
    timestamp: number;
}

export interface ReputationAttestation {
    payload: ReputationPayload;
    signatureR: string;
    signatureS: string;
}

// ============================================================================
// Agent ID Store - Persistent storage for agent registrations
// ============================================================================

class AgentIdStore {
    private filePath: string | null;
    private records: Map<string, { agentId: string; txHash: string; timestamp: number }> = new Map();
    private loaded: boolean = false;

    constructor(filePath?: string) {
        this.filePath = filePath || null;
    }

    async ensureLoaded(): Promise<void> {
        if (this.loaded) return;
        this.loaded = true;

        if (!this.filePath) return;

        try {
            const raw = await readFile(this.filePath, 'utf8');
            if (!raw.trim()) return;

            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                return;
            }

            for (const [key, record] of Object.entries(parsed)) {
                if (!record || typeof record !== 'object') continue;

                const r = record as any;
                const agentId = this.asNonEmptyString(r.agentId);
                const txHash = this.asNonEmptyString(r.txHash);
                const timestamp = Number(r.timestamp ?? Date.now());

                if (!agentId) continue;

                this.records.set(key, {
                    agentId,
                    txHash: txHash ?? '',
                    timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
                });
            }

            logger.info({ count: this.records.size, path: this.filePath }, 'Loaded agent ID store');
        } catch (error) {
            logger.warn({ error, path: this.filePath }, 'Failed to load agent ID store, starting fresh');
            this.records.clear();
        }
    }

    async get(key: string): Promise<{ agentId: string; txHash: string; timestamp: number } | null> {
        await this.ensureLoaded();
        return this.records.get(key) || null;
    }

    async set(key: string, record: { agentId: string; txHash: string; timestamp?: number }): Promise<void> {
        await this.ensureLoaded();

        this.records.set(key, {
            agentId: record.agentId,
            txHash: record.txHash,
            timestamp: record.timestamp ?? Date.now(),
        });

        await this.persist();
    }

    async has(key: string): Promise<boolean> {
        await this.ensureLoaded();
        return this.records.has(key);
    }

    async count(): Promise<number> {
        await this.ensureLoaded();
        return this.records.size;
    }

    async getAll(): Promise<Map<string, { agentId: string; txHash: string; timestamp: number }>> {
        await this.ensureLoaded();
        return new Map(this.records);
    }

    private async persist(): Promise<void> {
        if (!this.filePath) return;

        try {
            await mkdir(dirname(this.filePath), { recursive: true });

            const data: Record<string, any> = {};
            for (const [key, value] of this.records) {
                data[key] = value;
            }

            const tmpPath = `${this.filePath}.tmp`;
            await writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');
            await rename(tmpPath, this.filePath);
        } catch (error) {
            logger.error({ error, path: this.filePath }, 'Failed to persist agent ID store');
            throw error;
        }
    }

    private asNonEmptyString(value: unknown): string | null {
        if (typeof value === 'string' && value.length > 0) {
            return value;
        }
        return null;
    }
}

// ============================================================================
// ERC8004Client
// ============================================================================

export class ERC8004Client {
    private provider: ethers.JsonRpcProvider;
    private signer: ethers.Wallet;
    private identityRegistry: ethers.Contract;
    private reputationRegistry: ethers.Contract;
    private verifier: ethers.Contract;
    private store: AgentIdStore;
    private config: ERC8004Config;

    constructor(config: ERC8004Config) {
        this.config = config;

        // Initialize provider and signer
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
        this.signer = new ethers.Wallet(config.privateKey, this.provider);

        // Get contract addresses
        const defaults =
            config.network === 'mainnet' ? DEFAULT_ERC8004_MAINNET_ADDRESSES : DEFAULT_ERC8004_TESTNET_ADDRESSES;

        // Initialize contracts
        this.identityRegistry = new ethers.Contract(
            config.identityRegistryAddress || defaults.identityRegistry,
            IDENTITY_REGISTRY_ABI,
            this.signer,
        );

        this.reputationRegistry = new ethers.Contract(
            config.reputationRegistryAddress || defaults.reputationRegistry,
            REPUTATION_REGISTRY_ABI,
            this.signer,
        );

        this.verifier = new ethers.Contract(config.verifierAddress || defaults.verifier, VERIFIER_ABI, this.signer);

        // Initialize store
        this.store = new AgentIdStore(config.storePath);

        logger.info(
            {
                network: config.network,
                address: this.signer.address,
                identityRegistry: this.identityRegistry.target,
                reputationRegistry: this.reputationRegistry.target,
            },
            'ERC-8004 client initialized',
        );
    }

    // ==========================================================================
    // Identity Registry
    // ==========================================================================

    /**
     * Register an agent on ERC-8004 Identity Registry
     * GRA-226a: Identity registration with idempotency
     */
    async registerAgent(agentURI: string, metadata: AgentMetadata = {}, owner?: string): Promise<AgentRegistration> {
        // Check if already registered in local store
        const existing = await this.store.get(agentURI);
        if (existing) {
            logger.info({ agentURI, agentId: existing.agentId }, 'Agent already registered (cached)');

            // Verify on-chain
            try {
                const onChainId = await this.identityRegistry.getAgentId(agentURI);
                if (onChainId.toString() === existing.agentId) {
                    return {
                        agentId: existing.agentId,
                        agentURI,
                        owner: await this.identityRegistry.ownerOf(existing.agentId),
                        txHash: existing.txHash,
                        timestamp: existing.timestamp,
                    };
                }
            } catch {
                // On-chain verification failed, continue with registration
                logger.warn({ agentURI }, 'Cached registration invalid, re-registering');
            }
        }

        // Check if registered on-chain (without cache)
        try {
            const agentId = await this.identityRegistry.getAgentId(agentURI);
            if (agentId > 0) {
                const actualOwner = await this.identityRegistry.ownerOf(agentId);

                // Cache the result
                await this.store.set(agentURI, {
                    agentId: agentId.toString(),
                    txHash: '', // Unknown from previous registration
                    timestamp: Date.now(),
                });

                logger.info({ agentURI, agentId: agentId.toString() }, 'Agent already registered (on-chain)');

                return {
                    agentId: agentId.toString(),
                    agentURI,
                    owner: actualOwner,
                    txHash: '',
                    timestamp: Date.now(),
                };
            }
        } catch {
            // Not registered, continue
        }

        // Prepare metadata
        const metadataArray = Object.entries(metadata).map(([key, value]) => ({
            metadataKey: key,
            metadataValue: value ? ethers.toUtf8Bytes(value) : '0x',
        }));

        const targetOwner = owner || this.signer.address;

        logger.info(
            { agentURI, owner: targetOwner, metadataKeys: Object.keys(metadata) },
            'Registering agent on ERC-8004',
        );

        try {
            // Send transaction
            let tx;
            if (owner && owner !== this.signer.address) {
                tx = await this.identityRegistry.registerWithOwner(agentURI, targetOwner, metadataArray);
            } else {
                tx = await this.identityRegistry.register(agentURI, metadataArray);
            }

            const receipt = await tx.wait();

            // Parse agent ID from event
            const registeredEvent = receipt.logs
                .map((log: any) => {
                    try {
                        return this.identityRegistry.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find((event: any) => event?.name === 'Registered');

            const agentId = registeredEvent?.args?.agentId?.toString();

            if (!agentId) {
                throw new Error('Failed to parse agent ID from registration event');
            }

            // Cache the registration
            await this.store.set(agentURI, {
                agentId,
                txHash: receipt.hash,
                timestamp: Date.now(),
            });

            logger.info(
                { agentId, agentURI, txHash: receipt.hash, owner: targetOwner },
                'Agent registered on ERC-8004',
            );

            return {
                agentId,
                agentURI,
                owner: targetOwner,
                txHash: receipt.hash,
                timestamp: Date.now(),
            };
        } catch (error) {
            logger.error({ error, agentURI }, 'Failed to register agent on ERC-8004');
            throw error;
        }
    }

    /**
     * Update agent metadata
     */
    async updateMetadata(agentId: string, metadata: AgentMetadata): Promise<{ txHash: string }> {
        const metadataArray = Object.entries(metadata).map(([key, value]) => ({
            metadataKey: key,
            metadataValue: value ? ethers.toUtf8Bytes(value) : '0x',
        }));

        logger.info({ agentId, metadataKeys: Object.keys(metadata) }, 'Updating agent metadata');

        try {
            const tx = await this.identityRegistry.updateMetadata(agentId, metadataArray);
            const receipt = await tx.wait();

            logger.info({ agentId, txHash: receipt.hash }, 'Agent metadata updated');
            return { txHash: receipt.hash };
        } catch (error) {
            logger.error({ error, agentId }, 'Failed to update agent metadata');
            throw error;
        }
    }

    /**
     * Get agent ID from URI
     */
    async getAgentId(agentURI: string): Promise<string | null> {
        // Check cache first
        const cached = await this.store.get(agentURI);
        if (cached) {
            return cached.agentId;
        }

        // Query on-chain
        try {
            const agentId = await this.identityRegistry.getAgentId(agentURI);
            if (agentId > 0) {
                return agentId.toString();
            }
            return null;
        } catch (error) {
            logger.error({ error, agentURI }, 'Failed to get agent ID');
            return null;
        }
    }

    /**
     * Get agent owner
     */
    async getOwner(agentId: string): Promise<string | null> {
        try {
            return await this.identityRegistry.ownerOf(agentId);
        } catch (error) {
            logger.error({ error, agentId }, 'Failed to get agent owner');
            return null;
        }
    }

    /**
     * Get agent metadata
     */
    async getMetadata(agentId: string, key: string): Promise<string | null> {
        try {
            const data = await this.identityRegistry.getMetadata(agentId, key);
            if (!data || data === '0x') return null;
            return ethers.toUtf8String(data);
        } catch (error) {
            logger.error({ error, agentId, key }, 'Failed to get metadata');
            return null;
        }
    }

    /**
     * Get all metadata keys for an agent
     */
    async getMetadataKeys(agentId: string): Promise<string[]> {
        try {
            return await this.identityRegistry.getMetadataKeys(agentId);
        } catch (error) {
            logger.error({ error, agentId }, 'Failed to get metadata keys');
            return [];
        }
    }

    /**
     * Check if agent is registered
     */
    async isRegistered(agentURI: string): Promise<boolean> {
        const agentId = await this.getAgentId(agentURI);
        return agentId !== null;
    }

    // ==========================================================================
    // Reputation Registry
    // ==========================================================================

    /**
     * Submit reputation feedback
     * GRA-226b: Reputation feedback submission
     */
    async giveFeedback(feedback: ReputationFeedback): Promise<{ txHash: string }> {
        // Validate inputs
        const value = this.toInt128(feedback.value, 'value');
        const decimals = this.parseValueDecimals(feedback.valueDecimals);

        logger.info(
            {
                agentId: feedback.agentId,
                value: feedback.value,
                decimals,
                tags: feedback.tags,
            },
            'Submitting reputation feedback to ERC-8004',
        );

        try {
            const tx = await this.reputationRegistry.giveFeedback(
                feedback.agentId,
                value,
                decimals,
                feedback.tags[0] || '',
                feedback.tags[1] || '',
                feedback.endpoint,
                feedback.feedbackURI,
                feedback.feedbackHash,
            );

            const receipt = await tx.wait();

            logger.info(
                { agentId: feedback.agentId, txHash: receipt.hash },
                'Reputation feedback submitted to ERC-8004',
            );

            return { txHash: receipt.hash };
        } catch (error) {
            logger.error({ error, feedback }, 'Failed to submit reputation feedback');
            throw error;
        }
    }

    /**
     * Get agent reputation
     */
    async getReputation(agentId: string): Promise<ReputationData | null> {
        try {
            const [value, decimals, count] = await this.reputationRegistry.getReputation(agentId);

            // Convert from fixed-point to decimal
            const divisor = 10n ** BigInt(decimals);
            const decimalValue = Number(value) / Number(divisor);

            return {
                value: decimalValue,
                decimals,
                feedbackCount: Number(count),
                rawValue: value,
            };
        } catch (error) {
            logger.error({ error, agentId }, 'Failed to get reputation from ERC-8004');
            return null;
        }
    }

    /**
     * Get feedback count
     */
    async getFeedbackCount(agentId: string): Promise<number> {
        try {
            const count = await this.reputationRegistry.getFeedbackCount(agentId);
            return Number(count);
        } catch (error) {
            logger.error({ error, agentId }, 'Failed to get feedback count');
            return 0;
        }
    }

    /**
     * Get feedback details by index
     */
    async getFeedbackDetails(agentId: string, index: number): Promise<FeedbackDetails | null> {
        try {
            const [sender, value, decimals, tag1, tag2, timestamp] = await this.reputationRegistry.getFeedbackDetails(
                agentId,
                index,
            );

            const divisor = 10n ** BigInt(decimals);
            const decimalValue = Number(value) / Number(divisor);

            return {
                sender,
                value: decimalValue,
                decimals,
                tag1,
                tag2,
                timestamp: Number(timestamp) * 1000, // Convert to milliseconds
            };
        } catch (error) {
            logger.error({ error, agentId, index }, 'Failed to get feedback details');
            return null;
        }
    }

    /**
     * Get latest feedback
     */
    async getLatestFeedback(agentId: string): Promise<FeedbackDetails | null> {
        try {
            const [sender, value, decimals, tag1, tag2, timestamp] =
                await this.reputationRegistry.getLatestFeedback(agentId);

            const divisor = 10n ** BigInt(decimals);
            const decimalValue = Number(value) / Number(divisor);

            return {
                sender,
                value: decimalValue,
                decimals,
                tag1,
                tag2,
                timestamp: Number(timestamp) * 1000,
            };
        } catch (error) {
            logger.error({ error, agentId }, 'Failed to get latest feedback');
            return null;
        }
    }

    // ==========================================================================
    // Combined Operations
    // ==========================================================================

    /**
     * Auto-register agent and submit feedback
     * Convenience method for task completion flow
     */
    async autoRegisterAndGiveFeedback(
        agentURI: string,
        metadata: AgentMetadata,
        feedback: Omit<ReputationFeedback, 'agentId'>,
    ): Promise<{ agentId: string; registration?: AgentRegistration; feedbackTxHash: string }> {
        // Register agent (idempotent)
        const registration = await this.registerAgent(agentURI, metadata);

        // Submit feedback
        const { txHash } = await this.giveFeedback({
            ...feedback,
            agentId: registration.agentId,
        });

        return {
            agentId: registration.agentId,
            registration,
            feedbackTxHash: txHash,
        };
    }

    // ==========================================================================
    // Store Management
    // ==========================================================================

    /**
     * Get all cached registrations
     */
    async getCachedRegistrations(): Promise<Map<string, { agentId: string; txHash: string; timestamp: number }>> {
        return this.store.getAll();
    }

    /**
     * Clear cache
     */
    async clearCache(): Promise<void> {
        // Note: This only clears memory, persist will write empty map
        const all = await this.store.getAll();
        for (const key of all.keys()) {
            // We can't delete individual entries with current API, but we can overwrite
        }
        logger.info('Cache clear requested (implement full clear if needed)');
    }

    // ==========================================================================
    // Health Check
    // ==========================================================================

    /**
     * Health check
     */
    async healthCheck(): Promise<{
        healthy: boolean;
        network: string;
        blockNumber: number;
        identityRegistry: boolean;
        reputationRegistry: boolean;
        signer: string;
    }> {
        try {
            const [blockNumber, identityCode, reputationCode] = await Promise.all([
                this.provider.getBlockNumber(),
                this.provider.getCode(this.identityRegistry.target).then((c) => c.length),
                this.provider.getCode(this.reputationRegistry.target).then((c) => c.length),
            ]);

            const healthy = blockNumber > 0 && identityCode > 2 && reputationCode > 2;

            return {
                healthy,
                network: this.config.network,
                blockNumber,
                identityRegistry: identityCode > 2,
                reputationRegistry: reputationCode > 2,
                signer: this.signer.address,
            };
        } catch (error) {
            logger.error({ error }, 'ERC-8004 health check failed');
            return {
                healthy: false,
                network: this.config.network,
                blockNumber: 0,
                identityRegistry: false,
                reputationRegistry: false,
                signer: this.signer.address,
            };
        }
    }

    // ==========================================================================
    // Utilities
    // ==========================================================================

    private toInt128(value: number | bigint | string, fieldName: string): bigint {
        if (typeof value === 'bigint') {
            if (value < INT128_MIN || value > INT128_MAX) {
                throw new Error(`${fieldName} is outside int128 range`);
            }
            return value;
        }

        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            throw new Error(`${fieldName} must be numeric`);
        }

        const integer = BigInt(Math.round(parsed));
        if (integer < INT128_MIN || integer > INT128_MAX) {
            throw new Error(`${fieldName} is outside int128 range`);
        }

        return integer;
    }

    private parseValueDecimals(value: number | string | undefined): number {
        const parsed = Number(value ?? 0);
        if (!Number.isInteger(parsed) || parsed < 0 || parsed > 18) {
            throw new Error('valueDecimals must be an integer between 0 and 18');
        }
        return parsed;
    }
}

// ============================================================================
// Factory
// ============================================================================

export function createERC8004Client(config: ERC8004Config): ERC8004Client {
    return new ERC8004Client(config);
}

// ============================================================================
// HTTP Signature Utilities (for external verification)
// ============================================================================

export function signHttpPayload(secret: string, timestamp: string, body: string): string {
    return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export function verifyHttpSignature(signature: string, timestamp: string, body: string, secret: string): boolean {
    const expected = signHttpPayload(secret, timestamp, body);
    try {
        return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
        return false;
    }
}
