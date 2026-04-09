import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConnectionManager } from '../../src/connection/connection-manager.js';
import type { DaemonConfig } from '../../src/config.js';

const baseConfig: DaemonConfig = {
    port: 7420,
    host: '127.0.0.1',
    chainHubUrl: 'wss://localhost:9999/ws',
    chainHubRestUrl: 'https://localhost:9999',
    solanaRpcUrl: 'https://api.devnet.solana.com',
    dbPath: ':memory:',
    logLevel: 'error',
    maxAgentProcesses: 8,
    heartbeatInterval: 30_000,
    reconnectBaseDelay: 500,
    reconnectMaxDelay: 1000,
    reconnectMaxAttempts: 3,
    wsFailureThreshold: 3,
    restPollingInterval: 5_000,
    connectionHealthMetrics: true,
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
        cm.on('state-changed', (peerId: string, state: string) => states.push(state));
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

    it('should support adding and removing peers', () => {
        cm.addPeer('test-peer', 'wss://example.com/ws');
        const states = cm.getPeerStates();
        expect(states.has('test-peer')).toBe(true);
        expect(states.get('test-peer')).toBe('disconnected');

        cm.removePeer('test-peer');
        const statesAfterRemove = cm.getPeerStates();
        expect(statesAfterRemove.has('test-peer')).toBe(false);
    });

    it('should track health metrics', () => {
        cm.addPeer('test-peer', 'wss://example.com/ws');
        const metrics = cm.getHealthMetrics();
        expect(metrics.has('test-peer')).toBe(true);

        const peerMetrics = metrics.get('test-peer')!;
        expect(peerMetrics.latency).toBe(0);
        expect(peerMetrics.reconnectCount).toBe(0);
        expect(peerMetrics.uptime).toBe(0);
    });

    it('should set agent pubkey', () => {
        const testPubkey = 'test_pubkey_123';
        cm.setAgentPubkey(testPubkey);
        // No direct getter, but should not throw
        expect(() => cm.setAgentPubkey(testPubkey)).not.toThrow();
    });

    it('should emit task events when received', async () => {
        const taskEventPromise = new Promise<void>((resolve) => {
            cm.on('task-event', (taskEvent) => {
                expect(taskEvent.id).toBe('task-123');
                expect(taskEvent.type).toBe('test-task');
                resolve();
            });
        });

        // Simulate receiving a task event message
        const taskEventMessage = {
            type: 'task_event',
            event: {
                id: 'task-123',
                type: 'test-task',
                payload: { data: 'test' },
                priority: 1,
                timestamp: Date.now(),
            },
        };

        // Trigger message handling directly since we can't easily mock WebSocket connection in unit tests
        (cm as any).handleMessage('test-peer', taskEventMessage);

        await taskEventPromise;
    });

    it('should emit message events when received', async () => {
        const messageEventPromise = new Promise<void>((resolve) => {
            cm.on('message-event', (messageEvent) => {
                expect(messageEvent.id).toBe('msg-123');
                expect(messageEvent.from).toBe('agent-a');
                expect(messageEvent.to).toBe('agent-b');
                resolve();
            });
        });

        const messageEventMessage = {
            type: 'message_event',
            message: {
                id: 'msg-123',
                from: 'agent-a',
                to: 'agent-b',
                type: 'test-message',
                payload: { content: 'hello' },
                timestamp: Date.now(),
            },
        };

        (cm as any).handleMessage('test-peer', messageEventMessage);

        await messageEventPromise;
    });

    it('should emit fallback mode events', async () => {
        const fallbackPromise = new Promise<void>((resolve) => {
            cm.on('fallback-mode', (enabled) => {
                expect(typeof enabled).toBe('boolean');
                resolve();
            });
        });

        // Trigger fallback mode
        (cm as any).startRestFallback();

        await fallbackPromise;
    });

    it('should calculate exponential backoff correctly', () => {
        const backoff1 = (cm as any).calculateBackoff(0);
        const backoff2 = (cm as any).calculateBackoff(1);
        const backoff3 = (cm as any).calculateBackoff(5);

        expect(backoff1).toBeGreaterThanOrEqual(500); // base delay
        expect(backoff2).toBeGreaterThan(backoff1);
        // Note: backoff3 can be slightly above max due to jitter (up to 20% more)
        expect(backoff3).toBeLessThanOrEqual(1200); // max delay + jitter
    });
});
