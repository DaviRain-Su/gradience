import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    buildWebChatWsUrl,
    parseWebChatInboundEvent,
    serializeWebVoiceChunkEvent,
    serializeWebVoiceStartEvent,
    serializeWebVoiceStopEvent,
    serializeWebChatSendEvent,
} from './web-chat-client.ts';

describe('web-chat-client', () => {
    it('buildWebChatWsUrl converts http/https to ws/wss', () => {
        assert.equal(
            buildWebChatWsUrl('http://127.0.0.1:3939', 'agent-1'),
            'ws://127.0.0.1:3939/web/chat/agent-1',
        );
        assert.equal(
            buildWebChatWsUrl('https://agent.im', 'agent-1'),
            'wss://agent.im/web/chat/agent-1',
        );
    });

    it('serializeWebChatSendEvent outputs send payload', () => {
        const serialized = serializeWebChatSendEvent('hello');
        assert.deepEqual(JSON.parse(serialized), {
            type: 'chat.message.send',
            text: 'hello',
        });
    });

    it('serializes web voice events', () => {
        const started = JSON.parse(serializeWebVoiceStartEvent('req-1'));
        assert.equal(started.type, 'voice.start');
        assert.equal(started.requestId, 'req-1');

        const chunk = JSON.parse(
            serializeWebVoiceChunkEvent({ requestId: 'req-1', seq: 0, dataBase64: 'aGVsbG8=' }),
        );
        assert.equal(chunk.type, 'voice.chunk');
        assert.equal(chunk.seq, 0);
        assert.equal(chunk.dataBase64, 'aGVsbG8=');

        const stopped = JSON.parse(serializeWebVoiceStopEvent('req-1'));
        assert.equal(stopped.type, 'voice.stop');
        assert.equal(stopped.requestId, 'req-1');
    });

    it('parseWebChatInboundEvent accepts known event types only', () => {
        const ack = parseWebChatInboundEvent(
            JSON.stringify({
                type: 'chat.message.ack',
                payload: { messageId: 'm1' },
            }),
        );
        assert.equal(ack?.type, 'chat.message.ack');
        assert.equal(ack?.payload?.messageId, 'm1');

        const voice = parseWebChatInboundEvent(
            JSON.stringify({ type: 'voice.transcript.final', payload: { text: 'hello' } }),
        );
        assert.equal(voice?.type, 'voice.transcript.final');
        assert.equal(voice?.payload?.text, 'hello');

        const unknown = parseWebChatInboundEvent(
            JSON.stringify({ type: 'unknown.event', payload: {} }),
        );
        assert.equal(unknown, null);
    });
});
