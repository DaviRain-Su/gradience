/**
 * Unified Key Manager
 *
 * Combines Phase 1 (EncryptedFile) and Phase 2 (OS Keychain)
 * with automatic strategy selection and fallback support.
 *
 * Usage:
 *   const manager = new UnifiedKeyManager({
 *     strategy: 'auto',  // or 'os-keychain' | 'encrypted-file'
 *     osKeychain: { service: 'gradience', account: 'agent-key' },
 *     encryptedFile: { keyPath: './backup', password: 'secret' }
 *   });
 *   await manager.initialize();
 */

import { DaemonError, ErrorCodes } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { EncryptedFileKeyManager, EncryptedKeyManagerConfig } from './encrypted-file-key-manager.js';
import { OSKeychainManager, OSKeychainConfig } from './os-keychain-manager.js';

export type StorageStrategy = 'auto' | 'os-keychain' | 'encrypted-file' | 'plain-file';

export interface UnifiedKeyManagerConfig {
    strategy: StorageStrategy;
    osKeychain?: OSKeychainConfig;
    encryptedFile?: EncryptedKeyManagerConfig;
}

// Internal interface for strategy implementations
interface IKeyManagerStrategy {
    initialize(): Promise<void>;
    isInitialized(): boolean;
    getPublicKey(): string;
    sign(message: Uint8Array): Uint8Array;
    verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean;
    lock(): Promise<void>;
    unlock(credential?: string): Promise<void>;
    exportEncrypted(): Promise<Buffer>;
    importEncrypted(data: Buffer, password: string): Promise<void>;
}

export class UnifiedKeyManager implements IKeyManagerStrategy {
    private strategy: IKeyManagerStrategy;
    private config: UnifiedKeyManagerConfig;
    private strategyName: string;

    constructor(config: UnifiedKeyManagerConfig) {
        this.config = config;
        const { strategy, name } = this.selectStrategy();
        this.strategy = strategy;
        this.strategyName = name;
    }

    /**
     * Select the appropriate strategy based on config
     */
    private selectStrategy(): { strategy: IKeyManagerStrategy; name: string } {
        switch (this.config.strategy) {
            case 'os-keychain':
                if (!this.config.osKeychain) {
                    throw new Error('OS Keychain config required when strategy is "os-keychain"');
                }
                return {
                    strategy: new OSKeychainManager(this.config.osKeychain),
                    name: 'os-keychain',
                };

            case 'encrypted-file':
                if (!this.config.encryptedFile) {
                    throw new Error('Encrypted file config required when strategy is "encrypted-file"');
                }
                return {
                    strategy: new EncryptedFileKeyManager(this.config.encryptedFile),
                    name: 'encrypted-file',
                };

            case 'plain-file':
                // For backward compatibility - simple file without encryption
                if (!this.config.encryptedFile) {
                    throw new Error('File config required when strategy is "plain-file"');
                }
                return {
                    strategy: new EncryptedFileKeyManager({
                        ...this.config.encryptedFile,
                        password: undefined, // No password = plaintext
                    }),
                    name: 'plain-file',
                };

            case 'auto':
            default:
                return this.createAutoStrategy();
        }
    }

    /**
     * Create auto strategy with fallback chain:
     * OS Keychain → Encrypted File → Plain File
     */
    private createAutoStrategy(): { strategy: IKeyManagerStrategy; name: string } {
        // Prefer OS Keychain if configured
        if (this.config.osKeychain) {
            // Enable fallback to encrypted file
            const configWithFallback: OSKeychainConfig = {
                ...this.config.osKeychain,
                service: this.config.osKeychain.service || 'gradience', // Use concise service name
                biometric: this.config.osKeychain.biometric !== false, // Default: true
                fallback: this.config.encryptedFile
                    ? {
                          enabled: true,
                          encryptedFileConfig: this.config.encryptedFile,
                      }
                    : undefined,
            };

            return {
                strategy: new OSKeychainManager(configWithFallback),
                name: 'auto(os-keychain)',
            };
        }

        // Fall back to encrypted file
        if (this.config.encryptedFile) {
            return {
                strategy: new EncryptedFileKeyManager(this.config.encryptedFile),
                name: 'auto(encrypted-file)',
            };
        }

        throw new Error('No valid storage backend configured for auto strategy');
    }

    /**
     * Initialize the selected strategy
     */
    async initialize(): Promise<void> {
        logger.info({ strategy: this.strategyName }, 'Initializing UnifiedKeyManager');
        await this.strategy.initialize();
        logger.info({ strategy: this.strategyName }, 'UnifiedKeyManager initialized');
    }

    /**
     * Check if initialized
     */
    isInitialized(): boolean {
        return this.strategy.isInitialized();
    }

    /**
     * Get current strategy name
     */
    getStrategyName(): string {
        return this.strategyName;
    }

    /**
     * Get public key (Base58 encoded)
     */
    getPublicKey(): string {
        return this.strategy.getPublicKey();
    }

    /**
     * Sign a message
     */
    sign(message: Uint8Array): Uint8Array {
        return this.strategy.sign(message);
    }

    /**
     * Verify a signature
     */
    verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
        return this.strategy.verify(message, signature, publicKey);
    }

    /**
     * Lock the key (clear from memory)
     */
    lock(): Promise<void> {
        return this.strategy.lock();
    }

    /**
     * Unlock the key
     */
    unlock(credential?: string): Promise<void> {
        return this.strategy.unlock(credential);
    }

    /**
     * Export encrypted key (for backup)
     */
    exportEncrypted(): Promise<Buffer> {
        return this.strategy.exportEncrypted();
    }

    /**
     * Import encrypted key
     */
    importEncrypted(data: Buffer, password: string): Promise<void> {
        return this.strategy.importEncrypted(data, password);
    }
}

export default UnifiedKeyManager;
