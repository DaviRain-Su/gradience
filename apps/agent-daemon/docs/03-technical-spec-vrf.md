# Phase 3: Technical Spec — MagicBlock VRF Judge Selection (GRA-207)

> **Status**: Blocked — awaiting upstream TypeScript SDK or on-chain proof documentation.  
> **Date**: 2026-04-08  
> **Version**: v0.1  
> **Related Blocker Doc**: `docs/magicblock-vrf-integration-blocker.md`

---

## 0. Pragmatic Scope

This spec defines the **integration boundary** for MagicBlock VRF judge selection.
Because `@magicblock-labs/vrf-sdk` does **not exist** on npm and the proof format is not yet documented, the implementation is deliberately split into:

1. **Fully wired fallback** — deterministic, tested, and already integrated.
2. **VRF-ready scaffolding** — instruction builders, callback handlers, and result polling are in place but gated behind clear `TODO(GRA-207)` markers.

No production-grade VRF verification can be completed until the blockers listed below are resolved.

---

## 1. Desired End-State Architecture

### 1.1 Sequence Diagram (Callback-Based VRF)

```text
[Front-end / Daemon]              [MagicBlock Oracle]              [Agent Arena Program]
        |                                  |                                  |
        |  1. RequestRandomness tx         |                                  |
        |--------------------------------->|                                  |
        |     (with callback_program_id    |                                  |
        |      = AgentArena program)       |                                  |
        |                                  |                                  |
        |                                  |  2. CPI callback                 |
        |                                  |  receive_vrf_randomness          |
        |                                  |--------------------------------->|
        |                                  |     writes randomness to         |
        |                                  |     vrf_result PDA               |
        |                                  |                                  |
        |  3. Poll / Read vrf_result PDA   |                                  |
        |<------------------------------------------------------------------|
        |     (daemon uses MagicBlockVRFClient.readVrfResultAccount)        |
        |                                  |                                  |
        |  4. Build judgeAndPay tx         |                                  |
        |  (or post_task_with_vrf tx)      |                                  |
        |------------------------------------------------------------------>|
```

### 1.2 On-Chain Verification

Before the randomness is consumed for judge selection, the on-chain program should:

- Deserialize the `VRFProof` from the callback accounts.
- Invoke `verify_vrf_proof(vrf_pubkey, proof, seed)`.
- Only proceed if the proof is cryptographically valid.

> **Current state**: `programs/agent-arena/src/vrf.rs` contains `verify_vrf_proof_stub`, which always returns `Valid` for well-formed proofs. This keeps compilation and integration tests green but **must not be used in production**.

---

## 2. Data Structures

### 2.1 Off-Chain TypeScript

#### `VRFJudgeSelector` (`apps/agent-daemon/src/settlement/vrf-judge-selector.ts`)

```typescript
class VRFJudgeSelector {
  // Fallback selection using FNV-1a hash when VRF is unavailable.
  async selectJudge(taskId, candidates, seed?, numericTaskId?): VRFSelectionResult;

  // Builds a MagicBlock RequestRandomness ix targeting the Gradience callback handler.
  buildGradienceRequestRandomnessIx(taskId, numericTaskId, payer): TransactionInstruction;

  // Builds a raw RequestRandomness ix.
  buildRequestRandomnessIx(seed, callbackProgramId, discriminator, metas, args, payer): TransactionInstruction;
}
```

#### `JudgeRotationManager`

```typescript
class JudgeRotationManager {
  // Excludes the N most recent judges before selection.
  async selectNextJudge(candidates, policy, selector, taskId): VRFSelectionResult;
}
```

#### `MagicBlockVRFClient` (`apps/agent-daemon/src/settlement/magicblock-vrf-client.ts`)

```typescript
class MagicBlockVRFClient {
  async isRequestPending(seed, queue?): boolean;
  async readVrfResultAccount(pda): VrfResult;
}
```

### 2.2 On-Chain Rust

#### `VrfResult` (`programs/agent-arena/src/state/agent_layer.rs`)

```rust
pub struct VrfResult {
    pub task_id: u64,
    pub randomness: [u8; 32],
    pub fulfilled: bool,
    pub bump: u8,
}
```

#### `VRFProof` (`programs/agent-arena/src/vrf.rs`)

```rust
pub struct VRFProof {
    pub data: [u8; 64],
}
```

---

## 3. API Surface

### 3.1 Daemon Routes (MagicBlock)

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| `POST` | `/api/v1/magicblock/session` | Create ER/PER session | Implemented |
| `POST` | `/api/v1/magicblock/judge-per` | Settle task via PER | Implemented |
| `POST` | `/api/v1/magicblock/request-vrf` | Request VRF randomness for a task | **Scaffold** |

The `request-vrf` route:
1. Accepts `{ taskId, numericTaskId, payer }`.
2. Uses `VRFJudgeSelector.buildGradienceRequestRandomnessIx(...)` to build the instruction.
3. Returns the serialized instruction or a partially signed transaction (depending on daemon signer configuration).
4. The caller must submit the transaction to Solana.

### 3.2 Programs

| Instruction | Description | Status |
|-------------|-------------|--------|
| `PostTask` | In `pool` mode, currently uses `SlotHashes` fallback (`select_pool_judge`) | Implemented |
| `ReceiveVrfRandomness` | Callback handler that writes randomness to `vrf_result` PDA | Implemented |
| `VerifyVrfProof` (stub) | Always returns `Valid` | Stub only |
| `PostTaskWithVrf` (future) | Reads `vrf_result` PDA and uses verified randomness for judge selection | **Not yet implemented** |

---

## 4. Blockers & Upstream Dependencies

| Blocker | Impact | Likely Resolution |
|---------|--------|-------------------|
| `@magicblock-labs/vrf-sdk` 404 on npm | Daemon cannot consume VRF outputs via an official TS SDK | Wait for MagicBlock release, or continue using manual instruction construction (`magicblock-vrf-client.ts`) |
| VRF proof format undocumented | `verify_vrf_proof_stub` cannot be replaced with real crypto | Wait for MagicBlock docs or audit their open-source Rust crate (`ephemeral-vrf-sdk`) |
| No documented pull-based result PDA | Must rely on callback program (`ReceiveVrfRandomness`) | Already handled by Gradience callback handler |

---

## 5. Implementation Checklist

- [x] Fallback judge selector (`VRFJudgeSelector` + `JudgeRotationManager`)
- [x] Manual `RequestRandomness` instruction builder (`magicblock-vrf-client.ts`)
- [x] `ReceiveVrfRandomness` callback handler on-chain
- [x] `VrfResult` account definition and deserialization
- [ ] Chain-side `verify_vrf_proof` with real EC math (blocked)
- [ ] `PostTaskWithVrf` instruction that consumes the result PDA (blocked)
- [ ] Daemon `request-vrf` endpoint wired into settlement flow (scaffold)

---

## 6. Security Notes

- The current `verify_vrf_proof_stub` is **insecure by design**. It exists only to keep the build green while integration scaffolding is built.
- Until real verification lands, any "VRF" judge selection is effectively trusted to the MagicBlock oracle network.
- Production deployment **must** gate the VRF path behind a feature flag or environment variable (e.g. `ENABLE_EXPERIMENTAL_VRF=false`).

---

## 7. References

- MagicBlock `ephemeral-vrf`: https://github.com/magicblock-labs/ephemeral-vrf
- Gradience Blocker Doc: `docs/magicblock-vrf-integration-blocker.md`
- Daemon Fallback: `apps/agent-daemon/src/settlement/vrf-judge-selector.ts`
- On-Chain Callback: `programs/agent-arena/src/instructions/receive_vrf_randomness/`
