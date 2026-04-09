/**
 * HD Wallet Key Derivation Utilities
 *
 * Provides BIP44 path derivation for Solana sub-wallets.
 *
 * @module @gradiences/ows-adapter
 */

/**
 * BIP44 coin type for Solana
 */
export const SOLANA_COIN_TYPE = 501;

/**
 * Derive a BIP44 path for Solana
 *
 * Standard Solana derivation path: m/44'/501'/{account}'/{change}'
 *
 * @param accountIndex - Account index (default: 0)
 * @param changeIndex - Change index (default: 0)
 * @returns BIP44 derivation path
 */
export function deriveSolanaPath(accountIndex: number = 0, changeIndex: number = 0): string {
    if (accountIndex < 0 || !Number.isInteger(accountIndex)) {
        throw new Error('accountIndex must be a non-negative integer');
    }
    if (changeIndex < 0 || !Number.isInteger(changeIndex)) {
        throw new Error('changeIndex must be a non-negative integer');
    }

    return `m/44'/${SOLANA_COIN_TYPE}'/${accountIndex}'/${changeIndex}'`;
}

/**
 * Parsed derivation path components
 */
export interface DerivedPath {
    purpose: number;
    coinType: number;
    account: number;
    change: number;
    path: string;
}

/**
 * Parse a BIP44 derivation path string
 *
 * @param path - Derivation path (e.g., "m/44'/501'/0'/0'")
 * @returns Parsed path components
 */
export function parseDerivationPath(path: string): DerivedPath {
    const match = path.match(/^m\/(\d+)'\/(\d+)'\/(\d+)'\/(\d+)'$/);
    if (!match) {
        throw new Error(`Invalid derivation path: ${path}`);
    }

    const [, purpose, coinType, account, change] = match.map(Number);

    return {
        purpose,
        coinType,
        account,
        change,
        path,
    };
}

/**
 * Sub-wallet derived from a master wallet
 */
export interface SubWallet {
    /** Derivation path */
    path: string;
    /** Public key (base58 for Solana) */
    publicKey: string;
    /** Account index */
    accountIndex: number;
    /** Change index */
    changeIndex: number;
}

/**
 * Derive a sub-wallet descriptor from a master public key and path.
 *
 * Note: This is a client-side descriptor. Actual key derivation requires
 * private key material and should be performed by the OWS wallet or
 * secure hardware.
 *
 * @param masterPublicKey - Master public key
 * @param accountIndex - Account index
 * @param changeIndex - Change index
 * @returns Sub-wallet descriptor
 */
export function deriveSubWallet(masterPublicKey: string, accountIndex: number = 0, changeIndex: number = 0): SubWallet {
    if (!masterPublicKey || typeof masterPublicKey !== 'string') {
        throw new Error('masterPublicKey is required');
    }

    const path = deriveSolanaPath(accountIndex, changeIndex);

    // In a real implementation, this would use ed25519 derivation.
    // Here we create a deterministic placeholder public key for the sub-wallet.
    const publicKey = derivePlaceholderPublicKey(masterPublicKey, path);

    return {
        path,
        publicKey,
        accountIndex,
        changeIndex,
    };
}

/**
 * Derive multiple sub-wallets in a batch
 *
 * @param masterPublicKey - Master public key
 * @param count - Number of sub-wallets to derive
 * @param startIndex - Starting account index
 * @returns Array of sub-wallet descriptors
 */
export function deriveSubWallets(masterPublicKey: string, count: number, startIndex: number = 0): SubWallet[] {
    if (count < 1 || !Number.isInteger(count)) {
        throw new Error('count must be a positive integer');
    }
    if (startIndex < 0 || !Number.isInteger(startIndex)) {
        throw new Error('startIndex must be a non-negative integer');
    }

    const wallets: SubWallet[] = [];
    for (let i = 0; i < count; i++) {
        wallets.push(deriveSubWallet(masterPublicKey, startIndex + i, 0));
    }
    return wallets;
}

/**
 * Generate a deterministic placeholder public key for a derived path.
 * @private
 */
function derivePlaceholderPublicKey(masterPublicKey: string, path: string): string {
    const input = `${masterPublicKey}:${path}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash + char) | 0;
    }
    const seed = Math.abs(hash).toString(16).padStart(8, '0');
    return seed + masterPublicKey.slice(seed.length);
}
