import WebSocket from 'ws';
import { EventEmitter } from 'node:events';
import { logger } from '../utils/logger.js';
import type { DaemonConfig } from '../config.js';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface ConnectionManagerEvents {
    'state-changed': (state: ConnectionState) => void;
    message: (data: unknown) => void;
    error: (error: Error) => void;
}

export class ConnectionManager extends EventEmitter {
    private ws: WebSocket | null = null;
    private state: ConnectionState = 'disconnected';
    private reconnectAttempts = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
    private destroyed = false;

    constructor(private readonly config: DaemonConfig) {
        super();
    }

    getState(): ConnectionState {
        return this.state;
    }

    async connect(): Promise<void> {
        if (this.destroyed) return;
        if (this.state === 'connected' || this.state === 'connecting') return;
        this.setState('connecting');
        this.createConnection();
    }

    async disconnect(): Promise<void> {
        this.destroyed = true;
        this.clearTimers();
        if (this.ws) {
            this.ws.removeAllListeners();
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.close(1000, 'Client disconnect');
            } else {
                this.ws.terminate();
            }
            this.ws = null;
        }
        this.setState('disconnected');
    }

    send(data: unknown): boolean {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return false;
        }
        try {
            this.ws.send(JSON.stringify(data));
            return true;
        } catch (err) {
            logger.error({ err }, 'Failed to send WebSocket message');
            return false;
        }
    }

    private createConnection(): void {
        try {
            this.ws = new WebSocket(this.config.chainHubUrl);
        } catch (err) {
            logger.error({ err, url: this.config.chainHubUrl }, 'Invalid WebSocket URL');
            this.setState('disconnected');
            return;
        }

        // Catch connection-level errors to prevent uncaught exceptions
        this.ws.on('error', (err: Error) => {
            logger.error({ err }, 'WebSocket error');
            this.emit('error', err);
        });

        this.ws.on('open', () => {
            logger.info({ url: this.config.chainHubUrl }, 'WebSocket connected');
            this.reconnectAttempts = 0;
            this.setState('connected');
            this.startHeartbeat();
        });

        this.ws.on('message', (raw: WebSocket.RawData) => {
            try {
                const data = JSON.parse(raw.toString());
                this.emit('message', data);
            } catch {
                logger.warn('Received non-JSON WebSocket message');
            }
        });

        this.ws.on('pong', () => {
            if (this.heartbeatTimeout) {
                clearTimeout(this.heartbeatTimeout);
                this.heartbeatTimeout = null;
            }
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
            logger.info({ code, reason: reason.toString() }, 'WebSocket closed');
            this.stopHeartbeat();
            if (!this.destroyed) {
                this.scheduleReconnect();
            }
        });

    }

    private scheduleReconnect(): void {
        const maxAttempts = this.config.reconnectMaxAttempts;
        if (maxAttempts > 0 && this.reconnectAttempts >= maxAttempts) {
            logger.error(
                { attempts: this.reconnectAttempts, max: maxAttempts },
                'Max reconnect attempts reached',
            );
            this.setState('disconnected');
            return;
        }

        this.setState('reconnecting');
        const delay = this.calculateBackoff();
        logger.info({ delay, attempt: this.reconnectAttempts + 1 }, 'Scheduling reconnect');

        this.reconnectTimer = setTimeout(() => {
            this.reconnectAttempts++;
            this.setState('connecting');
            this.createConnection();
        }, delay);
    }

    private calculateBackoff(): number {
        const base = this.config.reconnectBaseDelay;
        const max = this.config.reconnectMaxDelay;
        const delay = Math.min(base * Math.pow(2, this.reconnectAttempts), max);
        const jitter = Math.random() * delay * 0.2;
        return Math.floor(delay + jitter);
    }

    private startHeartbeat(): void {
        this.heartbeatTimer = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.ping();
                this.heartbeatTimeout = setTimeout(() => {
                    logger.warn('Heartbeat timeout, closing connection');
                    this.ws?.terminate();
                }, 10_000);
            }
        }, this.config.heartbeatInterval);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    }

    private clearTimers(): void {
        this.stopHeartbeat();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    private setState(newState: ConnectionState): void {
        if (this.state === newState) return;
        const prev = this.state;
        this.state = newState;
        logger.debug({ from: prev, to: newState }, 'Connection state changed');
        this.emit('state-changed', newState);
    }
}
