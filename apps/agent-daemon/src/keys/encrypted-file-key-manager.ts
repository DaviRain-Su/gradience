/**
 * Encrypted File Key Manager
 *
 * Phase 1 Implementation: Password-encrypted key storage
 * Algorithm: PBKDF2 + AES-256-GCM
 *
 * Features:
 * - Backward compatible (plaintext fallback)
 * - Auto-upgrade from plaintext to encrypted
 * - Secure key derivation (100k+ iterations)
 * - Authenticated encryption (tamper-proof)
 */

import { pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { writeFileSync, readFileSync, existsSync, chmodSync } from 'fs';
import bs58 from 'bs58';
import * as nacl from 'tweetnacl';
import { DaemonError, ErrorCodes } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// Security parameters
const ENCRYPTION_VERSION = 1;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100_000;

export interface EncryptedKeyManagerConfig {
  keyPath: string;
  password?: string;
}

export class EncryptedFileKeyManager {
  private keypair: nacl.SignKeyPair | null = null;
  private password: string | null = null;
  private readonly keyPath: string;

  constructor(config: EncryptedKeyManagerConfig) {
    this.keyPath = config.keyPath;
    this.password = config.password || null;
  }

  /**
   * Initialize the key manager
   * - If encrypted file exists: decrypt with password
   * - If plaintext file exists: load (backward compatible)
   * - If no file: generate new keypair
   */
  async initialize(): Promise<void> {
    logger.info({ keyPath: this.keyPath }, 'Initializing key manager');

    if (existsSync(this.keyPath)) {
      const data = readFileSync(this.keyPath);

      // Check if encrypted format
      if (this.isEncrypted(data)) {
        if (!this.password) {
          throw new DaemonError(
            ErrorCodes.KEY_NOT_FOUND,
            'Password required for encrypted keyfile. Please provide password or use plaintext keyfile.',
            401
          );
        }
        this.keypair = this.decryptKeyfile(data, this.password);
        logger.info('Loaded encrypted keyfile');
      } else {
        // Backward compatible: plaintext Base58
        try {
          const secretKey = bs58.decode(data.toString('utf-8').trim());
          if (secretKey.length !== 64) {
            throw new Error('Invalid key length');
          }
          this.keypair = nacl.sign.keyPair.fromSecretKey(secretKey);
          logger.info('Loaded plaintext keyfile (legacy format)');

          // Auto-upgrade to encrypted if password provided
          if (this.password) {
            await this.upgradeToEncrypted();
          }
        } catch (err) {
          throw new DaemonError(
            ErrorCodes.KEY_INVALID,
            'Failed to load keyfile: invalid format',
            400
          );
        }
      }
    } else {
      // Generate new keypair
      this.keypair = nacl.sign.keyPair();
      logger.info({ publicKey: bs58.encode(this.keypair.publicKey) }, 'Generated new keypair');

      if (this.password) {
        await this.saveEncrypted(this.password);
        logger.info('Saved encrypted keyfile');
      } else {
        this.savePlaintext();
        logger.info('Saved plaintext keyfile (no password provided)');
      }
    }
  }

  /**
   * Check if file is in encrypted format
   */
  private isEncrypted(data: Buffer): boolean {
    return data.length > 0 && data[0] === ENCRYPTION_VERSION;
  }

  /**
   * Save keypair as encrypted file
   */
  private async saveEncrypted(password: string): Promise<void> {
    if (!this.keypair) {
      throw new DaemonError(ErrorCodes.KEY_NOT_FOUND, 'Keypair not initialized', 500);
    }

    // Generate random salt and IV
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);

    // Derive encryption key using PBKDF2
    const key = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');

    // Encrypt with AES-256-GCM
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(this.keypair.secretKey), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Assemble: version(1) + salt(16) + iv(12) + authTag(16) + ciphertext(32)
    const data = Buffer.concat([
      Buffer.from([ENCRYPTION_VERSION]),
      salt,
      iv,
      authTag,
      ciphertext,
    ]);

    // Write as Base64 for portability
    writeFileSync(this.keyPath, data.toString('base64'), { mode: 0o600 });
    chmodSync(this.keyPath, 0o600);
  }

  /**
   * Decrypt keyfile
   */
  private decryptKeyfile(data: Buffer, password: string): nacl.SignKeyPair {
    try {
      const decoded = Buffer.from(data.toString('utf-8'), 'base64');

      // Parse format
      let offset = 0;
      const version = decoded[offset++];

      if (version !== ENCRYPTION_VERSION) {
        throw new Error(`Unsupported encryption version: ${version}`);
      }

      const salt = decoded.slice(offset, offset + SALT_LENGTH);
      offset += SALT_LENGTH;

      const iv = decoded.slice(offset, offset + IV_LENGTH);
      offset += IV_LENGTH;

      const authTag = decoded.slice(offset, offset + AUTH_TAG_LENGTH);
      offset += AUTH_TAG_LENGTH;

      const ciphertext = decoded.slice(offset);

      // Derive key
      const key = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');

      // Decrypt
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      const secretKey = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

      if (secretKey.length !== 64) {
        throw new Error('Invalid decrypted key length');
      }

      return nacl.sign.keyPair.fromSecretKey(secretKey);
    } catch (err) {
      if (err instanceof DaemonError) throw err;

      logger.error({ err }, 'Failed to decrypt keyfile');
      throw new DaemonError(
        ErrorCodes.KEY_INVALID,
        'Failed to decrypt keyfile: wrong password or corrupted file',
        401
      );
    }
  }

  /**
   * Upgrade plaintext keyfile to encrypted
   */
  private async upgradeToEncrypted(): Promise<void> {
    if (!this.password || !this.keypair) return;

    logger.info('Upgrading plaintext keyfile to encrypted format...');

    // Backup old file
    const backupPath = `${this.keyPath}.backup.${Date.now()}`;
    writeFileSync(backupPath, readFileSync(this.keyPath));
    logger.info({ backupPath }, 'Created backup of plaintext keyfile');

    // Save as encrypted
    await this.saveEncrypted(this.password);

    // Remove backup after successful encryption
    // (In production, you might want to keep it longer)
    // fs.unlinkSync(backupPath);

    logger.info('Upgrade complete: keyfile now encrypted');
  }

  /**
   * Save as plaintext (backward compatible)
   */
  private savePlaintext(): void {
    if (!this.keypair) {
      throw new DaemonError(ErrorCodes.KEY_NOT_FOUND, 'Keypair not initialized', 500);
    }

    writeFileSync(this.keyPath, bs58.encode(this.keypair.secretKey), { mode: 0o600 });
    chmodSync(this.keyPath, 0o600);
  }

  /**
   * Get public key (Base58 encoded)
   */
  getPublicKey(): string {
    if (!this.keypair) {
      throw new DaemonError(ErrorCodes.KEY_NOT_FOUND, 'Key not initialized', 404);
    }
    return bs58.encode(this.keypair.publicKey);
  }

  /**
   * Sign a message
   */
  sign(message: Uint8Array): Uint8Array {
    if (!this.keypair) {
      throw new DaemonError(ErrorCodes.KEY_NOT_FOUND, 'Key not initialized', 404);
    }
    return nacl.sign.detached(message, this.keypair.secretKey);
  }

  /**
   * Verify a signature
   */
  verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
    return nacl.sign.detached.verify(message, signature, publicKey);
  }

  /**
   * Lock the key manager (no-op for encrypted file)
   */
  async lock(): Promise<void> {
    // No-op: key is protected by password at rest
  }

  /**
   * Unlock the key manager (no-op for encrypted file)
   */
  async unlock(_credential?: string): Promise<void> {
    // No-op: password is supplied per-operation or at initialization
  }

  /**
   * Export encrypted keyfile (for backup)
   */
  async exportEncrypted(): Promise<Buffer> {
    if (!existsSync(this.keyPath)) {
      throw new DaemonError(ErrorCodes.KEY_NOT_FOUND, 'No keyfile to export', 404);
    }
    return readFileSync(this.keyPath);
  }

  /**
   * Import encrypted keyfile
   */
  async importEncrypted(data: Buffer, password: string): Promise<void> {
    this.keypair = this.decryptKeyfile(data, password);
    this.password = password;

    // Save to configured path
    await this.saveEncrypted(password);
    logger.info('Imported encrypted keyfile');
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.keypair !== null;
  }

  /**
   * Check if file is encrypted
   */
  static isEncryptedFile(filePath: string): boolean {
    if (!existsSync(filePath)) return false;
    const data = readFileSync(filePath);
    return data.length > 0 && data[0] === ENCRYPTION_VERSION;
  }
}

export default EncryptedFileKeyManager;
