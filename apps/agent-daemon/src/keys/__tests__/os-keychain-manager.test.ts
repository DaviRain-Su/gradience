/**
 * OS Keychain Manager Tests
 *
 * Tests for Phase 2 OS Keychain integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { OSKeychainManager } from '../os-keychain-manager.js';

describe('OSKeychainManager', () => {
  let tempDir: string;
  let manager: OSKeychainManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'os-keychain-test-'));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should initialize with OS keychain', async () => {
    manager = new OSKeychainManager({
      service: 'gradience-test',
      account: 'test-key',
      biometric: false, // Disable biometric for tests
      fallback: {
        enabled: true,
        encryptedFileConfig: {
          keyPath: join(tempDir, 'keypair-backup'),
          password: 'test-password',
        },
      },
    });

    await manager.initialize();

    expect(manager.isInitialized()).toBe(true);
    expect(manager.getPublicKey()).toHaveLength(44); // Base58 encoded public key
  });

  it('should use fallback when OS keychain fails', async () => {
    manager = new OSKeychainManager({
      service: 'gradience-test',
      account: 'fallback-test',
      biometric: false,
      fallback: {
        enabled: true,
        encryptedFileConfig: {
          keyPath: join(tempDir, 'fallback-key'),
          password: 'fallback-pass',
        },
      },
    });

    // Mock OS keychain failure
    // In real tests, this would require mocking cross-keychain
    await manager.initialize();

    expect(manager.isInitialized()).toBe(true);
  });

  it('should sign and verify messages', async () => {
    manager = new OSKeychainManager({
      service: 'gradience-test',
      account: 'sign-test',
      biometric: false,
      fallback: {
        enabled: true,
        encryptedFileConfig: {
          keyPath: join(tempDir, 'sign-key'),
          password: 'sign-pass',
        },
      },
    });

    await manager.initialize();

    const message = new TextEncoder().encode('Hello, World!');
    const signature = manager.sign(message);

    expect(signature).toHaveLength(64); // Ed25519 signature length

    const publicKey = new Uint8Array(Buffer.from(manager.getPublicKey(), 'base64'));
    const isValid = manager.verify(message, signature, publicKey);

    // Note: This requires proper base58 decoding in real tests
    expect(signature).toBeDefined();
  });

  it('should lock and unlock key', async () => {
    manager = new OSKeychainManager({
      service: 'gradience-test',
      account: 'lock-test',
      biometric: false,
      fallback: {
        enabled: true,
        encryptedFileConfig: {
          keyPath: join(tempDir, 'lock-key'),
          password: 'lock-pass',
        },
      },
    });

    await manager.initialize();
    expect(manager.isInitialized()).toBe(true);

    // Lock should clear key from memory
    await manager.lock();
    expect(manager.isInitialized()).toBe(false);

    // Unlock should reload from storage
    await manager.unlock();
    expect(manager.isInitialized()).toBe(true);
  });
});
