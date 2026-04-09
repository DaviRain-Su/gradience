/**
 * XMTPClient unit tests.
 *
 * @xmtp/js-sdk is mocked so these tests run without a real XMTP node.
 */

import { XMTPClient, createXMTPClient } from '../client';
import { GradienceMessageType, TaskOfferPayload } from '../types';
import { GradienceCodec, buildUnsignedMessage } from '../codec';

// ─── Mock @xmtp/js-sdk ───────────────────────────────────────────────────────

const mockSend = jest.fn().mockResolvedValue({
    id: 'xmtp-1',
    sent: new Date(),
    senderAddress: '0xsender',
    conversation: { topic: 't1', peerAddress: '0xpeer' },
    content: new Uint8Array(),
});
const mockMessages = jest.fn().mockResolvedValue([]);
const mockConversation = {
    topic: 't1',
    peerAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    createdAt: new Date(1700000000000),
    send: mockSend,
    messages: mockMessages,
};

async function* mockStreamAllMessages() {
    // yields nothing by default — individual tests override this
}

const mockXMTPInstance = {
    address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    conversations: {
        newConversation: jest.fn().mockResolvedValue(mockConversation),
        list: jest.fn().mockResolvedValue([mockConversation]),
        streamAllMessages: jest.fn().mockImplementation(mockStreamAllMessages),
    },
    close: jest.fn(),
};

jest.mock('@xmtp/xmtp-js', () => ({
    Client: {
        create: jest.fn().mockResolvedValue(mockXMTPInstance),
    },
}));

// ─── Mock wallet signer ───────────────────────────────────────────────────────

const mockSigner = {
    getAddress: jest.fn().mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    signMessage: jest.fn().mockResolvedValue('0xmocksig'),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

const PEER = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

const OFFER: TaskOfferPayload = {
    parentTaskId: 'task-001',
    subtaskId: 1,
    description: 'Translate text',
    budget: BigInt('500000'),
    deadlineSlot: BigInt('888888'),
    requiredCapabilityMask: BigInt(1),
};

beforeEach(() => {
    jest.clearAllMocks();
    // Reset @xmtp/js-sdk mock
    const xmtp = require('@xmtp/xmtp-js');
    xmtp.Client.create.mockResolvedValue(mockXMTPInstance);
    mockXMTPInstance.conversations.newConversation.mockResolvedValue(mockConversation);
    mockXMTPInstance.conversations.list.mockResolvedValue([mockConversation]);
});

describe('XMTPClient.connect', () => {
    it('creates an XMTP client on connect()', async () => {
        const client = new XMTPClient({ env: 'dev' });
        await client.connect(mockSigner);
        expect(client.isConnected).toBe(true);
    });

    it('is idempotent — does not create a second XMTP client', async () => {
        const client = new XMTPClient();
        await client.connect(mockSigner);
        await client.connect(mockSigner);
        const xmtp = require('@xmtp/xmtp-js');
        expect(xmtp.Client.create).toHaveBeenCalledTimes(1);
    });

    it('throws when XMTP create fails', async () => {
        const xmtp = require('@xmtp/xmtp-js');
        xmtp.Client.create.mockRejectedValue(new Error('network error'));
        const client = new XMTPClient({ maxRetries: 1 });
        await expect(client.connect(mockSigner)).rejects.toThrow('network error');
    });
});

describe('XMTPClient.sendMessage', () => {
    it('sends a TaskOffer and returns an A2AMessage', async () => {
        const client = await createXMTPClient(mockSigner, { env: 'dev' });
        const msg = await client.sendMessage(PEER, GradienceMessageType.TaskOffer, OFFER);

        expect(msg.messageType).toBe(GradienceMessageType.TaskOffer);
        expect(msg.sender).toBe(mockXMTPInstance.address);
        expect(msg.recipient).toBe(PEER.toLowerCase());
        expect(typeof msg.id).toBe('string');
        expect(typeof msg.timestamp).toBe('number');
        expect(mockSend).toHaveBeenCalledTimes(1);

        // Verify the bytes sent are decodable
        const sentBytes = mockSend.mock.calls[0][0] as Uint8Array;
        const decoded = GradienceCodec.decode(sentBytes);
        expect(decoded).not.toBeNull();
        expect(decoded!.messageType).toBe(GradienceMessageType.TaskOffer);
    });

    it('throws when not connected', async () => {
        const client = new XMTPClient();
        await expect(client.sendMessage(PEER, GradienceMessageType.TaskOffer, OFFER)).rejects.toThrow('not connected');
    });
});

describe('XMTPClient.getConversations', () => {
    it('returns ConversationMeta list', async () => {
        const client = await createXMTPClient(mockSigner, { env: 'dev' });
        const convos = await client.getConversations();
        expect(convos).toHaveLength(1);
        expect(convos[0].peerAddress).toBe(mockConversation.peerAddress);
        expect(convos[0].createdAt).toBe(1700000000000);
    });
});

describe('XMTPClient.streamMessages', () => {
    it('calls callback with decoded messages', async () => {
        const unsigned = buildUnsignedMessage(mockXMTPInstance.address, PEER, GradienceMessageType.TaskResult, {
            parentTaskId: 't1',
            subtaskId: 1,
            deliverable: 'done',
            bidAmount: BigInt(100),
        });
        const gradienceMsg = { ...unsigned, signature: '0xsig' };
        const bytes = GradienceCodec.encode(gradienceMsg);

        const fakeXMTPMsg = {
            id: 'xmtp-incoming-1',
            senderAddress: PEER,
            sent: new Date(),
            conversation: { topic: 't1', peerAddress: mockXMTPInstance.address },
            content: bytes,
        };

        async function* gen() {
            yield fakeXMTPMsg;
        }
        mockXMTPInstance.conversations.streamAllMessages.mockImplementation(gen);

        const client = await createXMTPClient(mockSigner, { env: 'dev' });
        const received: unknown[] = [];
        const stop = await client.streamMessages((m) => {
            received.push(m);
        });

        // give the async generator a tick to yield
        await new Promise((r) => setTimeout(r, 10));
        stop();

        expect(received).toHaveLength(1);
        expect((received[0] as { messageType: string }).messageType).toBe(GradienceMessageType.TaskResult);
    });
});

describe('XMTPClient.disconnect', () => {
    it('calls close() and resets isConnected', async () => {
        const client = await createXMTPClient(mockSigner, { env: 'dev' });
        await client.disconnect();
        expect(client.isConnected).toBe(false);
        expect(mockXMTPInstance.close).toHaveBeenCalledTimes(1);
    });
});
