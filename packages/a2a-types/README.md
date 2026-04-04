# A2A Types

TypeScript type definitions for Agent-to-Agent (A2A) protocol.

## Installation

```bash
pnpm add @gradiences/a2a-types
```

## Usage

```typescript
import { AgentMessage, TaskRequest, TaskResponse } from '@gradiences/a2a-types';

const message: AgentMessage = {
    id: 'msg-123',
    from: 'agent-a',
    to: 'agent-b',
    content: {
        /* ... */
    },
};
```

## Types

- `AgentMessage` - Base message type
- `TaskRequest` - Task creation request
- `TaskResponse` - Task response
- `AgentCapability` - Capability declaration
- `A2AEnvelope` - Message envelope

## Related

- [A2A Protocol Spec](../../protocol/design/a2a-protocol-spec.md)
- [A2A Runtime](../a2a-protocol/runtime/README.md)
