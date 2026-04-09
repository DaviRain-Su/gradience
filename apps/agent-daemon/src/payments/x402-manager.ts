/**
 * X402 Payment Manager
 *
 * Implements X402 micropayment protocol for fine-grained service calls
 *
 * Flow:
 * 1. Create authorization (lock funds)
 * 2. Service provider verifies and executes
 * 3. Settlement (transfer actual amount)
 * 4. Rollback on failure (unlock funds)
 */

import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { createSolanaRpc } from '@solana/kit';
import { createHash, randomBytes } from 'crypto';
import type { X402EvmClient } from './x402-evm.js';

export interface PaymentChannel {
    id: string;
    payer: string;
    recipient: string;
    maxAmount: bigint;
    lockedAmount: bigint;
    createdAt: number;
    validUntil: number;
    status: 'locked' | 'settled' | 'rolled_back';
    signature?: string;
}

export interface X402Config {
    rpcUrl: string;
    minAmount: bigint; // Minimum payment (e.g., 0.0001 SOL)
    maxLockTime: number; // Maximum lock duration in seconds
    defaultValidFor: number; // Default authorization validity
}

export class X402PaymentManager {
    private rpc: ReturnType<typeof createSolanaRpc>;
    private channels: Map<string, PaymentChannel> = new Map();
    private config: X402Config;
    private evmClient?: X402EvmClient;

    constructor(config: Partial<X402Config> = {}, evmClient?: X402EvmClient) {
        this.config = {
            rpcUrl: config.rpcUrl || 'https://api.devnet.solana.com',
            minAmount: config.minAmount ?? 100000n, // 0.0001 SOL
            maxLockTime: config.maxLockTime || 3600, // 1 hour
            defaultValidFor: config.defaultValidFor || 300, // 5 minutes
        };
        this.evmClient = evmClient;
        this.rpc = createSolanaRpc(this.config.rpcUrl);
    }

    /**
     * Step 1: Create payment authorization (lock funds)
     *
     * Caller locks maxAmount in a payment channel
     * Actual settlement will be <= maxAmount
     */
    async createAuthorization(params: {
        payer: string;
        recipient: string;
        maxAmount: bigint;
        validFor?: number;
        chain?: 'solana' | 'evm';
    }): Promise<{ channelId: string; signature: string }> {
        // Validate minimum amount
        if (params.maxAmount < this.config.minAmount) {
            throw new Error(`Amount too small. Minimum: ${this.config.minAmount} lamports`);
        }

        const chain = params.chain || 'solana';
        const channelId = this.generateChannelId(chain);
        const validFor = Math.min(params.validFor || this.config.defaultValidFor, this.config.maxLockTime);

        const channel: PaymentChannel = {
            id: channelId,
            payer: params.payer,
            recipient: params.recipient,
            maxAmount: params.maxAmount,
            lockedAmount: params.maxAmount,
            createdAt: Date.now(),
            validUntil: Date.now() + validFor * 1000,
            status: 'locked',
        };

        // Create on-chain escrow or off-chain record
        // For simplicity, using off-chain with signature
        const signature = await this.signAuthorization(channel);
        channel.signature = signature;

        this.channels.set(channelId, channel);

        return { channelId, signature };
    }

    /**
     * Step 3a: Settlement - transfer actual amount
     *
     * Called after successful service execution
     * Transfers actualAmount (<= maxAmount) to recipient
     */
    async settle(channelId: string, actualAmount: bigint): Promise<string> {
        const channel = this.channels.get(channelId);

        if (!channel) {
            throw new Error(`Channel not found: ${channelId}`);
        }

        if (channel.status !== 'locked') {
            throw new Error(`Invalid channel status: ${channel.status}`);
        }

        if (actualAmount > channel.maxAmount) {
            throw new Error(`Settlement amount exceeds max: ${actualAmount} > ${channel.maxAmount}`);
        }

        if (Date.now() > channel.validUntil) {
            throw new Error('Channel expired');
        }

        // Execute settlement transaction
        let txSignature: string;
        if (this.evmClient && channel.id.startsWith('x402_evm_')) {
            txSignature = await this.evmClient.settle(channel.id as `0x${string}`, actualAmount);
        } else {
            txSignature = await this.executeTransfer(channel.payer, channel.recipient, actualAmount);
        }

        // Update channel
        channel.status = 'settled';
        channel.lockedAmount = channel.maxAmount - actualAmount;
        this.channels.set(channelId, channel);

        // Clean up after settlement
        this.channels.delete(channelId);

        return txSignature;
    }

    /**
     * Step 3b: Rollback - unlock funds
     *
     * Called on service failure or timeout
     * Unlocks all funds back to payer
     */
    async rollback(channelId: string): Promise<void> {
        const channel = this.channels.get(channelId);

        if (!channel) {
            console.warn(`Rollback: Channel not found: ${channelId}`);
            return;
        }

        if (channel.status !== 'locked') {
            console.warn(`Rollback: Invalid status: ${channel.status}`);
            return;
        }

        // Execute rollback (unlock funds)
        if (this.evmClient && channel.id.startsWith('x402_evm_')) {
            await this.evmClient.rollback(channel.id as `0x${string}`);
        }

        channel.status = 'rolled_back';
        this.channels.set(channelId, channel);

        // Clean up
        this.channels.delete(channelId);
    }

    /**
     * Rollback all pending channels
     * Emergency cleanup
     */
    async rollbackAll(): Promise<void> {
        const pendingChannels = Array.from(this.channels.values()).filter((c) => c.status === 'locked');

        for (const channel of pendingChannels) {
            await this.rollback(channel.id);
        }
    }

    /**
     * Get channel status
     */
    getChannel(channelId: string): PaymentChannel | undefined {
        return this.channels.get(channelId);
    }

    /**
     * Clean up expired channels
     */
    cleanupExpired(): void {
        const now = Date.now();
        for (const [id, channel] of this.channels) {
            if (channel.validUntil < now && channel.status === 'locked') {
                console.warn(`Auto-rolling back expired channel: ${id}`);
                this.rollback(id).catch(console.error);
            }
        }
    }

    // Private methods

    private generateChannelId(chain: 'solana' | 'evm'): string {
        if (chain === 'evm') {
            const random = `${Date.now()}_${randomBytes(8).toString('hex')}`;
            return `0x${createHash('sha256').update(`x402_evm_${random}`).digest('hex')}`;
        }
        return `x402_sol_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }

    private async signAuthorization(channel: PaymentChannel): Promise<string> {
        // Create authorization signature
        // In real implementation, this would sign with payer's key
        const data = JSON.stringify({
            channelId: channel.id,
            payer: channel.payer,
            recipient: channel.recipient,
            maxAmount: channel.maxAmount.toString(),
            validUntil: channel.validUntil,
        });

        // Placeholder signature
        return `sig_${Buffer.from(data).toString('base64')}`;
    }

    private async executeTransfer(from: string, to: string, amount: bigint): Promise<string> {
        // Execute Solana transfer
        // This is a placeholder - real implementation would:
        // 1. Create transaction
        // 2. Sign with payer key
        // 3. Send to RPC
        // 4. Confirm

        console.log(`[X402] Transfer: ${amount} lamports from ${from} to ${to}`);

        // Return mock signature
        return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }
}

export default X402PaymentManager;
