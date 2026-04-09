/**
 * Gradience-specific message types transmitted over XMTP.
 * Maps to A2A protocol message types used in the relay.
 */
export enum GradienceMessageType {
    TaskOffer = 'task_offer',
    TaskResult = 'task_result',
    JudgeVerdict = 'judge_verdict',
    PaymentConfirmation = 'payment_confirmation',
}

// ─── Payload shapes ────────────────────────────────────────────────────────────

export interface TaskOfferPayload {
    parentTaskId: string;
    subtaskId: number;
    description: string;
    budget: bigint;
    deadlineSlot: bigint;
    requiredCapabilityMask: bigint;
}

export interface TaskResultPayload {
    parentTaskId: string;
    subtaskId: number;
    deliverable: string; // URI or inline content
    computeProof?: string; // Optional ZK/TEE proof
    bidAmount: bigint;
}

export interface JudgeVerdictPayload {
    parentTaskId: string;
    subtaskId: number;
    accepted: boolean;
    reason?: string;
    settlementAmount: bigint;
}

export interface PaymentConfirmationPayload {
    parentTaskId: string;
    subtaskId: number;
    channelId: string;
    amountMicrolamports: bigint;
    txSignature: string; // Solana transaction signature
}

export type A2APayload = TaskOfferPayload | TaskResultPayload | JudgeVerdictPayload | PaymentConfirmationPayload;

// ─── Message envelope ──────────────────────────────────────────────────────────

export interface A2AMessage<T extends A2APayload = A2APayload> {
    /** Unique message ID: "<threadId>:<sequence>" */
    id: string;
    sender: string;
    recipient: string;
    messageType: GradienceMessageType;
    payload: T;
    timestamp: number;
    /** Ed25519 / ECDSA hex signature over canonical JSON of the envelope fields */
    signature: string;
    /** Optional: XMTP conversation topic this message was received on */
    conversationTopic?: string;
}

// ─── Conversation metadata ─────────────────────────────────────────────────────

export interface ConversationMeta {
    topic: string;
    peerAddress: string;
    createdAt: number;
    /** Latest message ID seen in this conversation */
    lastMessageId?: string;
}

// ─── Abstract adapter interface ────────────────────────────────────────────────

/**
 * MessagingAdapter defines the surface that every transport adapter must
 * implement.  XMTPClient is the XMTP implementation; future adapters (Nostr,
 * Waku, etc.) should implement the same interface.
 */
export interface MessagingAdapter {
    /**
     * Initialise the underlying transport using the provided wallet signer.
     * Must be called before any other method.
     */
    connect(walletSigner: WalletSigner): Promise<void>;

    /** True once connect() has completed successfully. */
    readonly isConnected: boolean;

    /**
     * Send an A2A message to peerAddress.
     * Returns the sent message with its server-assigned id and timestamp.
     */
    sendMessage<T extends A2APayload>(
        peerAddress: string,
        messageType: GradienceMessageType,
        payload: T,
    ): Promise<A2AMessage<T>>;

    /**
     * Subscribe to all incoming messages.
     * The returned cleanup function stops the subscription when called.
     */
    streamMessages(callback: MessageCallback): Promise<() => void>;

    /** List all conversations the local identity participates in. */
    getConversations(): Promise<ConversationMeta[]>;

    /** Disconnect and clean up resources. */
    disconnect(): Promise<void>;
}

// ─── Supporting types ──────────────────────────────────────────────────────────

/** Minimal wallet signer interface (compatible with ethers.js Signer and viem walletClient). */
export interface WalletSigner {
    getAddress(): Promise<string>;
    signMessage(message: string | Uint8Array): Promise<string>;
}

export type MessageCallback = (message: A2AMessage) => void | Promise<void>;

export interface AdapterConfig {
    /** XMTP environment: "dev", "production", or "local". Defaults to "production". */
    env?: 'dev' | 'production' | 'local';
    /** Optional pre-keys bundle for XMTP identity (advanced). */
    keys?: Uint8Array;
    /** Maximum retry attempts when publishing fails. Default: 3 */
    maxRetries?: number;
}
