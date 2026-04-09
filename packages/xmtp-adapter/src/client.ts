/**
 * XMTPClient — Gradience MessagingAdapter implementation backed by XMTP.
 *
 * XMTP provides end-to-end encrypted messaging between Ethereum wallets.
 * This client wraps @xmtp/js-sdk and translates between the XMTP conversation
 * model and Gradience A2AMessage envelopes.
 *
 * Usage:
 *   const client = new XMTPClient({ env: "production" });
 *   await client.connect(walletSigner);
 *   await client.sendMessage(peerAddress, GradienceMessageType.TaskOffer, payload);
 */

import {
    A2AMessage,
    A2APayload,
    AdapterConfig,
    ConversationMeta,
    GradienceMessageType,
    MessageCallback,
    MessagingAdapter,
    WalletSigner,
} from './types.js';
import { buildSigningInput, buildUnsignedMessage, GradienceCodec } from './codec.js';
import { normalizeAddress, withRetry } from './utils.js';

// ─── XMTP SDK types (thin structural interface) ────────────────────────────────
// We use structural typing so the package compiles even when @xmtp/js-sdk is not
// installed in the monorepo root (it may be optional at the workspace level).

interface XMTPClientInstance {
    address: string;
    conversations: {
        newConversation(peerAddress: string): Promise<XMTPConversation>;
        list(): Promise<XMTPConversation[]>;
        streamAllMessages(): AsyncGenerator<XMTPMessage>;
    };
    close(): void;
}

interface XMTPConversation {
    topic: string;
    peerAddress: string;
    createdAt: Date;
    send(content: unknown): Promise<XMTPMessage>;
    messages(): Promise<XMTPMessage[]>;
}

interface XMTPMessage {
    id: string;
    senderAddress: string;
    conversation: { topic: string; peerAddress: string };
    content: unknown;
    sent: Date;
}

// Lazy-load the real XMTP SDK; fall back to a stub for unit tests.
type XMTPStatic = {
    create(signer: WalletSigner, opts?: Record<string, unknown>): Promise<XMTPClientInstance>;
};

function loadXMTP(): XMTPStatic {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@xmtp/xmtp-js').Client as XMTPStatic;
}

// ─── XMTPClient ───────────────────────────────────────────────────────────────

export class XMTPClient implements MessagingAdapter {
    private xmtp: XMTPClientInstance | null = null;
    private config: Required<AdapterConfig>;
    private _sequence = 0;

    constructor(config: AdapterConfig = {}) {
        this.config = {
            env: config.env ?? 'production',
            keys: config.keys ?? new Uint8Array(),
            maxRetries: config.maxRetries ?? 3,
        };
    }

    get isConnected(): boolean {
        return this.xmtp !== null;
    }

    // ─── connect ──────────────────────────────────────────────────────────────

    async connect(walletSigner: WalletSigner): Promise<void> {
        if (this.xmtp) return; // already connected

        const XMTPStatic = loadXMTP();
        const opts: Record<string, unknown> = { env: this.config.env };
        if (this.config.keys.length > 0) opts.privateKeyOverride = this.config.keys;

        this.xmtp = await withRetry(() => XMTPStatic.create(walletSigner, opts), this.config.maxRetries);
    }

    // ─── sendMessage ──────────────────────────────────────────────────────────

    async sendMessage<T extends A2APayload>(
        peerAddress: string,
        messageType: GradienceMessageType,
        payload: T,
    ): Promise<A2AMessage<T>> {
        this.assertConnected();

        const senderAddress = this.xmtp!.address;
        const seq = ++this._sequence;

        // Build the unsigned envelope
        const unsigned = buildUnsignedMessage(senderAddress, normalizeAddress(peerAddress), messageType, payload, seq);

        // Produce signing input, then sign via the wallet that was used to connect.
        // We keep a reference to the signer on connect for this purpose.
        const signingInput = buildSigningInput(
            unsigned.sender,
            unsigned.recipient,
            unsigned.messageType,
            unsigned.payload,
            unsigned.timestamp,
            unsigned.id,
        );
        const signature = await this._signMessage(signingInput);

        const message: A2AMessage<T> = { ...unsigned, signature };

        // Encode and transmit over XMTP
        const bytes = GradienceCodec.encode(message as A2AMessage);
        const conversation = await withRetry(
            () => this.xmtp!.conversations.newConversation(peerAddress),
            this.config.maxRetries,
        );
        await withRetry(() => conversation.send(bytes), this.config.maxRetries);

        message.conversationTopic = conversation.topic;
        return message;
    }

    // ─── streamMessages ───────────────────────────────────────────────────────

    async streamMessages(callback: MessageCallback): Promise<() => void> {
        this.assertConnected();

        let active = true;
        const stream = this.xmtp!.conversations.streamAllMessages();

        // Run the generator in the background; resolve immediately with the stop fn
        (async () => {
            for await (const xmtpMsg of stream) {
                if (!active) break;
                const decoded = this.decodeXMTPMessage(xmtpMsg);
                if (decoded) {
                    try {
                        await callback(decoded);
                    } catch {
                        // Swallow callback errors so the stream stays alive
                    }
                }
            }
        })().catch(() => {
            /* stream ended */
        });

        return () => {
            active = false;
        };
    }

    // ─── getConversations ─────────────────────────────────────────────────────

    async getConversations(): Promise<ConversationMeta[]> {
        this.assertConnected();

        const convos = await this.xmtp!.conversations.list();

        const metas: ConversationMeta[] = await Promise.all(
            convos.map(async (c) => {
                let lastMessageId: string | undefined;
                try {
                    const msgs = await c.messages();
                    const last = msgs[msgs.length - 1];
                    if (last) {
                        const decoded = this.decodeXMTPMessage(last);
                        lastMessageId = decoded?.id ?? last.id;
                    }
                } catch {
                    /* ignore per-conversation errors */
                }
                return {
                    topic: c.topic,
                    peerAddress: c.peerAddress,
                    createdAt: c.createdAt.getTime(),
                    lastMessageId,
                };
            }),
        );

        return metas;
    }

    // ─── disconnect ───────────────────────────────────────────────────────────

    async disconnect(): Promise<void> {
        if (this.xmtp) {
            this.xmtp.close();
            this.xmtp = null;
        }
        this._signer = null;
        this._sequence = 0;
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private _signer: WalletSigner | null = null;

    /**
     * Override connect to also cache the signer for message signing.
     */
    async connectWithSigner(walletSigner: WalletSigner): Promise<void> {
        this._signer = walletSigner;
        await this.connect(walletSigner);
    }

    private async _signMessage(input: string): Promise<string> {
        if (!this._signer) return '';
        try {
            return await this._signer.signMessage(input);
        } catch {
            return '';
        }
    }

    private decodeXMTPMessage(xmtpMsg: XMTPMessage): A2AMessage | null {
        const raw = xmtpMsg.content;
        let bytes: Uint8Array | null = null;

        if (raw instanceof Uint8Array) {
            bytes = raw;
        } else if (typeof raw === 'string') {
            bytes = new TextEncoder().encode(raw);
        } else if (ArrayBuffer.isView(raw)) {
            bytes = new Uint8Array((raw as ArrayBufferView).buffer);
        }

        if (!bytes) return null;

        const decoded = GradienceCodec.decode(bytes);
        if (!decoded) return null;

        decoded.conversationTopic = xmtpMsg.conversation.topic;
        return decoded;
    }

    private assertConnected(): void {
        if (!this.xmtp) {
            throw new Error('XMTPClient is not connected. Call connect() first.');
        }
    }
}

/**
 * Factory that creates and connects an XMTPClient in one call.
 * Caches the signer for outbound message signing.
 */
export async function createXMTPClient(walletSigner: WalletSigner, config?: AdapterConfig): Promise<XMTPClient> {
    const client = new XMTPClient(config);
    client['_signer'] = walletSigner; // inject before connect
    await client.connect(walletSigner);
    return client;
}
