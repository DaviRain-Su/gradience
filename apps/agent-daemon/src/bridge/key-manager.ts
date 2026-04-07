/**
 * Key Manager for Settlement Bridge
 * 
 * Handles secure storage and loading of evaluator keypairs.
 * Keys are encrypted at rest using AES-256-GCM with a password.
 * 
 * @module bridge/key-manager
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Keypair } from '@solana/web3.js';
import { createKeyPairSignerFromBytes } from '@solana/kit';
import type { KeyPairSigner } from '@solana/kit';
import nacl from 'tweetnacl';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface KeyManagerConfig {
  keyDir: string;
  keyName?: string;
}

export interface KeyInfo {
  publicKey: string;
  keyPath: string;
  createdAt: number;
  encrypted: boolean;
}

// ============================================================================
// Key Manager
// ============================================================================

export class KeyManager {
  private keyDir: string;
  private keyName: string;
  private keypair: Keypair | null = null;

  constructor(config: KeyManagerConfig) {
    this.keyDir = config.keyDir;
    this.keyName = config.keyName || 'evaluator';
  }

  /**
   * Get the key file path
   */
  get keyPath(): string {
    return path.join(this.keyDir, `${this.keyName}.key`);
  }

  /**
   * Check if key exists
   */
  keyExists(): boolean {
    return fs.existsSync(this.keyPath);
  }

  /**
   * Load or create evaluator keypair
   * If password is provided, key is encrypted at rest
   */
  async loadOrCreate(password?: string): Promise<Keypair> {
    if (this.keypair) {
      return this.keypair;
    }

    // Ensure key directory exists
    if (!fs.existsSync(this.keyDir)) {
      fs.mkdirSync(this.keyDir, { recursive: true, mode: 0o700 });
    }

    if (this.keyExists()) {
      this.keypair = await this.loadKey(password);
      logger.info({ publicKey: this.keypair.publicKey.toBase58() }, 'Loaded existing evaluator key');
    } else {
      this.keypair = await this.createKey(password);
      logger.info({ publicKey: this.keypair.publicKey.toBase58() }, 'Created new evaluator key');
    }

    return this.keypair;
  }

  /**
   * Load key from encrypted file
   */
  private async loadKey(password?: string): Promise<Keypair> {
    const data = fs.readFileSync(this.keyPath);
    
    // Check if file is encrypted (has salt prefix)
    if (data.length > 48 && password) {
      // Encrypted format: salt(16) + iv(16) + tag(16) + ciphertext
      const decrypted = this.decrypt(data, password);
      return Keypair.fromSecretKey(decrypted);
    } else if (data.length === 64) {
      // Raw secret key (not recommended for production)
      logger.warn('Loading unencrypted key - consider encrypting with password');
      return Keypair.fromSecretKey(data);
    } else if (data[0] === 0x5b || data[0] === 0x7b) {
      // JSON format (array or object)
      const json = JSON.parse(data.toString('utf-8'));
      const secretKey = Array.isArray(json) ? new Uint8Array(json) : new Uint8Array(json.secretKey);
      return Keypair.fromSecretKey(secretKey);
    } else {
      throw new Error('Invalid key file format or missing password');
    }
  }

  /**
   * Create and save new keypair
   */
  private async createKey(password?: string): Promise<Keypair> {
    const keypair = Keypair.generate();
    
    if (password) {
      const encrypted = this.encrypt(keypair.secretKey, password);
      fs.writeFileSync(this.keyPath, encrypted, { mode: 0o600 });
    } else {
      // Save raw (not recommended)
      logger.warn('Saving unencrypted key - consider using password');
      fs.writeFileSync(this.keyPath, Buffer.from(keypair.secretKey), { mode: 0o600 });
    }

    return keypair;
  }

  /**
   * Encrypt data with AES-256-GCM
   */
  private encrypt(data: Uint8Array, password: string): Buffer {
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(password, salt, 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(data)),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    // Format: salt(16) + iv(16) + tag(16) + ciphertext
    return Buffer.concat([salt, iv, tag, encrypted]);
  }

  /**
   * Decrypt data with AES-256-GCM
   */
  private decrypt(data: Buffer, password: string): Uint8Array {
    const salt = data.subarray(0, 16);
    const iv = data.subarray(16, 32);
    const tag = data.subarray(32, 48);
    const ciphertext = data.subarray(48);

    const key = crypto.scryptSync(password, salt, 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return new Uint8Array(decrypted);
  }

  /**
   * Get current keypair (must call loadOrCreate first)
   * @deprecated Use getSigner() for new @solana/kit code
   */
  getKeypair(): Keypair {
    if (!this.keypair) {
      throw new Error('Keypair not loaded - call loadOrCreate() first');
    }
    return this.keypair;
  }

  /**
   * Get a @solana/kit KeyPairSigner (must call loadOrCreate first)
   */
  async getSigner(): Promise<KeyPairSigner<string>> {
    if (!this.keypair) {
      throw new Error('Keypair not loaded - call loadOrCreate() first');
    }
    return createKeyPairSignerFromBytes(this.keypair.secretKey);
  }

  /**
   * Get public key as base58 string
   */
  getPublicKey(): string {
    return this.getKeypair().publicKey.toBase58();
  }

  /**
   * Sign a message with the evaluator key
   */
  sign(message: Uint8Array): Uint8Array {
    const keypair = this.getKeypair();
    return nacl.sign.detached(message, keypair.secretKey);
  }

  /**
   * Sign a hash (hex string) and return signature as hex
   */
  signHash(hash: string): string {
    const message = Buffer.from(hash, 'hex');
    const signature = this.sign(message);
    return Buffer.from(signature).toString('hex');
  }

  /**
   * Verify a signature
   */
  static verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
    return nacl.sign.detached.verify(message, signature, publicKey);
  }

  /**
   * Verify a signature using hex strings
   */
  static verifyHex(messageHex: string, signatureHex: string, publicKeyBase58: string): boolean {
    const { PublicKey } = require('@solana/web3.js');
    const message = Buffer.from(messageHex, 'hex');
    const signature = Buffer.from(signatureHex, 'hex');
    const publicKey = new PublicKey(publicKeyBase58).toBytes();
    return this.verify(message, signature, publicKey);
  }

  /**
   * Get key info
   */
  getInfo(): KeyInfo | null {
    if (!this.keyExists()) {
      return null;
    }

    const stats = fs.statSync(this.keyPath);
    const data = fs.readFileSync(this.keyPath);
    
    return {
      publicKey: this.keypair?.publicKey.toBase58() || 'unknown',
      keyPath: this.keyPath,
      createdAt: stats.birthtimeMs,
      encrypted: data.length > 64, // Encrypted keys are larger
    };
  }

  /**
   * Rotate key (create new keypair)
   */
  async rotateKey(password?: string): Promise<Keypair> {
    // Backup old key
    if (this.keyExists()) {
      const backupPath = `${this.keyPath}.${Date.now()}.bak`;
      fs.renameSync(this.keyPath, backupPath);
      logger.info({ backupPath }, 'Old key backed up');
    }

    this.keypair = null;
    return this.loadOrCreate(password);
  }

  /**
   * Export public key for registration
   */
  exportPublicKey(): { publicKey: string; publicKeyBytes: number[] } {
    const keypair = this.getKeypair();
    return {
      publicKey: keypair.publicKey.toBase58(),
      publicKeyBytes: Array.from(keypair.publicKey.toBytes()),
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

let defaultKeyManager: KeyManager | null = null;

export function getKeyManager(config?: KeyManagerConfig): KeyManager {
  if (!defaultKeyManager) {
    defaultKeyManager = new KeyManager(config || {
      keyDir: process.env.DAEMON_KEY_DIR || './keys',
      keyName: 'evaluator',
    });
  }
  return defaultKeyManager;
}

export async function initializeKeyManager(password?: string): Promise<KeyManager> {
  const keyManager = getKeyManager();
  const keyPassword = password || process.env.DAEMON_KEY_PASSWORD;
  await keyManager.loadOrCreate(keyPassword);
  return keyManager;
}
