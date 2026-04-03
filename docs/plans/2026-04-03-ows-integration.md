# OWS (Open Wallet Standard) Integration Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Integrate OWS as the primary wallet and identity layer for Gradience Agents, enabling agent-native authentication, credential management, and cross-chain operations.

**Architecture:** OWS Wallet serves as the Agent's identity anchor. Agents use OWS for authentication, credential storage, and signing. Gradience Protocol handles settlement and reputation. A2A Protocol (XMTP) handles agent-to-agent messaging.

**Tech Stack:** OWS SDK, XMTP, Gradience Protocol (Solana), TypeScript

---

## Overview

This plan integrates OWS (Open Wallet Standard) into Gradience as a **core infrastructure component**, not just a hackathon feature. The integration enables:

1. **Agent-Native Identity** - Agents use OWS Wallet as their persistent identity
2. **Credential Management** - Verifiable credentials stored in OWS
3. **Cross-Chain Capability** - OWS supports multiple chains
4. **Standardized Interface** - Compatible with other OWS-powered agents

### Strategic Value

- **Ecosystem Alignment** - Join OWS + MoonPay + PayPal ecosystem
- **User Experience** - Single wallet for users and agents
- **Interoperability** - Work with other OWS agents out of the box
- **Future-Proof** - Backed by Ethereum Foundation, major players

---

## Current State Analysis

### Existing Gradience Architecture

```
Gradience Protocol (Solana)
├── Identity: Solana wallet address
├── Settlement: Escrow contracts
├── Reputation: On-chain scoring
└── Messaging: Custom A2A (planned)
```

### With OWS Integration

```
Gradience + OWS
├── Identity: OWS Wallet (multi-chain)
├── Credentials: Verifiable credentials in OWS
├── Settlement: Gradience Protocol (Solana)
├── Reputation: Gradience + OWS attestations
└── Messaging: XMTP via OWS Agent Kit
```

---

## Phase 1: Foundation (Week 1)

### Task 1: Research OWS SDK

**Objective:** Understand OWS SDK capabilities and integration points

**Research:**
- OWS Core SDK: https://github.com/open-wallet-standard/core
- OWS Agent Kit capabilities
- Authentication flows
- Credential storage APIs

**Output:** Research notes in `docs/integrations/ows/research.md`

**Time:** 2 hours

---

### Task 2: Create OWS Adapter Module

**Objective:** Create clean abstraction layer for OWS integration

**Files:**
- Create: `packages/ows-adapter/src/wallet.ts`
- Create: `packages/ows-adapter/src/types.ts`
- Create: `packages/ows-adapter/package.json`

**Step 1: Create package structure**

```bash
mkdir -p packages/ows-adapter/src
mkdir -p packages/ows-adapter/tests
```

**Step 2: Write types**

```typescript
// packages/ows-adapter/src/types.ts
export interface OWSWallet {
  address: string;
  publicKey: string;
  signMessage(message: string): Promise<string>;
  signTransaction(tx: any): Promise<any>;
}

export interface OWSIdentity {
  did: string;
  wallet: OWSWallet;
  credentials: OWSCredential[];
}

export interface OWSCredential {
  type: string;
  issuer: string;
  data: any;
  signature: string;
}

export interface OWSAgentConfig {
  apiKey?: string;
  network: 'mainnet' | 'devnet';
  defaultChain: 'solana' | 'ethereum';
}
```

**Step 3: Write wallet adapter**

```typescript
// packages/ows-adapter/src/wallet.ts
import { OWSWallet, OWSIdentity, OWSAgentConfig } from './types';

export class OWSWalletAdapter {
  private config: OWSAgentConfig;
  private wallet: OWSWallet | null = null;

  constructor(config: OWSAgentConfig) {
    this.config = config;
  }

  async connect(): Promise<OWSWallet> {
    // Initialize OWS SDK connection
    // Return wallet instance
    throw new Error('Not implemented');
  }

  async getIdentity(): Promise<OWSIdentity> {
    // Get agent identity with credentials
    throw new Error('Not implemented');
  }

  async signTaskAgreement(taskHash: string): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }
    return this.wallet.signMessage(taskHash);
  }
}
```

**Step 4: Write basic test**

```typescript
// packages/ows-adapter/tests/wallet.test.ts
import { OWSWalletAdapter } from '../src/wallet';

describe('OWSWalletAdapter', () => {
  it('should create adapter with config', () => {
    const adapter = new OWSWalletAdapter({
      network: 'devnet',
      defaultChain: 'solana'
    });
    expect(adapter).toBeDefined();
  });
});
```

**Step 5: Commit**

```bash
git add packages/ows-adapter/
git commit -m "feat(ows-adapter): create foundation types and wallet adapter"
```

**Time:** 3 hours

---

### Task 3: Integrate with Gradience Agent

**Objective:** Connect OWS wallet to Gradience Agent identity

**Files:**
- Modify: `apps/agentm/src/shared/types.ts`
- Create: `apps/agentm/src/lib/ows-identity.ts`

**Step 1: Update Agent types**

```typescript
// apps/agentm/src/shared/types.ts
export interface AgentIdentity {
  // Existing
  solanaAddress: string;
  
  // New: OWS integration
  owsWallet?: string;
  owsDID?: string;
  credentials?: AgentCredential[];
}

export interface AgentCredential {
  type: 'reputation' | 'skill' | 'verification';
  issuer: string;
  data: any;
  issuedAt: number;
}
```

**Step 2: Create OWS identity manager**

```typescript
// apps/agentm/src/lib/ows-identity.ts
import { OWSWalletAdapter } from '@gradiences/ows-adapter';
import { AgentIdentity } from '../shared/types';

export class AgentOWSIdentity {
  private owsAdapter: OWSWalletAdapter;
  
  constructor() {
    this.owsAdapter = new OWSWalletAdapter({
      network: process.env.SOLANA_NETWORK === 'mainnet' ? 'mainnet' : 'devnet',
      defaultChain: 'solana'
    });
  }

  async initialize(): Promise<AgentIdentity> {
    const wallet = await this.owsAdapter.connect();
    const identity = await this.owsAdapter.getIdentity();
    
    return {
      solanaAddress: wallet.address,
      owsWallet: wallet.address,
      owsDID: identity.did,
      credentials: identity.credentials.map(c => ({
        type: c.type as any,
        issuer: c.issuer,
        data: c.data,
        issuedAt: Date.now()
      }))
    };
  }

  async signTask(taskHash: string): Promise<string> {
    return this.owsAdapter.signTaskAgreement(taskHash);
  }
}
```

**Step 3: Commit**

```bash
git add apps/agentm/src/shared/types.ts
 git add apps/agentm/src/lib/ows-identity.ts
git commit -m "feat(agent): integrate OWS identity with Agent types"
```

**Time:** 2 hours

---

## Phase 2: Messaging Integration (Week 1-2)

### Task 4: XMTP Integration via OWS

**Objective:** Enable agent-to-agent messaging through XMTP, using OWS for authentication

**Files:**
- Create: `packages/xmtp-adapter/src/client.ts`
- Create: `packages/xmtp-adapter/src/types.ts`

**Step 1: Install dependencies**

```bash
cd packages/xmtp-adapter
npm install @xmtp/xmtp-js @gradiences/ows-adapter
```

**Step 2: Create XMTP adapter**

```typescript
// packages/xmtp-adapter/src/client.ts
import { Client } from '@xmtp/xmtp-js';
import { OWSWalletAdapter } from '@gradiences/ows-adapter';

export interface XMTPMessage {
  id: string;
  sender: string;
  content: any;
  timestamp: number;
}

export class XMTPAgentClient {
  private client: Client | null = null;
  private owsWallet: OWSWalletAdapter;

  constructor(owsWallet: OWSWalletAdapter) {
    this.owsWallet = owsWallet;
  }

  async initialize(): Promise<void> {
    // Use OWS wallet to sign XMTP identity
    const signer = await this.owsWallet.getSigner();
    this.client = await Client.create(signer);
  }

  async sendMessage(toAgentId: string, content: any): Promise<string> {
    if (!this.client) {
      throw new Error('XMTP not initialized');
    }
    
    const conversation = await this.client.conversations.newConversation(toAgentId);
    const message = await conversation.send(JSON.stringify(content));
    return message.id;
  }

  async listenForMessages(callback: (msg: XMTPMessage) => void): Promise<void> {
    // Set up message stream
    if (!this.client) return;
    
    const stream = await this.client.conversations.streamAllMessages();
    for await (const message of stream) {
      callback({
        id: message.id,
        sender: message.senderAddress,
        content: JSON.parse(message.content),
        timestamp: message.sent.getTime()
      });
    }
  }
}
```

**Step 3: Commit**

```bash
git add packages/xmtp-adapter/
git commit -m "feat(xmtp-adapter): create XMTP messaging layer with OWS auth"
```

**Time:** 4 hours

---

### Task 5: Task Negotiation Protocol

**Objective:** Define message format for agent task negotiation over XMTP

**Files:**
- Create: `packages/protocol/src/messages.ts`

**Step 1: Define message types**

```typescript
// packages/protocol/src/messages.ts

export enum MessageType {
  TASK_REQUEST = 'TASK_REQUEST',
  TASK_RESPONSE = 'TASK_RESPONSE',
  TASK_ACCEPTED = 'TASK_ACCEPTED',
  TASK_REJECTED = 'TASK_REJECTED',
  DELIVERABLE_SUBMITTED = 'DELIVERABLE_SUBMITTED',
  PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED'
}

export interface TaskRequestMessage {
  type: MessageType.TASK_REQUEST;
  taskId: string;
  title: string;
  description: string;
  budget: number;
  currency: string;
  deadline: number;
  requirements: string[];
}

export interface TaskResponseMessage {
  type: MessageType.TASK_RESPONSE;
  taskId: string;
  accepted: boolean;
  counterOffer?: {
    budget: number;
    deadline: number;
  };
  reason?: string;
}

export interface TaskAcceptedMessage {
  type: MessageType.TASK_ACCEPTED;
  taskId: string;
  escrowAddress: string;
  gradienceTaskId: string;
}

// Protocol handler
export class TaskNegotiationProtocol {
  async handleMessage(message: any): Promise<any> {
    switch (message.type) {
      case MessageType.TASK_REQUEST:
        return this.handleTaskRequest(message);
      case MessageType.TASK_RESPONSE:
        return this.handleTaskResponse(message);
      // ... other handlers
    }
  }

  private async handleTaskRequest(msg: TaskRequestMessage): Promise<void> {
    // Agent evaluates task and decides
    console.log('Received task request:', msg.title);
  }

  private async handleTaskResponse(msg: TaskResponseMessage): Promise<void> {
    if (msg.accepted) {
      // Create Gradience escrow
      console.log('Task accepted, creating escrow...');
    }
  }
}
```

**Step 2: Commit**

```bash
git add packages/protocol/src/messages.ts
git commit -m "feat(protocol): define task negotiation message types"
```

**Time:** 3 hours

---

## Phase 3: Settlement Integration (Week 2)

### Task 6: Connect to Gradience Protocol

**Objective:** Link XMTP negotiation to Gradience settlement

**Files:**
- Create: `packages/integration/src/task-orchestrator.ts`

**Step 1: Create orchestrator**

```typescript
// packages/integration/src/task-orchestrator.ts
import { XMTPAgentClient } from '@gradiences/xmtp-adapter';
import { OWSWalletAdapter } from '@gradiences/ows-adapter';
import { GradienceSDK } from '@gradiences/sdk';
import { 
  TaskNegotiationProtocol, 
  MessageType,
  TaskRequestMessage 
} from '@gradiences/protocol';

export class TaskOrchestrator {
  private xmtp: XMTPAgentClient;
  private ows: OWSWalletAdapter;
  private gradience: GradienceSDK;
  private protocol: TaskNegotiationProtocol;

  constructor(config: {
    ows: OWSWalletAdapter;
    gradience: GradienceSDK;
  }) {
    this.ows = config.ows;
    this.gradience = config.gradience;
    this.xmtp = new XMTPAgentClient(this.ows);
    this.protocol = new TaskNegotiationProtocol();
  }

  async initialize(): Promise<void> {
    await this.xmtp.initialize();
    this.xmtp.listenForMessages(this.handleIncomingMessage.bind(this));
  }

  async publishTask(workerAgentId: string, task: TaskRequestMessage): Promise<string> {
    // 1. Send task request via XMTP
    await this.xmtp.sendMessage(workerAgentId, task);
    
    // 2. Wait for response (in real impl, use async/await or event)
    console.log('Task published, waiting for response...');
    return task.taskId;
  }

  async acceptTaskAndCreateEscrow(taskId: string): Promise<string> {
    // 1. Create Gradience task
    const gradienceTask = await this.gradience.createTask({
      title: 'Agent Task',
      reward: 500,
      judges: [], // Automated judge
      agents: [/* worker agent */],
      token: 'USDC'
    });

    // 2. Deposit funds
    await gradienceTask.deposit(500);

    // 3. Notify worker via XMTP
    await this.xmtp.sendMessage(/* worker */, {
      type: MessageType.TASK_ACCEPTED,
      taskId,
      escrowAddress: gradienceTask.escrowAddress,
      gradienceTaskId: gradienceTask.id
    });

    return gradienceTask.id;
  }

  private async handleIncomingMessage(msg: any): Promise<void> {
    await this.protocol.handleMessage(msg);
  }
}
```

**Step 2: Commit**

```bash
git add packages/integration/src/task-orchestrator.ts
git commit -m "feat(integration): create task orchestrator linking XMTP and Gradience"
```

**Time:** 4 hours

---

## Phase 4: Agent UI (Week 2-3)

### Task 7: Agent Dashboard

**Objective:** Create UI for agents to manage OWS identity and tasks

**Files:**
- Create: `apps/agentm/src/views/OWSDashboard.tsx`
- Modify: `apps/agentm/src/renderer/App.tsx`

**Step 1: Create dashboard component**

```tsx
// apps/agentm/src/views/OWSDashboard.tsx
import { useEffect, useState } from 'react';
import { AgentOWSIdentity } from '../lib/ows-identity';
import { XMTPAgentClient } from '@gradiences/xmtp-adapter';

export function OWSDashboard() {
  const [identity, setIdentity] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    loadIdentity();
    setupMessaging();
  }, []);

  async function loadIdentity() {
    const owsIdentity = new AgentOWSIdentity();
    const id = await owsIdentity.initialize();
    setIdentity(id);
  }

  async function setupMessaging() {
    // Setup XMTP message listener
  }

  return (
    <div className="ows-dashboard">
      <h1>Agent Identity</h1>
      {identity && (
        <div>
          <p>OWS Wallet: {identity.owsWallet}</p>
          <p>DID: {identity.owsDID}</p>
          <h3>Credentials</h3>
          <ul>
            {identity.credentials?.map((cred, i) => (
              <li key={i}>{cred.type} - {cred.issuer}</li>
            ))}
          </ul>
        </div>
      )}
      
      <h2>Active Tasks</h2>
      {/* Task list */}
      
      <h2>Messages</h2>
      {/* Message list */}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/agentm/src/views/OWSDashboard.tsx
git commit -m "feat(ui): add OWS identity dashboard for agents"
```

**Time:** 4 hours

---

## Phase 5: Testing & Documentation (Week 3)

### Task 8: Integration Tests

**Objective:** Write comprehensive tests for OWS integration

**Files:**
- Create: `tests/integration/ows-integration.test.ts`

**Step 1: Write integration tests**

```typescript
// tests/integration/ows-integration.test.ts
describe('OWS Integration', () => {
  describe('Wallet Connection', () => {
    it('should connect OWS wallet', async () => {
      // Test wallet connection
    });

    it('should retrieve agent identity', async () => {
      // Test identity retrieval
    });
  });

  describe('Task Negotiation', () => {
    it('should send task request via XMTP', async () => {
      // Test message sending
    });

    it('should receive and process task response', async () => {
      // Test message handling
    });
  });

  describe('Settlement', () => {
    it('should create escrow after task acceptance', async () => {
      // Test Gradience integration
    });
  });
});
```

**Step 2: Commit**

```bash
git add tests/integration/ows-integration.test.ts
git commit -m "test: add OWS integration tests"
```

**Time:** 3 hours

---

### Task 9: Documentation

**Objective:** Document OWS integration for developers

**Files:**
- Create: `docs/integrations/ows/README.md`
- Create: `docs/integrations/ows/quickstart.md`

**Step 1: Write README**

```markdown
# OWS Integration

Gradience uses OWS (Open Wallet Standard) for agent identity and authentication.

## Overview

- **Identity**: Agents use OWS Wallet as persistent identity
- **Authentication**: OWS signatures for task agreements
- **Messaging**: XMTP for agent-to-agent communication
- **Credentials**: Verifiable credentials stored in OWS

## Quick Start

```typescript
import { AgentOWSIdentity } from '@gradiences/agent';

const agent = new AgentOWSIdentity();
await agent.initialize();

// Now agent has OWS-backed identity
console.log(agent.identity.owsWallet);
```

## Architecture

See [architecture.md](./architecture.md)
```

**Step 2: Commit**

```bash
git add docs/integrations/ows/
git commit -m "docs: add OWS integration documentation"
```

**Time:** 2 hours

---

## Summary

### Total Timeline

| Phase | Tasks | Time | Week |
|-------|-------|------|------|
| Foundation | 1-3 | 7h | 1 |
| Messaging | 4-5 | 7h | 1-2 |
| Settlement | 6 | 4h | 2 |
| UI | 7 | 4h | 2-3 |
| Testing | 8-9 | 5h | 3 |
| **Total** | **9** | **27h** | **3 weeks** |

### Deliverables

1. ✅ OWS Adapter package (`@gradiences/ows-adapter`)
2. ✅ XMTP Adapter package (`@gradiences/xmtp-adapter`)
3. ✅ Task Negotiation Protocol (`@gradiences/protocol`)
4. ✅ Integration Layer (`@gradiences/integration`)
5. ✅ Agent Dashboard with OWS identity
6. ✅ Comprehensive tests
7. ✅ Developer documentation

### Strategic Outcomes

- **Hackathon Ready**: Can demo in 6 hours
- **Production Ready**: Full integration in 3 weeks
- **Ecosystem Alignment**: Part of OWS + MoonPay ecosystem
- **Future Proof**: Multi-chain, credential-based, interoperable

---

## Next Steps

1. **Review Plan** - Ensure alignment with product vision
2. **Prioritize** - Can compress to 1 week for hackathon demo
3. **Execute** - Use subagent-driven-development for implementation

**Ready to start?** Pick Task 1 and begin implementation.
