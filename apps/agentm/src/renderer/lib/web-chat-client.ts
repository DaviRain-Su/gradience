export interface WebChatInboundEvent {
    type:
        | 'chat.message.ack'
        | 'chat.message.delta'
        | 'chat.message.final'
        | 'voice.started'
        | 'voice.transcript.partial'
        | 'voice.transcript.final'
        | 'voice.tts.chunk'
        | 'error';
    payload?: Record<string, unknown>;
}

export function buildWebChatWsUrl(baseHttpUrl: string, agentId: string): string {
    const parsed = new URL(baseHttpUrl);
    const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${parsed.host}/web/chat/${encodeURIComponent(agentId)}`;
}

export function serializeWebChatSendEvent(text: string): string {
    return JSON.stringify({
        type: 'chat.message.send',
        text,
    });
}

export function serializeWebVoiceStartEvent(requestId: string): string {
    return JSON.stringify({
        type: 'voice.start',
        requestId,
        codec: 'text-transcript',
    });
}

export function serializeWebVoiceChunkEvent(input: {
    requestId: string;
    seq: number;
    dataBase64: string;
}): string {
    return JSON.stringify({
        type: 'voice.chunk',
        requestId: input.requestId,
        seq: input.seq,
        dataBase64: input.dataBase64,
    });
}

export function serializeWebVoiceStopEvent(requestId: string): string {
    return JSON.stringify({
        type: 'voice.stop',
        requestId,
    });
}

export function parseWebChatInboundEvent(raw: string): WebChatInboundEvent | null {
    try {
        const parsed = JSON.parse(raw) as {
            type?: unknown;
            payload?: unknown;
        };
        if (
            parsed.type === 'chat.message.ack' ||
            parsed.type === 'chat.message.delta' ||
            parsed.type === 'chat.message.final' ||
            parsed.type === 'voice.started' ||
            parsed.type === 'voice.transcript.partial' ||
            parsed.type === 'voice.transcript.final' ||
            parsed.type === 'voice.tts.chunk' ||
            parsed.type === 'error'
        ) {
            return {
                type: parsed.type,
                payload:
                    parsed.payload && typeof parsed.payload === 'object'
                        ? (parsed.payload as Record<string, unknown>)
                        : undefined,
            };
        }
        return null;
    } catch {
        return null;
    }
}
