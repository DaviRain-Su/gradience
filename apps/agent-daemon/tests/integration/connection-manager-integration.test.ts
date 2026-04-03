import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionManager } from '../../src/connection/connection-manager.js';
import type { DaemonConfig } from '../../src/config.js';

const testConfig: DaemonConfig = {
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
    wsFailureThreshold: 2, // Lower threshold for testing
    restPollingInterval: 1_000, // Faster polling for testing
    connectionHealthMetrics: true,
    keyStorage: 'file',
};

describe('ConnectionManager Integration', () => {
    let cm: ConnectionManager;

    beforeEach(() => {
        cm = new ConnectionManager(testConfig);
        // Suppress uncaught WS errors in tests
        cm.on('error', () => {});
    });

    afterEach(async () => {
        await cm.disconnect();
    });

    it('should manage multiple peer connections', async () => {
        // Add multiple peers
        cm.addPeer('peer-1', 'wss://peer1.example.com/ws', 'peer');
        cm.addPeer('peer-2', 'wss://peer2.example.com/ws', 'peer');
        cm.addPeer('indexer-backup', 'wss://backup.indexer.com/ws', 'indexer');

        const peerStates = cm.getPeerStates();
        expect(peerStates.size).toBe(3); // 3 added peers (primary indexer added on connect())
        expect(peerStates.get('peer-1')).toBe('disconnected');
        expect(peerStates.get('peer-2')).toBe('disconnected');
        expect(peerStates.get('indexer-backup')).toBe('disconnected');

        // Remove one peer
        cm.removePeer('peer-2');
        const statesAfterRemove = cm.getPeerStates();
        expect(statesAfterRemove.size).toBe(2);
        expect(statesAfterRemove.has('peer-2')).toBe(false);
    });

    it('should track health metrics for each peer', () => {
        cm.addPeer('test-peer', 'wss://test.example.com/ws');
        
        const metrics = cm.getHealthMetrics();
        expect(metrics.has('test-peer')).toBe(true);
        
        const peerMetrics = metrics.get('test-peer')!;
        expect(peerMetrics).toEqual({
            latency: 0,
            reconnectCount: 0,
            lastSeen: 0,
            uptime: 0
        });
    });

    it('should handle subscription protocol', () => {
        cm.setAgentPubkey('test_agent_pubkey_12345');
        
        // Add an indexer connection first
        cm.addPeer('test-indexer', 'wss://indexer.test.com/ws', 'indexer');
        
        // Should return true when there are indexer connections (even if not connected)
        const subscribeResult = cm.subscribe(['tasks', 'messages']);
        expect(subscribeResult).toBe(true);
        
        // Subscribe to specific peer
        const peerSubscribeResult = cm.subscribe(['custom_topic'], 'test-indexer');
        expect(peerSubscribeResult).toBe(true);
    });

    it('should emit structured events', async () => {
        const taskEvents: any[] = [];
        const messageEvents: any[] = [];
        const healthEvents: any[] = [];
        const fallbackEvents: any[] = [];

        cm.on('task-event', (event) => taskEvents.push(event));
        cm.on('message-event', (event) => messageEvents.push(event));
        cm.on('health-metrics', (peerId, metrics) => healthEvents.push({ peerId, metrics }));
        cm.on('fallback-mode', (enabled) => fallbackEvents.push(enabled));

        // Simulate events
        (cm as any).handleMessage('test-peer', {
            type: 'task_event',
            event: {
                id: 'task-456',
                type: 'test-task',
                payload: { test: true },
                priority: 2,
                timestamp: Date.now()
            }
        });

        (cm as any).handleMessage('test-peer', {
            type: 'message_event',
            message: {
                id: 'msg-789',
                from: 'agent-x',
                to: 'agent-y',
                type: 'greeting',
                payload: { message: 'hello world' },
                timestamp: Date.now()
            }
        });

        // Trigger fallback mode
        (cm as any).startRestFallback();

        // Verify events were emitted
        expect(taskEvents).toHaveLength(1);
        expect(taskEvents[0].id).toBe('task-456');
        
        expect(messageEvents).toHaveLength(1);
        expect(messageEvents[0].id).toBe('msg-789');
        
        expect(fallbackEvents).toHaveLength(1);
        expect(fallbackEvents[0]).toBe(true);
    });

    it('should handle connection failures and trigger fallback', () => {
        const fallbackEvents: boolean[] = [];
        cm.on('fallback-mode', (enabled) => fallbackEvents.push(enabled));

        // Add an indexer connection first
        cm.addPeer('test-indexer', 'wss://indexer.test.com/ws', 'indexer');

        // Simulate multiple connection failures
        for (let i = 0; i < testConfig.wsFailureThreshold; i++) {
            (cm as any).handleConnectionFailure('test-indexer');
        }

        expect(fallbackEvents).toContain(true);
    });

    it('should support sending to specific peers', () => {
        cm.addPeer('target-peer', 'wss://target.com/ws');
        
        // Send to specific peer (should return false since not connected)
        const specificResult = cm.send({ test: 'data' }, 'target-peer');
        expect(specificResult).toBe(false);
        
        // Send to all peers (should return false since none are connected)
        const broadcastResult = cm.send({ test: 'broadcast' });
        expect(broadcastResult).toBe(false);
    });

    it('should expose backward compatible API', () => {
        // Backward compatibility checks
        expect(typeof cm.getState()).toBe('string');
        expect(typeof cm.send({ test: true })).toBe('boolean');
        expect(typeof cm.connect).toBe('function');
        expect(typeof cm.disconnect).toBe('function');
    });
});