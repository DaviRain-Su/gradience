import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    BroadcastChannelMagicBlockTransport,
    InMemoryMagicBlockHub,
    InMemoryMagicBlockTransport,
    MagicBlockA2AAgent,
    estimateMicropayment,
    parseA2AEnvelope,
} from './magicblock-a2a';

test('two agents exchange message under 500ms latency budget', async () => {
    const hub = new InMemoryMagicBlockHub({ latencyMs: 25 });
    const alice = new MagicBlockA2AAgent('alice', new InMemoryMagicBlockTransport(hub));
    const bob = new MagicBlockA2AAgent('bob', new InMemoryMagicBlockTransport(hub));

    const incoming = new Promise<number>((resolve) => {
        bob.onDelivery((delivery) => {
            if (
                delivery.direction === 'incoming' &&
                delivery.envelope.from === 'alice' &&
                delivery.envelope.to === 'bob'
            ) {
                resolve(delivery.latencyMs);
            }
        });
    });

    alice.start();
    bob.start();

    alice.sendInvite({
        to: 'bob',
        topic: 'collab',
        message: 'hello from alice',
    });

    const latencyMs = await incoming;
    assert.ok(latencyMs < 500, `expected latency < 500ms, got ${latencyMs}ms`);

    alice.stop();
    bob.stop();
});

test('micropayment stub estimates deterministic cost', () => {
    const cost = estimateMicropayment('defi', 'run strategy');
    assert.equal(cost, 100 + new TextEncoder().encode('defirun strategy').length * 2);
});

test('agent emits outgoing delivery with micropayment metadata', () => {
    const hub = new InMemoryMagicBlockHub({ latencyMs: 1 });
    const alice = new MagicBlockA2AAgent('alice', new InMemoryMagicBlockTransport(hub));
    alice.start();

    let outgoingPayment = 0;
    const unsubscribe = alice.onDelivery((delivery) => {
        if (delivery.direction === 'outgoing') {
            outgoingPayment = delivery.envelope.paymentMicrolamports;
        }
    });

    alice.sendInvite({
        to: 'bob',
        topic: 'signal',
        message: 'alpha',
    });

    assert.ok(outgoingPayment > 0);
    unsubscribe();
    alice.stop();
});

test('parseA2AEnvelope rejects malformed payloads', () => {
    assert.equal(parseA2AEnvelope({ topic: 'x' }), null);
    assert.equal(
        parseA2AEnvelope({
            id: '1',
            from: 'a',
            to: 'b',
            topic: 't',
            message: 'm',
            createdAt: Number.NaN,
            paymentMicrolamports: 1,
        }),
        null,
    );
});

test('BroadcastChannel transport ignores non-envelope messages', () => {
    const listeners = new Set<(event: MessageEvent<unknown>) => void>();
    const channel = {
        postMessage: () => {},
        addEventListener: (_type: 'message', listener: (event: MessageEvent<unknown>) => void) =>
            listeners.add(listener),
        removeEventListener: (_type: 'message', listener: (event: MessageEvent<unknown>) => void) =>
            listeners.delete(listener),
    } as unknown as BroadcastChannel;

    const transport = new BroadcastChannelMagicBlockTransport(channel);
    const received: string[] = [];
    const off = transport.subscribe((envelope) => received.push(envelope.id));

    for (const listener of listeners) {
        listener({ data: { bad: true } } as MessageEvent<unknown>);
        listener({
            data: {
                id: 'ok-1',
                from: 'a',
                to: 'b',
                topic: 'topic',
                message: 'hello',
                createdAt: 1,
                paymentMicrolamports: 2,
            },
        } as MessageEvent<unknown>);
    }

    off();
    assert.deepEqual(received, ['ok-1']);
});
