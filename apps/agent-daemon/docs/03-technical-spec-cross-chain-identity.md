# Phase 3: Technical Spec — Cross-Chain Identity Binding (GRA-267)

> **Status**: Phase 3 — Ready for Implementation  
> **Date**: 2026-04-08  
> **Version**: v0.1  
> **Task**: GRA-267

---

## 0. Problem Statement

Gradience operates on both Solana and EVM (Base/Arbitrum). An agent may have:

- a Solana wallet for Agent Arena tasks
- an EVM wallet for ERC-8004 reputation and EVM escrow

Without a unified identity layer, the Reputation Oracle cannot answer the question:
"What is the total reputation of this agent across all chains?"

GRA-267 solves this by introducing a **Solana-native IdentityBinding registry**
backed by **bidirectional wallet signatures** and validated by the **Gradience Oracle**.

---

## 1. Design Philosophy: "Self-Attested + Oracle Attested"

| Layer                   | Who acts         | What happens                                    | Trust level      |
| ----------------------- | ---------------- | ----------------------------------------------- | ---------------- |
| **Binding Request**     | User (agent)     | Signs a cross-chain address with both wallets   | Cryptographic    |
| **Oracle Verification** | Gradience Oracle | Verifies both signatures on-chain/off-chain     | Protocol-trusted |
| **Reputation Query**    | Oracle           | Looks up binding, aggregates multi-chain scores | Unified view     |

> The user **proves** ownership of both addresses. The Oracle **attests** that the proof is valid. No single party can arbitrarily bind someone else's addresses.

---

## 2. End-to-End Flow

```
1. Agent connects Solana wallet  (e.g. did:sol:Alice)
   and EVM wallet                (e.g. 0xBob)

2. Agent signs "bind 0xBob -> Alice" with Solana key
   Agent signs "bind Alice -> 0xBob" with EVM key

3. Agent sends both signatures + addresses to
   POST /api/v1/identity/bind

4. Daemon verifies both signatures
   - ed25519.verify(solSig, "bind:" + evmAddr, solPubkey)
   - ecrecover(ethSig, "bind:" + solAddr, ethPubkey)

5. Daemon writes binding to Solana IdentityBinding PDA
   (one PDA per primary Solana address)

6. Reputation Oracle queries:
   - read IdentityBinding PDA for Solana address
   - if bound EVM address exists, also read EVM subgraph/ChainHub
   - aggregate into unified reputation response
```

---

## 3. Data Structures

### 3.1 Solana On-Chain `IdentityBinding`

Stored as a PDA on the Gradience Arena program:

```rust
pub struct IdentityBinding {
    pub owner: [u8; 32],               // Primary Solana pubkey
    pub evm_address: [u8; 20],         // Bound EVM address (20 bytes)
    pub sol_signature: [u8; 64],       // Solana-side ed25519 signature
    pub evm_signature: [u8; 65],       // EVM-side secp256k1 signature (65 bytes)
    pub verified: bool,                // Oracle attestation flag
    pub updated_at: i64,               // Unix timestamp
    pub bump: u8,
}
```

**PDA seeds**: `["identity_binding", owner_pubkey]`

**Discriminator**: `0x0c`

### 3.2 EVM On-Chain `AgentIdentityRegistry`

A lightweight ERC-8004-compatible registry contract on EVM:

```solidity
struct Binding {
    bytes32 solanaPubkey;   // 32 bytes
    uint256 updatedAt;
    bool verified;
}

mapping(address evmAgent => Binding) public bindings;

function registerBinding(bytes32 solanaPubkey, bytes calldata solSig, bytes calldata evmSig);
function verifyBinding(address evmAgent) external onlyOracle;
```

> **Note**: The EVM side is a **mirror** of the Solana PDA. The Solana PDA is the
> canonical source of truth because Gradience's core program lives there.
> The EVM contract exists so EVM-only consumers can read bindings without
> Solana RPC.

### 3.3 Daemon API Types

```typescript
interface BindIdentityRequest {
    solanaAddress: string;
    evmAddress: string;
    solanaSignature: string; // base58 or base64
    evmSignature: string; // 0x-prefixed hex, 65 bytes
}

interface IdentityBindingResponse {
    solanaAddress: string;
    evmAddress?: string;
    verified: boolean;
    updatedAt: number;
}
```

---

## 4. Implementation Plan

### 4.1 Step 1 — Add `IdentityBinding` to Solana Program

File: `programs/agent-arena/src/state/agent_layer.rs`

- Define `IdentityBinding` struct with Borsh serialization.
- Add `IDENTITY_BINDING_DISCRIMINATOR = 0x0c`.

### 4.2 Step 2 — Add `BindIdentity` Instruction to Solana Program

File: `programs/agent-arena/src/instructions/bind_identity/`

**Accounts**:
| # | Account | Role |
|---|---------|------|
| 0 | `owner` | signer, writable (fee payer) |
| 1 | `identity_binding` | writable, PDA |
| 2 | `system_program` | — |

**Instruction data**:

- `evm_address: [u8; 20]`
- `sol_signature: [u8; 64]`
- `evm_signature: [u8; 65]`

**Processor logic**:

1. Verify `owner` is the PDA derived from `[b"identity_binding", owner.key]`.
2. **Signature verification is OPTIONAL inside the on-chain program**.
   The program writes the raw binding data and sets `verified = false`.
   Real signature verification happens off-chain in the Oracle/daemon
   to keep program size small and avoid adding secp256k1 recovery logic
   to the Solana program.
3. If account already exists, overwrite with new data and bump timestamp.

> **Rationale**: Solana on-chain secp256k1 recovery is possible but adds
> program complexity and compute cost. We delegate that to the daemon,
> which already has full Node.js crypto libraries.

### 4.3 Step 3 — Add `BindIdentity` to Daemon `TransactionManager`

```typescript
async bindIdentity(params: {
  evmAddress: string;
  solanaSignature: Uint8Array; // 64 bytes
  evmSignature: Uint8Array;    // 65 bytes
}): Promise<string>
```

Derives the PDA and sends the `BindIdentity` instruction.

### 4.4 Step 4 — Daemon API Route + Signature Verification

Route: `POST /api/v1/identity/bind`

Handler logic:

1. Parse request body.
2. Validate `solanaAddress` is valid base58 pubkey.
3. Validate `evmAddress` is valid checksummed Ethereum address.
4. **Verify Solana signature**:
    ```typescript
    nacl.sign.detached.verify(
        Buffer.from(`bind:${evmAddress.toLowerCase()}`),
        solanaSignature,
        new PublicKey(solanaAddress).toBytes(),
    );
    ```
5. **Verify EVM signature**:
    ```typescript
    import { verifyMessage } from 'viem';
    verifyMessage({
        address: evmAddress as `0x${string}`,
        message: `bind:${solanaAddress}`,
        signature: evmSignature as `0x${string}`,
    });
    ```
6. Call `TransactionManager.bindIdentity(...)` to write to Solana.
7. Also call `ERC8004Client.registerBinding(...)` to mirror to EVM (async fire-and-forget).
8. Return binding record.

### 4.5 Step 5 — Update Reputation Oracle to Use Bindings

In `reputation-oracle.ts`:

1. Add helper `resolveBoundEvmAddress(solanaAddress): Promise<string | undefined>`
    - Reads Solana `IdentityBinding` PDA via RPC.
    - Returns `evm_address` if `verified == true`.

2. Modify `GET /api/v1/oracle/reputation/:agentAddress`:
    - Detect whether `:agentAddress` is Solana or EVM.
    - If Solana, read Solana reputation, then check binding for EVM address.
      If bound, also read EVM reputation and **aggregate** (e.g. weighted average).
    - If EVM, reverse-lookup binding (evm -> sol), then aggregate similarly.

3. Aggregation formula (v1):
    ```
    unifiedScore = (solScore * solWeight + evmScore * evmWeight) / (solWeight + evmWeight)
    solWeight  = max(1, solCompletedTasks)
    evmWeight  = max(1, evmCompletedTasks)
    ```

### 4.6 Step 6 — Cross-chain Bridge (future work)

EVM identity mirroring will be handled via `packages/cross-chain-adapters/`
(Wormhole / LayerZero) rather than a dedicated EVM core protocol. This is
**not** a blocker for the core unified identity flow because the Oracle can
read the Solana PDA directly.

---

## 5. Security Considerations

| Attack                                              | Mitigation                                                                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Eve binds Alice's Solana addr to Eve's EVM addr** | Both signatures required. Eve cannot forge Alice's Solana signature.                                                                           |
| **Eve binds Alice's EVM addr to Eve's Solana addr** | Both signatures required. Eve cannot forge Alice's EVM signature.                                                                              |
| **Replay attack on an old binding**                 | `updated_at` timestamp and overwrite-on-write prevent stale bindings from persisting indefinitely.                                             |
| **Oracle compomise**                                | Oracle only _verifies_ signatures; it cannot create a valid binding without the user's private keys. Worst case: Oracle withholds attestation. |
| **Frong-end phishing**                              | Binding UI must clearly show both addresses and require wallet signatures on independent modals.                                               |

---

## 6. Acceptance Criteria

- [ ] `IdentityBinding` struct defined in Solana program
- [ ] `BindIdentity` instruction + processor implemented in Solana program
- [ ] SBF build passes
- [ ] Daemon `POST /api/v1/identity/bind` verifies both signatures and writes to Solana
- [ ] Reputation Oracle query aggregates scores across bound chains (cross-chain adapters)
- [ ] Unit tests for signature verification and binding logic
- [ ] agent-daemon full test suite passes

---

## 7. References

- Solana program state: `programs/agent-arena/src/state/agent_layer.rs`
- Reputation Oracle routes: `apps/agent-daemon/src/api/routes/reputation-oracle.ts`
- TransactionManager: `apps/agent-daemon/src/solana/transaction-manager.ts`

