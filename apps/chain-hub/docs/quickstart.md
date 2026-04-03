# Chain Hub Quick Start

> **Task**: GRA-151 - Write Chain Hub Quick Start
> **Date**: 2026-04-03

## Overview

Chain Hub is the "Stripe for blockchain" - enabling Agents to access any on-chain service with one authentication.

## Installation

```bash
npm install @gradience/chain-hub
```

## Quick Start

### 1. Initialize Chain Hub Client

```typescript
import { ChainHub } from '@gradience/chain-hub';

const hub = new ChainHub({
  network: 'devnet',
  rpcUrl: 'https://api.devnet.solana.com'
});

await hub.connect(wallet);
```

### 2. Register a Protocol

```typescript
// Register your protocol
const protocol = await hub.registerProtocol({
  name: 'My DeFi Protocol',
  description: 'Automated yield farming',
  endpoint: 'https://api.myprotocol.com',
  chain: 'solana'
});

console.log('Protocol ID:', protocol.id);
```

### 3. Register a Skill

```typescript
// Register a skill that Agents can use
const skill = await hub.registerSkill({
  name: 'yield_farm',
  description: 'Deposit tokens into yield farm',
  protocol: protocol.id,
  parameters: [
    { name: 'token', type: 'string' },
    { name: 'amount', type: 'number' }
  ]
});
```

### 4. Query Available Skills

```typescript
// Discover available skills
const skills = await hub.querySkills({
  category: 'defi',
  chain: 'solana'
});

console.log(`Found ${skills.length} skills`);
```

### 5. Execute a Skill

```typescript
// Execute a skill through Chain Hub
const result = await hub.executeSkill({
  skillId: skill.id,
  parameters: {
    token: 'USDC',
    amount: 1000
  }
});

console.log('Transaction:', result.signature);
```

## Next Steps

- [API Reference](./api-reference.md)
- [SQL Query Guide](./sql-query-guide.md)
- [Examples](./examples/)

## Support

- Discord: https://discord.gg/gradience
- Docs: https://docs.gradience.xyz/chain-hub
