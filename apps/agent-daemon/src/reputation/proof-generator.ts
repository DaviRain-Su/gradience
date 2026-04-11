/**
 * Reputation Proof Generator - GRA-2
 *
 * Generates ReputationPayload and ECDSA signatures compatible with
 * GradienceReputationOracle.sol on EVM chains.
 */

import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface ReputationPayload {
    agentId: string; // bytes32 hex string
    globalScore: number; // 0-10000
    categoryScores: number[]; // length 8, each 0-10000
    updatedAt: number; // Unix timestamp seconds
    confidence: number; // 0-100
    nonce: number; // strict monotonic per agentId
    merkleRoot: string; // bytes32 hex string
    sourceChain: string; // e.g. "solana"
}

export interface SignedReputationPayload {
    payload: ReputationPayload;
    signature: string; // 65-byte hex string
    payloadHash: string; // bytes32 hex string
}

export interface ProofGeneratorConfig {
    oracleSignerPrivateKey: string;
}

// ============================================================================
// Proof Generator
// ============================================================================

export class ReputationProofGenerator {
    private signer: ethers.Wallet;

    constructor(config: ProofGeneratorConfig) {
        this.signer = new ethers.Wallet(config.oracleSignerPrivateKey);
        logger.info({ address: this.signer.address }, 'ReputationProofGenerator initialized');
    }

    /**
     * Generate payload + ECDSA signature for EVM oracle
     */
    async generateSignedPayload(
        agentAddress: string,
        globalScore: number,
        categoryScores: number[],
        nonce: number,
        options?: {
            confidence?: number;
            merkleRoot?: string;
            sourceChain?: string;
        },
    ): Promise<SignedReputationPayload> {
        // Normalize categoryScores to exactly 8 entries
        const normalizedCategories = this.normalizeCategoryScores(categoryScores);

        const payload: ReputationPayload = {
            agentId: this.agentAddressToBytes32(agentAddress),
            globalScore: Math.max(0, Math.min(10000, Math.round(globalScore))),
            categoryScores: normalizedCategories,
            updatedAt: Math.floor(Date.now() / 1000),
            confidence: Math.max(0, Math.min(100, Math.round(options?.confidence ?? 90))),
            nonce: Math.max(0, Math.floor(nonce)),
            merkleRoot: options?.merkleRoot ?? ethers.ZeroHash,
            sourceChain: options?.sourceChain ?? 'solana',
        };

        const hash = hashPayload(payload);
        const signature = await this.signer.signMessage(ethers.getBytes(hash));

        logger.debug(
            {
                agentAddress,
                globalScore: payload.globalScore,
                nonce: payload.nonce,
                signer: this.signer.address,
            },
            'Generated signed reputation payload',
        );

        return {
            payload,
            signature,
            payloadHash: hash,
        };
    }

    /**
     * Get the oracle signer address
     */
    getSignerAddress(): string {
        return this.signer.address;
    }

    // =========================================================================
    // Internal Helpers
    // =========================================================================

    private normalizeCategoryScores(scores: number[]): number[] {
        const result: number[] = [];
        for (let i = 0; i < 8; i++) {
            const raw = scores[i] != null ? scores[i] : 0;
            result.push(Math.max(0, Math.min(10000, Math.round(raw as number))));
        }
        return result;
    }

    private agentAddressToBytes32(address: string): string {
        // Solana base58 addresses are longer than 32 bytes.
        // We hash them to derive a deterministic bytes32 agentId.
        if (address.startsWith('0x') && address.length === 42) {
            // EVM address: left-pad to bytes32
            return ethers.zeroPadValue(address, 32);
        }

        // For Solana or any other address format, hash to bytes32
        return ethers.keccak256(ethers.toUtf8Bytes(address));
    }
}

// ============================================================================
// Standalone Utilities
// ============================================================================

export function hashPayload(payload: ReputationPayload): string {
    return ethers.solidityPackedKeccak256(
        ['bytes32', 'uint16', 'uint16[8]', 'uint64', 'uint8', 'uint64', 'bytes32', 'string'],
        [
            payload.agentId,
            payload.globalScore,
            payload.categoryScores,
            payload.updatedAt,
            payload.confidence,
            payload.nonce,
            payload.merkleRoot,
            payload.sourceChain,
        ],
    );
}

export function verifyPayloadSignature(
    payload: ReputationPayload,
    signature: string,
    expectedSigner: string,
): boolean {
    const hash = hashPayload(payload);
    const recovered = ethers.verifyMessage(ethers.getBytes(hash), signature);
    return recovered.toLowerCase() === expectedSigner.toLowerCase();
}

// ============================================================================
// Factory
// ============================================================================

export function createReputationProofGenerator(config: ProofGeneratorConfig): ReputationProofGenerator {
    return new ReputationProofGenerator(config);
}
