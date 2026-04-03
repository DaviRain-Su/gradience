import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConnectionManager } from '../../src/connection/connection-manager.js';
import type { DaemonConfig } from '../../src/config.js';

const baseConfig: DaemonConfig = {
    port: 7420,
    host: '127.0.0.1',
    chainHubUrl: 'wss://localhost:9999/ws',
    solanaRpcUrl: 'https://api.devnet.solana.com',
    dbPath: ':memory:',
    logLevel: 'error',
    maxAgentProcesses: 8,
    heartbeatInterval: 30_000,
    reconnectBaseDelay: 500,
    reconnectMaxDelay: 1000,
    reconnectMaxAttempts: 3,
    keyStorage: 'file',
};

describe('ConnectionManager', () => {
    let cm: ConnectionManager;

    beforeEach(() => {
        cm = new ConnectionManager(baseConfig);
        // Suppress uncaught WS errors in tests
        cm.on('error', () => {});
    });

    afterEach(async () => {
        await cm.disconnect();
    });

    it('H3: should start in disconnected state', () => {
        expect(cm.getState()).toBe('disconnected');
    });

    it('should emit state-changed on connect attempt', async () => {
        const states: string[] = [];
        cm.on('state-changed', (s: string) => states.push(s));
        await cm.connect();
        expect(states[0]).toBe('connecting');
    });

    it('should transition to disconnected on disconnect()', async () => {
        await cm.disconnect();
        expect(cm.getState()).toBe('disconnected');
    });

    it('send() should return false when not connected', () => {
        expect(cm.send({ test: true })).toBe(false);
    });
});
