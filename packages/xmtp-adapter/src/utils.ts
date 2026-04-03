/**
 * Utility helpers for the XMTP adapter.
 */

// ─── BigInt JSON serialization ─────────────────────────────────────────────────

/**
 * JSON.stringify replacer that serializes bigint as "<decimal>n".
 * This lets us round-trip bigint values through JSON without losing precision.
 */
export function bigintReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return `${value.toString()}n`;
  return value;
}

/**
 * JSON.parse reviver that deserializes "<decimal>n" strings back to bigint.
 */
export function bigintReviver(_key: string, value: unknown): unknown {
  if (typeof value === "string" && /^-?\d+n$/.test(value)) {
    return BigInt(value.slice(0, -1));
  }
  return value;
}

// ─── Canonical serialization ───────────────────────────────────────────────────

/**
 * Produce a deterministic JSON string for signing.
 * Keys are sorted alphabetically at every level of nesting.
 */
export function canonicalize(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj, bigintReplacer as (k: string, v: unknown) => unknown);
  }
  if (Array.isArray(obj)) {
    return `[${(obj as unknown[]).map(canonicalize).join(",")}]`;
  }
  const sorted = Object.keys(obj as Record<string, unknown>)
    .sort()
    .map((k) => {
      const v = (obj as Record<string, unknown>)[k];
      return `${JSON.stringify(k)}:${canonicalize(v)}`;
    });
  return `{${sorted.join(",")}}`;
}

// ─── Message ID generation ─────────────────────────────────────────────────────

/**
 * Generate a locally-unique message ID.
 * Format: "<senderPrefix>-<timestamp>-<sequence>"
 */
export function generateMessageId(
  sender: string,
  timestamp: number,
  sequence: number,
): string {
  const prefix = sender.slice(0, 8).toLowerCase();
  return `${prefix}-${timestamp}-${sequence}`;
}

// ─── Address helpers ──────────────────────────────────────────────────────────

/** Basic Ethereum-style address validation (0x + 40 hex chars). */
export function isValidEthAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/** Normalise to checksum-free lowercase for comparisons. */
export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

/**
 * Retry an async operation with exponential back-off.
 * @param fn     Operation to retry
 * @param max    Maximum attempts (default 3)
 * @param delay  Base delay in ms (default 100)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  max = 3,
  delay = 100,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < max; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < max - 1) {
        await sleep(delay * 2 ** attempt);
      }
    }
  }
  throw lastErr;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Type narrowing helpers ────────────────────────────────────────────────────

import {
  GradienceMessageType,
  TaskOfferPayload,
  TaskResultPayload,
  JudgeVerdictPayload,
  PaymentConfirmationPayload,
  A2AMessage,
  A2APayload,
} from "./types";

export function isTaskOffer(
  msg: A2AMessage,
): msg is A2AMessage<TaskOfferPayload> {
  return msg.messageType === GradienceMessageType.TaskOffer;
}

export function isTaskResult(
  msg: A2AMessage,
): msg is A2AMessage<TaskResultPayload> {
  return msg.messageType === GradienceMessageType.TaskResult;
}

export function isJudgeVerdict(
  msg: A2AMessage,
): msg is A2AMessage<JudgeVerdictPayload> {
  return msg.messageType === GradienceMessageType.JudgeVerdict;
}

export function isPaymentConfirmation(
  msg: A2AMessage,
): msg is A2AMessage<PaymentConfirmationPayload> {
  return msg.messageType === GradienceMessageType.PaymentConfirmation;
}
