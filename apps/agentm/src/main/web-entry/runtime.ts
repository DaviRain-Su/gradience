import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { WS_MAX_MESSAGE_BYTES } from './constants.ts';
import {
    consumePairCode,
    createWebEntryState,
    findBridgeForSessionAgent,
    getBridgeIdByToken,
    getBridgeSession,
    hasOnlineBridgeForSession,
    issuePairCode,
    recordHeartbeat,
    setBridgeOffline,
    setBridgeOnline,
    sweepTimeouts,
    type WebEntryConfig,
    type WebEntryState,
    WebEntryError,
    upsertAgentPresence,
    listAgentsForSession,
} from './state.ts';
import { acceptWebSocketUpgrade, type WsPeer } from './ws.ts';
import type { BridgeRealtimeInboundEvent } from './types.ts';

export interface WebEntryRuntimeDeps {
    requireSession: () =>
        | { error: string }
        | {
              agentId: string;
              publicKey: string;
              email: string | null;
              privyUserId: string;
          };
    now?: () => number;
}

export interface WebEntryRuntime {
    handleHttp(
        req: IncomingMessage,
        res: ServerResponse,
        method: string,
        path: string,
        url: URL,
    ): Promise<boolean>;
    handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean;
    dispose(): void;
    getStatus(): {
        pairCodeIssuedTotal: number;
        pairCodeConsumedTotal: number;
        bridgeConnectionsTotal: number;
        bridgeOnline: number;
        webChatConnections: number;
        pendingChatRequests: number;
        pendingVoiceRequests: number;
        voiceRequestsTotal: number;
        voiceChunksTotal: number;
        voiceResultsTotal: number;
        wsErrorsTotal: number;
    };
    state: WebEntryState;
}

export function createWebEntryRuntime(
    deps: WebEntryRuntimeDeps,
    config: Partial<WebEntryConfig> = {},
): WebEntryRuntime {
    const now = deps.now ?? (() => Date.now());
    const state = createWebEntryState(config);
    const bridgePeers = new Map<string, WsPeer>();
    const webChatPeers = new Set<WsPeer>();
    const pendingChatRequests = new Map<
        string,
        { peer: WsPeer; bridgeId: string; agentId: string }
    >();
    const pendingVoiceRequests = new Map<
        string,
        { peer: WsPeer; bridgeId: string; agentId: string }
    >();
    const runtimeMetrics = {
        pairCodeIssuedTotal: 0,
        pairCodeConsumedTotal: 0,
        bridgeConnectionsTotal: 0,
        voiceRequestsTotal: 0,
        voiceChunksTotal: 0,
        voiceResultsTotal: 0,
        wsErrorsTotal: 0,
    };

    const sweepTimer = setInterval(() => {
        sweepTimeouts(state, now());
        for (const [bridgeId, peer] of bridgePeers.entries()) {
            const bridge = getBridgeSession(state, bridgeId);
            if (!bridge || bridge.status !== 'online') {
                peer.close(1001, 'bridge offline');
                bridgePeers.delete(bridgeId);
            }
        }
    }, 1_000);
    sweepTimer.unref?.();

    async function handleHttp(
        req: IncomingMessage,
        res: ServerResponse,
        method: string,
        path: string,
        _url: URL,
    ) {
        if (method === 'POST' && path === '/web/session/pair') {
            const session = deps.requireSession();
            if ('error' in session) {
                return respondJson(res, 401, {
                    code: 'WB-1001',
                    error: 'Auth required',
                    detail: session.error,
                });
            }
            try {
                const pair = issuePairCode(state, {
                    userId: session.privyUserId,
                    sessionId: session.privyUserId,
                    now: now(),
                });
                runtimeMetrics.pairCodeIssuedTotal += 1;
                return respondJson(res, 200, pair);
            } catch (error) {
                return respondWebEntryError(res, error);
            }
        }

        if (method === 'POST' && path === '/local/bridge/attach') {
            const body = await readJsonBody(req);
            try {
                const attached = consumePairCode(state, {
                    pairCode: asString(body.pairCode),
                    machineName: asString(body.machineName) || 'unknown-machine',
                    now: now(),
                });
                runtimeMetrics.pairCodeConsumedTotal += 1;
                return respondJson(res, 200, attached);
            } catch (error) {
                return respondWebEntryError(res, error);
            }
        }

        if (method === 'GET' && path === '/web/agents') {
            const session = deps.requireSession();
            if ('error' in session) {
                return respondJson(res, 401, {
                    code: 'WB-1001',
                    error: 'Auth required',
                    detail: session.error,
                });
            }
            const sessionId = session.privyUserId;
            if (!hasOnlineBridgeForSession(state, { sessionId, now: now() })) {
                return respondJson(res, 404, {
                    code: 'WB-1005',
                    error: 'Bridge not connected',
                });
            }
            const items = listAgentsForSession(state, { sessionId, now: now() });
            return respondJson(res, 200, { items });
        }

        return false;
    }

    function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
        const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        if (requestUrl.pathname !== '/bridge/realtime') {
            const webChatMatch = requestUrl.pathname.match(/^\/web\/chat\/(.+)$/);
            if (!webChatMatch || !webChatMatch[1]) {
                return false;
            }

            const session = deps.requireSession();
            if ('error' in session) {
                rejectUpgrade(socket, 401, 'Auth required');
                return true;
            }
            const agentId = decodeURIComponent(webChatMatch[1]);
            const route = findBridgeForSessionAgent(state, {
                sessionId: session.privyUserId,
                agentId,
                now: now(),
            });
            if (!route) {
                rejectUpgrade(socket, 404, 'Agent not found');
                return true;
            }

            const peer = acceptWebSocketUpgrade(req, socket, head, {
                maxMessageBytes: WS_MAX_MESSAGE_BYTES,
            });
            if (!peer) {
                rejectUpgrade(socket, 400, 'Invalid websocket upgrade');
                return true;
            }

            webChatPeers.add(peer);
            peer.onMessage((messageText) => {
                handleWebChatMessage({
                    messageText,
                    peer,
                    agentId,
                    bridgeId: route.bridgeId,
                    bridgePeers,
                    pendingChatRequests,
                    pendingVoiceRequests,
                    runtimeMetrics,
                });
            });
            peer.onClose(() => {
                webChatPeers.delete(peer);
                for (const [requestId, request] of pendingChatRequests.entries()) {
                    if (request.peer === peer) {
                        pendingChatRequests.delete(requestId);
                    }
                }
                for (const [requestId, request] of pendingVoiceRequests.entries()) {
                    if (request.peer === peer) {
                        pendingVoiceRequests.delete(requestId);
                    }
                }
            });
            return true;
        }

        const token = requestUrl.searchParams.get('token');
        if (!token) {
            rejectUpgrade(socket, 401, 'Missing bridge token');
            return true;
        }

        const bridgeId = getBridgeIdByToken(state, token);
        if (!bridgeId) {
            rejectUpgrade(socket, 401, 'Invalid bridge token');
            return true;
        }

        const peer = acceptWebSocketUpgrade(req, socket, head, {
            maxMessageBytes: WS_MAX_MESSAGE_BYTES,
        });
        if (!peer) {
            rejectUpgrade(socket, 400, 'Invalid websocket upgrade');
            return true;
        }

        setBridgeOnline(state, { bridgeId, now: now() });
        runtimeMetrics.bridgeConnectionsTotal += 1;
        bridgePeers.set(bridgeId, peer);

        peer.onMessage((text) => {
            handleBridgeRealtimeMessage(
                state,
                bridgeId,
                text,
                now(),
                pendingChatRequests,
                pendingVoiceRequests,
                runtimeMetrics,
            );
        });
        peer.onClose(() => {
            setBridgeOffline(state, bridgeId, now());
            bridgePeers.delete(bridgeId);
            for (const [requestId, request] of pendingChatRequests.entries()) {
                if (request.bridgeId === bridgeId) {
                    request.peer.sendJson({
                        type: 'error',
                        payload: {
                            code: 'WB-1005',
                            message: 'Bridge disconnected',
                        },
                    });
                    pendingChatRequests.delete(requestId);
                }
            }
            for (const [requestId, request] of pendingVoiceRequests.entries()) {
                if (request.bridgeId === bridgeId) {
                    request.peer.sendJson({
                        type: 'error',
                        payload: {
                            code: 'WB-1005',
                            message: 'Bridge disconnected',
                        },
                    });
                    pendingVoiceRequests.delete(requestId);
                }
            }
        });
        return true;
    }

    function dispose() {
        clearInterval(sweepTimer);
        for (const peer of bridgePeers.values()) {
            peer.close(1001, 'server shutdown');
        }
        for (const peer of webChatPeers.values()) {
            peer.close(1001, 'server shutdown');
        }
        bridgePeers.clear();
        webChatPeers.clear();
        pendingChatRequests.clear();
        pendingVoiceRequests.clear();
    }

    function getStatus() {
        let bridgeOnline = 0;
        for (const bridge of state.bridges.values()) {
            if (bridge.status === 'online') {
                bridgeOnline += 1;
            }
        }
        return {
            pairCodeIssuedTotal: runtimeMetrics.pairCodeIssuedTotal,
            pairCodeConsumedTotal: runtimeMetrics.pairCodeConsumedTotal,
            bridgeConnectionsTotal: runtimeMetrics.bridgeConnectionsTotal,
            bridgeOnline,
            webChatConnections: webChatPeers.size,
            pendingChatRequests: pendingChatRequests.size,
            pendingVoiceRequests: pendingVoiceRequests.size,
            voiceRequestsTotal: runtimeMetrics.voiceRequestsTotal,
            voiceChunksTotal: runtimeMetrics.voiceChunksTotal,
            voiceResultsTotal: runtimeMetrics.voiceResultsTotal,
            wsErrorsTotal: runtimeMetrics.wsErrorsTotal,
        };
    }

    return { handleHttp, handleUpgrade, dispose, getStatus, state };
}

function handleBridgeRealtimeMessage(
    state: WebEntryState,
    bridgeId: string,
    text: string,
    nowValue: number,
    pendingChatRequests: Map<string, { peer: WsPeer; bridgeId: string; agentId: string }>,
    pendingVoiceRequests: Map<string, { peer: WsPeer; bridgeId: string; agentId: string }>,
    runtimeMetrics: {
        voiceRequestsTotal: number;
        voiceChunksTotal: number;
        voiceResultsTotal: number;
        wsErrorsTotal: number;
    },
) {
    let payload: BridgeRealtimeInboundEvent;
    try {
        payload = JSON.parse(text) as BridgeRealtimeInboundEvent;
    } catch {
        runtimeMetrics.wsErrorsTotal += 1;
        return;
    }

    if (payload.type === 'bridge.heartbeat') {
        recordHeartbeat(state, { bridgeId, now: nowValue });
        return;
    }
    if (payload.type === 'bridge.agent.presence' && Array.isArray(payload.agents)) {
        upsertAgentPresence(state, {
            bridgeId,
            now: nowValue,
            agents: payload.agents,
        });
        return;
    }

    if (payload.type === 'bridge.chat.result') {
        const request = pendingChatRequests.get(payload.requestId);
        if (!request || request.bridgeId !== bridgeId) {
            return;
        }
        if (payload.error) {
            request.peer.sendJson({
                type: 'error',
                payload: payload.error,
            });
            pendingChatRequests.delete(payload.requestId);
            return;
        }
        if (payload.delta) {
            request.peer.sendJson({
                type: 'chat.message.delta',
                payload: {
                    messageId: payload.requestId,
                    delta: payload.delta,
                },
            });
        }
        if (payload.text) {
            request.peer.sendJson({
                type: 'chat.message.final',
                payload: {
                    messageId: payload.requestId,
                    text: payload.text,
                },
            });
            pendingChatRequests.delete(payload.requestId);
            return;
        }
        if (payload.done) {
            pendingChatRequests.delete(payload.requestId);
        }
        return;
    }

    if (payload.type === 'bridge.voice.result') {
        runtimeMetrics.voiceResultsTotal += 1;
        const request = pendingVoiceRequests.get(payload.requestId);
        if (!request || request.bridgeId !== bridgeId) {
            return;
        }
        if (payload.error) {
            request.peer.sendJson({
                type: 'error',
                payload: payload.error,
            });
            pendingVoiceRequests.delete(payload.requestId);
            return;
        }
        if (payload.transcriptPartial) {
            request.peer.sendJson({
                type: 'voice.transcript.partial',
                payload: { text: payload.transcriptPartial },
            });
        }
        if (payload.transcriptFinal) {
            request.peer.sendJson({
                type: 'voice.transcript.final',
                payload: { text: payload.transcriptFinal },
            });
        }
        if (payload.ttsChunkBase64) {
            request.peer.sendJson({
                type: 'voice.tts.chunk',
                payload: {
                    seq: payload.ttsSeq ?? 0,
                    dataBase64: payload.ttsChunkBase64,
                    done: Boolean(payload.done),
                },
            });
        }
        if (payload.done) {
            pendingVoiceRequests.delete(payload.requestId);
        }
    }
}

function handleWebChatMessage(input: {
    messageText: string;
    peer: WsPeer;
    agentId: string;
    bridgeId: string;
    bridgePeers: Map<string, WsPeer>;
    pendingChatRequests: Map<string, { peer: WsPeer; bridgeId: string; agentId: string }>;
    pendingVoiceRequests: Map<string, { peer: WsPeer; bridgeId: string; agentId: string }>;
    runtimeMetrics: {
        voiceRequestsTotal: number;
        voiceChunksTotal: number;
        voiceResultsTotal: number;
        wsErrorsTotal: number;
    };
}) {
    let payload:
        | { type?: unknown; text?: unknown; payload?: { text?: unknown } }
        | {
              type?: unknown;
              requestId?: unknown;
              codec?: unknown;
              seq?: unknown;
              dataBase64?: unknown;
          };
    try {
        payload = JSON.parse(input.messageText) as {
            type?: unknown;
            text?: unknown;
            payload?: { text?: unknown };
        };
    } catch {
        input.runtimeMetrics.wsErrorsTotal += 1;
        input.peer.sendJson({
            type: 'error',
            payload: { code: 'WB-1002', message: 'Invalid message payload' },
        });
        return;
    }

    if (payload.type !== 'chat.message.send') {
        if (
            payload.type === 'voice.start' ||
            payload.type === 'voice.chunk' ||
            payload.type === 'voice.stop'
        ) {
            const bridgePeer = input.bridgePeers.get(input.bridgeId);
            if (!bridgePeer) {
                input.peer.sendJson({
                    type: 'error',
                    payload: { code: 'WB-1005', message: 'Bridge not connected' },
                });
                return;
            }

            const requestId =
                asString((payload as { requestId?: unknown }).requestId).trim() || randomUUID();

            if (payload.type === 'voice.start') {
                input.runtimeMetrics.voiceRequestsTotal += 1;
                input.pendingVoiceRequests.set(requestId, {
                    peer: input.peer,
                    bridgeId: input.bridgeId,
                    agentId: input.agentId,
                });
                bridgePeer.sendJson({
                    type: 'bridge.voice.request',
                    event: 'start',
                    requestId,
                    agentId: input.agentId,
                    codec: asString((payload as { codec?: unknown }).codec) || 'pcm16',
                });
                input.peer.sendJson({
                    type: 'voice.started',
                    payload: { requestId },
                });
                return;
            }

            const voicePending = input.pendingVoiceRequests.get(requestId);
            if (!voicePending) {
                input.peer.sendJson({
                    type: 'error',
                    payload: { code: 'WB-1008', message: 'Voice stream not started' },
                });
                return;
            }

            if (payload.type === 'voice.chunk') {
                input.runtimeMetrics.voiceChunksTotal += 1;
                bridgePeer.sendJson({
                    type: 'bridge.voice.request',
                    event: 'chunk',
                    requestId,
                    agentId: input.agentId,
                    seq:
                        typeof (payload as { seq?: unknown }).seq === 'number'
                            ? (payload as { seq: number }).seq
                            : 0,
                    dataBase64: asString((payload as { dataBase64?: unknown }).dataBase64),
                });
                return;
            }

            bridgePeer.sendJson({
                type: 'bridge.voice.request',
                event: 'stop',
                requestId,
                agentId: input.agentId,
            });
            return;
        }

        input.peer.sendJson({
            type: 'error',
            payload: { code: 'WB-1002', message: 'Unsupported event type' },
        });
        return;
    }

    const text = asString(
        (payload as { text?: unknown }).text ??
            (payload as { payload?: { text?: unknown } }).payload?.text,
    ).trim();
    if (!text || Buffer.byteLength(text, 'utf8') > 16 * 1024) {
        input.peer.sendJson({
            type: 'error',
            payload: { code: 'WB-1007', message: 'Invalid message size' },
        });
        return;
    }

    const bridgePeer = input.bridgePeers.get(input.bridgeId);
    if (!bridgePeer) {
        input.peer.sendJson({
            type: 'error',
            payload: { code: 'WB-1005', message: 'Bridge not connected' },
        });
        return;
    }

    const requestId = randomUUID();
    input.pendingChatRequests.set(requestId, {
        peer: input.peer,
        bridgeId: input.bridgeId,
        agentId: input.agentId,
    });
    input.peer.sendJson({
        type: 'chat.message.ack',
        payload: { messageId: requestId },
    });
    bridgePeer.sendJson({
        type: 'bridge.chat.request',
        requestId,
        agentId: input.agentId,
        text,
    });
}

function rejectUpgrade(socket: Duplex, status: number, reason: string) {
    socket.write(
        `HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Type: text/plain\r\nContent-Length: ${reason.length}\r\n\r\n${reason}`,
    );
    socket.destroy();
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(chunk as Buffer);
    }
    const text = Buffer.concat(chunks).toString();
    if (!text) return {};
    try {
        const body = JSON.parse(text) as Record<string, unknown>;
        return body ?? {};
    } catch {
        throw new WebEntryError(400, 'WB-1002', 'Invalid request body');
    }
}

function respondJson(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
    return true;
}

function respondWebEntryError(res: ServerResponse, error: unknown) {
    if (error instanceof WebEntryError) {
        return respondJson(res, error.status, {
            code: error.code,
            error: error.message,
        });
    }
    return respondJson(res, 500, {
        code: 'WB-1010',
        error: error instanceof Error ? error.message : 'Internal error',
    });
}

function asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}
