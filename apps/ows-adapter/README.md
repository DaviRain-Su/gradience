# @gradiences/ows-adapter

Open Wallet Standard (OWS) adapter for Gradience Protocol.

## Overview

This package provides integration between Gradience Protocol and Open Wallet Standard (OWS), enabling:

- **Agent-Native Identity** - Use OWS Wallet as Agent's persistent multi-chain identity
- **Credential Management** - Store and retrieve verifiable credentials
- **Cross-Chain Capability** - Support for multiple chains through OWS
- **XMTP Integration** - Agent-to-agent messaging via OWS Agent Kit
- **HD Key Derivation** - BIP44 sub-wallet derivation for Solana
- **Transaction Signing** - Sign Solana transactions through OWS
- **Message Signing** - Sign arbitrary and structured authentication messages
- **Balance Checking** - Query SOL and SPL token balances

## Installation

```bash
npm install @gradiences/ows-adapter
```

## Quick Start

```typescript
import { OWSWalletAdapter } from '@gradiences/ows-adapter';

// Create adapter
const adapter = new OWSWalletAdapter({
  network: 'devnet',
  defaultChain: 'solana',
  rpcEndpoint: 'https://api.devnet.solana.com'
});

// Connect to OWS Wallet
const wallet = await adapter.connect();
console.log('Connected:', wallet.address);

// Get Agent identity
const identity = await adapter.getIdentity();
console.log('DID:', identity.did);

// Derive a sub-wallet (BIP44)
const subWallet = adapter.deriveSubWallet(1);
console.log('Sub-wallet path:', subWallet.path);

// Sign a Solana transaction
const signedTx = await adapter.signTransaction(transaction);

// Sign an authentication message
const auth = await adapter.signAuthMessage({
  domain: 'example.com',
  address: wallet.address,
  nonce: crypto.randomUUID(),
  issuedAt: Date.now()
});

// Check balance
const balance = await adapter.checkBalance();
console.log('SOL balance:', balance.uiBalance);
```

## API Reference

### OWSWalletAdapter

Main class for OWS integration.

#### Constructor

```typescript
new OWSWalletAdapter(config: OWSAgentConfig)
```

**Config options:**
- `network`: `'mainnet' | 'devnet'`
- `defaultChain`: `'solana' | 'ethereum'`
- `apiKey?`: Optional API key
- `xmtpEnv?`: `'production' | 'dev'` XMTP environment
- `rpcEndpoint?`: Optional Solana RPC endpoint for balance queries

#### Connection Methods

- `connect()` - Connect to OWS Wallet
- `disconnect()` - Disconnect from wallet
- `getStatus()` - Get current connection status
- `isConnected()` - Check if connected
- `getWallet()` - Get connected wallet

#### Identity Methods

- `getIdentity()` - Get Agent identity with credentials
- `signTaskAgreement(agreement)` - Sign a task agreement
- `signMessage(message)` - Sign a generic message
- `signAuthMessage(payload)` - Sign a structured authentication message

#### Transaction Methods

- `signTransaction(tx)` - Sign a Solana transaction

#### Key Derivation Methods

- `deriveSubWallet(accountIndex?, changeIndex?)` - Derive a single BIP44 sub-wallet
- `deriveSubWallets(count, startIndex?)` - Derive multiple sub-wallets

#### Balance Methods

- `checkBalance()` - Check native SOL balance (requires `rpcEndpoint`)
- `checkTokenBalance(mint)` - Check SPL token balance (requires `rpcEndpoint`)
- `checkTokenBalances(mints)` - Check multiple token balances (requires `rpcEndpoint`)
- `getConnection()` - Get the underlying Solana RPC connection

### Key Derivation Utilities (`derive`)

Standalone utilities for HD wallet path derivation.

```typescript
import { deriveSolanaPath, deriveSubWallet, deriveSubWallets } from '@gradiences/ows-adapter';

// Get BIP44 path for Solana account 5
const path = deriveSolanaPath(5, 0);
// => "m/44'/501'/5'/0'"

// Derive a sub-wallet descriptor
const sub = deriveSubWallet(masterPublicKey, 1);

// Derive multiple sub-wallets
const subs = deriveSubWallets(masterPublicKey, 10);
```

### Transaction Utilities (`transaction`)

Standalone utilities for Solana transaction signing.

```typescript
import {
  signSolanaTransaction,
  createSignTransactionHandler,
  serializeTransaction,
  deserializeTransaction
} from '@gradiences/ows-adapter';

// Sign a transaction with an OWS wallet
const result = await signSolanaTransaction(wallet, transaction);
console.log(result.serializedTx, result.signatures);

// Create a reusable handler
const signTx = createSignTransactionHandler(wallet);
const result2 = await signTx(transaction);
```

### Message Utilities (`message`)

Standalone utilities for message signing.

```typescript
import {
  createAuthMessage,
  signAuthenticationMessage,
  signRawMessage,
  verifySignedMessageFormat
} from '@gradiences/ows-adapter';

// Create a SIWS-like auth message
const message = createAuthMessage({
  domain: 'example.com',
  address: wallet.address,
  nonce: 'abc123',
  issuedAt: Date.now()
});

// Sign it
const signed = await signAuthenticationMessage(wallet, payload);

// Verify format (client-side structural check)
const isValid = verifySignedMessageFormat(signed);
```

### Balance Utilities (`balance`)

Standalone utilities for balance checking.

```typescript
import { checkBalance, checkTokenBalance, checkTokenBalances } from '@gradiences/ows-adapter';
import { Connection } from '@solana/web3.js';

const connection = new Connection('https://api.devnet.solana.com');

// Check SOL balance
const sol = await checkBalance(connection, address);

// Check SPL token balance
const usdc = await checkTokenBalance(connection, address, USDC_MINT);

// Check multiple tokens
const balances = await checkTokenBalances(connection, address, [MINT_A, MINT_B]);
```

## Types

Key types exported from the package:

```typescript
interface OWSWallet {
  address: string;
  publicKey: string;
  signMessage(message: string): Promise<string>;
  signTransaction(tx: any): Promise<any>;
}

interface OWSIdentity {
  did: string;
  wallet: OWSWallet;
  credentials: OWSCredential[];
}

interface AuthMessagePayload {
  domain: string;
  address: string;
  nonce: string;
  issuedAt: number;
  statement?: string;
  uri?: string;
  chainId?: string;
  expiration?: number;
}

interface BalanceInfo {
  address: string;
  balance: number;
  uiBalance: number;
  decimals: number;
  mint: string | null;
}
```

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
    │
    ▼
┌───────┐  ┌──────────┐  ┌─────────┐
│Solana │  │ Key Der. │  │ Balance │
│  Tx   │  │  (BIP44) │  │ Checker │
└───────┘  └──────────┘  └─────────┘
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
