import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  AccountBindingStore,
  VerificationTierResolver,
  createAccountBindingStore,
  createVerificationTierResolver,
  COOLDOWN_MS,
  type UserMetrics,
} from '../../src/identity/account-binding.js';

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AccountBindingStore', () => {
  let db: Database.Database;
  let store: AccountBindingStore;

  beforeEach(() => {
    db = new Database(':memory:');
    store = createAccountBindingStore(db);
  });

  it('should bind a new account', () => {
    const record = store.bind({
      accountId: 'acc-1',
      primaryWallet: '0xAbC',
      oauthHash: 'sha256-google-1',
      signature: 'sig-1',
    });

    expect(record.accountId).toBe('acc-1');
    expect(record.primaryWallet).toBe('0xabc');
    expect(record.oauthHash).toBe('sha256-google-1');
  });

  it('should retrieve by wallet or oauth hash', () => {
    store.bind({
      accountId: 'acc-2',
      primaryWallet: '0xDeF',
      oauthHash: 'sha256-google-2',
      signature: 'sig-2',
    });

    expect(store.getByWallet('0xDeF')?.accountId).toBe('acc-2');
    expect(store.getByOAuthHash('sha256-google-2')?.accountId).toBe('acc-2');
  });

  it('should detect bound wallet and oauth', () => {
    store.bind({
      accountId: 'acc-3',
      primaryWallet: '0x111',
      oauthHash: 'sha256-google-3',
      signature: 'sig-3',
    });

    expect(store.isBound('0x111')).toBe(true);
    expect(store.isBound(undefined, 'sha256-google-3')).toBe(true);
    expect(store.isBound('0x999')).toBe(false);
  });

  it('should store and retrieve ZK nullifier', () => {
    store.bind({
      accountId: 'acc-4',
      primaryWallet: '0x222',
      signature: 'sig-4',
    });

    store.setZkNullifier('acc-4', 'nullifier-abc');
    const record = store.getByZkNullifier('nullifier-abc');
    expect(record?.accountId).toBe('acc-4');
  });

  it('should reject wallet change within cooldown', () => {
    store.bind({
      accountId: 'acc-5',
      primaryWallet: '0x333',
      signature: 'sig-5',
    });

    expect(() => store.changePrimaryWallet('acc-5', '0x444')).toThrow('cooldown');
  });

  it('should allow wallet change after cooldown', () => {
    store.bind({
      accountId: 'acc-6',
      primaryWallet: '0x555',
      signature: 'sig-6',
    });

    // Simulate cooldown passed by directly mutating (test-only shortcut)
    db.prepare('UPDATE account_bindings SET last_wallet_change_at = ? WHERE account_id = ?').run(
      Date.now() - COOLDOWN_MS - 1000,
      'acc-6'
    );

    const updated = store.changePrimaryWallet('acc-6', '0x666');
    expect(updated.primaryWallet).toBe('0x666');
  });

  it('should reject wallet already bound to another account', () => {
    store.bind({
      accountId: 'acc-7a',
      primaryWallet: '0x777',
      signature: 'sig-7a',
    });
    store.bind({
      accountId: 'acc-7b',
      primaryWallet: '0x888',
      signature: 'sig-7b',
    });

    db.prepare('UPDATE account_bindings SET last_wallet_change_at = ? WHERE account_id = ?').run(
      Date.now() - COOLDOWN_MS - 1000,
      'acc-7b'
    );

    expect(() => store.changePrimaryWallet('acc-7b', '0x777')).toThrow(
      'Wallet already bound to another account'
    );
  });
});

describe('VerificationTierResolver', () => {
  let resolver: VerificationTierResolver;

  beforeEach(() => {
    resolver = createVerificationTierResolver();
  });

  it('should resolve guest for empty metrics', () => {
    const tier = resolver.resolve({
      walletAgeDays: 0,
      oauthBound: false,
      zkKycBound: false,
      completedTasks: 0,
      reputationScore: 0,
    });
    expect(tier.tier).toBe('guest');
  });

  it('should resolve verified with OAuth', () => {
    const tier = resolver.resolve({
      walletAgeDays: 10,
      oauthBound: true,
      zkKycBound: false,
      completedTasks: 0,
      reputationScore: 0,
    });
    expect(tier.tier).toBe('verified');
  });

  it('should resolve trusted with completed tasks', () => {
    const tier = resolver.resolve({
      walletAgeDays: 20,
      oauthBound: true,
      zkKycBound: false,
      completedTasks: 5,
      reputationScore: 70,
    });
    expect(tier.tier).toBe('trusted');
  });

  it('should resolve pro with ZK-KYC', () => {
    const tier = resolver.resolve({
      walletAgeDays: 35,
      oauthBound: true,
      zkKycBound: true,
      completedTasks: 12,
      reputationScore: 80,
    });
    expect(tier.tier).toBe('pro');
  });

  it('should enforce task posting permissions', () => {
    const verified: UserMetrics = {
      walletAgeDays: 10,
      oauthBound: true,
      zkKycBound: false,
      completedTasks: 0,
      reputationScore: 0,
    };

    expect(resolver.canPostTask(verified, BigInt(0.5e18))).toBe(true);
    expect(resolver.canPostTask(verified, BigInt(2e18))).toBe(true); // verified can post high value
  });

  it('should enforce judge permission', () => {
    const verified: UserMetrics = {
      walletAgeDays: 10,
      oauthBound: true,
      zkKycBound: false,
      completedTasks: 0,
      reputationScore: 0,
    };
    const trusted: UserMetrics = {
      walletAgeDays: 20,
      oauthBound: true,
      zkKycBound: false,
      completedTasks: 5,
      reputationScore: 70,
    };

    expect(resolver.canApplyAsJudge(verified)).toBe(false);
    expect(resolver.canApplyAsJudge(trusted)).toBe(true);
  });
});
