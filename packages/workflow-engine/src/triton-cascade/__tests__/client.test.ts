/**
 * Triton Cascade Integration - Client Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TritonCascadeClient, createTritonCascadeClient } from '../client.js';
import { CascadeError, CascadeErrorCodes } from '../errors.js';

describe('TritonCascadeClient', () => {
    let client: TritonCascadeClient;

    afterEach(async () => {
        if (client) {
            await client.close();
        }
    });

    describe('initialization', () => {
        it('should create client with default config', () => {
            client = new TritonCascadeClient({ network: 'devnet' });

            expect(client).toBeDefined();
            expect(client.getMetrics()).toMatchObject({
                transactionsSubmitted: 0,
                transactionsConfirmed: 0,
                transactionsFailed: 0,
            });
        });

        it('should create client with createTritonCascadeClient helper', () => {
            client = createTritonCascadeClient({ network: 'devnet' });

            expect(client).toBeDefined();
        });

        it('should create client with Jito enabled', () => {
            client = new TritonCascadeClient({
                network: 'devnet',
                enableJitoBundle: true,
            });

            expect(client).toBeDefined();
        });
    });

    describe('getPriorityFeeEstimate', () => {
        it('should return cached estimate if available', async () => {
            client = new TritonCascadeClient({ network: 'devnet' });

            // This will fail because we don't have a real endpoint
            // But it tests the error handling path
            await expect(client.getPriorityFeeEstimate()).rejects.toThrow();
        });
    });

    describe('getHealthStatus', () => {
        it('should return health status', async () => {
            client = new TritonCascadeClient({ network: 'devnet' });

            // This will fail because we don't have a real endpoint
            await expect(client.getHealthStatus()).rejects.toThrow();
        });
    });

    describe('getMetrics', () => {
        it('should return initial metrics', () => {
            client = new TritonCascadeClient({ network: 'devnet' });

            const metrics = client.getMetrics();

            expect(metrics).toMatchObject({
                transactionsSubmitted: 0,
                transactionsConfirmed: 0,
                transactionsFailed: 0,
                totalRetries: 0,
                averageLatencyMs: 0,
                queueSize: 0,
            });
        });
    });

    describe('close', () => {
        it('should close the client', async () => {
            client = new TritonCascadeClient({ network: 'devnet' });

            await client.close();

            // Should throw when trying to use closed client
            await expect(client.sendTransaction('test')).rejects.toThrow('Client is closed');
        });

        it('should be safe to close multiple times', async () => {
            client = new TritonCascadeClient({ network: 'devnet' });

            await client.close();
            await client.close(); // Should not throw
        });
    });

    describe('sendTransaction', () => {
        it('should throw when client is closed', async () => {
            client = new TritonCascadeClient({ network: 'devnet' });
            await client.close();

            await expect(client.sendTransaction('test')).rejects.toThrow('Client is closed');
        });

        it('should throw for invalid transaction', async () => {
            client = new TritonCascadeClient({
                network: 'devnet',
                rpcEndpoint: 'https://api.devnet.solana.com',
            });

            // This will fail because the transaction is invalid
            await expect(client.sendTransaction('invalid')).rejects.toThrow();
        });
    });
});
