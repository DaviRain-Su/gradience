/**
 * GradienceCodec — custom XMTP content codec for Gradience A2A messages.
 *
 * XMTP transports arbitrary bytes in "encoded content" envelopes.  This codec
 * packs/unpacks A2AMessage objects so that XMTP nodes store only opaque bytes
 * and the Gradience SDK handles all application-level deserialization.
 *
 * Content type ID: gradience.xyz/a2a:1.0
 */

import { A2AMessage, A2APayload, GradienceMessageType } from "./types";
import {
  bigintReplacer,
  bigintReviver,
  canonicalize,
  generateMessageId,
} from "./utils";

// ─── Content type identifier ───────────────────────────────────────────────────

export const GRADIENCE_CONTENT_TYPE = {
  authorityId: "gradience.xyz",
  typeId: "a2a",
  versionMajor: 1,
  versionMinor: 0,
} as const;

// String form used for logging / header fields
export const GRADIENCE_CONTENT_TYPE_STR = "gradience.xyz/a2a:1.0";

// ─── Wire format ───────────────────────────────────────────────────────────────

/**
 * What we actually serialize to XMTP bytes.
 * bigint values are encoded as "<decimal>n" strings by bigintReplacer.
 */
interface WireEnvelope {
  /** Codec version for forward-compat checks */
  v: number;
  id: string;
  sender: string;
  recipient: string;
  messageType: string;
  payload: unknown;
  timestamp: number;
  signature: string;
}

// ─── Codec ────────────────────────────────────────────────────────────────────

export const GradienceCodec = {
  contentType: GRADIENCE_CONTENT_TYPE,

  /**
   * Encode an A2AMessage to raw bytes for XMTP transport.
   */
  encode(message: A2AMessage): Uint8Array {
    const wire: WireEnvelope = {
      v: 1,
      id: message.id,
      sender: message.sender,
      recipient: message.recipient,
      messageType: message.messageType,
      payload: message.payload,
      timestamp: message.timestamp,
      signature: message.signature,
    };
    const json = JSON.stringify(wire, bigintReplacer);
    return new TextEncoder().encode(json);
  },

  /**
   * Decode raw XMTP bytes back to an A2AMessage.
   * Returns null if the bytes don't look like a Gradience message.
   */
  decode(bytes: Uint8Array): A2AMessage | null {
    try {
      const json = new TextDecoder().decode(bytes);
      const wire = JSON.parse(json, bigintReviver) as WireEnvelope;

      if (wire.v !== 1) return null;
      if (!isValidMessageType(wire.messageType)) return null;

      return {
        id: wire.id,
        sender: wire.sender,
        recipient: wire.recipient,
        messageType: wire.messageType as GradienceMessageType,
        payload: wire.payload as A2APayload,
        timestamp: wire.timestamp,
        signature: wire.signature,
      };
    } catch {
      return null;
    }
  },

  /**
   * Fallback plain-text representation for clients that don't support this codec.
   */
  fallback(message: A2AMessage): string {
    return `[Gradience ${message.messageType}] ${message.id}`;
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidMessageType(type: string): boolean {
  return Object.values(GradienceMessageType).includes(
    type as GradienceMessageType,
  );
}

/**
 * Build the canonical string that should be signed / verified.
 * Only covers the fields that must be authenticated; excludes conversationTopic
 * and the signature field itself.
 */
export function buildSigningInput(
  sender: string,
  recipient: string,
  messageType: GradienceMessageType,
  payload: A2APayload,
  timestamp: number,
  id: string,
): string {
  return canonicalize({ id, sender, recipient, messageType, payload, timestamp });
}

/**
 * Construct an unsigned A2AMessage shell (signature = "").
 * The caller is responsible for filling in the signature field before sending.
 */
export function buildUnsignedMessage<T extends A2APayload>(
  sender: string,
  recipient: string,
  messageType: GradienceMessageType,
  payload: T,
  sequenceHint = 0,
): Omit<A2AMessage<T>, "signature"> & { signature: "" } {
  const timestamp = Date.now();
  const id = generateMessageId(sender, timestamp, sequenceHint);
  return {
    id,
    sender,
    recipient,
    messageType,
    payload,
    timestamp,
    signature: "",
  };
}
