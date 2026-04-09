import { deriveSolanaPath, parseDerivationPath, deriveSubWallet, deriveSubWallets, SOLANA_COIN_TYPE } from './derive';

describe('deriveSolanaPath', () => {
    it('should return default path for account 0, change 0', () => {
        expect(deriveSolanaPath()).toBe(`m/44'/${SOLANA_COIN_TYPE}'/0'/0'`);
    });

    it('should return path with custom account index', () => {
        expect(deriveSolanaPath(5)).toBe(`m/44'/${SOLANA_COIN_TYPE}'/5'/0'`);
    });

    it('should return path with custom account and change index', () => {
        expect(deriveSolanaPath(3, 1)).toBe(`m/44'/${SOLANA_COIN_TYPE}'/3'/1'`);
    });

    it('should throw for negative account index', () => {
        expect(() => deriveSolanaPath(-1)).toThrow('accountIndex must be a non-negative integer');
    });

    it('should throw for non-integer account index', () => {
        expect(() => deriveSolanaPath(1.5)).toThrow('accountIndex must be a non-negative integer');
    });

    it('should throw for negative change index', () => {
        expect(() => deriveSolanaPath(0, -1)).toThrow('changeIndex must be a non-negative integer');
    });
});

describe('parseDerivationPath', () => {
    it('should parse a valid path', () => {
        const path = `m/44'/${SOLANA_COIN_TYPE}'/2'/1'`;
        const parsed = parseDerivationPath(path);
        expect(parsed).toEqual({
            purpose: 44,
            coinType: SOLANA_COIN_TYPE,
            account: 2,
            change: 1,
            path,
        });
    });

    it('should throw for invalid path format', () => {
        expect(() => parseDerivationPath('invalid')).toThrow('Invalid derivation path');
    });

    it('should throw for path missing hardened indices', () => {
        expect(() => parseDerivationPath(`m/44/${SOLANA_COIN_TYPE}/0/0`)).toThrow('Invalid derivation path');
    });
});

describe('deriveSubWallet', () => {
    it('should derive a sub-wallet with default indices', () => {
        const masterPublicKey = 'abc123';
        const sub = deriveSubWallet(masterPublicKey);

        expect(sub.path).toBe(`m/44'/${SOLANA_COIN_TYPE}'/0'/0'`);
        expect(sub.accountIndex).toBe(0);
        expect(sub.changeIndex).toBe(0);
        expect(sub.publicKey).toBeDefined();
        expect(sub.publicKey.length).toBeGreaterThan(0);
    });

    it('should derive a sub-wallet with custom indices', () => {
        const masterPublicKey = 'abc123';
        const sub = deriveSubWallet(masterPublicKey, 5, 1);

        expect(sub.path).toBe(`m/44'/${SOLANA_COIN_TYPE}'/5'/1'`);
        expect(sub.accountIndex).toBe(5);
        expect(sub.changeIndex).toBe(1);
    });

    it('should generate deterministic public keys for same inputs', () => {
        const masterPublicKey = 'abc123';
        const sub1 = deriveSubWallet(masterPublicKey, 1, 0);
        const sub2 = deriveSubWallet(masterPublicKey, 1, 0);

        expect(sub1.publicKey).toBe(sub2.publicKey);
    });

    it('should generate different public keys for different paths', () => {
        const masterPublicKey = 'abc123';
        const sub1 = deriveSubWallet(masterPublicKey, 1, 0);
        const sub2 = deriveSubWallet(masterPublicKey, 2, 0);

        expect(sub1.publicKey).not.toBe(sub2.publicKey);
    });

    it('should throw for empty master public key', () => {
        expect(() => deriveSubWallet('')).toThrow('masterPublicKey is required');
    });
});

describe('deriveSubWallets', () => {
    it('should derive multiple sub-wallets', () => {
        const masterPublicKey = 'abc123';
        const wallets = deriveSubWallets(masterPublicKey, 3);

        expect(wallets).toHaveLength(3);
        wallets.forEach((wallet, index) => {
            expect(wallet.accountIndex).toBe(index);
            expect(wallet.changeIndex).toBe(0);
            expect(wallet.path).toBe(`m/44'/${SOLANA_COIN_TYPE}'/${index}'/0'`);
        });
    });

    it('should start from custom index', () => {
        const masterPublicKey = 'abc123';
        const wallets = deriveSubWallets(masterPublicKey, 2, 10);

        expect(wallets[0].accountIndex).toBe(10);
        expect(wallets[1].accountIndex).toBe(11);
    });

    it('should throw for count less than 1', () => {
        expect(() => deriveSubWallets('abc', 0)).toThrow('count must be a positive integer');
    });

    it('should throw for negative start index', () => {
        expect(() => deriveSubWallets('abc', 1, -1)).toThrow('startIndex must be a non-negative integer');
    });
});
