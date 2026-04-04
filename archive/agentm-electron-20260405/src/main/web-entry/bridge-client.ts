/**
 * Local Bridge Client SDK
 *
 * Desktop/Node.js side SDK for connecting to AgentM Web Entry Gateway
 * This runs in the local daemon and bridges local agents to the web
 */

export interface BridgeClientConfig {
  /** Gateway URL */
  gatewayUrl: string;
  /** Machine name for identification */
  machineName?: string;
  /** Auto reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect delay in ms */
  reconnectDelayMs?: number;
  /** Maximum reconnect attempts */
  maxReconnectAttempts?: number;
  /** Heartbeat interval in ms */
  heartbeatIntervalMs?: number;
}

export interface BridgeSession {
  bridgeId: string;
  bridgeToken: string;
  sessionId: string;
  userId: string;
}

export interface AgentPresence {
  agentId: string;
  displayName?: string;
  status: 'idle' | 'busy' | 'offline';
  capabilities: Array<'text' | 'voice'>;
}

export interface ChatRequest {
  requestId: string;
  agentId: string;
  text: string;
}

export interface VoiceRequest {
  requestId: string;
  agentId: string;
  event: 'start' | 'chunk' | 'stop';
  codec?: string;
  seq?: number;
  dataBase64?: string;
}

export type BridgeEvent =
  | { type: 'connected' }
  | { type: 'disconnected'; reason?: string }
  | { type: 'reconnecting'; attempt: number }
  | { type: 'chat.request'; request: ChatRequest }
  | { type: 'voice.request'; request: VoiceRequest }
  | { type: 'error'; code: string; message: string };

export interface ChatResponse {
  requestId: string;
  delta?: string;
  text?: string;
  done?: boolean;
  error?: { code: string; message: string };
}

export interface VoiceResponse {
  requestId: string;
  transcriptPartial?: string;
  transcriptFinal?: string;
  ttsChunkBase64?: string;
  ttsSeq?: number;
  done?: boolean;
  error?: { code: string; message: string };
}

export class BridgeClient {
  private config: Required<BridgeClientConfig>;
  private ws: WebSocket | null = null;
  private session: BridgeSession | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private eventListeners: Array<(event: BridgeEvent) => void> = [];
  private agents: Map<string, AgentPresence> = new Map();
  private isIntentionallyClosed = false;

  constructor(config: BridgeClientConfig) {
    this.config = {
      machineName: 'local-machine',
      autoReconnect: true,
      reconnectDelayMs: 3000,
      maxReconnectAttempts: 10,
      heartbeatIntervalMs: 10000,
      ...config,
    };
  }

  /**
   * Attach to a web session using pair code
   */
  async attach(pairCode: string): Promise<BridgeSession> {
    const response = await fetch(`${this.config.gatewayUrl}/local/bridge/attach`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pairCode,
        machineName: this.config.machineName,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    this.session = await response.json();
    return this.session;
  }

  /**
   * Connect to gateway WebSocket
   */
  connect(): void {
    if (!this.session) {
      throw new Error('Must attach first');
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isIntentionallyClosed = false;
    const wsUrl = `${this.config.gatewayUrl.replace(/^http/, 'ws')}/bridge/realtime?token=${this.session.bridgeToken}`;

    this.ws = new WebSocket(wsUrl);
    this.ws.onopen = () => this.handleOpen();
    this.ws.onclose = (event) => this.handleClose(event);
    this.ws.onerror = (error) => this.handleError(error);
    this.ws.onmessage = (event) => this.handleMessage(event.data);
  }

  /**
   * Disconnect from gateway
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    this.cleanup();
    this.emit({ type: 'disconnected', reason: 'user_initiated' });
  }

  /**
   * Register local agents
   */
  registerAgents(agents: AgentPresence[]): void {
    this.agents.clear();
    for (const agent of agents) {
      this.agents.set(agent.agentId, agent);
    }
    this.sendPresence();
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentId: string, status: AgentPresence['status']): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      this.sendPresence();
    }
  }

  /**
   * Send chat response
   */
  sendChatResponse(response: ChatResponse): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[Bridge] Not connected, dropping chat response');
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'bridge.chat.result',
      ...response,
    }));
  }

  /**
   * Send voice response
   */
  sendVoiceResponse(response: VoiceResponse): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[Bridge] Not connected, dropping voice response');
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'bridge.voice.result',
      ...response,
    }));
  }

  /**
   * Subscribe to events
   */
  onEvent(listener: (event: BridgeEvent) => void): () => void {
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
   * Get current session
   */
  get currentSession(): BridgeSession | null {
    return this.session;
  }

  private handleOpen(): void {
    this.reconnectAttempts = 0;
    this.startHeartbeat();
    this.sendPresence();
    this.emit({ type: 'connected' });
  }

  private handleClose(event: WebSocket.CloseEvent): void {
    this.cleanup();

    if (this.isIntentionallyClosed) {
      this.emit({ type: 'disconnected', reason: 'user_initiated' });
      return;
    }

    this.emit({ type: 'disconnected', reason: event.reason || 'connection_lost' });

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
        case 'bridge.chat.request':
          this.emit({
            type: 'chat.request',
            request: {
              requestId: message.requestId,
              agentId: message.agentId,
              text: message.text,
            },
          });
          break;

        case 'bridge.voice.request':
          this.emit({
            type: 'voice.request',
            request: {
              requestId: message.requestId,
              agentId: message.agentId,
              event: message.event,
              codec: message.codec,
              seq: message.seq,
              dataBase64: message.dataBase64,
            },
          });
          break;

        default:
          console.log('[Bridge] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[Bridge] Failed to parse message:', error);
    }
  }

  private sendPresence(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'bridge.agent.presence',
      agents: Array.from(this.agents.values()),
    }));
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    this.emit({ type: 'reconnecting', attempt: this.reconnectAttempts });

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.config.reconnectDelayMs);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'bridge.heartbeat' }));
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

  private emit(event: BridgeEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[Bridge] Event listener error:', error);
      }
    }
  }
}

// Export factory function
export function createBridgeClient(config: BridgeClientConfig): BridgeClient {
  return new BridgeClient(config);
}
