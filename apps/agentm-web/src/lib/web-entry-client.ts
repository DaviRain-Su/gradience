/**
 * Web Entry Client SDK
 *
 * Browser-side SDK for connecting to AgentM Web Entry
 * Handles pairing, WebSocket connection, and message exchange
 */

export interface WebEntryClientConfig {
  /** Web Entry Gateway URL */
  gatewayUrl: string;
  /** Authentication token (from Privy) */
  authToken: string;
  /** Auto reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect delay in ms */
  reconnectDelayMs?: number;
  /** Maximum reconnect attempts */
  maxReconnectAttempts?: number;
  /** Heartbeat interval in ms */
  heartbeatIntervalMs?: number;
}

export interface PairCodeResponse {
  pairCode: string;
  expiresAt: number;
}

export interface AgentInfo {
  agentId: string;
  displayName: string | null;
  status: 'idle' | 'busy' | 'offline';
  capabilities: Array<'text' | 'voice'>;
}

export interface ChatMessage {
  id: string;
  text: string;
  direction: 'outgoing' | 'incoming';
  timestamp: number;
}

export type WebEntryEvent =
  | { type: 'connected' }
  | { type: 'disconnected'; reason?: string }
  | { type: 'reconnecting'; attempt: number }
  | { type: 'agents.updated'; agents: AgentInfo[] }
  | { type: 'message.received'; message: ChatMessage }
  | { type: 'message.delta'; id: string; delta: string }
  | { type: 'error'; code: string; message: string };

export class WebEntryClient {
  private config: Required<WebEntryClientConfig>;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private eventListeners: Array<(event: WebEntryEvent) => void> = [];
  private pendingMessages: Map<string, { resolve: (value: string) => void; reject: (error: Error) => void }> = new Map();
  private currentAgentId: string | null = null;
  private isIntentionallyClosed = false;

  constructor(config: WebEntryClientConfig) {
    this.config = {
      autoReconnect: true,
      reconnectDelayMs: 3000,
      maxReconnectAttempts: 5,
      heartbeatIntervalMs: 30000,
      ...config,
    };
  }

  /**
   * Request a pair code for local bridge connection
   */
  async requestPairCode(): Promise<PairCodeResponse> {
    const response = await fetch(`${this.config.gatewayUrl}/web/session/pair`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get list of available agents
   */
  async getAgents(): Promise<AgentInfo[]> {
    const response = await fetch(`${this.config.gatewayUrl}/web/agents`, {
      headers: {
        'Authorization': `Bearer ${this.config.authToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Bridge not connected
        return [];
      }
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.items || [];
  }

  /**
   * Connect to an agent via WebSocket
   */
  connect(agentId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      if (this.currentAgentId === agentId) {
        return; // Already connected to this agent
      }
      this.disconnect();
    }

    this.isIntentionallyClosed = false;
    this.currentAgentId = agentId;
    const wsUrl = `${this.config.gatewayUrl.replace(/^http/, 'ws')}/web/chat/${encodeURIComponent(agentId)}`;

    this.ws = new WebSocket(wsUrl);
    this.ws.onopen = () => this.handleOpen();
    this.ws.onclose = (event) => this.handleClose(event);
    this.ws.onerror = (error) => this.handleError(error);
    this.ws.onmessage = (event) => this.handleMessage(event.data);
  }

  /**
   * Disconnect from current agent
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    this.cleanup();
    this.emit({ type: 'disconnected', reason: 'user_initiated' });
  }

  /**
   * Send a chat message
   */
  async sendMessage(text: string): Promise<string> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected');
    }

    const messageId = this.generateId();

    return new Promise((resolve, reject) => {
      this.pendingMessages.set(messageId, { resolve, reject });

      // Set timeout for message acknowledgment
      setTimeout(() => {
        if (this.pendingMessages.has(messageId)) {
          this.pendingMessages.delete(messageId);
          reject(new Error('Message timeout'));
        }
      }, 30000);

      this.ws!.send(JSON.stringify({
        type: 'chat.message.send',
        text,
      }));
    });
  }

  /**
   * Subscribe to events
   */
  onEvent(listener: (event: WebEntryEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get current agent ID
   */
  get currentAgent(): string | null {
    return this.currentAgentId;
  }

  private handleOpen(): void {
    this.reconnectAttempts = 0;
    this.startHeartbeat();
    this.emit({ type: 'connected' });
  }

  private handleClose(event: CloseEvent): void {
    this.cleanup();

    if (this.isIntentionallyClosed) {
      this.emit({ type: 'disconnected', reason: 'user_initiated' });
      return;
    }

    this.emit({ type: 'disconnected', reason: event.reason || 'connection_lost' });

    // Attempt reconnect
    if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  private handleError(error: Event): void {
    this.emit({ type: 'error', code: 'WS_ERROR', message: 'WebSocket error' });
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'chat.message.ack':
          this.handleMessageAck(message.payload);
          break;

        case 'chat.message.delta':
          this.emit({
            type: 'message.delta',
            id: message.payload.messageId,
            delta: message.payload.delta,
          });
          break;

        case 'chat.message.final':
          this.emit({
            type: 'message.received',
            message: {
              id: message.payload.messageId,
              text: message.payload.text,
              direction: 'incoming',
              timestamp: Date.now(),
            },
          });
          break;

        case 'error':
          this.emit({
            type: 'error',
            code: message.payload.code,
            message: message.payload.message,
          });
          break;

        default:
          console.log('[WebEntry] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[WebEntry] Failed to parse message:', error);
    }
  }

  private handleMessageAck(payload: { messageId: string }): void {
    const pending = this.pendingMessages.get(payload.messageId);
    if (pending) {
      pending.resolve(payload.messageId);
      this.pendingMessages.delete(payload.messageId);
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    this.emit({ type: 'reconnecting', attempt: this.reconnectAttempts });

    this.reconnectTimer = setTimeout(() => {
      if (this.currentAgentId) {
        this.connect(this.currentAgentId);
      }
    }, this.config.reconnectDelayMs);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, this.config.heartbeatIntervalMs);
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private emit(event: WebEntryEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[WebEntry] Event listener error:', error);
      }
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton for easy use
let defaultClient: WebEntryClient | null = null;

export function createWebEntryClient(config: WebEntryClientConfig): WebEntryClient {
  return new WebEntryClient(config);
}

export function getDefaultWebEntryClient(): WebEntryClient | null {
  return defaultClient;
}

export function setDefaultWebEntryClient(client: WebEntryClient): void {
  defaultClient = client;
}
