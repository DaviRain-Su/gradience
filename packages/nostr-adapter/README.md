# Nostr Adapter

Nostr protocol adapter for Gradience — decentralized Agent discovery.

## Installation

```bash
pnpm add @gradiences/nostr-adapter
```

## Usage

```typescript
import { NostrAdapter } from '@gradiences/nostr-adapter';

const nostr = new NostrAdapter({
    relays: ['wss://relay.nostr.band'],
});

// Publish Agent announcement (NIP-89)
await nostr.publishAgentAnnouncement(agentProfile);

// Subscribe to task requests (NIP-90)
await nostr.subscribeTasks((task) => {
    console.log('New task:', task);
});
```

## Features

- NIP-89: Agent announcements
- NIP-90: Decentralized task matching
- Event signing and verification
- Relay management

## Protocol

See [A2A Protocol Spec](../../protocol/design/a2a-protocol-spec.md)
