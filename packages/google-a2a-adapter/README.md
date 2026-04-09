# @gradiences/google-a2a-adapter

Google A2A (Agent2Agent) Protocol Adapter for the Gradience Protocol. Enables cross-framework agent interoperability with any A2A-compatible agent (LangChain, CrewAI, AutoGen, etc.).

## Features

- **Agent Card Discovery**: Automatic discovery via `/.well-known/agent.json`
- **JSON-RPC Messaging**: Full support for Google A2A task lifecycle
- **Task Lifecycle**: submitted → working → input-required → completed/failed
- **Streaming Support**: SSE for real-time task updates
- **Push Notifications**: Webhook-based delivery support
- **Gradience Integration**: Seamless mapping to Gradience A2A types

## Installation

```bash
npm install @gradiences/google-a2a-adapter
# or
pnpm add @gradiences/google-a2a-adapter
# or
yarn add @gradiences/google-a2a-adapter
```

## Quick Start

```typescript
import { GoogleA2AAdapter } from '@gradiences/google-a2a-adapter';

// Create adapter instance
const adapter = new GoogleA2AAdapter({
    knownPeers: [
        'https://agent1.example.com/.well-known/agent.json',
        'https://agent2.example.com/.well-known/agent.json',
    ],
    solanaAddress: 'your-solana-address',
    requestTimeout: 10000,
});

// Initialize
await adapter.initialize();

// Subscribe to incoming messages
const subscription = await adapter.subscribe(async (message) => {
    console.log('Received:', message);
});

// Send a task proposal
const result = await adapter.send({
    id: 'task-1',
    from: 'your-address',
    to: 'recipient-address',
    type: 'task_proposal',
    timestamp: Date.now(),
    payload: {
        description: 'Analyze market trends',
        budget: 100,
    },
});

// Cleanup
await subscription.unsubscribe();
await adapter.shutdown();
```

## Agent Card

The Google A2A protocol uses an Agent Card hosted at `/.well-known/agent.json`:

```json
{
    "name": "My Gradience Agent",
    "description": "An AI agent powered by Gradience",
    "url": "https://myagent.example.com/a2a",
    "version": "1.0.0",
    "capabilities": [
        {
            "id": "market-analysis",
            "name": "Market Analysis",
            "description": "Analyze crypto market trends",
            "tags": ["finance", "crypto"]
        }
    ],
    "authentication": {
        "schemes": ["bearer"]
    },
    "defaultInputModes": ["text/plain", "application/json"],
    "defaultOutputModes": ["text/plain", "application/json"],
    "provider": {
        "organization": "Gradience Protocol",
        "url": "https://gradiences.xyz"
    },
    "x-gradience": {
        "solanaAddress": "your-solana-address",
        "reputationScore": 95,
        "protocolVersion": "0.1.0"
    }
}
```

Generate an Agent Card using the adapter:

```typescript
import { GoogleA2AAdapter } from '@gradiences/google-a2a-adapter';

const adapter = new GoogleA2AAdapter();
const agentCard = adapter.generateAgentCard({
    address: 'solana-address',
    displayName: 'My Agent',
    capabilities: ['market-analysis', 'trading'],
    reputationScore: 95,
    available: true,
    discoveredVia: 'google-a2a',
    lastSeenAt: Date.now(),
});

// Serve via Express
app.get('/.well-known/agent.json', GoogleA2AAdapter.createAgentCardHandler(agentCard));
```

## API Reference

### `GoogleA2AAdapter`

#### Constructor Options

```typescript
interface GoogleA2AAdapterOptions {
    /** This agent's Agent Card metadata */
    agentCard?: Partial<GoogleA2AAgentCard>;
    /** URL where this agent's Agent Card is hosted */
    agentCardUrl?: string;
    /** Port for local JSON-RPC server (0 = disabled) */
    serverPort?: number;
    /** Known peer Agent Card URLs */
    knownPeers?: string[];
    /** HTTP request timeout (ms) */
    requestTimeout?: number;
    /** Solana address of this agent */
    solanaAddress?: string;
    /** Reputation score to advertise */
    reputationScore?: number;
}
```

#### Methods

- `initialize()` - Initialize the adapter and discover peers
- `shutdown()` - Cleanup and close connections
- `isAvailable()` - Check if adapter is initialized
- `send(message)` - Send an A2A message
- `subscribe(handler)` - Subscribe to incoming messages
- `discoverAgents(filter?)` - Discover available agents
- `broadcastCapabilities(agentInfo)` - Publish agent capabilities
- `health()` - Get adapter health status
- `generateAgentCard(agentInfo)` - Generate Agent Card JSON
- `handleIncomingRequest(request)` - Handle incoming JSON-RPC requests

#### Static Methods

- `createAgentCardHandler(card)` - Create Express/Fastify handler for Agent Card

## Protocol Mapping

| Gradience Concept | Google A2A Concept                  |
| ----------------- | ----------------------------------- |
| `A2AMessage`      | JSON-RPC Task                       |
| `AgentInfo`       | Agent Card                          |
| `task_proposal`   | `tasks/send` with state `submitted` |
| `task_accept`     | Task state `working`                |
| `payment_confirm` | Task state `completed`              |
| `task_reject`     | Task state `canceled`/`failed`      |

## Google A2A Specification

This adapter implements the [Google A2A Protocol](https://github.com/a2aproject/A2A):

- **Agent Card**: `/.well-known/agent.json`
- **Task Lifecycle**: submitted → working → input-required → completed/failed
- **Methods**: `tasks/send`, `tasks/get`, `tasks/cancel`
- **Streaming**: SSE for real-time updates
- **Push Notifications**: Webhook-based

## License

MIT
