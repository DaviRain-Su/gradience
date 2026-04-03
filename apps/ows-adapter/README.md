# @gradience/ows-adapter

Open Wallet Standard (OWS) adapter for Gradience Protocol.

## Overview

This package provides integration between Gradience Protocol and Open Wallet Standard (OWS), enabling:

- **Agent-Native Identity** - Use OWS Wallet as Agent's persistent multi-chain identity
- **Credential Management** - Store and retrieve verifiable credentials
- **Cross-Chain Capability** - Support for multiple chains through OWS
- **XMTP Integration** - Agent-to-agent messaging via OWS Agent Kit

## Installation

```bash
npm install @gradience/ows-adapter
```

## Quick Start

```typescript
import { OWSWalletAdapter } from '@gradience/ows-adapter';

// Create adapter
const adapter = new OWSWalletAdapter({
  network: 'devnet',
  defaultChain: 'solana'
});

// Connect to OWS Wallet
const wallet = await adapter.connect();
console.log('Connected:', wallet.address);

// Get Agent identity
const identity = await adapter.getIdentity();
console.log('DID:', identity.did);

// Sign task agreement
const agreement = {
  taskId: 'task-123',
  hash: '0xabc...',
  agent: '0xdef...',
  reward: 1000,
  deadline: Date.now() + 86400000
};
const signature = await adapter.signTaskAgreement(agreement);
```

## API Reference

### OWSWalletAdapter

Main class for OWS integration.

#### Constructor

```typescript
new OWSWalletAdapter(config: OWSAgentConfig)
```

**Config options:**
- `network`: 'mainnet' | 'devnet'
- `defaultChain`: 'solana' | 'ethereum'
- `apiKey?`: Optional API key

#### Methods

- `connect()` - Connect to OWS Wallet
- `disconnect()` - Disconnect from wallet
- `getIdentity()` - Get Agent identity with credentials
- `signMessage(message)` - Sign a message
- `signTaskAgreement(agreement)` - Sign a task agreement
- `signTransaction(tx)` - Sign a transaction

## Architecture

```
┌─────────────────┐
│  Gradience SDK  │
└────────┬────────┘
         │
┌────────▼────────┐
│  OWS Adapter    │
│  (this package) │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐  ┌───────┐
│ OWS   │  │ XMTP  │
│ Wallet│  │Client │
└───────┘  └───────┘
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Type check
npm run typecheck
```

## Related

- [OWS Hackathon Registration](../../docs/hackathon/ows-miami-2026/registration-guide.md)
- [OWS Integration Docs](../../docs/integrations/ows/)
- [Open Wallet Standard](https://openwallet.sh/)

## License

MIT
