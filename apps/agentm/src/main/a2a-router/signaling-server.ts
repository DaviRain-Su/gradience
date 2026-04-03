/**
 * WebRTC Signaling Server
 *
 * Simple signaling server for WebRTC peer discovery and connection setup
 *
 * @module a2a-router/signaling-server
 */

import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

interface SignalingClient {
  ws: WebSocket;
  agentId: string | null;
  connectedAt: number;
}

interface SignalingMessage {
  type: 'register' | 'offer' | 'answer' | 'ice-candidate' | 'broadcast' | 'discover';
  from?: string;
  to?: string;
  agentId?: string;
  agent?: {
    address: string;
    displayName?: string;
    capabilities: string[];
  };
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export class SignalingServer {
  private wss: WebSocketServer;
  private clients = new Map<string, SignalingClient>();
  private agents = new Map<string, { displayName?: string; capabilities: string[]; lastSeen: number }>();

  constructor(port: number = 8080) {
    const server = createServer();
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws) => {
      this.handleConnection(ws);
    });

    server.listen(port, () => {
      console.log(`[SignalingServer] Listening on port ${port}`);
    });
  }

  private handleConnection(ws: WebSocket): void {
    const clientId = crypto.randomUUID();
    const client: SignalingClient = {
      ws,
      agentId: null,
      connectedAt: Date.now(),
    };

    this.clients.set(clientId, client);

    console.log(`[SignalingServer] Client connected: ${clientId}`);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as SignalingMessage;
        this.handleMessage(clientId, message);
      } catch (error) {
        console.error('[SignalingServer] Invalid message:', error);
      }
    });

    ws.on('close', () => {
      console.log(`[SignalingServer] Client disconnected: ${clientId}`);
      this.clients.delete(clientId);
    });

    ws.on('error', (error) => {
      console.error(`[SignalingServer] Client error: ${clientId}`, error);
    });
  }

  private handleMessage(clientId: string, message: SignalingMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'register':
        if (message.agentId) {
          client.agentId = message.agentId;
          console.log(`[SignalingServer] Agent registered: ${message.agentId}`);
        }
        break;

      case 'offer':
      case 'answer':
      case 'ice-candidate':
        this.forwardMessage(clientId, message);
        break;

      case 'broadcast':
        if (message.agent) {
          this.agents.set(message.agent.address, {
            displayName: message.agent.displayName,
            capabilities: message.agent.capabilities,
            lastSeen: Date.now(),
          });
          this.broadcastToOthers(clientId, message);
        }
        break;

      case 'discover':
        this.sendAgentList(clientId);
        break;
    }
  }

  private forwardMessage(fromClientId: string, message: SignalingMessage): void {
    const fromClient = this.clients.get(fromClientId);
    if (!fromClient || !fromClient.agentId) return;

    // Find target client
    for (const [clientId, client] of this.clients) {
      if (clientId !== fromClientId && client.agentId === message.to) {
        client.ws.send(
          JSON.stringify({
            ...message,
            from: fromClient.agentId,
          })
        );
        return;
      }
    }

    console.log(`[SignalingServer] Target not found: ${message.to}`);
  }

  private broadcastToOthers(fromClientId: string, message: SignalingMessage): void {
    for (const [clientId, client] of this.clients) {
      if (clientId !== fromClientId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    }
  }

  private sendAgentList(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const agents = Array.from(this.agents.entries()).map(([address, info]) => ({
      address,
      ...info,
    }));

    client.ws.send(
      JSON.stringify({
        type: 'agent-list',
        agents,
      })
    );
  }

  getStats(): { clients: number; agents: number } {
    return {
      clients: this.clients.size,
      agents: this.agents.size,
    };
  }

  stop(): void {
    this.wss.close();
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.SIGNALING_PORT) || 8080;
  const server = new SignalingServer(port);

  console.log(`[SignalingServer] Started on port ${port}`);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[SignalingServer] Shutting down...');
    server.stop();
    process.exit(0);
  });
}

export default SignalingServer;
