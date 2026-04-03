import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import type { TransportEncryptedPayload } from "./types";

const TRANSPORT_ALGORITHM = "aes-256-gcm";

export class TransportCrypto {
  private readonly key: Buffer;

  constructor(secret: string) {
    if (!secret || secret.trim() === "") {
      throw new Error("transport encryption secret is required");
    }
    this.key = createHash("sha256").update(secret).digest();
  }

  encrypt(payload: Record<string, unknown>): Record<string, unknown> {
    const iv = randomBytes(12);
    const cipher = createCipheriv(TRANSPORT_ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(payload), "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    const wrapped: TransportEncryptedPayload = {
      __transportEncrypted: true,
      alg: TRANSPORT_ALGORITHM,
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
    return wrapped as unknown as Record<string, unknown>;
  }

  decrypt(payload: Record<string, unknown>): Record<string, unknown> {
    const wrapped = parseEncryptedPayload(payload);
    if (!wrapped) {
      return payload;
    }

    const decipher = createDecipheriv(
      TRANSPORT_ALGORITHM,
      this.key,
      Buffer.from(wrapped.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(wrapped.tag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(wrapped.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");

    return JSON.parse(plaintext) as Record<string, unknown>;
  }
}

function parseEncryptedPayload(payload: Record<string, unknown>): TransportEncryptedPayload | null {
  const maybe = payload as Partial<TransportEncryptedPayload>;
  if (
    maybe.__transportEncrypted !== true ||
    maybe.alg !== TRANSPORT_ALGORITHM ||
    typeof maybe.iv !== "string" ||
    typeof maybe.tag !== "string" ||
    typeof maybe.ciphertext !== "string"
  ) {
    return null;
  }
  return maybe as TransportEncryptedPayload;
}
