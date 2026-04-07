/**
 * OpenWallet Manager - Phase 3 Implementation
 *
 * Integrates with external Solana wallets via OpenWallet standard.
 * Supports: Phantom, Solflare, Backpack, and other compatible wallets.
 */

import { DaemonError, ErrorCodes } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import * as bs58 from 'bs58';

// Wallet detection and connection types
export interface WalletAdapter {
  name: string;
  icon?: string;
  readyState: 'Installed' | 'Loadable' | 'NotDetected' | 'Unsupported';
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
  signTransaction(transaction: unknown): Promise<unknown>;
  publicKey: { toString(): string } | null;
  connected: boolean;
}

export interface OpenWalletConfig {
  // Wallet selection
  preferredWallets?: string[];  // e.g., ['Phantom', 'Solflare']
  autoConnect?: boolean;        // Auto-connect on initialize

  // Connection settings
  appIdentity?: {
    name: string;
    icon?: string;
    uri?: string;
  };

  // Fallback
  fallback?: {
    enabled: boolean;
    // Fallback to Phase 1/2 manager
    localManager?: unknown;
  };
}

export class OpenWalletManager {
  private config: Required<OpenWalletConfig>;
  private adapter: WalletAdapter | null = null;
  private availableWallets: WalletAdapter[] = [];
  private useFallback: boolean = false;

  constructor(config: OpenWalletConfig = {}) {
    this.config = {
      preferredWallets: config.preferredWallets || ['Phantom', 'Solflare', 'Backpack'],
      autoConnect: config.autoConnect !== false, // Default: true
      appIdentity: {
        name: config.appIdentity?.name || 'Gradience Protocol',
        icon: config.appIdentity?.icon,
        uri: config.appIdentity?.uri || 'https://gradience.io',
      },
      fallback: {
        enabled: config.fallback?.enabled !== false,
        localManager: config.fallback?.localManager,
      },
    };
  }

  /**
   * Initialize OpenWallet manager
   * 1. Detect available wallets
   * 2. Connect to preferred wallet
   * 3. Fall back to local manager if needed
   */
  async initialize(): Promise<void> {
    logger.info({ preferred: this.config.preferredWallets }, 'Initializing OpenWallet manager');

    // Detect available wallets
    this.availableWallets = await this.detectWallets();

    if (this.availableWallets.length === 0) {
      logger.warn('No compatible wallets detected');

      if (this.config.fallback.enabled && this.config.fallback.localManager) {
        this.useFallback = true;
        logger.info('Using fallback local key manager');
        return;
      }

      throw new DaemonError(
        ErrorCodes.WALLET_NOT_FOUND,
        'No compatible wallet found. Please install Phantom, Solflare, or Backpack.',
        404
      );
    }

    logger.info({ wallets: this.availableWallets.map(w => w.name) }, 'Detected wallets');

    // Auto-connect if enabled
    if (this.config.autoConnect) {
      await this.connect();
    }
  }

  /**
   * Detect available wallets in the environment
   * This would integrate with @open-wallet-standard/core
   */
  private async detectWallets(): Promise<WalletAdapter[]> {
    const wallets: WalletAdapter[] = [];

    // Check for Phantom
    if (this.isPhantomAvailable()) {
      wallets.push(this.createPhantomAdapter());
    }

    // Check for Solflare
    if (this.isSolflareAvailable()) {
      wallets.push(this.createSolflareAdapter());
    }

    // Check for Backpack
    if (this.isBackpackAvailable()) {
      wallets.push(this.createBackpackAdapter());
    }

    // Sort by preference
    return this.sortWalletsByPreference(wallets);
  }

  /**
   * Check if Phantom wallet is available
   */
  private isPhantomAvailable(): boolean {
    // Check global window object for Phantom
    return typeof globalThis !== 'undefined' &&
           (globalThis as any).phantom?.solana?.isPhantom === true;
  }

  /**
   * Check if Solflare wallet is available
   */
  private isSolflareAvailable(): boolean {
    return typeof globalThis !== 'undefined' &&
           (globalThis as any).solflare?.isSolflare === true;
  }

  /**
   * Check if Backpack wallet is available
   */
  private isBackpackAvailable(): boolean {
    return typeof globalThis !== 'undefined' &&
           (globalThis as any).backpack?.isBackpack === true;
  }

  /**
   * Create Phantom wallet adapter
   */
  private createPhantomAdapter(): WalletAdapter {
    const phantom = (globalThis as any).phantom.solana;

    return {
      name: 'Phantom',
      icon: 'https://phantom.app/favicon.ico',
      readyState: phantom.isConnected ? 'Installed' : 'Loadable',
      publicKey: phantom.publicKey,
      connected: phantom.isConnected,

      async connect(): Promise<void> {
        await phantom.connect();
      },

      async disconnect(): Promise<void> {
        await phantom.disconnect();
      },

      async signMessage(message: Uint8Array): Promise<Uint8Array> {
        const signature = await phantom.signMessage(message);
        return new Uint8Array(signature.signature);
      },

      async signTransaction(transaction: unknown): Promise<unknown> {
        return await phantom.signTransaction(transaction);
      },
    };
  }

  /**
   * Create Solflare wallet adapter
   */
  private createSolflareAdapter(): WalletAdapter {
    const solflare = (globalThis as any).solflare;

    return {
      name: 'Solflare',
      icon: 'https://solflare.com/favicon.ico',
      readyState: solflare.isConnected ? 'Installed' : 'Loadable',
      publicKey: solflare.publicKey,
      connected: solflare.isConnected,

      async connect(): Promise<void> {
        await solflare.connect();
      },

      async disconnect(): Promise<void> {
        await solflare.disconnect();
      },

      async signMessage(message: Uint8Array): Promise<Uint8Array> {
        const signature = await solflare.signMessage(message);
        return new Uint8Array(signature);
      },

      async signTransaction(transaction: unknown): Promise<unknown> {
        return await solflare.signTransaction(transaction);
      },
    };
  }

  /**
   * Create Backpack wallet adapter
   */
  private createBackpackAdapter(): WalletAdapter {
    const backpack = (globalThis as any).backpack;

    return {
      name: 'Backpack',
      icon: 'https://backpack.app/favicon.ico',
      readyState: backpack.isConnected ? 'Installed' : 'Loadable',
      publicKey: backpack.publicKey,
      connected: backpack.isConnected,

      async connect(): Promise<void> {
        await backpack.connect();
      },

      async disconnect(): Promise<void> {
        await backpack.disconnect();
      },

      async signMessage(message: Uint8Array): Promise<Uint8Array> {
        const signature = await backpack.signMessage(message);
        return new Uint8Array(signature);
      },

      async signTransaction(transaction: unknown): Promise<unknown> {
        return await backpack.signTransaction(transaction);
      },
    };
  }

  /**
   * Sort wallets by user preference
   */
  private sortWalletsByPreference(wallets: WalletAdapter[]): WalletAdapter[] {
    return wallets.sort((a, b) => {
      const aIndex = this.config.preferredWallets.indexOf(a.name);
      const bIndex = this.config.preferredWallets.indexOf(b.name);
      return aIndex - bIndex;
    });
  }

  /**
   * Connect to a wallet
   */
  async connect(walletName?: string): Promise<void> {
    if (this.useFallback) {
      logger.info('Using fallback, no external wallet connection needed');
      return;
    }

    // Select wallet
    let wallet: WalletAdapter;

    if (walletName) {
      wallet = this.availableWallets.find(w => w.name === walletName)!;
      if (!wallet) {
        throw new DaemonError(
          ErrorCodes.WALLET_NOT_FOUND,
          `Wallet ${walletName} not found`,
          404
        );
      }
    } else {
      // Use first available (highest preference)
      wallet = this.availableWallets[0];
    }

    // Connect
    try {
      await wallet.connect();
      this.adapter = wallet;
      logger.info({ wallet: wallet.name }, 'Connected to wallet');
    } catch (err) {
      throw new DaemonError(
        ErrorCodes.WALLET_CONNECTION_FAILED,
        `Failed to connect to ${wallet.name}: ${err}`,
        500
      );
    }
  }

  /**
   * Disconnect from wallet
   */
  async disconnect(): Promise<void> {
    if (this.adapter) {
      await this.adapter.disconnect();
      this.adapter = null;
      logger.info('Disconnected from wallet');
    }
  }

  // Public API

  getPublicKey(): string {
    if (this.useFallback) {
      // Delegate to fallback manager
      return '';
    }

    if (!this.adapter?.publicKey) {
      throw new DaemonError(ErrorCodes.WALLET_NOT_CONNECTED, 'Wallet not connected', 401);
    }

    return this.adapter.publicKey.toString();
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    if (this.useFallback) {
      // Delegate to fallback manager
      throw new Error('Fallback signing not implemented in this stub');
    }

    if (!this.adapter) {
      throw new DaemonError(ErrorCodes.WALLET_NOT_CONNECTED, 'Wallet not connected', 401);
    }

    return await this.adapter.signMessage(message);
  }

  verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
    // For external wallets, verification happens on-chain
    // We can still do local verification
    const nacl = require('tweetnacl');
    return nacl.sign.detached.verify(message, signature, publicKey);
  }

  isInitialized(): boolean {
    return this.adapter !== null || this.useFallback;
  }

  isConnected(): boolean {
    return this.adapter?.connected ?? false;
  }

  getAvailableWallets(): string[] {
    return this.availableWallets.map(w => w.name);
  }

  getConnectedWallet(): string | null {
    return this.adapter?.name ?? null;
  }

  // Fallback methods

  isUsingFallback(): boolean {
    return this.useFallback;
  }

  async lock(): Promise<void> {
    await this.disconnect();
  }

  async unlock(): Promise<void> {
    await this.connect();
  }
}

export default OpenWalletManager;
