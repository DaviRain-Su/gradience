/**
 * Keys module - Unified key management exports
 *
 * Provides multiple key manager implementations:
 * - FileKeyManager: Plaintext file storage (backward compatible)
 * - EncryptedFileKeyManager: Password-encrypted storage (Phase 1)
 * - OSKeychainManager: OS native keychain storage (Phase 2)
 * - UnifiedKeyManager: Auto-selects best strategy with fallback (Recommended)
 */

// Phase 1: Encrypted File
export { EncryptedFileKeyManager, type EncryptedKeyManagerConfig } from './encrypted-file-key-manager.js';

// Phase 2: OS Keychain
export { OSKeychainManager, type OSKeychainConfig } from './os-keychain-manager.js';

// Unified: Auto strategy selection
export { UnifiedKeyManager, type UnifiedKeyManagerConfig, type StorageStrategy } from './unified-key-manager.js';

// Legacy: Plaintext file (backward compatible)
export { FileKeyManager, type KeyManager } from './key-manager.js';

// Utilities
export * as CryptoUtils from './crypto.js';

// Re-export unified interface as default
export { UnifiedKeyManager as default } from './unified-key-manager.js';
