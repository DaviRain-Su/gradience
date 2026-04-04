# ENS (Ethereum Name Service) Integration Research

> **Research Document** for Gradience Agent Social Features  
> **Date**: 2026-04-04  
> **Resources**: [ens.domains](https://ens.domains/), [docs.ens.domains](https://docs.ens.domains/)

---

## Table of Contents

1. [Overview](#1-overview)
2. [ENS SDK & Libraries](#2-ens-sdk--libraries)
3. [Domain Resolution](#3-domain-resolution)
   - [Forward Resolution](#31-forward-resolution)
   - [Reverse Resolution](#32-reverse-resolution-primary-names)
4. [Cross-Chain Considerations](#4-cross-chain-considerations)
5. [EVM Wallet Integration](#5-evm-wallet-integration)
6. [Code Examples](#6-code-examples)
7. [Recommendations for Gradience Agent Social](#7-recommendations-for-gradience-agent-social)

---

## 1. Overview

### What is ENS?

ENS (Ethereum Name Service) is a decentralized, open naming system built on Ethereum that maps human-readable names (like `vitalik.eth`) to machine-readable identifiers such as:

- **Ethereum addresses** (e.g., `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`)
- **Multi-chain addresses** (BTC, Solana, etc.)
- **Content hashes** (IPFS, Swarm)
- **Text records** (Twitter, Discord, GitHub, email, avatar, etc.)

### Core Components

| Component | Description |
|-----------|-------------|
| **Registry** | Central smart contract storing all ENS records |
| **Registrar** | Controls `.eth` name registration |
| **Resolver** | Smart contracts that resolve names to records |
| **Universal Resolver** | Unified interface for resolving names across resolvers |
| **Reverse Registrar** | Enables address-to-name (primary name) resolution |

### ENSv2 (2026 Update)

ENS Labs has announced **ENSv2**, a major upgrade focusing on:

- **L2 Migration**: Moving to Linea (zkEVM) as the primary chain for registrations
- **Hierarchical Registries**: Each name can have its own registry and resolver
- **Cross-chain Primary Names**: Native support for L2 primary names on Arbitrum, Base, Linea, OP Mainnet, and Scroll
- **`on.eth` Chain Registry**: Native chain identification system for cross-chain interoperability

---

## 2. ENS SDK & Libraries

### Recommended Libraries

| Library | Language | Use Case | Install |
|---------|----------|----------|---------|
| **viem** | TypeScript | Low-level, modern, performant | `npm install viem` |
| **wagmi** | React + TypeScript | React hooks for ENS | `npm install wagmi @tanstack/react-query` |
| **ENSjs** | TypeScript | Official ENS library | `npm install @ensdomains/ensjs` |
| **ethers.js** | TypeScript/JS | Battle-tested, widely used | `npm install ethers` |
| **web3.py** | Python | Python integration | `pip install web3` |

### Quickstart Kits with ENS Support

- **ConnectKit** (by Family) - Full wallet + ENS support out of box
- **RainbowKit** (by Rainbow) - Beautiful wallet UI with ENS
- **Web3Modal** (by WalletConnect) - Cross-platform wallet connection

### Package Installation

```bash
# Core libraries for TypeScript/React project
npm install viem wagmi @tanstack/react-query

# Or with ENSjs for advanced features
npm install @ensdomains/ensjs viem
```

---

## 3. Domain Resolution

### 3.1 Forward Resolution

Forward resolution converts an ENS name → Ethereum address (and other records).

**Resolution Process:**
1. Normalize the name (UTS-46 normalization)
2. Hash the name using `namehash`
3. Query the Registry for the Resolver address
4. Query the Resolver for the desired record

**Supported Records:**
- **ETH Address**: `addr(bytes32 node)` 
- **Multi-chain Address**: `addr(bytes32 node, uint256 coinType)`
- **Text Records**: `text(bytes32 node, string key)`
- **Content Hash**: `contenthash(bytes32 node)`
- **ABI**: `ABI(bytes32 node, uint256 contentTypes)`

**Common Text Record Keys:**

| Key | Description |
|-----|-------------|
| `avatar` | Profile image (IPFS, HTTPS, NFT URI) |
| `com.twitter` | Twitter handle |
| `com.github` | GitHub username |
| `com.discord` | Discord username |
| `email` | Email address |
| `url` | Website URL |
| `description` | Profile bio |
| `notice` | Important notice |
| `keywords` | Comma-separated tags |

### 3.2 Reverse Resolution (Primary Names)

Reverse resolution converts an Ethereum address → ENS name.

**What is a Primary Name?**

A "primary name" represents a **bi-directional relationship**:
1. **Forward**: Name → Address (set via resolver)
2. **Reverse**: Address → Name (set via reverse registrar)

Both directions must match for a valid primary name.

**L2 Primary Names (New in 2025)**

ENS now supports primary names on L2s:
- Arbitrum One
- Base  
- Linea
- OP Mainnet
- Scroll

**Important**: The forward address *for a given chain* must match the reverse record on that chain's reverse registrar.

**Setting a Primary Name:**
1. Set the chain-specific address in the name's resolver (e.g., Base address for `nick.eth`)
2. Set the reverse record on the respective chain's Reverse Registrar

**Propagation Delay**: L2 primary names have a propagation period of up to 6 hours.

---

## 4. Cross-Chain Considerations

### Multi-Chain Address Resolution

ENS names can resolve to different addresses on different chains using coin types defined in [SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md).

| Coin Type | Chain |
|-----------|-------|
| 60 | Ethereum (ETH) |
| 0 | Bitcoin (BTC) |
| 501 | Solana (SOL) |
| 2147483649 | Optimism |
| 2147483658 | Arbitrum |
| 2147492101 | Base |

### EIP-3668 CCIP-Read (Cross-Chain Interoperability Protocol)

ENS uses CCIP-Read to fetch data from off-chain or L2 sources while maintaining on-chain verification:

1. Client calls resolver on L1
2. Resolver returns an `OffchainLookup` error with gateway URL
3. Client fetches data from gateway
4. Client verifies proof on-chain

### Multichain dApp Configuration

For apps deployed on L2s that need ENS resolution:

```typescript
// Add mainnet to your wagmi config for ENS resolution
import { useEnsAddress } from 'wagmi'

const { data: address } = useEnsAddress({
  name: 'nick.eth',
  chainId: 1, // Always resolve from mainnet
})
```

### ENSv2 `on.eth` Chain Registry

The new `on.eth` system provides native chain identification:
- Standardizes chain metadata in ENS
- Enables human-readable chain-specific addresses
- Example: `arbitrum.on.eth` → Arbitrum chain info

---

## 5. EVM Wallet Integration

### Wallet Connection with ENS

Most modern wallet kits automatically display ENS names and avatars:

**ConnectKit Setup:**
```typescript
import { ConnectKitProvider, ConnectKitButton } from 'connectkit'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { mainnet, base, arbitrum } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const config = createConfig({
  chains: [mainnet, base, arbitrum],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
  },
})

const queryClient = new QueryClient()

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>
          <ConnectKitButton />
          {/* ENS name and avatar shown automatically */}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
```

### Sign-In with Ethereum (SIWE)

Combine ENS with SIWE for decentralized authentication:

```typescript
import { SiweMessage } from 'siwe'

const message = new SiweMessage({
  domain: 'example.com',
  address: '0x...', // User's address
  statement: 'Sign in to Example App',
  uri: 'https://example.com',
  version: '1',
  chainId: 1,
  nonce: generateNonce(),
})

// User signs the message
// Server verifies and uses ENS for identity
```

---

## 6. Code Examples

### 6.1 Forward Resolution with viem

```typescript
import { createPublicClient, http, normalize } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})

// Resolve ENS name to address
async function resolveAddress(ensName: string) {
  const address = await client.getEnsAddress({
    name: normalize(ensName),
  })
  return address // e.g., '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
}

// Example usage
const address = await resolveAddress('vitalik.eth')
```

### 6.2 Reverse Resolution with viem

```typescript
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})

// Resolve address to ENS name
async function resolveName(address: `0x${string}`) {
  const name = await client.getEnsName({
    address,
  })
  return name // e.g., 'vitalik.eth'
}

// Example usage
const name = await resolveName('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')
```

### 6.3 Get ENS Avatar

```typescript
import { createPublicClient, http, normalize } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})

async function getAvatar(ensName: string) {
  const avatar = await client.getEnsAvatar({
    name: normalize(ensName),
  })
  return avatar // e.g., 'https://...' or 'ipfs://...'
}

// Example usage
const avatar = await getAvatar('nick.eth')
```

### 6.4 Get Text Records

```typescript
import { createPublicClient, http, normalize } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})

async function getTextRecord(ensName: string, key: string) {
  const value = await client.getEnsText({
    name: normalize(ensName),
    key, // e.g., 'com.twitter', 'com.github', 'description'
  })
  return value
}

// Get multiple text records
async function getProfile(ensName: string) {
  const normalized = normalize(ensName)
  
  const [twitter, github, description, email, url] = await Promise.all([
    client.getEnsText({ name: normalized, key: 'com.twitter' }),
    client.getEnsText({ name: normalized, key: 'com.github' }),
    client.getEnsText({ name: normalized, key: 'description' }),
    client.getEnsText({ name: normalized, key: 'email' }),
    client.getEnsText({ name: normalized, key: 'url' }),
  ])
  
  return { twitter, github, description, email, url }
}
```

### 6.5 React Hooks with wagmi

```tsx
import { useEnsName, useEnsAddress, useEnsAvatar, useAccount } from 'wagmi'
import { normalize } from 'viem/ens'

// Display connected user's ENS name
function UserProfile() {
  const { address } = useAccount()
  
  const { data: name } = useEnsName({
    address,
    chainId: 1, // Always mainnet for ENS
  })
  
  const { data: avatar } = useEnsAvatar({
    name: name ?? undefined,
    chainId: 1,
  })
  
  return (
    <div className="flex items-center gap-2">
      <img 
        src={avatar || '/fallback-avatar.svg'} 
        className="w-8 h-8 rounded-full"
      />
      <span>{name || address?.slice(0, 6) + '...'}</span>
    </div>
  )
}

// Resolve input ENS name
function AddressInput() {
  const [input, setInput] = useState('')
  
  const { data: address, isLoading } = useEnsAddress({
    name: input.includes('.') ? normalize(input) : undefined,
    chainId: 1,
  })
  
  return (
    <div>
      <input 
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="vitalik.eth or 0x..."
      />
      {address && <p>Resolved: {address}</p>}
    </div>
  )
}
```

### 6.6 Multi-Chain Address Resolution

```typescript
import { createPublicClient, http, normalize } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})

// SLIP-0044 coin types
const COIN_TYPES = {
  ETH: 60,
  BTC: 0,
  SOL: 501,
  OPTIMISM: 2147483649,
  ARBITRUM: 2147483658,
  BASE: 2147492101,
} as const

async function getMultiChainAddress(ensName: string, coinType: number) {
  const address = await client.getEnsAddress({
    name: normalize(ensName),
    coinType,
  })
  return address
}

// Get all addresses for a name
async function getAllAddresses(ensName: string) {
  const normalized = normalize(ensName)
  
  const addresses = await Promise.all([
    client.getEnsAddress({ name: normalized, coinType: COIN_TYPES.ETH }),
    client.getEnsAddress({ name: normalized, coinType: COIN_TYPES.BTC }),
    client.getEnsAddress({ name: normalized, coinType: COIN_TYPES.SOL }),
    client.getEnsAddress({ name: normalized, coinType: COIN_TYPES.BASE }),
  ])
  
  return {
    eth: addresses[0],
    btc: addresses[1],
    sol: addresses[2],
    base: addresses[3],
  }
}
```

### 6.7 ENS Profile Service Utility

```typescript
import { createPublicClient, http, normalize, type Address } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})

export interface ENSProfile {
  name: string | null
  address: Address
  avatar: string | null
  twitter: string | null
  github: string | null
  discord: string | null
  email: string | null
  description: string | null
  url: string | null
}

export async function getENSProfile(addressOrName: string): Promise<ENSProfile> {
  let address: Address
  let name: string | null = null
  
  // Determine if input is address or name
  if (addressOrName.startsWith('0x')) {
    address = addressOrName as Address
    name = await client.getEnsName({ address })
  } else {
    const normalized = normalize(addressOrName)
    const resolved = await client.getEnsAddress({ name: normalized })
    if (!resolved) throw new Error('ENS name not found')
    address = resolved
    name = addressOrName
  }
  
  // If we have a name, fetch profile data
  if (name) {
    const normalized = normalize(name)
    const [avatar, twitter, github, discord, email, description, url] = 
      await Promise.all([
        client.getEnsAvatar({ name: normalized }),
        client.getEnsText({ name: normalized, key: 'com.twitter' }),
        client.getEnsText({ name: normalized, key: 'com.github' }),
        client.getEnsText({ name: normalized, key: 'com.discord' }),
        client.getEnsText({ name: normalized, key: 'email' }),
        client.getEnsText({ name: normalized, key: 'description' }),
        client.getEnsText({ name: normalized, key: 'url' }),
      ])
    
    return {
      name,
      address,
      avatar,
      twitter,
      github,
      discord,
      email,
      description,
      url,
    }
  }
  
  return {
    name: null,
    address,
    avatar: null,
    twitter: null,
    github: null,
    discord: null,
    email: null,
    description: null,
    url: null,
  }
}
```

---

## 7. Recommendations for Gradience Agent Social

### 7.1 Identity Resolution Layer

**Create an ENS-first identity system:**

```typescript
// packages/soul-engine/src/identity/ens-resolver.ts

export interface AgentIdentity {
  // Primary identifier
  ensName: string | null
  address: Address
  
  // Profile data from ENS
  avatar: string | null
  displayName: string | null
  bio: string | null
  
  // Social links
  socials: {
    twitter?: string
    github?: string
    discord?: string
    nostr?: string  // Consider adding nostr npub
  }
  
  // Multi-chain addresses
  addresses: {
    eth: Address
    solana?: string
    base?: Address
    arbitrum?: Address
  }
  
  // Verification status
  verified: boolean
}

export class ENSIdentityResolver {
  async resolveAgent(identifier: string): Promise<AgentIdentity> {
    // Support both ENS names and addresses
    const profile = await getENSProfile(identifier)
    
    return {
      ensName: profile.name,
      address: profile.address,
      avatar: profile.avatar,
      displayName: profile.name?.split('.')[0] || null,
      bio: profile.description,
      socials: {
        twitter: profile.twitter,
        github: profile.github,
        discord: profile.discord,
      },
      addresses: {
        eth: profile.address,
        // Fetch multi-chain addresses
      },
      verified: !!profile.name, // Has ENS = basic verification
    }
  }
}
```

### 7.2 Agent Discovery with ENS

**Enable agent discovery via ENS subnames:**

```
gradience.eth
├── agent1.gradience.eth  → Agent 1's profile
├── agent2.gradience.eth  → Agent 2's profile
└── dao.gradience.eth     → DAO treasury/governance
```

**Benefits:**
- Human-readable agent identifiers
- Decentralized agent registry
- Built-in profile/metadata storage
- Cross-platform portability

### 7.3 Social Proof Integration

**Link ENS profiles to social verification:**

```typescript
// Verify social links match ENS records
async function verifySocialProof(ensName: string, platform: string, handle: string) {
  const storedHandle = await client.getEnsText({
    name: normalize(ensName),
    key: `com.${platform}`,
  })
  
  return storedHandle?.toLowerCase() === handle.toLowerCase()
}
```

### 7.4 Agent-to-Agent Communication

**Use ENS for A2A protocol addressing:**

```typescript
// A2A message addressing
interface A2AMessage {
  from: string  // 'sender.gradience.eth'
  to: string    // 'receiver.gradience.eth'
  // ... message content
}

// Resolve addresses for transaction
async function routeA2AMessage(message: A2AMessage) {
  const [fromAddress, toAddress] = await Promise.all([
    resolveAddress(message.from),
    resolveAddress(message.to),
  ])
  
  // Route message to resolved addresses
}
```

### 7.5 Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Gradience Agent Social                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Wallet     │  │    ENS      │  │   Agent Registry    │ │
│  │  Connect    │──│  Identity   │──│   (On-chain)        │ │
│  │  (wagmi)    │  │  Resolver   │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   Profile Cache Layer                    ││
│  │  - ENS text records (avatar, socials, bio)              ││
│  │  - Multi-chain addresses                                 ││
│  │  - Verification status                                   ││
│  └─────────────────────────────────────────────────────────┘│
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                Agent Social Features                     ││
│  │  - Profile display (ENS name, avatar)                   ││
│  │  - Agent discovery (subname registry)                   ││
│  │  - A2A messaging (ENS-addressed)                        ││
│  │  - Cross-chain transactions                             ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.6 Implementation Priorities

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| P0 | Basic ENS resolution (name ↔ address) | Low | High |
| P0 | Avatar & profile display | Low | High |
| P1 | Multi-chain address resolution | Medium | High |
| P1 | L2 primary name support | Medium | Medium |
| P2 | ENS subname issuance for agents | High | High |
| P2 | Social proof verification | Medium | Medium |
| P3 | Custom ENS resolver for agent metadata | High | Medium |

### 7.7 Security Considerations

1. **Name Normalization**: Always use `normalize()` from viem before hashing
2. **Verification**: Verify forward resolution matches reverse resolution
3. **Caching**: Cache ENS data but respect TTL from resolvers
4. **Fallbacks**: Always have fallback UI for addresses without ENS
5. **Multi-chain**: Verify chain-specific addresses match chain-specific primary names

### 7.8 Future Considerations (ENSv2)

As ENSv2 rolls out:
- Monitor Linea (Namechain) migration timeline
- Prepare for hierarchical registry changes
- Consider `on.eth` integration for chain identification
- Evaluate gas savings from L2-native registration

---

## References

- [ENS Documentation](https://docs.ens.domains/)
- [ENS Labs Blog - ENSv2](https://ens.domains/blog/post/ensv2)
- [viem ENS Actions](https://viem.sh/docs/ens/actions/getEnsAddress)
- [wagmi ENS Hooks](https://wagmi.sh/react/hooks/useEnsName)
- [ENSIP Standards](https://docs.ens.domains/ensip)
- [EIP-3668: CCIP Read](https://eips.ethereum.org/EIPS/eip-3668)
- [SLIP-0044: Coin Types](https://github.com/satoshilabs/slips/blob/master/slip-0044.md)

---

*This document should be updated as ENSv2 rolls out and the ecosystem evolves.*
