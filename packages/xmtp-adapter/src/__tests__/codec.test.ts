import { GradienceCodec, buildSigningInput, buildUnsignedMessage } from '../codec';
import { GradienceMessageType, TaskOfferPayload } from '../types';

const SENDER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const RECIPIENT = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

const OFFER_PAYLOAD: TaskOfferPayload = {
    parentTaskId: 'task-001',
    subtaskId: 1,
    description: 'Summarize document',
    budget: BigInt('1000000'),
    deadlineSlot: BigInt('999999'),
    requiredCapabilityMask: BigInt(3),
};

describe('GradienceCodec', () => {
    it('round-trips an A2AMessage through encode → decode', () => {
        const unsigned = buildUnsignedMessage(SENDER, RECIPIENT, GradienceMessageType.TaskOffer, OFFER_PAYLOAD, 1);
        const message = { ...unsigned, signature: '0xdeadbeef' };

        const bytes = GradienceCodec.encode(message);
        expect(bytes).toBeInstanceOf(Uint8Array);

        const decoded = GradienceCodec.decode(bytes);
        expect(decoded).not.toBeNull();
        expect(decoded!.messageType).toBe(GradienceMessageType.TaskOffer);
        expect(decoded!.sender).toBe(SENDER);
        expect(decoded!.recipient).toBe(RECIPIENT);
        expect(decoded!.signature).toBe('0xdeadbeef');
    });

    it('preserves bigint values through the round-trip', () => {
        const unsigned = buildUnsignedMessage(SENDER, RECIPIENT, GradienceMessageType.TaskOffer, OFFER_PAYLOAD);
        const message = { ...unsigned, signature: '' };

        const bytes = GradienceCodec.encode(message);
        const decoded = GradienceCodec.decode(bytes);

        const payload = decoded!.payload as TaskOfferPayload;
        expect(payload.budget).toBe(BigInt('1000000'));
        expect(payload.deadlineSlot).toBe(BigInt('999999'));
        expect(payload.requiredCapabilityMask).toBe(BigInt(3));
    });

    it('returns null when decoding invalid bytes', () => {
        const garbage = new TextEncoder().encode('not json');
        expect(GradienceCodec.decode(garbage)).toBeNull();
    });

    it('returns null for an unknown message type', () => {
        const wire = JSON.stringify({
            v: 1,
            messageType: 'unknown_type',
            sender: SENDER,
            recipient: RECIPIENT,
            payload: {},
            timestamp: 0,
            signature: '',
            id: 'x',
        });
        const bytes = new TextEncoder().encode(wire);
        expect(GradienceCodec.decode(bytes)).toBeNull();
    });

    it('returns null when codec version is not 1', () => {
        const wire = JSON.stringify({
            v: 2,
            messageType: GradienceMessageType.TaskOffer,
            sender: SENDER,
            recipient: RECIPIENT,
            payload: {},
            timestamp: 0,
            signature: '',
            id: 'x',
        });
        const bytes = new TextEncoder().encode(wire);
        expect(GradienceCodec.decode(bytes)).toBeNull();
    });

    it('produces a non-empty fallback string', () => {
        const unsigned = buildUnsignedMessage(SENDER, RECIPIENT, GradienceMessageType.TaskOffer, OFFER_PAYLOAD);
        const message = { ...unsigned, signature: '' };
        expect(GradienceCodec.fallback(message)).toContain(GradienceMessageType.TaskOffer);
    });
});

describe('buildSigningInput', () => {
    it('returns deterministic output for the same inputs', () => {
        const a = buildSigningInput(SENDER, RECIPIENT, GradienceMessageType.TaskOffer, OFFER_PAYLOAD, 1000, 'id-1');
        const b = buildSigningInput(SENDER, RECIPIENT, GradienceMessageType.TaskOffer, OFFER_PAYLOAD, 1000, 'id-1');
        expect(a).toBe(b);
    });

    it('changes when any field changes', () => {
        const base = buildSigningInput(SENDER, RECIPIENT, GradienceMessageType.TaskOffer, OFFER_PAYLOAD, 1000, 'id-1');
        const diffTs = buildSigningInput(
            SENDER,
            RECIPIENT,
            GradienceMessageType.TaskOffer,
            OFFER_PAYLOAD,
            9999,
            'id-1',
        );
        expect(base).not.toBe(diffTs);
    });
});
