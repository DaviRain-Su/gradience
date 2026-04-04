# Technical Spec: Metaplex Agent Registry Integration
## Phase 3 — agentm-web sub-module

> **Parent PRD**: docs/hackathon/metaplex/demo.md
> **Track**: Metaplex Agents Track ($5,000 prize)
> **Scope**: agentm-web + agentm-pro Metaplex integration layer
> **Status**: Active

---

## 1. Scope

Two deliverables:

| File | Purpose |
|------|---------|
| `apps/agentm-web/src/lib/metaplex/agent-registry.ts` | On-chain agent identity via Metaplex Core Assets |
| `apps/agentm-web/src/lib/metaplex/a2a-demo.ts` | Hackathon demo: two agents negotiate + settle |
| `apps/agentm-pro/src/lib/metaplex/a2a-interactions.ts` | Enhance mock data + add real SDK stubs |

---

## 2. Dependencies

```
@metaplex-foundation/umi               ^1.x   — UMI framework
@metaplex-foundation/umi-bundle-defaults ^1.x  — devnet/mainnet HTTP setup
@metaplex-foundation/mpl-core          ^1.x   — Core Asset program
```

Added to `apps/agentm-web/package.json`. The agentm-pro files remain mock-only (no extra deps).

---

## 3. Data Structures

### 3.1 MetaplexAgentAsset

```typescript
interface MetaplexAgentAsset {
    /** Metaplex Core Asset public key (base58) */
    assetAddress: string;
    /** Human-readable agent name (≤32 chars) */
    name: string;
    /** Agent capabilities encoded as URI attributes */
    uri: string;
    /** Owner wallet (base58) */
    owner: string;
    /** Registration timestamp (ms) */
    registeredAt: number;
    /** Capabilities derived from URI metadata */
    capabilities: string[];
    /** Unique agent ID derived from asset address */
    agentId: string;
}
```

### 3.2 AgentRegistrationInput

```typescript
interface AgentRegistrationInput {
    /** Wallet adapter / UMI signer */
    wallet: WalletAdapter | MockWallet;
    /** Display name (1–32 chars) */
    name: string;
    /** Agent capability tags */
    capabilities: string[];
    /** Optional metadata URI override */
    metadataUri?: string;
}
```

### 3.3 A2AInteractionStep

```typescript
interface A2AInteractionStep {
    step: number;
    actor: 'agent_a' | 'agent_b' | 'protocol';
    action: string;
    payload: Record<string, unknown>;
    timestamp: number;
    txRef?: string;
}
```

### 3.4 A2ADemoResult

```typescript
interface A2ADemoResult {
    agentA: MetaplexAgentAsset;
    agentB: MetaplexAgentAsset;
    steps: A2AInteractionStep[];
    settlement: {
        amount: number;
        token: 'SOL' | 'USDC';
        txRef: string;
        settledAt: number;
    };
    success: boolean;
}
```

---

## 4. Function Signatures

### agent-registry.ts

```typescript
// Register a new agent on-chain using Metaplex Core
// - Creates a Core Asset with name + attributes plugin
// - Returns the registered agent details
// - In demo mode (no real wallet): returns a deterministic mock
async function registerAgent(input: AgentRegistrationInput): Promise<MetaplexAgentAsset>

// Fetch a single agent by asset address
// - Queries Metaplex Core Asset on-chain
// - Falls back to registry cache in demo mode
async function getAgentInfo(assetAddress: string): Promise<MetaplexAgentAsset | null>

// List all agents registered under a given collection or authority
// - Uses Metaplex DAS (Digital Asset Standard) API
// - Falls back to static demo registry
async function listAgents(options?: { owner?: string; limit?: number }): Promise<MetaplexAgentAsset[]>

// Build the metadata URI for an agent
// - Encodes capabilities as JSON attributes
// - Returns a data URI (demo) or uploads to Arweave/IPFS (production)
function buildAgentMetadataUri(name: string, capabilities: string[]): string
```

### a2a-demo.ts

```typescript
// Full hackathon demo: two agents interact end-to-end
// Steps: register → post task → discover → negotiate → settle
async function runA2ADemo(options?: { simulate?: boolean }): Promise<A2ADemoResult>

// Step 1: register two demo agents
async function setupDemoAgents(): Promise<{ agentA: MetaplexAgentAsset; agentB: MetaplexAgentAsset }>

// Step 2: simulate task posting by Agent A
function postDemoTask(agentA: MetaplexAgentAsset): A2AInteractionStep

// Step 3: Agent B discovers the task
function discoverTask(agentB: MetaplexAgentAsset): A2AInteractionStep

// Step 4: negotiation exchange (3 messages)
function negotiateTask(agentA: MetaplexAgentAsset, agentB: MetaplexAgentAsset): A2AInteractionStep[]

// Step 5: Gradience Protocol settlement
function settleTask(agentA: MetaplexAgentAsset, agentB: MetaplexAgentAsset, amount: number): A2AInteractionStep
```

---

## 5. Behavior Rules

### registerAgent
- Name must be trimmed, 1–32 chars; throw `Error('name too long')` if >32
- Capabilities must be a non-empty array; throw `Error('capabilities required')` if empty
- When `NEXT_PUBLIC_SOLANA_RPC` is set and a real signer is provided: call `createV1` from `@metaplex-foundation/mpl-core`
- Otherwise: return a deterministic mock derived from `sha256(name + capabilities.join(','))`
- `agentId` format: `mplx-agent:${assetAddress.slice(0, 8).toLowerCase()}`
- `registeredAt`: `Date.now()`

### getAgentInfo
- Return `null` for unknown addresses (never throw)
- Demo fallback: search the static `DEMO_REGISTRY` array

### listAgents
- Default `limit`: 20
- Demo fallback: return `DEMO_REGISTRY.slice(0, limit)`
- Real path: query Metaplex DAS via `fetch(RPC_URL, { method: 'getAssetsByOwner', ... })`

### buildAgentMetadataUri
- Returns `data:application/json;base64,<encoded>` with shape:
  ```json
  { "name": "...", "description": "Gradience Protocol Agent", "attributes": [{"trait_type": "capability", "value": "..."}] }
  ```

### runA2ADemo
- Always runs in simulate mode for hackathon (no real wallet required)
- Returns deterministic result for same inputs (seeded by agent names)
- Total steps: exactly 7 (register A, register B, post task, discover, negotiate x2, settle)
- Settlement amount: 0.05 SOL (50_000_000 lamports)

---

## 6. Error Codes

| Condition | Error message |
|-----------|--------------|
| name.length > 32 | `'agent name must be ≤ 32 characters'` |
| capabilities empty | `'at least one capability is required'` |
| RPC unreachable | `'metaplex rpc unavailable — using demo mode'` (non-fatal, falls back) |

---

## 7. Demo Registry (Static)

Three demo agents used as fallback and in the A2A demo:

```
ID: mplx-agent:7xkx9yz1    name: MarketAnalyzer_v1   capabilities: [nft-analysis, pricing, tensor-trading]
ID: mplx-agent:4fqr2mn8    name: TaskExecutor_v1     capabilities: [task-execution, code-review, qa-testing]
ID: mplx-agent:9bwp1ck5    name: DataIndexer_v1      capabilities: [data-indexing, collection-analytics, metadata-repair]
```

---

## 8. Integration Points

### With existing agentm-pro code
- `reputation-bridge.ts`: `buildMetaplexReputationBridge` already uses the same `mplx-agent:` prefix pattern → compatible
- `a2a-interactions.ts`: existing `METAPLEX_REGISTRY` format is source of truth for mock agent shape

### With OWS wallet (agentm-web)
- `OWSAgentWalletManager.getBinding(accountKey).masterWallet` is the `owner` field on `MetaplexAgentAsset`

### With Gradience Protocol
- Settlement `txRef` format: `gradience-settle-${hex8}` to distinguish from Metaplex-native refs

---

## 9. File Location

```
apps/agentm-web/src/lib/metaplex/
├── agent-registry.ts       ← new
└── a2a-demo.ts             ← new
apps/agentm-pro/src/lib/metaplex/
└── a2a-interactions.ts     ← update existing
```

---

*Technical Spec complete. Proceed to Phase 6: Implementation.*
