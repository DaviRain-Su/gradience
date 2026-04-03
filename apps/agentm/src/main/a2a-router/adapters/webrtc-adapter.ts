/**
 * WebRTC Protocol Adapter
 *
 * Browser-to-browser P2P communication using WebRTC
 *
 * @module a2a-router/adapters/webrtc-adapter
 */

import type {
  ProtocolAdapter,
  ProtocolSubscription,
  A2AMessage,
  A2AResult,
  AgentInfo,
  AgentFilter,
  ProtocolHealthStatus,
} from '../../../shared/a2a-router-types.js';
import { A2A_ERROR_CODES } from '../constants.js';

export interface WebRTCAdapterOptions {
  /** Agent ID */
  agentId: string;
  /** Signaling server URL */
  signalingUrl?: string;
  /** ICE servers for NAT traversal */
  iceServers?: RTCIceServer[];
  /** Auto-connect on initialize */
  autoConnect?: boolean;
}

interface PeerConnection {
  id: string;
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  agentId: string | null;
  connected: boolean;
}

export class WebRTCAdapter implements ProtocolAdapter {
  readonly protocol = 'webrtc' as const;
  private options: Required<WebRTCAdapterOptions>;
  private ws: WebSocket | null = null;
  private peers = new Map<string, PeerConnection>();
  private messageHandler?: (message: A2AMessage) => void | Promise<void>;
  private localAgentId: string;
  private lastActivityAt?: number;

  constructor(options: WebRTCAdapterOptions) {
    this.localAgentId = options.agentId;
    this.options = {
      agentId: options.agentId,
      signalingUrl: options.signalingUrl ?? 'wss://signaling.gradience.io',
      iceServers: options.iceServers ?? [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      autoConnect: options.autoConnect ?? true,
    };
  }

  // ============ Lifecycle ============

  async initialize(): Promise<void> {
    if (this.ws) {
      throw new Error('[WebRTCAdapter] Already initialized');
    }

    // Connect to signaling server
    await this.connectSignaling();

    console.log('[WebRTCAdapter] Initialized');
  }

  async shutdown(): Promise<void> {
    // Close all peer connections
    for (const peer of this.peers.values()) {
      peer.dc?.close();
      peer.pc.close();
    }
    this.peers.clear();

    // Close signaling connection
    this.ws?.close();
    this.ws = null;

    console.log('[WebRTCAdapter] Shutdown');
  }

  isAvailable(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ============ Messaging ============

  async send(message: A2AMessage): Promise<A2AResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        messageId: message.id,
        protocol: 'webrtc',
        error: 'WebRTC adapter not connected',
        errorCode: A2A_ERROR_CODES.PROTOCOL_NOT_AVAILABLE,
        timestamp: Date.now(),
      };
    }

    try {
      // Find or create peer connection
      const peer = await this.getOrCreatePeerConnection(message.to);

      if (!peer.connected || !peer.dc) {
        return {
          success: false,
          messageId: message.id,
          protocol: 'webrtc',
          error: 'Peer not connected',
          errorCode: A2A_ERROR_CODES.PROTOCOL_SEND_FAILED,
          timestamp: Date.now(),
        };
      }

      // Send via data channel
      peer.dc.send(JSON.stringify(message));
      this.lastActivityAt = Date.now();

      return {
        success: true,
        messageId: message.id,
        protocol: 'webrtc',
        timestamp: Date.now(),
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        messageId: message.id,
        protocol: 'webrtc',
        error: err.message,
        errorCode: A2A_ERROR_CODES.PROTOCOL_SEND_FAILED,
        timestamp: Date.now(),
      };
    }
  }

  async subscribe(
    handler: (message: A2AMessage) => void | Promise<void>
  ): Promise<ProtocolSubscription> {
    this.messageHandler = handler;

    return {
      protocol: 'webrtc',
      unsubscribe: async () => {
        this.messageHandler = undefined;
      },
    };
  }

  // ============ Discovery ============

  async discoverAgents(_filter?: AgentFilter): Promise<AgentInfo[]> {
    // WebRTC doesn't have built-in discovery
    // Use signaling server or other protocols
    return [];
  }

  async broadcastCapabilities(agentInfo: AgentInfo): Promise<void> {
    // Broadcast via signaling server
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'broadcast',
          agent: agentInfo,
        })
      );
    }
  }

  // ============ Health ============

  health(): ProtocolHealthStatus {
    return {
      available: this.isAvailable(),
      peerCount: this.peers.size,
      subscribedTopics: this.isAvailable() ? ['webrtc-peers'] : [],
      lastActivityAt: this.lastActivityAt,
    };
  }

  // ============ Private Methods ============

  private async connectSignaling(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.options.signalingUrl);

      ws.onopen = () => {
        console.log('[WebRTCAdapter] Signaling connected');
        // Register with signaling server
        ws.send(
          JSON.stringify({
            type: 'register',
            agentId: this.options.agentId,
          })
        );
        resolve();
      };

      ws.onmessage = (event) => {
        this.handleSignalingMessage(JSON.parse(event.data));
      };

      ws.onerror = (error) => {
        console.error('[WebRTCAdapter] Signaling error:', error);
        reject(error);
      };

      ws.onclose = () => {
        console.log('[WebRTCAdapter] Signaling disconnected');
      };

      this.ws = ws;
    });
  }

  private async handleSignalingMessage(msg: unknown): Promise<void> {
    const data = msg as {
      type: string;
      from?: string;
      to?: string;
      sdp?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
      agent?: AgentInfo;
    };

    switch (data.type) {
      case 'offer':
        if (data.from && data.sdp) {
          await this.handleOffer(data.from, data.sdp);
        }
        break;
      case 'answer':
        if (data.from && data.sdp) {
          await this.handleAnswer(data.from, data.sdp);
        }
        break;
      case 'ice-candidate':
        if (data.from && data.candidate) {
          await this.handleIceCandidate(data.from, data.candidate);
        }
        break;
      case 'broadcast':
        if (data.agent) {
          // Handle agent broadcast
          console.log('[WebRTCAdapter] Discovered agent:', data.agent.address);
        }
        break;
    }
  }

  private async getOrCreatePeerConnection(agentId: string): Promise<PeerConnection> {
    // Check if we already have a connection
    for (const peer of this.peers.values()) {
      if (peer.agentId === agentId && peer.connected) {
        return peer;
      }
    }

    // Create new connection
    const pc = new RTCPeerConnection({
      iceServers: this.options.iceServers,
    });

    const peerId = crypto.randomUUID();
    const peer: PeerConnection = {
      id: peerId,
      pc,
      dc: null,
      agentId,
      connected: false,
    };

    // Create data channel
    const dc = pc.createDataChannel('a2a-messages', {
      ordered: true,
    });

    this.setupDataChannel(peer, dc);

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.ws) {
        this.ws.send(
          JSON.stringify({
            type: 'ice-candidate',
            to: agentId,
            candidate: event.candidate,
          })
        );
      }
    };

    // Handle incoming data channels
    pc.ondatachannel = (event) => {
      this.setupDataChannel(peer, event.channel);
    };

    // Create and send offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    if (this.ws) {
      this.ws.send(
        JSON.stringify({
          type: 'offer',
          to: agentId,
          sdp: offer,
        })
      );
    }

    this.peers.set(peerId, peer);
    return peer;
  }

  private setupDataChannel(peer: PeerConnection, dc: RTCDataChannel): void {
    peer.dc = dc;

    dc.onopen = () => {
      console.log('[WebRTCAdapter] Data channel opened');
      peer.connected = true;
    };

    dc.onclose = () => {
      console.log('[WebRTCAdapter] Data channel closed');
      peer.connected = false;
    };

    dc.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as A2AMessage;
        this.lastActivityAt = Date.now();
        if (this.messageHandler) {
          this.messageHandler(message);
        }
      } catch (error) {
        console.error('[WebRTCAdapter] Failed to parse message:', error);
      }
    };
  }

  private async handleOffer(from: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const pc = new RTCPeerConnection({
      iceServers: this.options.iceServers,
    });

    const peerId = crypto.randomUUID();
    const peer: PeerConnection = {
      id: peerId,
      pc,
      dc: null,
      agentId: from,
      connected: false,
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.ws) {
        this.ws.send(
          JSON.stringify({
            type: 'ice-candidate',
            to: from,
            candidate: event.candidate,
          })
        );
      }
    };

    // Handle incoming data channels
    pc.ondatachannel = (event) => {
      this.setupDataChannel(peer, event.channel);
    };

    // Set remote description
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    // Create answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Send answer
    if (this.ws) {
      this.ws.send(
        JSON.stringify({
          type: 'answer',
          to: from,
          sdp: answer,
        })
      );
    }

    this.peers.set(peerId, peer);
  }

  private async handleAnswer(from: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    for (const peer of this.peers.values()) {
      if (peer.agentId === from) {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        break;
      }
    }
  }

  private async handleIceCandidate(from: string, candidate: RTCIceCandidateInit): Promise<void> {
    for (const peer of this.peers.values()) {
      if (peer.agentId === from) {
        await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
        break;
      }
    }
  }
}

export default WebRTCAdapter;
