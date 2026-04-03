/**
 * useA2A Hook unit tests
 *
 * @module hooks/useA2A.test
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// Mock React for testing
const mockUseState = <T>(initial: T): [T, (v: T) => void] => [initial, () => {}];
const mockUseEffect = () => {};
const mockUseCallback = <T>(fn: T) => fn;
const mockUseRef = <T>(initial: T) => ({ current: initial });
const mockUseMemo = <T>(fn: () => T) => fn();

// Simple test to verify hook structure
describe('useA2A', () => {
    it('should be importable', async () => {
        // Dynamic import to avoid React dependency in Node test
        const module = await import('../../renderer/hooks/useA2A.js');
        assert.ok(module.useA2A);
        assert.strictEqual(typeof module.useA2A, 'function');
    });

    it('should export UseA2AReturn interface', async () => {
        const module = await import('../../renderer/hooks/useA2A.js');
        // Type-only export, just verify module loads
        assert.ok(module);
    });
});

describe('useA2A integration', () => {
    it('should work with disabled protocols', async () => {
        // This is a smoke test to ensure the hook can be created
        // Full integration tests require React rendering environment
        const module = await import('../../renderer/hooks/useA2A.js');
        assert.ok(module.useA2A);
    });
});
