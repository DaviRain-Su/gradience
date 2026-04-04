# Chain Hub SDK Integration Example

## Installation

```bash
npm install @gradiences/sdk
```

## Usage

```typescript
import { Gradience, ChainHubClient } from '@gradiences/sdk';

// Initialize client
const client = new Gradience({
  rpcEndpoint: 'https://api.devnet.solana.com',
  indexerEndpoint: 'https://indexer.gradiences.xyz',
});

// Use Chain Hub
const reputation = await client.hub.getReputation('agent-address');
console.log(reputation);

// Or use ChainHubClient directly
const hub = new ChainHubClient({
  baseUrl: 'https://indexer.gradiences.xyz',
});

const agents = await hub.getAgents({ limit: 10 });
```

## API

### ChainHubClient

```typescript
class ChainHubClient {
  constructor(config: ChainHubClientConfig);
  
  // Reputation
  getReputation(agent: string): Promise<ReputationData>;
  
  // Agents
  getAgents(params?: QueryParams): Promise<AgentInfo[]>;
  
  // Tasks
  getTask(taskId: number): Promise<TaskApi>;
  getTasks(params?: QueryParams): Promise<TaskApi[]>;
  
  // Health
  healthCheck(): Promise<boolean>;
}
```

## Integration with AgentM Pro

AgentM Pro 已经集成 Chain Hub SDK：

```typescript
// apps/agentm-pro/src/lib/indexer/index.ts
import { ChainHubClient } from '@gradiences/sdk';

export const indexer = new ChainHubClient({
  baseUrl: process.env.NEXT_PUBLIC_INDEXER_ENDPOINT,
});
```
