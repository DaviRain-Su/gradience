/**
 * Payment Service Tests
 *
 * @module services/payment-service.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { PaymentService } from './payment-service.js';
import { OWSWalletManager } from '../wallet/ows-wallet-manager.js';
import type { A2ARouter } from '../a2a-router/router.js';

describe('PaymentService', () => {
    let db: Database.Database;
    let walletManager: OWSWalletManager;
    let mockA2ARouter: A2ARouter;
    let paymentService: PaymentService;
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = mkdtempSync(join(tmpdir(), 'payment-test-'));
        db = new Database(join(tmpDir, 'test.db'));
        walletManager = new OWSWalletManager(db);

        // Create test wallets
        await walletManager.createWallet({
            agentId: 'payer-agent',
            parentWallet: 'parent-1',
            name: 'payer-wallet',
            initialReputation: 80,
        });

        await walletManager.createWallet({
            agentId: 'payee-agent',
            parentWallet: 'parent-2',
            name: 'payee-wallet',
            initialReputation: 75,
        });

        // Mock A2A Router
        mockA2ARouter = {
            send: vi.fn().mockResolvedValue({ success: true }),
            subscribe: vi.fn().mockReturnValue(Promise.resolve(() => Promise.resolve())),
        } as unknown as A2ARouter;

        paymentService = new PaymentService(mockA2ARouter, walletManager, {
            defaultTimeoutMs: 3600000,
            autoApproveThreshold: 80,
            chainHubProgramId: 'mock-program-id',
            rpcEndpoint: 'https://mock.rpc',
        });
    });

    afterEach(() => {
        db.close();
        rmSync(tmpDir, { recursive: true, force: true });
    });

    describe('payment request', () => {
        it('should create payment request', async () => {
            const session = await paymentService.requestPayment({
                payerAgentId: 'payer-agent',
                payeeAgentId: 'payee-agent',
                taskId: 'task-123',
                amount: '1000000',
                token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                tokenSymbol: 'USDC',
                decimals: 6,
                description: 'Test payment',
            });

            expect(session.paymentId).toBeDefined();
            expect(session.payerAgentId).toBe('payer-agent');
            expect(session.payeeAgentId).toBe('payee-agent');
            expect(session.status).toBe('pending_request');
            expect(session.request.amount).toBe('1000000');

            expect(mockA2ARouter.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'payee-agent',
                    type: 'payment_request',
                    preferredProtocol: 'xmtp',
                }),
            );
        });

        it('should reject payment if payer wallet not found', async () => {
            await expect(
                paymentService.requestPayment({
                    payerAgentId: 'non-existent',
                    payeeAgentId: 'payee-agent',
                    taskId: 'task-123',
                    amount: '1000000',
                    token: 'USDC',
                    tokenSymbol: 'USDC',
                    decimals: 6,
                    description: 'Test',
                }),
            ).rejects.toThrow('Payer wallet not found');
        });

        it('should reject payment exceeding policy limits', async () => {
            // Create low-reputation payer
            await walletManager.createWallet({
                agentId: 'low-rep-payer',
                parentWallet: 'parent-3',
                name: 'low-rep-wallet',
                initialReputation: 20, // Bronze tier, max $0.60
            });

            await expect(
                paymentService.requestPayment({
                    payerAgentId: 'low-rep-payer',
                    payeeAgentId: 'payee-agent',
                    taskId: 'task-123',
                    amount: '10000000', // $10
                    token: 'USDC',
                    tokenSymbol: 'USDC',
                    decimals: 6,
                    description: 'Test',
                }),
            ).rejects.toThrow('Payment not allowed');
        });
    });

    describe('payment acceptance', () => {
        it('should accept payment request', async () => {
            const session = await paymentService.requestPayment({
                payerAgentId: 'payer-agent',
                payeeAgentId: 'payee-agent',
                taskId: 'task-123',
                amount: '1000000',
                token: 'USDC',
                tokenSymbol: 'USDC',
                decimals: 6,
                description: 'Test',
            });

            const accepted = await paymentService.acceptPayment(session.paymentId, 'payee-agent');

            expect(accepted.status).toBe('accepted');
            expect(accepted.request.payee).toBeDefined();

            expect(mockA2ARouter.send).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    to: 'payer-agent',
                    type: 'task_accept',
                }),
            );
        });

        it('should reject acceptance by wrong agent', async () => {
            const session = await paymentService.requestPayment({
                payerAgentId: 'payer-agent',
                payeeAgentId: 'payee-agent',
                taskId: 'task-123',
                amount: '1000000',
                token: 'USDC',
                tokenSymbol: 'USDC',
                decimals: 6,
                description: 'Test',
            });

            await expect(paymentService.acceptPayment(session.paymentId, 'wrong-agent')).rejects.toThrow(
                'Agent is not the designated payee',
            );
        });

        it('should reject acceptance of non-existent payment', async () => {
            await expect(paymentService.acceptPayment('non-existent', 'payee-agent')).rejects.toThrow(
                'Payment session not found',
            );
        });
    });

    describe('service completion', () => {
        it('should mark service complete', async () => {
            const session = await paymentService.requestPayment({
                payerAgentId: 'payer-agent',
                payeeAgentId: 'payee-agent',
                taskId: 'task-123',
                amount: '1000000',
                token: 'USDC',
                tokenSymbol: 'USDC',
                decimals: 6,
                description: 'Test',
            });

            await paymentService.acceptPayment(session.paymentId, 'payee-agent');

            const completed = await paymentService.markServiceComplete(session.paymentId, 'payee-agent');

            expect(completed.status).toBe('pending_evaluation');
        });
    });

    describe('session management', () => {
        it('should get session by ID', async () => {
            const session = await paymentService.requestPayment({
                payerAgentId: 'payer-agent',
                payeeAgentId: 'payee-agent',
                taskId: 'task-123',
                amount: '1000000',
                token: 'USDC',
                tokenSymbol: 'USDC',
                decimals: 6,
                description: 'Test',
            });

            const retrieved = paymentService.getSession(session.paymentId);
            expect(retrieved?.paymentId).toBe(session.paymentId);
        });

        it('should list sessions for agent', async () => {
            await paymentService.requestPayment({
                payerAgentId: 'payer-agent',
                payeeAgentId: 'payee-agent',
                taskId: 'task-1',
                amount: '1000000',
                token: 'USDC',
                tokenSymbol: 'USDC',
                decimals: 6,
                description: 'Test 1',
            });

            await paymentService.requestPayment({
                payerAgentId: 'payer-agent',
                payeeAgentId: 'payee-agent',
                taskId: 'task-2',
                amount: '2000000',
                token: 'USDC',
                tokenSymbol: 'USDC',
                decimals: 6,
                description: 'Test 2',
            });

            const sessions = paymentService.listSessions('payer-agent');
            expect(sessions).toHaveLength(2);
        });
    });

    describe('disputes', () => {
        it('should raise dispute', async () => {
            const session = await paymentService.requestPayment({
                payerAgentId: 'payer-agent',
                payeeAgentId: 'payee-agent',
                taskId: 'task-123',
                amount: '1000000',
                token: 'USDC',
                tokenSymbol: 'USDC',
                decimals: 6,
                description: 'Test',
            });

            const disputed = await paymentService.raiseDispute(session.paymentId, 'payer-agent', {
                initiator: 'payer',
                reason: 'Service was not completed as described',
                requestedResolution: 'refund',
            });

            expect(disputed.status).toBe('disputed');

            expect(mockA2ARouter.send).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    to: 'payee-agent',
                    type: 'direct_message',
                    payload: expect.objectContaining({
                        type: 'payment_dispute',
                    }),
                }),
            );
        });
    });

    describe('cleanup', () => {
        it('should clean up expired sessions', async () => {
            // Create service with short timeout
            const shortTimeoutService = new PaymentService(mockA2ARouter, walletManager, {
                defaultTimeoutMs: 1, // 1ms timeout
                autoApproveThreshold: 80,
                chainHubProgramId: 'mock',
                rpcEndpoint: 'https://mock.rpc',
            });

            const session = await shortTimeoutService.requestPayment({
                payerAgentId: 'payer-agent',
                payeeAgentId: 'payee-agent',
                taskId: 'task-123',
                amount: '1000000',
                token: 'USDC',
                tokenSymbol: 'USDC',
                decimals: 6,
                description: 'Test',
            });

            // Wait for timeout
            await new Promise((resolve) => setTimeout(resolve, 10));

            const cleaned = shortTimeoutService.cleanupExpiredSessions();
            expect(cleaned).toBe(1);

            const expired = shortTimeoutService.getSession(session.paymentId);
            expect(expired?.status).toBe('expired');
        });
    });
});
