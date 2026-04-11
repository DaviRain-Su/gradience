/**
 * Gateway Domain — placeholder stub
 *
 * Solana is the only core protocol chain. EVM gateway code has been
 * removed; this domain returns null services until a Solana gateway
 * is implemented.
 */

import { logger } from '../utils/logger.js';
import type { DaemonConfig } from '../config.js';
import type { ITransactionManager } from '../shared/transaction-manager.js';

export interface GatewayDomainServices {
    gateway: null;
    listener: null;
}

export function initGatewayDomain(
    _config: DaemonConfig,
    _dbPath: string,
    _transactionManager: ITransactionManager,
): GatewayDomainServices {
    logger.info('Gateway domain stubbed (Solana-only core protocol)');
    return { gateway: null, listener: null };
}

export async function stopGatewayDomain(_services: GatewayDomainServices): Promise<void> {
    // no-op
}
