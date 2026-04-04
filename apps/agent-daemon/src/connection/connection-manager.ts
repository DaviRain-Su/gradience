import WebSocket from 'ws';
import { EventEmitter } from 'node:events';
import { logger } from '../utils/logger.js';
import type { DaemonConfig } from '../config.js';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
export type ConnectionType = 'indexer' | 'peer';

export interface ConnectionHealthMetrics {
    latency: number;
    reconnectCount: number;
    lastSeen: number;
    uptime: number;
}

export interface PeerConnection {
    id: string;
    url: string;
    type: ConnectionType;
    ws: WebSocket | null;
    state: ConnectionState;
    metrics: ConnectionHealthMetrics;
    subscriptions: Set<string>;
    reconnectAttempts: number;
    reconnectTimer: ReturnType<typeof setTimeout> | null;
    heartbeatTimer: ReturnType<typeof setInterval> | null;
    heartbeatTimeout: ReturnType<typeof setTimeout> | null;
}

export interface SubscriptionMessage {
    type: 'subscribe';
    topics: string[];
    agentPubkey: string;
}

export interface TaskEventMessage {
    type: 'task_event';
    event: {
        id: string;
        type: string;
        payload: unknown;
        priority: number;
        timestamp: number;
    };
}

export interface MessageEventMessage {
    type: 'message_event';
    message: {
        id: string;
        from: string;
        to: string;
        type: string;
        payload: unknown;
        timestamp: number;
    };
}

export interface HeartbeatMessage {
    type: 'ping' | 'pong';
    timestamp: number;
}

export type WebSocketMessage = SubscriptionMessage | TaskEventMessage | MessageEventMessage | HeartbeatMessage;

export interface ConnectionManagerEvents {
    'state-changed': (peerId: string, state: ConnectionState) => void;
    'task-event': (taskEvent: TaskEventMessage['event']) => void;
    'message-event': (messageEvent: MessageEventMessage['message']) => void;
    'health-metrics': (peerId: string, metrics: ConnectionHealthMetrics) => void;
    'fallback-mode': (enabled: boolean) => void;
    message: (data: unknown) => void; // Backward compatibility
    error: (error: Error) => void;
}

export class ConnectionManager extends EventEmitter {
    private connections = new Map<string, PeerConnection>();
    private destroyed = false;
    private agentPubkey: string = '';
    
    // REST API fallback
    private restFallbackEnabled = false;
    private restFallbackTimer: ReturnType<typeof setInterval> | null = null;
    private lastTaskFetch = 0;
    private wsFailureCount = 0;

    constructor(private readonly config: DaemonConfig) {
        super();
        // Generate a placeholder agent pubkey for now
        this.agentPubkey = 'agent_' + Math.random().toString(36).substring(2, 15);
    }

    setAgentPubkey(pubkey: string): void {
        this.agentPubkey = pubkey;
        // Re-subscribe all connections with new pubkey
        for (const [peerId, connection] of this.connections) {
            if (connection.state === 'connected' && connection.subscriptions.size > 0) {
                this.sendSubscription(peerId, Array.from(connection.subscriptions));
            }
        }
    }

    getState(): ConnectionState {
        // Return the state of the primary indexer connection, or 'disconnected' if none
        const indexerConnection = Array.from(this.connections.values()).find(c => c.type === 'indexer');
        return indexerConnection?.state ?? 'disconnected';
    }

    getPeerStates(): Map<string, ConnectionState> {
        const states = new Map<string, ConnectionState>();
        for (const [peerId, connection] of this.connections) {
            states.set(peerId, connection.state);
        }
        return states;
    }

    getHealthMetrics(): Map<string, ConnectionHealthMetrics> {
        const metrics = new Map<string, ConnectionHealthMetrics>();
        for (const [peerId, connection] of this.connections) {
            metrics.set(peerId, { ...connection.metrics });
        }
        return metrics;
    }

    async connect(): Promise<void> {
        if (this.destroyed) return;
        
        // Add the primary indexer connection if it doesn't exist
        const indexerId = 'indexer-primary';
        if (!this.connections.has(indexerId)) {
            this.addPeer(indexerId, this.config.chainHubUrl, 'indexer');
        }
        
        // Connect to all peers
        const connectPromises = Array.from(this.connections.keys()).map(peerId => 
            this.connectToPeer(peerId)
        );
        
        await Promise.allSettled(connectPromises);
    }

    async disconnect(): Promise<void> {
        this.destroyed = true;
        this.stopRestFallback();
        
        const disconnectPromises = Array.from(this.connections.keys()).map(peerId =>
            this.disconnectFromPeer(peerId)
        );
        
        await Promise.allSettled(disconnectPromises);
        this.connections.clear();
    }

    addPeer(peerId: string, url: string, type: ConnectionType = 'peer'): void {
        if (this.connections.has(peerId)) {
            logger.warn({ peerId, url }, 'Peer already exists, updating URL');
            this.removePeer(peerId);
        }

        const connection: PeerConnection = {
            id: peerId,
            url,
            type,
            ws: null,
            state: 'disconnected',
            metrics: {
                latency: 0,
                reconnectCount: 0,
                lastSeen: 0,
                uptime: 0
            },
            subscriptions: new Set(),
            reconnectAttempts: 0,
            reconnectTimer: null,
            heartbeatTimer: null,
            heartbeatTimeout: null
        };

        this.connections.set(peerId, connection);
        logger.info({ peerId, url, type }, 'Peer added');
    }

    removePeer(peerId: string): void {
        const connection = this.connections.get(peerId);
        if (!connection) return;

        this.disconnectFromPeer(peerId);
        this.connections.delete(peerId);
        logger.info({ peerId }, 'Peer removed');
    }

    send(data: unknown, peerId?: string): boolean {
        if (peerId) {
            return this.sendToPeer(peerId, data);
        }

        // Send to all connected peers
        let success = false;
        for (const [id] of this.connections) {
            if (this.sendToPeer(id, data)) {
                success = true;
            }
        }
        return success;
    }

    subscribe(topics: string[], peerId?: string): boolean {
        if (peerId) {
            return this.subscribeToTopics(peerId, topics);
        }

        // Subscribe on all connections
        let success = false;
        for (const [id, connection] of this.connections) {
            if (connection.type === 'indexer') { // Only subscribe to indexer connections
                if (this.subscribeToTopics(id, topics)) {
                    success = true;
                }
            }
        }
        return success;
    }

    private async connectToPeer(peerId: string): Promise<void> {
        const connection = this.connections.get(peerId);
        if (!connection || connection.state === 'connected' || connection.state === 'connecting') {
            return;
        }

        this.setState(peerId, 'connecting');
        
        try {
            connection.ws = new WebSocket(connection.url);
        } catch (err) {
            logger.error({ err, peerId, url: connection.url }, 'Invalid WebSocket URL');
            this.setState(peerId, 'disconnected');
            this.handleConnectionFailure(peerId);
            return;
        }

        this.setupWebSocketHandlers(peerId);
    }

    private async disconnectFromPeer(peerId: string): Promise<void> {
        const connection = this.connections.get(peerId);
        if (!connection) return;

        this.clearTimers(peerId);
        
        if (connection.ws) {
            const ws = connection.ws;
            connection.ws = null; // Clear reference first
            
            ws.removeAllListeners();
            
            // Add a one-time error handler to catch termination errors
            ws.on('error', () => {
                // Ignore errors during cleanup
            });
            
            if (ws.readyState === WebSocket.OPEN) {
                ws.close(1000, 'Client disconnect');
            } else if (ws.readyState === WebSocket.CONNECTING) {
                // For connecting sockets, add close handler to close when connection is established
                ws.on('open', () => ws.close(1000, 'Client disconnect'));
            }
            // If readyState is CLOSING or CLOSED, don't do anything
        }
        
        this.setState(peerId, 'disconnected');
    }

    private setupWebSocketHandlers(peerId: string): void {
        const connection = this.connections.get(peerId);
        if (!connection?.ws) return;

        const ws = connection.ws;

        ws.on('error', (err: Error) => {
            logger.error({ err, peerId }, 'WebSocket error');
            this.emit('error', err);
            this.handleConnectionFailure(peerId);
        });

        ws.on('open', () => {
            logger.info({ peerId, url: connection.url }, 'WebSocket connected');
            connection.reconnectAttempts = 0;
            this.wsFailureCount = 0; // Reset failure count on successful connection
            connection.metrics.uptime = Date.now();
            this.setState(peerId, 'connected');
            this.startHeartbeat(peerId);
            
            // Subscribe to default topics for indexer connections
            if (connection.type === 'indexer') {
                this.subscribeToTopics(peerId, ['tasks', 'messages']);
            }
        });

        ws.on('message', (raw: WebSocket.RawData) => {
            connection.metrics.lastSeen = Date.now();
            
            try {
                const data = JSON.parse(raw.toString()) as WebSocketMessage;
                this.handleMessage(peerId, data);
            } catch {
                logger.warn({ peerId }, 'Received non-JSON WebSocket message');
            }
        });

        ws.on('pong', (data: Buffer) => {
            this.handlePong(peerId, data);
        });

        ws.on('close', (code: number, reason: Buffer) => {
            logger.info({ peerId, code, reason: reason.toString() }, 'WebSocket closed');
            this.stopHeartbeat(peerId);
            connection.metrics.uptime = 0;
            
            if (!this.destroyed) {
                this.scheduleReconnect(peerId);
            }
        });
    }

    private handleMessage(peerId: string, message: WebSocketMessage): void {
        switch (message.type) {
            case 'task_event':
                this.emit('task-event', message.event);
                break;
                
            case 'message_event':
                this.emit('message-event', message.message);
                break;
                
            case 'pong':
                this.handlePong(peerId, Buffer.from(JSON.stringify({ timestamp: message.timestamp })));
                break;
                
            default:
                // Backward compatibility - emit raw message
                this.emit('message', message);
                break;
        }
    }

    private sendToPeer(peerId: string, data: unknown): boolean {
        const connection = this.connections.get(peerId);
        if (!connection?.ws || connection.ws.readyState !== WebSocket.OPEN) {
            return false;
        }
        
        try {
            connection.ws.send(JSON.stringify(data));
            return true;
        } catch (err) {
            logger.error({ err, peerId }, 'Failed to send WebSocket message');
            return false;
        }
    }

    private sendSubscription(peerId: string, topics: string[]): boolean {
        const subscriptionMessage: SubscriptionMessage = {
            type: 'subscribe',
            topics,
            agentPubkey: this.agentPubkey
        };
        
        return this.sendToPeer(peerId, subscriptionMessage);
    }

    private subscribeToTopics(peerId: string, topics: string[]): boolean {
        const connection = this.connections.get(peerId);
        if (!connection) return false;

        // Add topics to subscription set
        topics.forEach(topic => connection.subscriptions.add(topic));

        if (connection.state === 'connected') {
            return this.sendSubscription(peerId, topics);
        }
        
        return true; // Will subscribe when connected
    }

    private scheduleReconnect(peerId: string): void {
        const connection = this.connections.get(peerId);
        if (!connection) return;

        const maxAttempts = this.config.reconnectMaxAttempts;
        if (maxAttempts > 0 && connection.reconnectAttempts >= maxAttempts) {
            logger.error(
                { peerId, attempts: connection.reconnectAttempts, max: maxAttempts },
                'Max reconnect attempts reached'
            );
            this.setState(peerId, 'disconnected');
            this.handleConnectionFailure(peerId);
            return;
        }

        this.setState(peerId, 'reconnecting');
        const delay = this.calculateBackoff(connection.reconnectAttempts);
        logger.debug({ peerId, delay, attempt: connection.reconnectAttempts + 1 }, 'Scheduling reconnect');

        connection.reconnectTimer = setTimeout(() => {
            connection.reconnectAttempts++;
            connection.metrics.reconnectCount++;
            this.connectToPeer(peerId);
        }, delay);
    }

    private handleConnectionFailure(peerId: string): void {
        const connection = this.connections.get(peerId);
        if (!connection || connection.type !== 'indexer') return;

        this.wsFailureCount++;
        
        if (this.wsFailureCount >= this.config.wsFailureThreshold && !this.restFallbackEnabled) {
            logger.warn('WebSocket failures exceeded threshold, enabling REST fallback');
            this.startRestFallback();
        }
    }

    private startRestFallback(): void {
        if (this.restFallbackEnabled) return;
        
        this.restFallbackEnabled = true;
        this.emit('fallback-mode', true);
        
        this.restFallbackTimer = setInterval(() => {
            this.pollRestAPI();
        }, this.config.restPollingInterval);
        
        logger.info('REST API fallback mode enabled');
    }

    private stopRestFallback(): void {
        if (!this.restFallbackEnabled) return;
        
        this.restFallbackEnabled = false;
        this.emit('fallback-mode', false);
        
        if (this.restFallbackTimer) {
            clearInterval(this.restFallbackTimer);
            this.restFallbackTimer = null;
        }
        
        logger.info('REST API fallback mode disabled');
    }

    private async pollRestAPI(): Promise<void> {
        try {
            const since = this.lastTaskFetch;
            const response = await fetch(`${this.config.chainHubRestUrl}/api/tasks?since=${since}`);
            
            if (!response.ok) {
                logger.warn({ status: response.status }, 'REST API polling failed');
                return;
            }
            
            const data = await response.json() as { tasks: Array<{ id: string; type: string; payload: unknown; priority: number; timestamp: number }> };
            
            // Emit task events for new tasks
            for (const task of data.tasks) {
                if (task.timestamp > this.lastTaskFetch) {
                    this.emit('task-event', task);
                }
            }
            
            this.lastTaskFetch = Date.now();
            
            // Check if WebSocket connections are back online
            const hasConnectedIndexer = Array.from(this.connections.values()).some(
                c => c.type === 'indexer' && c.state === 'connected'
            );
            
            if (hasConnectedIndexer) {
                this.stopRestFallback();
            }
            
        } catch (err) {
            logger.debug({ err }, 'REST API polling error');
        }
    }

    private calculateBackoff(attempts: number): number {
        const base = this.config.reconnectBaseDelay;
        const max = this.config.reconnectMaxDelay;
        const delay = Math.min(base * Math.pow(2, attempts), max);
        const jitter = Math.random() * delay * 0.2;
        return Math.floor(delay + jitter);
    }

    private startHeartbeat(peerId: string): void {
        const connection = this.connections.get(peerId);
        if (!connection) return;

        connection.heartbeatTimer = setInterval(() => {
            if (connection.ws?.readyState === WebSocket.OPEN) {
                const pingTimestamp = Date.now();
                connection.ws.ping(Buffer.from(JSON.stringify({ timestamp: pingTimestamp })));
                
                connection.heartbeatTimeout = setTimeout(() => {
                    logger.warn({ peerId }, 'Heartbeat timeout, closing connection');
                    connection.ws?.terminate();
                }, 10_000);
            }
        }, this.config.heartbeatInterval);
    }

    private stopHeartbeat(peerId: string): void {
        const connection = this.connections.get(peerId);
        if (!connection) return;

        if (connection.heartbeatTimer) {
            clearInterval(connection.heartbeatTimer);
            connection.heartbeatTimer = null;
        }
        if (connection.heartbeatTimeout) {
            clearTimeout(connection.heartbeatTimeout);
            connection.heartbeatTimeout = null;
        }
    }

    private handlePong(peerId: string, data: Buffer): void {
        const connection = this.connections.get(peerId);
        if (!connection) return;

        if (connection.heartbeatTimeout) {
            clearTimeout(connection.heartbeatTimeout);
            connection.heartbeatTimeout = null;
        }

        try {
            const parsed = JSON.parse(data.toString()) as { timestamp: number };
            const latency = Date.now() - parsed.timestamp;
            connection.metrics.latency = latency;
            
            if (this.config.connectionHealthMetrics) {
                this.emit('health-metrics', peerId, { ...connection.metrics });
            }
        } catch {
            // Ignore malformed pong data
        }
    }

    private clearTimers(peerId: string): void {
        const connection = this.connections.get(peerId);
        if (!connection) return;

        this.stopHeartbeat(peerId);
        if (connection.reconnectTimer) {
            clearTimeout(connection.reconnectTimer);
            connection.reconnectTimer = null;
        }
    }

    private setState(peerId: string, newState: ConnectionState): void {
        const connection = this.connections.get(peerId);
        if (!connection || connection.state === newState) return;
        
        const prev = connection.state;
        connection.state = newState;
        logger.debug({ peerId, from: prev, to: newState }, 'Connection state changed');
        this.emit('state-changed', peerId, newState);
    }
}