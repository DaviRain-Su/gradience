/**
 * Marketplace Event Listener
 *
 * Polls confirmed transactions for the Workflow Marketplace program
 * and emits parsed PurchaseEvent objects.
 */

import { Connection, PublicKey, type TransactionResponse } from '@solana/web3.js';
import type { PurchaseEvent } from './types.js';
import { GatewayError, GW_INVALID_EVENT } from './errors.js';

const PURCHASE_V2_OPCODE = 8;

export interface EventListenerConfig {
    rpcEndpoint: string;
    marketplaceProgramId: string;
    pollIntervalMs: number;
}

export interface MarketplaceEventListener {
    start(onEvent: (event: PurchaseEvent) => void | Promise<void>): void;
    stop(): Promise<void>;
    isRunning(): boolean;
}

export class PollingMarketplaceEventListener implements MarketplaceEventListener {
    private connection: Connection;
    private programId: PublicKey;
    private config: EventListenerConfig;
    private pollingInterval?: ReturnType<typeof setInterval>;
    private running = false;
    private processedSignatures = new Set<string>();

    constructor(config: EventListenerConfig) {
        this.connection = new Connection(config.rpcEndpoint, 'confirmed');
        this.programId = new PublicKey(config.marketplaceProgramId);
        this.config = config;
    }

    start(onEvent: (event: PurchaseEvent) => void | Promise<void>): void {
        if (this.running) return;
        this.running = true;

        // Immediate first poll
        this.poll(onEvent).catch((err) => console.error('Initial poll failed:', err));

        this.pollingInterval = setInterval(() => {
            this.poll(onEvent).catch((err) => console.error('Poll failed:', err));
        }, this.config.pollIntervalMs);
    }

    async stop(): Promise<void> {
        this.running = false;
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = undefined;
        }
    }

    isRunning(): boolean {
        return this.running;
    }

    private async poll(onEvent: (event: PurchaseEvent) => void | Promise<void>): Promise<void> {
        const signatures = await this.connection.getSignaturesForAddress(this.programId, {
            limit: 20,
        });

        if (!signatures.length) return;

        // Process oldest-first to maintain order
        const toProcess = signatures.filter((sig) => !this.processedSignatures.has(sig.signature)).reverse();

        for (const sigInfo of toProcess) {
            if (!this.running) break;
            if (sigInfo.err) continue; // skip failed transactions

            try {
                const tx = await this.connection.getTransaction(sigInfo.signature, {
                    commitment: 'confirmed',
                });

                if (!tx || !tx.meta || tx.meta.err) continue;

                const event = this.parsePurchaseEvent(tx, sigInfo.signature, sigInfo.blockTime ?? 0);
                if (event) {
                    await onEvent(event);
                }
            } catch (err) {
                console.error(`Failed to process transaction ${sigInfo.signature}:`, err);
            }

            this.processedSignatures.add(sigInfo.signature);
            // Prevent unbounded growth
            if (this.processedSignatures.size > 1000) {
                const first = this.processedSignatures.values().next().value;
                if (first) this.processedSignatures.delete(first);
            }
        }
    }

    private parsePurchaseEvent(tx: TransactionResponse, signature: string, blockTime: number): PurchaseEvent | null {
        if (!tx.meta) return null;
        const message = tx.transaction.message;
        const accountKeys = message.accountKeys;
        const programIdBase58 = this.programId.toBase58();

        for (const ix of message.instructions) {
            const programKey = accountKeys[ix.programIdIndex]?.toBase58();
            if (programKey !== programIdBase58) continue;

            const data = Buffer.from(ix.data, 'base64');
            if (data.length === 0 || data[0] !== PURCHASE_V2_OPCODE) continue;

            // Accounts for purchase_workflow_v2:
            // 0: buyer (signer, writable)
            // 1: workflow PDA
            const buyerIndex = ix.accounts[0];
            const workflowIndex = ix.accounts[1];
            if (buyerIndex === undefined || workflowIndex === undefined) continue;

            const buyer = accountKeys[buyerIndex]?.toBase58();
            const workflowId = accountKeys[workflowIndex]?.toBase58();
            if (!buyer || !workflowId) continue;

            // Estimate amount from buyer's balance change
            const preBalance = tx.meta.preBalances[buyerIndex] ?? 0;
            const postBalance = tx.meta.postBalances[buyerIndex] ?? 0;
            const amount = BigInt(Math.max(0, preBalance - postBalance));

            // Generate a stable purchaseId from workflow + buyer + signature prefix
            const purchaseId = `${workflowId}_${buyer}_${signature.slice(0, 8)}`;

            return {
                purchaseId,
                buyer,
                workflowId,
                amount,
                txSignature: signature,
                blockTime,
            };
        }

        return null;
    }
}
