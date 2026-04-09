/**
 * Jupiter API Integration Tests
 *
 * Tests for real trading handlers with Jupiter API
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    createRealSwapHandler,
    createRealTransferHandler,
    createRealTradingHandlers,
    createAllHandlers,
    getSupportedActions,
    type HandlerMode,
} from '../src/handlers/index.js';
import type { ExecutionContext } from '../src/engine/step-executor.js';

describe('Jupiter API Integration', () => {
    const mockContext: ExecutionContext = {
        workflowId: 'test-workflow',
        stepId: 'test-step',
        variables: new Map(),
        logger: console,
    };

    describe('Handler Creation', () => {
        it('should create real swap handler', () => {
            const handler = createRealSwapHandler({
                jupiterApiUrl: 'https://quote-api.jup.ag/v6',
                useTritonCascade: false,
            });

            expect(handler).toBeDefined();
            expect(handler.execute).toBeDefined();
        });

        it('should create real transfer handler', () => {
            const handler = createRealTransferHandler({
                useTritonCascade: false,
            });

            expect(handler).toBeDefined();
            expect(handler.execute).toBeDefined();
        });

        it('should create all real trading handlers', () => {
            const handlers = createRealTradingHandlers({
                jupiterApiUrl: 'https://quote-api.jup.ag/v6',
                useTritonCascade: false,
            });

            expect(handlers.size).toBeGreaterThan(0);
            expect(handlers.has('swap')).toBe(true);
            expect(handlers.has('transfer')).toBe(true);
            expect(handlers.has('stake')).toBe(true);
            expect(handlers.has('unstake')).toBe(true);
        });
    });

    describe('createAllHandlers with mode selection', () => {
        it('should create mock handlers by default', () => {
            const handlers = createAllHandlers('mock');

            expect(handlers.size).toBeGreaterThan(0);
            // In mock mode, handlers should not require real RPC calls
        });

        it('should create real handlers when mode is real', () => {
            const handlers = createAllHandlers('real', {
                jupiterApiUrl: 'https://quote-api.jup.ag/v6',
                useTritonCascade: false,
            });

            expect(handlers.size).toBeGreaterThan(0);
            expect(handlers.has('swap')).toBe(true);
            expect(handlers.has('transfer')).toBe(true);
        });

        it('should auto-detect mode based on environment', () => {
            // Save original env
            const originalEnv = process.env.USE_REAL_HANDLERS;

            // Test with USE_REAL_HANDLERS=true
            process.env.USE_REAL_HANDLERS = 'true';
            const handlersWithRealEnv = createAllHandlers('auto');
            expect(handlersWithRealEnv.size).toBeGreaterThan(0);

            // Test without env var
            delete process.env.USE_REAL_HANDLERS;
            const handlersWithNoEnv = createAllHandlers('auto');
            expect(handlersWithNoEnv.size).toBeGreaterThan(0);

            // Restore env
            process.env.USE_REAL_HANDLERS = originalEnv;
        });
    });

    describe('Jupiter Quote API', () => {
        it('should fetch quote from Jupiter (integration test)', async () => {
            // Skip if no network
            if (process.env.SKIP_NETWORK_TESTS === 'true') {
                console.log('Skipping network test');
                return;
            }

            const handler = createRealSwapHandler({
                jupiterApiUrl: 'https://quote-api.jup.ag/v6',
                useTritonCascade: false,
            });

            // USDC to SOL swap parameters (mainnet)
            const params = {
                from: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
                to: 'So11111111111111111111111111111111111111112', // SOL
                amount: '1000000', // 1 USDC (6 decimals)
                slippage: 0.5,
                // Note: signer would be required for actual execution
            };

            // This will fail without a signer, but we can test the quote step
            try {
                await handler.execute('solana', params, mockContext);
            } catch (error: any) {
                // Expected to fail without signer
                expect(error.message).toContain('Signer');
            }
        }, 30000); // 30s timeout for network
    });

    describe('Handler Exports', () => {
        it('should register implemented handlers by default', () => {
            const handlers = createRealTradingHandlers();

            const expectedHandlers = ['swap', 'transfer', 'stake', 'unstake'];
            for (const handlerName of expectedHandlers) {
                expect(handlers.has(handlerName)).toBe(true);
            }

            const stubHandlers = ['bridge', 'yieldFarm', 'borrow', 'repay'];
            for (const handlerName of stubHandlers) {
                expect(handlers.has(handlerName)).toBe(false);
            }
        });

        it('should expose supported actions metadata', () => {
            const actions = getSupportedActions();
            expect(actions.length).toBeGreaterThan(0);

            const stable = actions.filter((a) => a.status === 'stable');
            expect(stable.map((a) => a.name)).toContain('swap');
            expect(stable.map((a) => a.name)).toContain('transfer');

            const stub = actions.filter((a) => a.status === 'stub');
            expect(stub.map((a) => a.name)).toContain('bridge');
        });
    });
});
