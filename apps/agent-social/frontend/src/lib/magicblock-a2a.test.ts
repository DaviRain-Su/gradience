import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    InMemoryMagicBlockHub,
    InMemoryMagicBlockTransport,
    MagicBlockA2AAgent,
    estimateMicropayment,
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
