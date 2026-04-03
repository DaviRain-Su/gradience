import { DomainResolver } from '../resolver';
import { SNSProvider } from '../providers/sns';
import { ENSProvider } from '../providers/ens';
import { DomainResolverError, ValidationError, ProviderError } from '../types';

// Mock the @bonfida/spl-name-service module
jest.mock('@bonfida/spl-name-service', () => ({
  getDomainKey: jest.fn(),
  NameRegistryState: {
    retrieve: jest.fn(),
  },
  reverseLookup: jest.fn(),
}));

// Mock the @solana/web3.js module
jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn().mockImplementation(() => ({
    // Mock connection methods as needed
  })),
  PublicKey: jest.fn().mockImplementation((key) => ({
    toBase58: () => key,
    toString: () => key,
  })),
}));

import { getDomainKey, NameRegistryState, reverseLookup } from '@bonfida/spl-name-service';
import { PublicKey } from '@solana/web3.js';

const mockGetDomainKey = getDomainKey as jest.MockedFunction<typeof getDomainKey>;
const mockNameRegistryState = NameRegistryState.retrieve as jest.MockedFunction<typeof NameRegistryState.retrieve>;
const mockReverseLookup = reverseLookup as jest.MockedFunction<typeof reverseLookup>;

describe('DomainResolver', () => {
  let resolver: DomainResolver;

  beforeEach(() => {
    resolver = new DomainResolver();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create resolver with default config', () => {
      expect(resolver).toBeInstanceOf(DomainResolver);
      expect(resolver.getSupportedDomains()).toContain('.sol');
      expect(resolver.getSupportedDomains()).toContain('.eth');
    });

    it('should create resolver with custom config', () => {
      const customResolver = new DomainResolver({
        cache: {
          maxSize: 500,
          ttl: 10 * 60 * 1000, // 10 minutes
        },
      });
      
      expect(customResolver.getCacheStats().maxSize).toBe(500);
      expect(customResolver.getCacheStats().defaultTTL).toBe(10 * 60 * 1000);
    });
  });

  describe('isValid', () => {
    it('should validate .sol domains', () => {
      expect(resolver.isValid('alice.sol')).toBe(true);
      expect(resolver.isValid('test-domain.sol')).toBe(true);
      expect(resolver.isValid('123.sol')).toBe(true);
    });

    it('should validate .eth domains', () => {
      expect(resolver.isValid('alice.eth')).toBe(true);
      expect(resolver.isValid('test-domain.eth')).toBe(true);
    });

    it('should reject invalid domains', () => {
      expect(resolver.isValid('')).toBe(false);
      expect(resolver.isValid('nodot')).toBe(false);
      expect(resolver.isValid('invalid.xyz')).toBe(false);
      expect(resolver.isValid('alice')).toBe(false);
    });
  });

  describe('resolve', () => {
    it('should resolve .sol domain successfully', async () => {
      const mockAddress = 'AhKx7YmNZPXR8Fy4MFz5EsjvdgfVUQcQW4w1TrL9G2Ly';
      
      // Mock getDomainKey
      mockGetDomainKey.mockResolvedValue({
        pubkey: new PublicKey('mock-pubkey'),
        isSub: false,
        parent: undefined,
        hashed: Buffer.from('mock-hash'),
      } as any);
      
      // Mock NameRegistryState.retrieve
      mockNameRegistryState.mockResolvedValue({
        owner: new PublicKey(mockAddress),
        data: Buffer.from(''),
        parentName: new PublicKey('mock-parent'),
        class: new PublicKey('mock-class'),
      } as any);

      const result = await resolver.resolve('alice.sol');
      expect(result).toBe(mockAddress);
      expect(mockGetDomainKey).toHaveBeenCalledWith('alice');
    });

    it('should return null for unregistered domain', async () => {
      // Mock getDomainKey
      mockGetDomainKey.mockResolvedValue({
        pubkey: new PublicKey('mock-pubkey'),
        isSub: false,
        parent: undefined,
        hashed: Buffer.from('mock-hash'),
      } as any);
      
      // Mock account doesn't exist error
      mockNameRegistryState.mockRejectedValue(new Error('Account does not exist'));

      const result = await resolver.resolve('unregistered.sol');
      expect(result).toBeNull();
    });

    it('should throw ValidationError for invalid domain', async () => {
      await expect(resolver.resolve('invalid-domain'))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for unsupported domain', async () => {
      await expect(resolver.resolve('test.xyz'))
        .rejects
        .toThrow(ValidationError);
    });

    it('should use cache for repeated requests', async () => {
      const mockAddress = 'AhKx7YmNZPXR8Fy4MFz5EsjvdgfVUQcQW4w1TrL9G2Ly';
      
      // Mock getDomainKey
      mockGetDomainKey.mockResolvedValue({
        pubkey: new PublicKey('mock-pubkey'),
        isSub: false,
        parent: undefined,
        hashed: Buffer.from('mock-hash'),
      } as any);
      
      // Mock NameRegistryState.retrieve
      mockNameRegistryState.mockResolvedValue({
        owner: new PublicKey(mockAddress),
        data: Buffer.from(''),
        parentName: new PublicKey('mock-parent'),
        class: new PublicKey('mock-class'),
      } as any);

      // First call
      const result1 = await resolver.resolve('cached.sol');
      expect(result1).toBe(mockAddress);

      // Second call should use cache
      const result2 = await resolver.resolve('cached.sol');
      expect(result2).toBe(mockAddress);

      // Should only call the mock once
      expect(mockGetDomainKey).toHaveBeenCalledTimes(1);
    });

    it('should handle ENS domains (should throw not implemented)', async () => {
      await expect(resolver.resolve('alice.eth'))
        .rejects
        .toThrow(ProviderError);
    });
  });

  describe('reverse', () => {
    it('should reverse lookup successfully', async () => {
      const mockDomain = 'alice';
      const mockAddress = 'AhKx7YmNZPXR8Fy4MFz5EsjvdgfVUQcQW4w1TrL9G2Ly';
      
      // Mock reverseLookup to return array of domains
      (mockReverseLookup as any).mockResolvedValue([mockDomain]);

      const result = await resolver.reverse(mockAddress);
      expect(result).toBe('alice.sol');
      expect(mockReverseLookup).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
    });

    it('should return null for address with no domain', async () => {
      // Mock empty array response
      (mockReverseLookup as any).mockResolvedValue([]);

      const result = await resolver.reverse('AhKx7YmNZPXR8Fy4MFz5EsjvdgfVUQcQW4w1TrL9G2Ly');
      expect(result).toBeNull();
    });

    it('should use cache for repeated reverse lookups', async () => {
      const mockDomain = 'alice';
      const mockAddress = 'AhKx7YmNZPXR8Fy4MFz5EsjvdgfVUQcQW4w1TrL9G2Ly';
      
      // Mock reverseLookup
      (mockReverseLookup as any).mockResolvedValue([mockDomain]);

      // First call
      const result1 = await resolver.reverse(mockAddress);
      expect(result1).toBe('alice.sol');

      // Second call should use cache
      const result2 = await resolver.reverse(mockAddress);
      expect(result2).toBe('alice.sol');

      // Should only call the mock once
      expect(mockReverseLookup).toHaveBeenCalledTimes(1);
    });
  });

  describe('cache management', () => {
    it('should clear cache', () => {
      resolver.clearCache();
      expect(resolver.getCacheStats().size).toBe(0);
    });

    it('should get cache statistics', () => {
      const stats = resolver.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('defaultTTL');
    });

    it('should cleanup expired entries', () => {
      const cleaned = resolver.cleanupCache();
      expect(typeof cleaned).toBe('number');
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });

  describe('provider management', () => {
    it('should add custom provider', () => {
      const mockProvider = {
        name: 'MOCK',
        supports: jest.fn(() => true),
        resolve: jest.fn(() => Promise.resolve('mock-address')),
      };

      resolver.addProvider('mock', mockProvider);
      // Test would need to be extended to verify the provider was added
    });

    it('should remove provider', () => {
      const removed = resolver.removeProvider('ens');
      expect(typeof removed).toBe('boolean');
    });

    it('should get supported domains', () => {
      const domains = resolver.getSupportedDomains();
      expect(Array.isArray(domains)).toBe(true);
      expect(domains.length).toBeGreaterThan(0);
    });
  });
});

describe('SNSProvider', () => {
  let provider: SNSProvider;

  beforeEach(() => {
    provider = new SNSProvider();
    jest.clearAllMocks();
  });

  describe('supports', () => {
    it('should support .sol domains', () => {
      expect(provider.supports('alice.sol')).toBe(true);
      expect(provider.supports('test-123.sol')).toBe(true);
    });

    it('should not support other domains', () => {
      expect(provider.supports('alice.eth')).toBe(false);
      expect(provider.supports('test.com')).toBe(false);
    });
  });
});

describe('ENSProvider', () => {
  let provider: ENSProvider;

  beforeEach(() => {
    provider = new ENSProvider();
  });

  describe('supports', () => {
    it('should support .eth domains', () => {
      expect(provider.supports('alice.eth')).toBe(true);
      expect(provider.supports('test-123.eth')).toBe(true);
    });

    it('should not support other domains', () => {
      expect(provider.supports('alice.sol')).toBe(false);
      expect(provider.supports('test.com')).toBe(false);
    });
  });

  describe('resolve', () => {
    it('should throw ProviderError (not implemented)', async () => {
      await expect(provider.resolve('alice.eth'))
        .rejects
        .toThrow(ProviderError);
    });
  });
});