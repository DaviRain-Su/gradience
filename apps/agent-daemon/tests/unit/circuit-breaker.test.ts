/**
 * Circuit Breaker Unit Tests
 *
 * @module a2a-router/circuit-breaker.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    CircuitBreaker,
    CircuitBreakerRegistry,
    CircuitOpenError,
    DEFAULT_CIRCUIT_CONFIG,
} from '../../src/a2a-router/circuit-breaker.js';

describe('CircuitBreaker', () => {
    let breaker: CircuitBreaker;

    beforeEach(() => {
        breaker = new CircuitBreaker('test', {
            failureThreshold: 3,
            resetTimeoutMs: 1000,
            operationTimeoutMs: 5000,
        });
    });

    describe('Basic Operations', () => {
        it('should execute successful operations', async () => {
            const result = await breaker.execute(async () => 'success');
            expect(result).toBe('success');
            expect(breaker.getState()).toBe('closed');
        });

        it('should track failures', async () => {
            await expect(
                breaker.execute(async () => {
                    throw new Error('test error');
                }),
            ).rejects.toThrow('test error');

            const stats = breaker.getStats();
            expect(stats.totalFailures).toBe(1);
        });

        it('should open circuit after threshold failures', async () => {
            // Generate failures
            for (let i = 0; i < 3; i++) {
                try {
                    await breaker.execute(async () => {
                        throw new Error('test error');
                    });
                } catch {}
            }

            expect(breaker.getState()).toBe('open');
        });

        it('should reject calls when open', async () => {
            // Open the circuit
            breaker.forceState('open');

            await expect(breaker.execute(async () => 'success')).rejects.toThrow(CircuitOpenError);
        });
    });

    describe('State Transitions', () => {
        it('should transition from closed to open', async () => {
            expect(breaker.getState()).toBe('closed');

            for (let i = 0; i < 3; i++) {
                try {
                    await breaker.execute(async () => {
                        throw new Error('test');
                    });
                } catch {}
            }

            expect(breaker.getState()).toBe('open');
        });

        it('should reset to closed', () => {
            breaker.forceState('open');
            breaker.reset();
            expect(breaker.getState()).toBe('closed');
        });
    });

    describe('Statistics', () => {
        it('should report stats correctly', async () => {
            await breaker.execute(async () => 'success');

            const stats = breaker.getStats();
            expect(stats.state).toBe('closed');
            expect(stats.totalSuccesses).toBe(1);
            expect(stats.totalFailures).toBe(0);
            expect(stats.failureRate).toBe(0);
        });
    });
});

describe('CircuitBreakerRegistry', () => {
    let registry: CircuitBreakerRegistry;

    beforeEach(() => {
        registry = new CircuitBreakerRegistry();
    });

    it('should create and retrieve breakers', () => {
        const breaker = registry.get('test');
        expect(breaker).toBeInstanceOf(CircuitBreaker);
        expect(registry.get('test')).toBe(breaker);
    });

    it('should get all stats', () => {
        registry.get('breaker1');
        registry.get('breaker2');

        const stats = registry.getAllStats();
        expect(Object.keys(stats)).toHaveLength(2);
    });

    it('should track open circuits', async () => {
        const breaker = registry.get('test');
        breaker.forceState('open');

        expect(registry.hasOpenCircuit()).toBe(true);
        expect(registry.getOpenCircuits()).toContain('test');
    });
});
