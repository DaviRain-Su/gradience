import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    estimateMicropayment,
    parseA2AEnvelope,
    InMemoryMagicBlockHub,
    InMemoryMagicBlockTransport,
    MagicBlockA2AAgent,
    DEFAULT_MICROPAYMENT_POLICY,
} from './a2a-client.ts';
import type { A2ADelivery } from '../../shared/types.ts';

describe('estimateMicropayment', () => {
    it('calculates base + byte_len * perByte', () => {
        const cost = estimateMicropayment('defi', 'run strategy');
        const bytes = new TextEncoder().encode('defirun strategy').length;
        assert.equal(cost, 100 + bytes * 2);
    });

    it('uses custom policy', () => {
        const cost = estimateMicropayment('a', 'b', { baseMicrolamports: 50, perByteMicrolamports: 1 });
        const bytes = new TextEncoder().encode('ab').length;
        assert.equal(cost, 50 + bytes * 1);
    });
});

describe('parseA2AEnvelope', () => {
    const valid = {
        id: '123-456',
        from: 'alice',
        to: 'bob',
        topic: 'test',
        message: 'hello',
        createdAt: 1000,
        paymentMicrolamports: 100,
    };

    it('parses valid envelope', () => {
        const result = parseA2AEnvelope(valid);
        assert.deepEqual(result, valid);
    });

    it('rejects createdAt=NaN', () => {
        assert.equal(parseA2AEnvelope({ ...valid, createdAt: NaN }), null);
    });

    it('rejects paymentMicrolamports < 0', () => {
        assert.equal(parseA2AEnvelope({ ...valid, paymentMicrolamports: -1 }), null);
    });

    it('rejects missing fields (one at a time)', () => {
        for (const field of ['id', 'from', 'to', 'topic', 'message'] as const) {
            const broken = { ...valid, [field]: undefined };
            assert.equal(parseA2AEnvelope(broken), null, `should reject missing ${field}`);
        }
    });

    it('rejects null/undefined input', () => {
        assert.equal(parseA2AEnvelope(null), null);
        assert.equal(parseA2AEnvelope(undefined), null);
    });
});

describe('InMemoryTransport + MagicBlockA2AAgent', () => {
    it('delivers message from sender to receiver', async () => {
        const hub = new InMemoryMagicBlockHub({ latencyMs: 10 });
        const tA = new InMemoryMagicBlockTransport(hub);
        const tB = new InMemoryMagicBlockTransport(hub);

        const agentA = new MagicBlockA2AAgent('alice', tA);
        const agentB = new MagicBlockA2AAgent('bob', tB);

        const deliveries: A2ADelivery[] = [];
        agentB.onDelivery(d => deliveries.push(d));
        agentA.start();
        agentB.start();

        agentA.sendInvite({ to: 'bob', topic: 'test', message: 'hello' });
        await new Promise(r => setTimeout(r, 50));

        assert.equal(deliveries.length, 1);
        assert.equal(deliveries[0].envelope.from, 'alice');
        assert.equal(deliveries[0].envelope.to, 'bob');
        assert.equal(deliveries[0].direction, 'incoming');

        agentA.stop();
        agentB.stop();
    });

    it('filters messages not addressed to this agent', async () => {
        const hub = new InMemoryMagicBlockHub({ latencyMs: 10 });
        const tA = new InMemoryMagicBlockTransport(hub);
        const tB = new InMemoryMagicBlockTransport(hub);

        const agentA = new MagicBlockA2AAgent('alice', tA);
        const agentB = new MagicBlockA2AAgent('bob', tB);

        const deliveries: A2ADelivery[] = [];
        agentB.onDelivery(d => deliveries.push(d));
        agentA.start();
        agentB.start();

        // Send to charlie, not bob
        agentA.sendInvite({ to: 'charlie', topic: 'test', message: 'hi' });
        await new Promise(r => setTimeout(r, 50));

        assert.equal(deliveries.length, 0);

        agentA.stop();
        agentB.stop();
    });

    it('sender gets outgoing delivery', () => {
        const hub = new InMemoryMagicBlockHub({ latencyMs: 10 });
        const t = new InMemoryMagicBlockTransport(hub);
        const agent = new MagicBlockA2AAgent('alice', t);

        const deliveries: A2ADelivery[] = [];
        agent.onDelivery(d => deliveries.push(d));
        agent.start();

        agent.sendInvite({ to: 'bob', topic: 'test', message: 'hi' });

        assert.equal(deliveries.length, 1);
        assert.equal(deliveries[0].direction, 'outgoing');

        agent.stop();
    });
});
