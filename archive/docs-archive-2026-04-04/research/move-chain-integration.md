# Move Chain Integration Research: Aptos & Sui

> **Document Type**: Technical Research  
> **Date**: 2026-04-04  
> **Status**: Research Complete  
> **Author**: Droid (AI Research Agent)

---

## Executive Summary

This document provides comprehensive research on integrating Move-based blockchains (Aptos and Sui) into the Gradience Protocol. Both chains emerged from Meta's Diem project and utilize the Move programming language, offering unique advantages for AI Agent escrow, reputation management, and secure task execution.

**Key Findings**:

- Both chains offer superior safety guarantees through Move's resource-oriented model
- Aptos and Sui have diverged significantly in architecture (account-centric vs object-centric)
- Integration requires chain-specific SDKs and wallet adapters
- Cross-chain reputation bridging via Wormhole is feasible for both
- Security considerations differ between chains due to architectural differences

---

## 1. Chain Comparison: Aptos vs Sui

### 1.1 Core Architecture Comparison

| Dimension         | Aptos                    | Sui                                |
| ----------------- | ------------------------ | ---------------------------------- |
| **Origin**        | Meta Diem (2022)         | Meta Diem (2022)                   |
| **Consensus**     | AptosBFT + DiemBFT v4    | Narwhal/Bullshark DAG              |
| **Data Model**    | Account-centric          | Object-centric                     |
| **Execution**     | Block-STM (parallel)     | Parallel execution (owned objects) |
| **TPS (Mainnet)** | ~160k (theoretical)      | ~800+ TPS sustained                |
| **Finality**      | ~0.9 seconds             | ~0.4 seconds (simple tx)           |
| **Move Variant**  | Core Move                | Sui Move (object-centric)          |
| **State Model**   | Global state tree        | Object graph                       |
| **Gas Model**     | Gas units + storage fees | Gas + storage rebates              |

### 1.2 Move Language Variants

#### Aptos Move (Core Move)

```move
// Aptos: Resource stored in account
module gradience::agent_profile {
    struct AgentProfile has key, store {
        reputation: u64,
        completed_tasks: u32,
        win_rate: u16,
    }

    public entry fun create_profile(account: &signer) {
        move_to(account, AgentProfile {
            reputation: 0,
            completed_tasks: 0,
            win_rate: 0,
        });
    }

    public fun update_reputation(
        profile: &mut AgentProfile,
        delta: u64
    ) {
        profile.reputation = profile.reputation + delta;
    }
}
```

#### Sui Move (Object-Centric)

```move
// Sui: Resource as standalone object
module gradience::agent_profile {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    struct AgentProfile has key, store {
        id: UID,
        owner: address,
        reputation: u64,
        completed_tasks: u32,
        win_rate: u16,
    }

    public entry fun create_profile(ctx: &mut TxContext) {
        let profile = AgentProfile {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            reputation: 0,
            completed_tasks: 0,
            win_rate: 0,
        };
        transfer::share_object(profile);
    }

    public entry fun update_reputation(
        profile: &mut AgentProfile,
        delta: u64
    ) {
        profile.reputation = profile.reputation + delta;
    }
}
```

### 1.3 Key Architectural Differences

| Aspect                | Aptos                         | Sui                               |
| --------------------- | ----------------------------- | --------------------------------- |
| **Resource Location** | Stored under accounts         | Standalone objects with UID       |
| **Ownership**         | Account-based (like Ethereum) | Object-level (more granular)      |
| **Transaction Model** | Sequential by default         | Parallel for independent objects  |
| **Shared State**      | All state is account-bound    | Explicit shared/owned distinction |
| **Upgradability**     | Module upgrade via governance | Package immutability by default   |
| **Events**            | Global event stream           | Per-object event emission         |

### 1.4 Ecosystem Maturity (2026)

| Metric                     | Aptos            | Sui                       |
| -------------------------- | ---------------- | ------------------------- |
| **TVL (DeFi)**             | ~$500M           | ~$1.2B                    |
| **Daily Active Addresses** | ~150k            | ~250k                     |
| **Developer Tooling**      | Mature           | Very Mature               |
| **Wallet Ecosystem**       | 5+ major wallets | 8+ major wallets          |
| **DEX Volume**             | $100M/day        | $200M/day                 |
| **NFT Ecosystem**          | Growing          | Established               |
| **AI/Agent Focus**         | Emerging         | Strong (Agentic Commerce) |

---

## 2. Move Language Support

### 2.1 Development Environment

#### Aptos Development Setup

```bash
# Install Aptos CLI
curl -fsSL "https://aptos.dev/scripts/install_cli.sh" | bash

# Initialize project
aptos init --network devnet

# Create Move project
aptos move init --name gradience_aptos

# Compile
aptos move compile

# Test
aptos move test

# Deploy
aptos move publish --named-addresses gradience=default
```

#### Sui Development Setup

```bash
# Install Sui CLI
cargo install --locked --git https://github.com/MystenLabs/sui.git sui

# Initialize project
sui client new-env --alias devnet --rpc https://fullnode.devnet.sui.io:443

# Create Move project
sui move new gradience_sui

# Build
sui move build

# Test
sui move test

# Deploy
sui client publish --gas-budget 100000000
```

### 2.2 TypeScript SDK Integration

#### Aptos TypeScript SDK (`@aptos-labs/ts-sdk`)

```typescript
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

// Initialize client
const config = new AptosConfig({ network: Network.MAINNET });
const aptos = new Aptos(config);

// Account operations
const account = Account.generate();
const balance = await aptos.getAccountAPTAmount({
    accountAddress: account.accountAddress,
});

// Submit transaction
const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
        function: 'gradience::agent_arena::post_task',
        functionArguments: [taskDesc, reward, deadline],
    },
});
const pendingTx = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction,
});
await aptos.waitForTransaction({ transactionHash: pendingTx.hash });

// Read resources
const resource = await aptos.getAccountResource({
    accountAddress: account.accountAddress,
    resourceType: 'gradience::agent_arena::AgentProfile',
});
```

#### Sui TypeScript SDK (`@mysten/sui`)

```typescript
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

// Initialize client
const client = new SuiClient({ url: getFullnodeUrl('mainnet') });
const keypair = Ed25519Keypair.generate();

// Build transaction
const tx = new Transaction();
tx.moveCall({
    target: `${PACKAGE_ID}::agent_arena::post_task`,
    arguments: [tx.pure.string(taskDesc), tx.pure.u64(reward), tx.pure.u64(deadline)],
});

// Execute
const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: {
        showEffects: true,
        showEvents: true,
    },
});

// Query objects
const objects = await client.getOwnedObjects({
    owner: keypair.getPublicKey().toSuiAddress(),
    filter: {
        StructType: `${PACKAGE_ID}::agent_arena::AgentProfile`,
    },
});
```

### 2.3 Move Abilities Comparison

| Ability | Aptos Meaning                        | Sui Meaning                |
| ------- | ------------------------------------ | -------------------------- |
| `key`   | Can be stored as top-level resource  | Has globally unique ID     |
| `store` | Can be stored inside other resources | Can be transferred/wrapped |
| `copy`  | Can be copied                        | Same                       |
| `drop`  | Can be dropped implicitly            | Same                       |

**Sui-specific**: Objects must have `key` to exist independently. The `UID` field is mandatory.

---

## 3. Wallet Options

### 3.1 Aptos Wallets

#### Petra Wallet (Primary Recommendation)

- **Type**: Browser extension + mobile
- **Developer**: Aptos Labs (official)
- **Features**:
    - AIP-62 compliant wallet standard
    - Hardware wallet support (Ledger)
    - dApp browser built-in
    - Gas estimation
- **SDK Integration**:

```typescript
import { PetraWallet } from "petra-plugin-wallet-adapter";
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";

// React setup
<AptosWalletAdapterProvider
    plugins={[new PetraWallet()]}
    autoConnect={true}
>
    <App />
</AptosWalletAdapterProvider>

// Transaction signing
const { signAndSubmitTransaction } = useWallet();
const result = await signAndSubmitTransaction({
    data: {
        function: "gradience::task::create",
        functionArguments: [...],
    },
});
```

#### Martian Wallet (Multi-chain)

- **Type**: Browser extension + mobile
- **Developer**: Martian
- **Features**:
    - Supports both Aptos AND Sui
    - NFT gallery
    - Token swaps
    - DeFi integrations
- **SDK Integration**:

```typescript
import { MartianWallet } from '@martianwallet/aptos-wallet-adapter';

// Similar to Petra integration
const plugins = [new MartianWallet()];
```

#### Other Aptos Wallets

| Wallet  | Type      | Key Feature      |
| ------- | --------- | ---------------- |
| Pontem  | Extension | Built-in DEX     |
| Rise    | Mobile    | Social features  |
| Fewcha  | Extension | Multi-account    |
| MSafe   | Multisig  | Enterprise-grade |
| Nightly | Extension | Multi-chain      |

### 3.2 Sui Wallets

#### Sui Wallet (Official)

- **Type**: Browser extension + mobile
- **Developer**: Mysten Labs (official)
- **Features**:
    - Native Sui integration
    - Staking support
    - Object explorer
    - Gas estimation with sponsorship
- **SDK Integration**:

```typescript
import { WalletProvider, useWallet } from "@mysten/dapp-kit";
import { SuiClientProvider } from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";

// React setup
<SuiClientProvider networks={{ mainnet: { url: getFullnodeUrl("mainnet") } }}>
    <WalletProvider autoConnect>
        <App />
    </WalletProvider>
</SuiClientProvider>

// Transaction signing
const { signAndExecuteTransaction } = useWallet();
const result = await signAndExecuteTransaction({
    transaction: tx,
});
```

#### Suiet Wallet Kit (Aggregator)

- **Type**: SDK/Aggregator
- **Developer**: Suiet
- **Features**:
    - Connects to ALL Sui wallets
    - Unified API
    - Auto-detection
- **SDK Integration**:

```typescript
import { WalletProvider, useWallet } from "@suiet/wallet-kit";

// Automatically detects installed wallets
<WalletProvider>
    <App />
</WalletProvider>
```

#### Other Sui Wallets

| Wallet       | Type      | Key Feature             |
| ------------ | --------- | ----------------------- |
| Ethos        | Extension | Beginner-friendly       |
| Glass        | Extension | Privacy focus           |
| Martian      | Extension | Multi-chain (Aptos+Sui) |
| Nightly      | Extension | Multi-chain             |
| OKX Wallet   | Extension | Exchange integration    |
| Trust Wallet | Mobile    | Mass adoption           |

### 3.3 Wallet Selection Matrix for Gradience

| Use Case                | Recommended Wallet     | Reason                 |
| ----------------------- | ---------------------- | ---------------------- |
| **Aptos Integration**   | Petra                  | Official, most tested  |
| **Sui Integration**     | Sui Wallet + Suiet Kit | Maximum compatibility  |
| **Multi-chain Support** | Martian / Nightly      | Single wallet for both |
| **Enterprise/Multisig** | MSafe (Aptos)          | Advanced security      |
| **Agent Automation**    | Keypair-based          | Programmatic control   |

---

## 4. Integration Architecture

### 4.1 Gradience Move Module Architecture

```
Gradience Protocol on Move Chains
├── Core Modules
│   ├── agent_arena.move       # Task posting, bidding, settlement
│   ├── reputation.move        # Agent reputation tracking
│   ├── escrow.move           # Fund custody and release
│   └── judge.move            # Evaluation interface
├── Bridge Modules
│   ├── wormhole_bridge.move  # Cross-chain messaging
│   └── reputation_sync.move  # Reputation attestation
└── Utility Modules
    ├── events.move           # Event emission
    └── admin.move            # Governance
```

### 4.2 Aptos Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Aptos Integration                         │
├─────────────────────────────────────────────────────────────┤
│  gradiences/sdk                                              │
│  ├── AptosProvider implements ChainProvider                  │
│  │   ├── connect()                                          │
│  │   ├── postTask()                                         │
│  │   ├── submitResult()                                     │
│  │   ├── judgeAndPay()                                      │
│  │   └── syncReputation()                                   │
│  └── AptosWalletAdapter                                     │
│      ├── PetraAdapter                                       │
│      └── MartianAdapter                                     │
├─────────────────────────────────────────────────────────────┤
│  On-Chain (Move Modules)                                     │
│  ├── gradience::agent_arena                                 │
│  │   ├── Task (resource)                                    │
│  │   ├── Application (resource)                             │
│  │   └── Submission (resource)                              │
│  ├── gradience::reputation                                  │
│  │   └── AgentReputation (resource)                         │
│  └── gradience::escrow                                      │
│      └── EscrowVault (resource)                             │
├─────────────────────────────────────────────────────────────┤
│  External Dependencies                                       │
│  ├── @aptos-labs/ts-sdk                                     │
│  ├── @aptos-labs/wallet-adapter-react                       │
│  ├── Wormhole SDK (cross-chain)                             │
│  └── Aptos Indexer (event streaming)                        │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Sui Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Sui Integration                          │
├─────────────────────────────────────────────────────────────┤
│  gradiences/sdk                                              │
│  ├── SuiProvider implements ChainProvider                    │
│  │   ├── connect()                                          │
│  │   ├── postTask()                                         │
│  │   ├── submitResult()                                     │
│  │   ├── judgeAndPay()                                      │
│  │   └── syncReputation()                                   │
│  └── SuiWalletAdapter                                       │
│      ├── SuiWalletAdapter                                   │
│      ├── SuietKitAdapter                                    │
│      └── MartianSuiAdapter                                  │
├─────────────────────────────────────────────────────────────┤
│  On-Chain (Move Modules - Object Model)                      │
│  ├── gradience::agent_arena                                 │
│  │   ├── Task (shared object)                               │
│  │   ├── Application (owned object)                         │
│  │   └── Submission (owned object)                          │
│  ├── gradience::reputation                                  │
│  │   └── AgentReputation (shared object)                    │
│  └── gradience::escrow                                      │
│      └── EscrowVault (shared object)                        │
├─────────────────────────────────────────────────────────────┤
│  External Dependencies                                       │
│  ├── @mysten/sui                                            │
│  ├── @mysten/dapp-kit                                       │
│  ├── Wormhole SDK (cross-chain)                             │
│  └── Sui Indexer (event streaming)                          │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 Cross-Chain Reputation Bridge

```
┌─────────────────────────────────────────────────────────────┐
│              Cross-Chain Reputation Sync                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Solana (Primary)         Wormhole          Move Chains    │
│   ┌──────────────┐                         ┌──────────────┐ │
│   │ Reputation   │    ──────────────────>  │ Reputation   │ │
│   │ Account PDA  │    Attestation VAA      │ Resource     │ │
│   │              │                         │ (Aptos/Sui)  │ │
│   │ avg_score    │    Fields Synced:       │              │ │
│   │ completed    │    - avg_score          │ avg_score    │ │
│   │ win_rate     │    - completed          │ completed    │ │
│   │ total_earned │    - timestamp          │ win_rate     │ │
│   │ last_active  │    - signature          │ last_sync    │ │
│   └──────────────┘                         └──────────────┘ │
│                                                              │
│   Sync Triggers:                                             │
│   1. Manual sync request (Agent initiated)                   │
│   2. Threshold-based (>10 completed tasks)                   │
│   3. Periodic (daily aggregation)                            │
│                                                              │
│   Verification:                                              │
│   - Wormhole VAA signature validation                        │
│   - Solana state proof verification                          │
│   - Timestamp freshness check (<24h)                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.5 SDK Provider Interface

```typescript
// Chain Hub SDK - Move Provider Interface
interface MoveChainProvider extends ChainProvider {
    // Core operations
    postTask(params: TaskParams): Promise<TxResult>;
    applyForTask(taskId: string): Promise<TxResult>;
    submitResult(taskId: string, result: SubmissionParams): Promise<TxResult>;
    judgeAndPay(taskId: string, scores: JudgeParams): Promise<TxResult>;

    // Reputation
    getReputation(agentAddress: string): Promise<ReputationData>;
    syncReputationFromSolana(proof: WormholeVAA): Promise<TxResult>;

    // Queries
    getTask(taskId: string): Promise<Task>;
    getOpenTasks(filters?: TaskFilters): Promise<Task[]>;
    getAgentSubmissions(agentAddress: string): Promise<Submission[]>;

    // Events
    subscribeToEvents(callback: EventCallback): Unsubscribe;
}

// Aptos-specific implementation
class AptosProvider implements MoveChainProvider {
    private client: Aptos;
    private moduleAddress: string;

    constructor(config: AptosProviderConfig) {
        this.client = new Aptos(
            new AptosConfig({
                network: config.network,
            }),
        );
        this.moduleAddress = config.moduleAddress;
    }

    async postTask(params: TaskParams): Promise<TxResult> {
        const tx = await this.client.transaction.build.simple({
            sender: params.poster,
            data: {
                function: `${this.moduleAddress}::agent_arena::post_task`,
                functionArguments: [
                    params.description,
                    params.evaluationCid,
                    params.deadline,
                    params.judge,
                    params.reward,
                    params.minStake,
                ],
            },
        });
        return this.signAndSubmit(tx);
    }

    // ... other implementations
}

// Sui-specific implementation
class SuiProvider implements MoveChainProvider {
    private client: SuiClient;
    private packageId: string;

    constructor(config: SuiProviderConfig) {
        this.client = new SuiClient({ url: config.rpcUrl });
        this.packageId = config.packageId;
    }

    async postTask(params: TaskParams): Promise<TxResult> {
        const tx = new Transaction();

        // Split coin for escrow
        const [coin] = tx.splitCoins(tx.gas, [params.reward]);

        tx.moveCall({
            target: `${this.packageId}::agent_arena::post_task`,
            arguments: [
                tx.pure.string(params.description),
                tx.pure.string(params.evaluationCid),
                tx.pure.u64(params.deadline),
                tx.pure.address(params.judge),
                coin,
                tx.pure.u64(params.minStake),
            ],
        });

        return this.signAndExecute(tx);
    }

    // ... other implementations
}
```

---

## 5. Security Considerations

### 5.1 Move Language Security Features

Move provides inherent security guarantees that benefit Gradience integration:

| Feature                  | Security Benefit                                    | Gradience Application                                |
| ------------------------ | --------------------------------------------------- | ---------------------------------------------------- |
| **Resource Safety**      | Assets cannot be duplicated or destroyed implicitly | Task rewards and stakes are provably safe            |
| **Type Safety**          | Strong typing prevents type confusion               | Agent profiles cannot be miscast                     |
| **Linear Types**         | Resources must be explicitly handled                | Escrow funds must be moved, not copied               |
| **Borrow Checker**       | Prevents double-spend at compile time               | Task state cannot be modified twice                  |
| **Module Encapsulation** | Private state access                                | Reputation can only be updated by authorized modules |

### 5.2 Aptos-Specific Security Considerations

#### 5.2.1 Known Vulnerability Patterns

| Vulnerability            | Description                                   | Mitigation                                      |
| ------------------------ | --------------------------------------------- | ----------------------------------------------- |
| **Signer Validation**    | Missing signer checks in public functions     | Always verify `&signer` for state modifications |
| **Resource Existence**   | Not checking if resource exists before access | Use `exists<T>(addr)` before `borrow_global`    |
| **Integer Overflow**     | Arithmetic operations without bounds          | Use SafeMath or explicit overflow checks        |
| **Access Control**       | Improper capability management                | Implement capability-based access patterns      |
| **Reentrancy (Limited)** | Cross-module callbacks                        | Review all external module calls                |

#### 5.2.2 Aptos Best Practices

```move
// Secure pattern: Signer validation + existence check
public entry fun update_reputation(
    admin: &signer,
    agent: address,
    delta: u64
) acquires AgentReputation, AdminCap {
    // 1. Verify admin capability
    let admin_addr = signer::address_of(admin);
    assert!(exists<AdminCap>(admin_addr), ERROR_NOT_ADMIN);

    // 2. Check resource existence
    assert!(exists<AgentReputation>(agent), ERROR_PROFILE_NOT_FOUND);

    // 3. Borrow and update with bounds check
    let profile = borrow_global_mut<AgentReputation>(agent);
    let new_rep = profile.reputation + delta;
    assert!(new_rep >= profile.reputation, ERROR_OVERFLOW); // Overflow check
    profile.reputation = new_rep;

    // 4. Emit event for indexing
    event::emit(ReputationUpdated { agent, new_reputation: new_rep });
}
```

### 5.3 Sui-Specific Security Considerations

#### 5.3.1 Known Vulnerability Patterns

| Vulnerability                | Description                              | Mitigation                                     |
| ---------------------------- | ---------------------------------------- | ---------------------------------------------- |
| **Object Ownership**         | Incorrect shared vs owned object usage   | Plan object access patterns carefully          |
| **Dynamic Fields**           | Unbounded storage growth                 | Implement size limits                          |
| **Clock Manipulation**       | Trusting `Clock` for critical operations | Use epoch-based timing for important deadlines |
| **Shared Object Contention** | DoS through shared object spam           | Rate limiting, gas economics                   |
| **Transfer Confusion**       | Transferring objects to wrong recipients | Explicit address validation                    |

#### 5.3.2 Sui Best Practices

```move
// Secure pattern: Object ownership and access control
public entry fun submit_result(
    task: &mut Task,
    submission: Submission,
    clock: &Clock,
    ctx: &mut TxContext
) {
    // 1. Verify task is open
    assert!(task.state == TASK_OPEN, ERROR_TASK_NOT_OPEN);

    // 2. Verify deadline not passed
    let now = clock::timestamp_ms(clock);
    assert!(now < task.deadline, ERROR_DEADLINE_PASSED);

    // 3. Verify submitter is applicant
    let submitter = tx_context::sender(ctx);
    assert!(
        vector::contains(&task.applicants, &submitter),
        ERROR_NOT_APPLICANT
    );

    // 4. Store submission (owned by submitter)
    let submission_obj = Submission {
        id: object::new(ctx),
        task_id: object::id(task),
        agent: submitter,
        result_cid: submission.result_cid,
        trace_cid: submission.trace_cid,
        timestamp: now,
    };

    // Transfer to task creator for review
    transfer::transfer(submission_obj, task.poster);
}
```

### 5.4 Cross-Chain Security

#### 5.4.1 Wormhole Integration Security

| Risk                  | Mitigation                          |
| --------------------- | ----------------------------------- |
| **VAA Forgery**       | Verify Guardian signatures on-chain |
| **Replay Attacks**    | Track consumed VAAs by hash         |
| **Stale Data**        | Require recent timestamp (<24h)     |
| **Chain ID Mismatch** | Verify source/target chain IDs      |

#### 5.4.2 Reputation Bridge Security

```move
// Secure cross-chain reputation sync
public entry fun sync_reputation_from_solana(
    vaa_bytes: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext
) acquires ReputationBridge, AgentReputation {
    // 1. Parse and verify VAA
    let vaa = wormhole::parse_and_verify_vaa(vaa_bytes);

    // 2. Verify source chain (Solana = chain ID 1)
    assert!(wormhole::get_emitter_chain(&vaa) == 1, ERROR_INVALID_CHAIN);

    // 3. Check VAA not already consumed
    let bridge = borrow_global_mut<ReputationBridge>(@gradience);
    let vaa_hash = wormhole::get_hash(&vaa);
    assert!(
        !table::contains(&bridge.consumed_vaas, vaa_hash),
        ERROR_VAA_ALREADY_CONSUMED
    );

    // 4. Verify timestamp freshness (within 24 hours)
    let payload = wormhole::get_payload(&vaa);
    let rep_data = parse_reputation_payload(payload);
    let now = clock::timestamp_ms(clock) / 1000;
    assert!(now - rep_data.timestamp < 86400, ERROR_STALE_VAA);

    // 5. Mark VAA as consumed
    table::add(&mut bridge.consumed_vaas, vaa_hash, true);

    // 6. Update local reputation
    update_or_create_reputation(rep_data.agent, rep_data, ctx);
}
```

### 5.5 Security Audit Checklist

Before deployment, ensure:

- [ ] All public entry functions validate signers
- [ ] Resource existence checked before access
- [ ] Integer arithmetic uses overflow-safe operations
- [ ] Cross-module calls are reviewed for reentrancy
- [ ] Object ownership patterns are intentional (Sui)
- [ ] Shared objects have contention mitigation (Sui)
- [ ] Wormhole VAAs are validated and deduped
- [ ] Timestamps use appropriate precision
- [ ] Events emitted for all state changes
- [ ] Admin capabilities are properly protected
- [ ] Upgrade mechanisms have time-locks

---

## 6. Implementation Roadmap

### 6.1 Phase Overview

```
Phase 1 (Weeks 1-3): Aptos Core Implementation
├── Week 1: Module development + unit tests
├── Week 2: SDK integration + devnet deployment
└── Week 3: Wallet integration + frontend components

Phase 2 (Weeks 4-5): Cross-Chain Bridge
├── Week 4: Wormhole integration (Solana → Aptos)
└── Week 5: Reputation sync + testing

Phase 3 (Weeks 6-8): Sui Adaptation
├── Week 6: Object-centric module adaptation
├── Week 7: SDK + wallet integration
└── Week 8: Testing + mainnet preparation

Phase 4 (Week 9): Mainnet Launch
├── Security audit
├── Mainnet deployment
└── Monitoring setup
```

### 6.2 Phase 1: Aptos Core Implementation (3 weeks)

#### Week 1: Module Development

| Day | Task                         | Deliverable             |
| --- | ---------------------------- | ----------------------- |
| 1-2 | Set up Aptos dev environment | CLI + project structure |
| 3-4 | Implement `agent_arena.move` | Task CRUD operations    |
| 5   | Implement `reputation.move`  | Reputation tracking     |
| 6   | Implement `escrow.move`      | Fund management         |
| 7   | Unit tests                   | 80%+ coverage           |

**Key Deliverables**:

- `gradience::agent_arena` module with Task, Application, Submission
- `gradience::reputation` module with AgentReputation
- `gradience::escrow` module with secure fund custody
- Comprehensive Move unit tests

#### Week 2: SDK Integration

| Day | Task                         | Deliverable                  |
| --- | ---------------------------- | ---------------------------- |
| 1-2 | Create `AptosProvider` class | ChainProvider implementation |
| 3-4 | Implement all SDK methods    | Full SDK coverage            |
| 5   | Deploy to devnet             | Live devnet contracts        |
| 6   | SDK integration tests        | End-to-end tests             |
| 7   | Documentation                | API docs + examples          |

**Key Deliverables**:

- `@gradiences/sdk` with AptosProvider
- Devnet deployment scripts
- Integration test suite
- SDK documentation

#### Week 3: Wallet Integration

| Day | Task                   | Deliverable          |
| --- | ---------------------- | -------------------- |
| 1-2 | Petra wallet adapter   | React hooks          |
| 3-4 | Martian wallet adapter | Multi-wallet support |
| 5-6 | Frontend components    | Task UI components   |
| 7   | Demo application       | Working demo         |

**Key Deliverables**:

- Wallet adapter implementations
- React components for Aptos tasks
- Demo dApp on devnet

### 6.3 Phase 2: Cross-Chain Bridge (2 weeks)

#### Week 4: Wormhole Integration

| Day | Task                   | Deliverable            |
| --- | ---------------------- | ---------------------- |
| 1-2 | Wormhole SDK setup     | Bridge client          |
| 3-4 | Solana VAA emission    | Source chain code      |
| 5-6 | Aptos VAA verification | Destination chain code |
| 7   | Integration tests      | Cross-chain tests      |

**Key Deliverables**:

- Solana program for reputation attestation
- Aptos module for VAA verification
- Cross-chain test suite

#### Week 5: Reputation Sync

| Day | Task                     | Deliverable       |
| --- | ------------------------ | ----------------- |
| 1-2 | Sync trigger logic       | Event-based sync  |
| 3-4 | Batch sync support       | Efficient syncing |
| 5-6 | Error handling + retries | Robust sync       |
| 7   | Monitoring setup         | Observability     |

**Key Deliverables**:

- Automated reputation sync
- Batch processing for efficiency
- Error recovery mechanisms
- Monitoring dashboards

### 6.4 Phase 3: Sui Adaptation (3 weeks)

#### Week 6: Object-Centric Modules

| Day | Task                     | Deliverable      |
| --- | ------------------------ | ---------------- |
| 1-2 | Adapt `agent_arena.move` | Sui objects      |
| 3-4 | Adapt `reputation.move`  | Shared objects   |
| 5-6 | Adapt `escrow.move`      | Object transfers |
| 7   | Unit tests               | Move tests       |

**Key Deliverables**:

- Sui-native Move modules
- Object ownership patterns
- Comprehensive tests

#### Week 7: Sui SDK + Wallet

| Day | Task                         | Deliverable    |
| --- | ---------------------------- | -------------- |
| 1-2 | Create `SuiProvider` class   | ChainProvider  |
| 3-4 | Suiet wallet kit integration | Multi-wallet   |
| 5-6 | Deploy to devnet             | Live contracts |
| 7   | Integration tests            | E2E tests      |

**Key Deliverables**:

- `@gradiences/sdk` with SuiProvider
- Suiet wallet kit integration
- Devnet deployment

#### Week 8: Testing + Preparation

| Day | Task                | Deliverable    |
| --- | ------------------- | -------------- |
| 1-2 | Cross-chain testing | Bridge tests   |
| 3-4 | Performance testing | Load tests     |
| 5-6 | Security review     | Internal audit |
| 7   | Documentation       | Final docs     |

**Key Deliverables**:

- Complete test coverage
- Performance benchmarks
- Security checklist complete
- Deployment documentation

### 6.5 Phase 4: Mainnet Launch (1 week)

| Day | Task                       | Deliverable      |
| --- | -------------------------- | ---------------- |
| 1-2 | External security audit    | Audit report     |
| 3-4 | Audit remediation          | Fixed issues     |
| 5   | Mainnet deployment (Aptos) | Live contracts   |
| 6   | Mainnet deployment (Sui)   | Live contracts   |
| 7   | Monitoring + alerting      | Production ready |

**Key Deliverables**:

- Security audit report
- Mainnet contracts (both chains)
- Production monitoring

### 6.6 Resource Requirements

| Phase   | Engineers | Skills Required         |
| ------- | --------- | ----------------------- |
| Phase 1 | 2         | Move, TypeScript, React |
| Phase 2 | 2         | Solana, Wormhole, Move  |
| Phase 3 | 2         | Sui Move, TypeScript    |
| Phase 4 | 1         | DevOps, Security        |

### 6.7 Dependencies

| Dependency                         | Version | Purpose                  |
| ---------------------------------- | ------- | ------------------------ |
| `@aptos-labs/ts-sdk`               | ^1.0.0  | Aptos TypeScript SDK     |
| `@mysten/sui`                      | ^2.0.0  | Sui TypeScript SDK       |
| `@aptos-labs/wallet-adapter-react` | ^3.0.0  | Aptos wallet integration |
| `@mysten/dapp-kit`                 | ^0.14.0 | Sui wallet integration   |
| `@suiet/wallet-kit`                | ^0.4.0  | Sui multi-wallet         |
| `@certusone/wormhole-sdk`          | ^0.10.0 | Cross-chain messaging    |

### 6.8 Success Metrics

| Metric                   | Target     | Measurement         |
| ------------------------ | ---------- | ------------------- |
| Module Test Coverage     | >90%       | Move test framework |
| SDK Integration Tests    | 100% pass  | Jest/Vitest         |
| Transaction Success Rate | >99.5%     | On-chain metrics    |
| Reputation Sync Latency  | <5 minutes | Monitoring          |
| Wallet Connect Success   | >98%       | Analytics           |
| Security Audit           | 0 critical | Audit report        |

---

## 7. Appendix

### 7.1 Reference Links

**Aptos**:

- Documentation: https://aptos.dev
- TypeScript SDK: https://aptos-labs.github.io/aptos-ts-sdk/
- Move Book: https://aptos.dev/build/smart-contracts/book
- Wallet Adapter: https://aptos.dev/build/sdks/wallet-adapter

**Sui**:

- Documentation: https://docs.sui.io
- TypeScript SDK: https://sdk.mystenlabs.com
- Move Guide: https://docs.sui.io/build/move
- dApp Kit: https://sdk.mystenlabs.com/dapp-kit

**Cross-Chain**:

- Wormhole: https://docs.wormhole.com
- Wormhole Aptos: https://docs.wormhole.com/wormhole/blockchain-environments/aptos
- Wormhole Sui: https://docs.wormhole.com/wormhole/blockchain-environments/sui

**Security**:

- Move Security Guidelines: https://aptos.dev/build/smart-contracts/move-security-guidelines
- OWASP Smart Contract Top 10: https://scs.owasp.org/sctop10/

### 7.2 Glossary

| Term          | Definition                                                      |
| ------------- | --------------------------------------------------------------- |
| **Move**      | Resource-oriented programming language for smart contracts      |
| **Resource**  | Linear type in Move that cannot be copied or dropped implicitly |
| **Object**    | Sui's primitive unit of storage with unique ID                  |
| **PDA**       | Program Derived Address (Solana concept)                        |
| **VAA**       | Verified Action Approval (Wormhole message format)              |
| **Block-STM** | Aptos's parallel execution engine                               |
| **Narwhal**   | Sui's DAG-based mempool                                         |
| **Bullshark** | Sui's consensus mechanism                                       |

### 7.3 Version History

| Version | Date       | Changes                   |
| ------- | ---------- | ------------------------- |
| 1.0     | 2026-04-04 | Initial research document |

---

_Document generated by Droid AI Research Agent for Gradience Protocol_
