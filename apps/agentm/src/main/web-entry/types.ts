export type PairCodeState = 'issued' | 'consumed' | 'expired';

export interface PairCodeRecord {
    pairCode: string;
    userId: string;
    sessionId: string;
    expiresAt: number;
    state: PairCodeState;
    consumedByBridgeId: string | null;
}

export interface BridgeSession {
    bridgeId: string;
    userId: string;
    sessionId: string;
    machineName: string;
    connectedAt: number;
    lastHeartbeatAt: number;
    status: 'online' | 'offline';
}

export interface AgentPresence {
    agentId: string;
    bridgeId: string;
    displayName: string | null;
    status: 'idle' | 'busy' | 'offline';
    capabilities: Array<'text' | 'voice'>;
    updatedAt: number;
}

export interface BridgeRealtimeHeartbeatEvent {
    type: 'bridge.heartbeat';
}

export interface BridgeRealtimeAgentPresenceEvent {
    type: 'bridge.agent.presence';
    agents: Array<{
        agentId: string;
        displayName?: string | null;
        status?: 'idle' | 'busy' | 'offline';
        capabilities?: Array<'text' | 'voice'>;
    }>;
}

export interface BridgeRealtimeChatResultEvent {
    type: 'bridge.chat.result';
    requestId: string;
    agentId: string;
    delta?: string;
    text?: string;
    done?: boolean;
    error?: {
        code: string;
        message: string;
    };
}

export interface BridgeRealtimeVoiceResultEvent {
    type: 'bridge.voice.result';
    requestId: string;
    agentId: string;
    transcriptPartial?: string;
    transcriptFinal?: string;
    ttsChunkBase64?: string;
    ttsSeq?: number;
    done?: boolean;
    error?: {
        code: string;
        message: string;
    };
}

export type BridgeRealtimeInboundEvent =
    | BridgeRealtimeHeartbeatEvent
    | BridgeRealtimeAgentPresenceEvent
    | BridgeRealtimeChatResultEvent
    | BridgeRealtimeVoiceResultEvent;
