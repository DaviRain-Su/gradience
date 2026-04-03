# @gradiences/domain-resolver

A TypeScript library for resolving blockchain domain names to addresses, supporting Solana Name Service (.sol) and Ethereum Name Service (.eth) domains.

## Features

- **SNS Support**: Full support for .sol domains via Bonfida SNS
- **ENS Support**: Stub implementation for future .eth domain support
- **Caching**: LRU cache with TTL to optimize performance
- **Provider Architecture**: Extensible design for adding new domain systems
- **Error Handling**: Comprehensive error types and graceful failure modes
- **TypeScript**: Full type safety and IntelliSense support

## Installation

```bash
npm install @gradiences/domain-resolver
```

## Quick Start

```typescript
import { resolve, reverse, DomainResolver } from '@gradiences/domain-resolver';

// Quick resolution using default resolver
const address = await resolve('alice.sol');
console.log(address); // 'AhKx7YmNZPXR8Fy4MFz5EsjvdgfVUQcQW4w1TrL9G2Ly'

// Reverse lookup
const domain = await reverse('AhKx7YmNZPXR8Fy4MFz5EsjvdgfVUQcQW4w1TrL9G2Ly');
console.log(domain); // 'alice.sol'

// Using resolver instance for more control
const resolver = new DomainResolver({
  cache: { maxSize: 1000, ttl: 5 * 60 * 1000 }, // 5 minutes
});

const result = await resolver.resolve('bob.sol');
```

## API Reference

### DomainResolver Class

The main resolver class that orchestrates domain resolution across different providers.

```typescript
import { DomainResolver, ResolverConfig } from '@gradiences/domain-resolver';

const resolver = new DomainResolver(config?: ResolverConfig);
```

#### Configuration

```typescript
interface ResolverConfig {
  cache?: {
    maxSize?: number;    // Maximum cache entries (default: 1000)
    ttl?: number;        // Cache TTL in milliseconds (default: 5 minutes)
  };
  providers?: {
    sns?: SNSProviderConfig;
    ens?: ENSProviderConfig;
  };
}
```

#### Methods

##### `resolve(domain: string): Promise<string | null>`

Resolves a domain name to an address.

```typescript
// Resolve .sol domain
const solAddress = await resolver.resolve('alice.sol');

// Returns null if domain is not registered
const notFound = await resolver.resolve('nonexistent.sol'); // null
```

##### `reverse(address: string): Promise<string | null>`

Performs reverse lookup to find domain name for an address.

```typescript
const domain = await resolver.reverse('AhKx7YmNZPXR8Fy4MFz5EsjvdgfVUQcQW4w1TrL9G2Ly');
console.log(domain); // 'alice.sol' or null if not found
```

##### `isValid(domain: string): boolean`

Validates domain format.

```typescript
console.log(resolver.isValid('alice.sol'));    // true
console.log(resolver.isValid('bob.eth'));      // true
console.log(resolver.isValid('invalid'));      // false
```

##### Cache Management

```typescript
// Clear cache
resolver.clearCache();

// Get cache statistics
const stats = resolver.getCacheStats();
console.log(stats); // { size: 42, maxSize: 1000, defaultTTL: 300000 }

// Clean expired entries
const removed = resolver.cleanupCache();
```

##### Provider Management

```typescript
// Add custom provider
resolver.addProvider('custom', customProvider);

// Remove provider
resolver.removeProvider('ens');

// Get supported domains
const domains = resolver.getSupportedDomains(); // ['.sol', '.eth']
```

### Convenience Functions

For simple use cases, use the convenience functions that manage a default resolver instance:

```typescript
import { resolve, reverse, isValidDomain } from '@gradiences/domain-resolver';

// Quick resolution
const address = await resolve('alice.sol');

// Quick reverse lookup  
const domain = await reverse(address);

// Quick validation
const valid = isValidDomain('bob.sol');

// Use custom config for one-off calls
const result = await resolve('alice.sol', {
  cache: { ttl: 10 * 60 * 1000 } // 10 minutes
});
```

### Providers

#### SNSProvider

Handles .sol domain resolution via Bonfida SNS.

```typescript
import { SNSProvider } from '@gradiences/domain-resolver';

const snsProvider = new SNSProvider({
  connection: 'https://api.mainnet-beta.solana.com', // or Connection object
  timeout: 30000 // 30 seconds
});

const address = await snsProvider.resolve('alice.sol');
const domain = await snsProvider.reverse(address);
```

#### ENSProvider (Stub)

Placeholder for future .eth domain support.

```typescript
import { ENSProvider } from '@gradiences/domain-resolver';

const ensProvider = new ENSProvider();
// Currently throws "not implemented" error
// Will be implemented for cross-chain support
```

### Custom Providers

Implement the `Provider` interface to add support for new domain systems:

```typescript
import { Provider } from '@gradiences/domain-resolver';

class CustomProvider implements Provider {
  name = 'CUSTOM';
  
  supports(domain: string): boolean {
    return domain.endsWith('.custom');
  }
  
  async resolve(domain: string): Promise<string | null> {
    // Your resolution logic
    return 'resolved-address';
  }
  
  async reverse?(address: string): Promise<string | null> {
    // Optional reverse lookup
    return 'domain.custom';
  }
}

// Add to resolver
resolver.addProvider('custom', new CustomProvider());
```

## Error Handling

The library provides specific error types for different failure modes:

```typescript
import { 
  DomainResolverError, 
  ProviderError, 
  ValidationError 
} from '@gradiences/domain-resolver';

try {
  const result = await resolver.resolve('alice.sol');
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Invalid domain format:', error.domain);
  } else if (error instanceof ProviderError) {
    console.log('Provider error:', error.provider, error.message);
  } else if (error instanceof DomainResolverError) {
    console.log('Resolution error:', error.code, error.message);
  }
}
```

## Advanced Usage

### Custom Solana Connection

```typescript
import { Connection } from '@solana/web3.js';
import { DomainResolver } from '@gradiences/domain-resolver';

const customConnection = new Connection('https://your-rpc-endpoint.com');

const resolver = new DomainResolver({
  providers: {
    sns: {
      connection: customConnection,
      timeout: 15000 // 15 seconds
    }
  }
});
```

### Multiple Resolver Instances

```typescript
// Mainnet resolver
const mainnetResolver = new DomainResolver({
  providers: {
    sns: {
      connection: 'https://api.mainnet-beta.solana.com'
    }
  }
});

// Devnet resolver
const devnetResolver = new DomainResolver({
  providers: {
    sns: {
      connection: 'https://api.devnet.solana.com'
    }
  }
});
```

### Cache Optimization

```typescript
const resolver = new DomainResolver({
  cache: {
    maxSize: 5000,           // Store up to 5000 entries
    ttl: 15 * 60 * 1000     // 15 minute TTL
  }
});

// Periodic cache cleanup
setInterval(() => {
  const removed = resolver.cleanupCache();
  console.log(`Cleaned ${removed} expired entries`);
}, 5 * 60 * 1000); // Every 5 minutes
```

## Supported Domains

- ✅ `.sol` - Solana Name Service (via Bonfida)
- 🚧 `.eth` - Ethereum Name Service (planned)
- 🔮 Future: Other blockchain domains as needed

## Dependencies

- `@bonfida/spl-name-service`: SNS resolution
- `@solana/web3.js`: Solana blockchain interaction  
- `lru-cache`: Efficient caching with TTL

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Watch tests
npm run test:watch

# Lint
npm run lint
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Roadmap

- [ ] ENS (.eth) domain support
- [ ] Unstoppable Domains support  
- [ ] ICANN DNS integration
- [ ] WebAssembly build for browser optimization
- [ ] Batch resolution for multiple domains
- [ ] Domain metadata caching (avatar, description, etc.)

## Support

- **Issues**: [GitHub Issues](https://github.com/gradience/gradience/issues)
- **Discord**: [Gradience Community](https://discord.gg/gradience)
- **Documentation**: [Full Docs](https://docs.gradience.xyz)