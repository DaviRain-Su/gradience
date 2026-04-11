/**
 * Reputation EVM Relayer - GRA-2
 *
 * Pushes signed reputation payloads to GradienceReputationOracle on EVM.
 */

import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';
import type { ReputationPayload } from './proof-generator.js';

// ============================================================================
// ABI (minimal for GradienceReputationOracle)
// ============================================================================

const ORACLE_ABI = [
    'function updateReputation((bytes32 agentId, uint16 globalScore, uint16[8] categoryScores, uint64 updatedAt, uint8 confidence, uint64 nonce, bytes32 merkleRoot, string sourceChain) payload, bytes signature) external',
    'function getReputation(bytes32 agentId) view returns (int128 value, uint8 decimals, uint256 count)',
    'function verifySignature((bytes32 agentId, uint16 globalScore, uint16[8] categoryScores, uint64 updatedAt, uint8 confidence, uint64 nonce, bytes32 merkleRoot, string sourceChain) payload, bytes signature) view returns (bool)',
    'function nonces(bytes32 agentId) view returns (uint64)',
    'event ReputationUpdated(bytes32 indexed agentId, uint16 globalScore, uint64 updatedAt, uint64 nonce, bytes32 merkleRoot)',
];

// ============================================================================
// Types
// ============================================================================

export interface EVMRelayerConfig {
    rpcUrl: string;
    privateKey: string;
    contractAddress: string;
    chainId?: number;
}

export interface EVMOraclePushResult {
    success: boolean;
    txHash?: string;
    error?: string;
}

// ============================================================================
// EVM Relayer
// ============================================================================

export class ReputationEVMRelayer {
    private provider: ethers.JsonRpcProvider;
    private signer: ethers.Wallet;
    private contract: ethers.Contract;
    private config: EVMRelayerConfig;

    constructor(config: EVMRelayerConfig) {
        this.config = config;
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
        this.signer = new ethers.Wallet(config.privateKey, this.provider);
        this.contract = new ethers.Contract(config.contractAddress, ORACLE_ABI, this.signer);

        logger.info(
            {
                chainId: config.chainId,
                contract: config.contractAddress,
                signer: this.signer.address,
            },
            'ReputationEVMRelayer initialized',
        );
    }

    /**
     * Push reputation to EVM oracle contract
     */
    async pushReputation(payload: ReputationPayload, signature: string): Promise<EVMOraclePushResult> {
        try {
            // Pre-check nonce
            const onChainNonce = await this.contract.nonces(payload.agentId);
            if (BigInt(onChainNonce) >= BigInt(payload.nonce)) {
                logger.warn(
                    { agentId: payload.agentId, onChainNonce, payloadNonce: payload.nonce },
                    'EVM oracle nonce stale, skipping push',
                );
                return {
                    success: false,
                    error: `Nonce stale: on-chain ${onChainNonce} >= payload ${payload.nonce}`,
                };
            }

            logger.info(
                { agentId: payload.agentId, globalScore: payload.globalScore, nonce: payload.nonce },
                'Pushing reputation to EVM oracle',
            );

            const tx = await this.contract.updateReputation(payload, signature);
            const receipt = await tx.wait();

            logger.info(
                { agentId: payload.agentId, txHash: receipt.hash },
                'Reputation pushed to EVM oracle successfully',
            );

            return { success: true, txHash: receipt.hash };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ error: errMsg, agentId: payload.agentId }, 'Failed to push reputation to EVM oracle');
            return { success: false, error: errMsg };
        }
    }

    /**
     * Verify a signature locally through the contract view function
     */
    async verifyOnChain(payload: ReputationPayload, signature: string): Promise<boolean> {
        try {
            return await this.contract.verifySignature(payload, signature);
        } catch (error) {
            logger.error({ error, agentId: payload.agentId }, 'EVM on-chain verification failed');
            return false;
        }
    }

    /**
     * Get stored reputation from EVM contract
     */
    async getReputation(agentId: string): Promise<{ value: number; decimals: number; count: number } | null> {
        try {
            const [value, decimals, count] = await this.contract.getReputation(agentId);
            return {
                value: Number(value),
                decimals: Number(decimals),
                count: Number(count),
            };
        } catch (error) {
            logger.error({ error, agentId }, 'Failed to get reputation from EVM oracle');
            return null;
        }
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<{
        healthy: boolean;
        blockNumber: number;
        contractAddress: string;
        signerAddress: string;
    }> {
        try {
            const blockNumber = await this.provider.getBlockNumber();
            const code = await this.provider.getCode(this.config.contractAddress);
            const healthy = blockNumber > 0 && code.length > 2;

            return {
                healthy,
                blockNumber,
                contractAddress: this.config.contractAddress,
                signerAddress: this.signer.address,
            };
        } catch (error) {
            logger.error({ error }, 'EVM relayer health check failed');
            return {
                healthy: false,
                blockNumber: 0,
                contractAddress: this.config.contractAddress,
                signerAddress: this.signer.address,
            };
        }
    }
}

// ============================================================================
// Factory
// ============================================================================

export function createReputationEVMRelayer(config: EVMRelayerConfig): ReputationEVMRelayer {
    return new ReputationEVMRelayer(config);
}
