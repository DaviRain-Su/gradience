import { join } from 'node:path';
import type Database from 'better-sqlite3';
import type { DaemonConfig } from '../config.js';
import { FileKeyManager } from '../keys/key-manager.js';
import { AuthorizationManager } from '../wallet/authorization.js';
import { OWSWalletManager } from '../wallet/ows-wallet-manager.js';
import { logger } from '../utils/logger.js';

export interface IdentityDomainServices {
    keyManager: FileKeyManager;
    authorizationManager: AuthorizationManager;
    owsWalletManager: OWSWalletManager;
}

export async function initIdentityDomain(
    _config: DaemonConfig,
    dataDir: string,
    db: Database.Database,
): Promise<IdentityDomainServices> {
    const keyManager = new FileKeyManager(join(dataDir, 'keypair'));
    await keyManager.initialize();
    logger.info({ publicKey: keyManager.getPublicKey() }, 'KeyManager initialized');

    const authorizationManager = new AuthorizationManager(db, keyManager.getPublicKey());
    logger.info(
        {
            authorized: authorizationManager.authorized,
            masterWallet: authorizationManager.masterWallet,
        },
        'AuthorizationManager initialized',
    );

    const owsWalletManager = new OWSWalletManager(db);
    logger.info('OWSWalletManager initialized');

    return { keyManager, authorizationManager, owsWalletManager };
}

export async function stopIdentityDomain(_services: IdentityDomainServices): Promise<void> {
    // Identity domain has no async cleanup
}
