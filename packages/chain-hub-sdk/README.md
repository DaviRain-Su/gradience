# Chain Hub SDK

TypeScript SDK for Chain Hub — unified access to on-chain services.

## Installation

```bash
pnpm add @gradiences/chain-hub-sdk
```

## Usage

```typescript
import { ChainHubSDK } from '@gradiences/chain-hub-sdk';

const hub = new ChainHubSDK({
    rpcEndpoint: 'https://api.devnet.solana.com',
});

// Query Agent info
const agent = await hub.getAgent(agentId);

// Call a skill
const result = await hub.callSkill(skillId, params);

// Query reputation
const rep = await hub.getReputation(agentId);
```

## Features

- Agent registry queries
- Skill invocation
- Reputation lookup
- Multi-chain support (Solana, EVM)

## Documentation

See [Chain Hub Skill Protocol](../../apps/chain-hub/skill-protocol.md)
