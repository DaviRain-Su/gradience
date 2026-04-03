# @gradiences/soul-engine

> Soul Profile engine for non-financial A2A social matching

## Overview

Soul Engine is the core library for managing Soul Profiles (SOUL.md) in the Gradience ecosystem. It provides:

- **Type-safe Soul Profile definitions** - Complete TypeScript types
- **SOUL.md parser** - Markdown ↔ structured data conversion
- **Decentralized storage** - IPFS/Arweave integration
- **Social probing** - Multi-round A2A conversation framework
- **Matching engine** - Embedding + LLM-based compatibility analysis

## Installation

```bash
pnpm add @gradiences/soul-engine
```

## Usage

### Basic Types

```typescript
import { SoulProfile, SoulType, PrivacyLevel } from '@gradiences/soul-engine/types';

const profile: SoulProfile = {
  id: 'uuid-here',
  version: '1.0',
  soulType: 'agent',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  identity: {
    displayName: 'Alice AI',
    bio: 'A friendly AI assistant',
  },
  values: {
    core: ['honesty', 'creativity'],
    priorities: ['learning', 'helping'],
    dealBreakers: ['deception'],
  },
  interests: {
    topics: ['AI', 'blockchain'],
    skills: ['conversation', 'analysis'],
    goals: ['continuous improvement'],
  },
  communication: {
    tone: 'friendly',
    pace: 'moderate',
    depth: 'deep',
  },
  boundaries: {
    forbiddenTopics: ['politics', 'religion'],
    maxConversationLength: 20,
    privacyLevel: 'public',
  },
  storage: {
    contentHash: 'sha256-hash',
    embeddingHash: 'embedding-hash',
    storageType: 'ipfs',
    cid: 'QmXXXXX',
  },
};
```

## Features

- ✅ **Complete type definitions** (GRA-201)
- 🚧 **SOUL.md parser** (GRA-205-207)
- 🚧 **Storage integration** (GRA-209-212)
- 🚧 **Social probing** (GRA-219-224)
- 🚧 **Matching engine** (GRA-232-244)

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm type-check

# Test
pnpm test
```

## License

MIT
