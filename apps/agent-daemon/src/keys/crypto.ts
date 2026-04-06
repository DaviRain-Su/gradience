/**
 * Crypto utilities for key management
 *
 * Low-level encryption primitives used by EncryptedFileKeyManager
 */

import { pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

// Security parameters matching EncryptedFileKeyManager
export const CRYPTO_PARAMS = {
  version: 1,
  saltLength: 16,
  ivLength: 12,
  authTagLength: 16,
  keyLength: 32,
  pbkdf2Iterations: 100_000,
  algorithm: 'aes-256-gcm' as const,
  kdf: 'pbkdf2' as const,
  hash: 'sha256' as const,
};

/**
 * Derive encryption key from password using PBKDF2
 */
export function deriveKey(password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(
    password,
    salt,
    CRYPTO_PARAMS.pbkdf2Iterations,
    CRYPTO_PARAMS.keyLength,
    CRYPTO_PARAMS.hash
  );
}

/**
 * Encrypt data with AES-256-GCM
 */
export function encrypt(plaintext: Buffer, key: Buffer, iv: Buffer): { ciphertext: Buffer; authTag: Buffer } {
  const cipher = createCipheriv(CRYPTO_PARAMS.algorithm, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, authTag };
}

/**
 * Decrypt data with AES-256-GCM
 */
export function decrypt(ciphertext: Buffer, key: Buffer, iv: Buffer, authTag: Buffer): Buffer {
  const decipher = createDecipheriv(CRYPTO_PARAMS.algorithm, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Generate cryptographically secure random bytes
 */
export function generateSalt(): Buffer {
  return randomBytes(CRYPTO_PARAMS.saltLength);
}

export function generateIV(): Buffer {
  return randomBytes(CRYPTO_PARAMS.ivLength);
}

/**
 * Securely clear a buffer (best effort in JS)
 */
export function clearBuffer(buffer: Buffer): void {
  buffer.fill(0);
}

/**
 * Format encrypted data for storage
 */
export function formatEncryptedData(
  version: number,
  salt: Buffer,
  iv: Buffer,
  authTag: Buffer,
  ciphertext: Buffer
): Buffer {
  return Buffer.concat([Buffer.from([version]), salt, iv, authTag, ciphertext]);
}

/**
 * Parse encrypted data from storage
 */
export function parseEncryptedData(data: Buffer): {
  version: number;
  salt: Buffer;
  iv: Buffer;
  authTag: Buffer;
  ciphertext: Buffer;
} {
  let offset = 0;
  const version = data[offset++];

  const salt = data.slice(offset, offset + CRYPTO_PARAMS.saltLength);
  offset += CRYPTO_PARAMS.saltLength;

  const iv = data.slice(offset, offset + CRYPTO_PARAMS.ivLength);
  offset += CRYPTO_PARAMS.ivLength;

  const authTag = data.slice(offset, offset + CRYPTO_PARAMS.authTagLength);
  offset += CRYPTO_PARAMS.authTagLength;

  const ciphertext = data.slice(offset);

  return { version, salt, iv, authTag, ciphertext };
}
