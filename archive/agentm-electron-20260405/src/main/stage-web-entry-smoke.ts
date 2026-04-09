import assert from 'node:assert/strict';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createApiServer } from './api-server.ts';
import { createAppStore } from '../renderer/lib/store.ts';
import { InMemoryMagicBlockHub, InMemoryMagicBlockTransport, MagicBlockA2AAgent } from '../renderer/lib/a2a-client.ts';

export interface WebEntrySmokeStep {
    name: string;
    expected: string;
    actual: string;
}

export interface WebEntrySmokeResult {
    apiBaseUrl: string;
    steps: WebEntrySmokeStep[];
}

export async function runWebEntrySmoke(): Promise<WebEntrySmokeResult> {
    const store = createAppStore();
    store.getState().setAuth({
        authenticated: true,
        publicKey: 'web-entry-smoke-pubkey',
        email: 'smoke@agent.im',
        privyUserId: 'web-entry-smoke-user',
    });

    const hub = new InMemoryMagicBlockHub({ latencyMs: 1 });
    const transport = new InMemoryMagicBlockTransport(hub);
    const a2aAgent = new MagicBlockA2AAgent('web-entry-smoke-controller', transport);
    a2aAgent.start();

    const api = createApiServer({ store, a2aAgent }, { port: 0 });
    const port = await api.start();
    const baseUrl = `http://127.0.0.1:${port}`;
    const steps: WebEntrySmokeStep[] = [];

    try {
        const pairRes = await fetch(`${baseUrl}/web/session/pair`, { method: 'POST' });
        assert.equal(pairRes.status, 200);
        const pairBody = (await pairRes.json()) as { pairCode: string; expiresAt: number };
        assert.equal(pairBody.pairCode.length, 8);
        steps.push({
            name: 'Pair code',
            expected: 'HTTP 200 and 8-char pair code',
            actual: `HTTP ${pairRes.status}, pairCode=${pairBody.pairCode}`,
        });

        const attachRes = await fetch(`${baseUrl}/local/bridge/attach`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ pairCode: pairBody.pairCode, machineName: 'smoke-machine' }),
        });
        assert.equal(attachRes.status, 200);
        const attachBody = (await attachRes.json()) as { bridgeToken: string };
        steps.push({
            name: 'Bridge attach',
            expected: 'HTTP 200 and bridge token',
            actual: `HTTP ${attachRes.status}, token=${attachBody.bridgeToken.slice(0, 8)}...`,
        });

        const bridgeWs = await openWebSocket(`ws://127.0.0.1:${port}/bridge/realtime?token=${attachBody.bridgeToken}`);
        bridgeWs.send(
            JSON.stringify({
                type: 'bridge.agent.presence',
                agents: [{ agentId: 'smoke-agent', status: 'idle', capabilities: ['text', 'voice'] }],
            }),
        );
        await delay(20);

        const webWs = await openWebSocket(`ws://127.0.0.1:${port}/web/chat/smoke-agent`);
        webWs.send(JSON.stringify({ type: 'chat.message.send', text: 'hello smoke' }));

        const ack = await waitForMessage(webWs);
        const requestId = String((ack.payload as { messageId?: string } | undefined)?.messageId);
        assert.equal(ack.type, 'chat.message.ack');
        assert.ok(requestId.length > 0);

        const chatReq = await waitForMessage(bridgeWs);
        assert.equal(chatReq.type, 'bridge.chat.request');
        assert.equal(chatReq.requestId, requestId);
        bridgeWs.send(
            JSON.stringify({
                type: 'bridge.chat.result',
                requestId,
                agentId: 'smoke-agent',
                text: 'smoke reply',
                done: true,
            }),
        );
        const final = await waitForMessage(webWs);
        assert.equal(final.type, 'chat.message.final');
        steps.push({
            name: 'Text relay',
            expected: 'chat ack + final reply',
            actual: `ack=${requestId}, final=${String((final.payload as { text?: string })?.text ?? '')}`,
        });

        webWs.send(
            JSON.stringify({
                type: 'voice.start',
                requestId: 'voice-smoke-1',
                codec: 'text-transcript',
            }),
        );
        await waitForMessage(bridgeWs); // bridge.voice.request start

        webWs.send(
            JSON.stringify({
                type: 'voice.chunk',
                requestId: 'voice-smoke-1',
                seq: 0,
                dataBase64: 'c21va2U=',
            }),
        );
        await waitForMessage(bridgeWs); // chunk
        webWs.send(JSON.stringify({ type: 'voice.stop', requestId: 'voice-smoke-1' }));
        await waitForMessage(bridgeWs); // stop

        bridgeWs.send(
            JSON.stringify({
                type: 'bridge.voice.result',
                requestId: 'voice-smoke-1',
                agentId: 'smoke-agent',
                transcriptFinal: 'smoke voice',
                done: true,
            }),
        );
        const voiceFinal = await waitForMessage(webWs);
        assert.equal(voiceFinal.type, 'voice.transcript.final');
        steps.push({
            name: 'Voice relay',
            expected: 'voice start/chunk/stop forwarded and final transcript returned',
            actual: `voiceFinal=${String((voiceFinal.payload as { text?: string })?.text ?? '')}`,
        });

        const statusRes = await fetch(`${baseUrl}/status`);
        assert.equal(statusRes.status, 200);
        const status = (await statusRes.json()) as { webEntry: { voiceRequestsTotal: number } };
        assert.ok(status.webEntry.voiceRequestsTotal >= 1);
        steps.push({
            name: 'Web-entry metrics',
            expected: 'status.webEntry.voiceRequestsTotal >= 1',
            actual: `voiceRequestsTotal=${status.webEntry.voiceRequestsTotal}`,
        });

        bridgeWs.close();
        webWs.close();
    } finally {
        await api.stop();
    }

    return { apiBaseUrl: baseUrl, steps };
}

async function openWebSocket(url: string): Promise<WebSocket> {
    const ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
        ws.addEventListener('open', () => resolve(), { once: true });
        ws.addEventListener('error', () => reject(new Error(`failed to open websocket: ${url}`)), {
            once: true,
        });
    });
    return ws;
}

async function waitForMessage(ws: WebSocket, timeoutMs = 1000): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('websocket message timeout')), timeoutMs);
        ws.addEventListener(
            'message',
            async (event) => {
                clearTimeout(timeout);
                const raw =
                    typeof event.data === 'string'
                        ? event.data
                        : 'text' in (event.data as object)
                          ? await (event.data as { text: () => Promise<string> }).text()
                          : String(event.data);
                resolve(JSON.parse(raw) as Record<string, unknown>);
            },
            { once: true },
        );
        ws.addEventListener(
            'error',
            () => {
                clearTimeout(timeout);
                reject(new Error('websocket error'));
            },
            { once: true },
        );
    });
}

async function delay(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

const isMainEntry = typeof process.argv[1] === 'string' && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainEntry) {
    runWebEntrySmoke()
        .then((result) => {
            process.stdout.write(`Web entry smoke passed (api=${result.apiBaseUrl})\n`);
            for (const [index, step] of result.steps.entries()) {
                process.stdout.write(
                    `${index + 1}. ${step.name}\n   expected: ${step.expected}\n   actual: ${step.actual}\n`,
                );
            }
        })
        .catch((error) => {
            process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
            process.exit(1);
        });
}
