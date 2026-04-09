/**
 * SDK Utilities Unit Tests
 *
 * Tests for SDK helper functions
 */

import { describe, it, expect, vi } from 'vitest';
import { createSdk, createRpcClient, loadKeypairSigner, createKeypairAdapter } from './sdk.js';
import { loadConfig, updateConfig, readConfig } from './config.js';

describe('SDK Utils', () => {
    describe('createSdk', () => {
        it('should create SDK with default endpoint', () => {
            const sdk = createSdk({});
            expect(sdk).toBeDefined();
        });

        it('should create SDK with custom endpoint', () => {
            const sdk = createSdk({
                GRADIENCE_INDEXER_ENDPOINT: 'https://custom.api.com',
            });
            expect(sdk).toBeDefined();
        });
    });

    describe('createRpcClient', () => {
        it('should create RPC client', () => {
            const client = createRpcClient('https://api.devnet.solana.com');
            expect(client).toBeDefined();
        });
    });

    describe('loadKeypairSigner', () => {
        it('should throw on missing file', async () => {
            await expect(loadKeypairSigner('/nonexistent/keypair.json')).rejects.toThrow();
        });

        it('should throw on invalid JSON', async () => {
            // Would need mocking to test file system
        });
    });

    describe('createKeypairAdapter', () => {
        it('should create adapter', async () => {
            // Would need valid keypair file to test
        });
    });
});

describe('Config Utils', () => {
    describe('loadConfig', () => {
        it('should return empty config when file missing', async () => {
            const config = await loadConfig({ HOME: '/tmp/nonexistent' });
            expect(config).toEqual({});
        });
    });

    describe('readConfig', () => {
        it('should return empty object on error', async () => {
            const config = await readConfig('/nonexistent/path.json');
            expect(config).toEqual({});
        });
    });

    describe('updateConfig', () => {
        it('should validate RPC URL', async () => {
            await expect(updateConfig('rpc', 'invalid-url', { HOME: '/tmp' })).rejects.toThrow('Invalid RPC URL');
        });

        it('should accept valid RPC URL', async () => {
            // Would need mocking to test file write
        });
    });
});
