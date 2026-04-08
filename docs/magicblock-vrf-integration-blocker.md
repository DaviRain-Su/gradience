# MagicBlock VRF Integration Blocker (GRA-207)

## Status

**Blocked — awaiting upstream TypeScript SDK or on-chain program documentation.**

Last verified: 2026-04-08

---

## Summary

GRA-207 aims to replace the deterministic judge-selection fallback with a
**Verifiable Random Function (VRF)** powered by MagicBlock’s ephemeral VRF
network. After repository audit and live verification, the `@magicblock-labs/vrf-sdk`
npm package **does not exist** and the VRF program architecture requires a
**custom Solana callback program**, making a full TypeScript-side integration
impossible without additional upstream artifacts.

---

## Why It Is Blocked

### 1. No TypeScript / JavaScript SDK

- **npm package:** `@magicblock-labs/vrf-sdk` returns **404 Not Found** on the
  public registry (checked 2026-04-08).
- **Available artifacts:**
  - Rust crate: `ephemeral-vrf-sdk` (crates.io, v0.2.3)
  - Solana on-chain program source:
    [`magicblock-labs/ephemeral-vrf`](https://github.com/magicblock-labs/ephemeral-vrf)
  - Oracle CLI and binary (`vrf-oracle`, `vrf-cli`)
- **Missing artifact:** A TypeScript/JS library to construct
  `RequestRandomness` instructions, parse queue accounts, or consume VRF
  outputs from a Node.js / browser runtime.

### 2. MagicBlock VRF Is Callback-Based

The on-chain program defines the following key instruction:

```rust
// api/src/instruction.rs
pub enum EphemeralVrfInstruction {
    RequestHighPriorityRandomness = 3,
    RequestRandomness = 8,
    ProvideRandomness = 4,
    // ...
}

pub struct RequestRandomness {
    pub caller_seed: [u8; 32],
    pub callback_program_id: Pubkey,
    pub callback_discriminator: Vec<u8>,
    pub callback_accounts_metas: Vec<SerializableAccountMeta>,
    pub callback_args: Vec<u8>,
}
```

Requesting randomness **requires** a `callback_program_id`. The VRF oracle
network calls this program back via CPI once randomness is available. This
means Gradience needs **one of the following** to finish the integration:

1. **A dedicated callback handler** inside the existing `agent-arena` Solana
   program (to receive the VRF result and store it in an account we can read);
   **or**
2. **Documented pull-based flow** (if MagicBlock later exposes a result
   account that can be read without a callback).

Neither option is currently available in a form we can consume from TypeScript.

---

## What We Have In Place (Fallback)

Until the blocker is resolved, the system uses a **deterministic fallback**
that is fully tested and integrated into the settlement pipeline.

| Component | Path | Purpose |
|-----------|------|---------|
| Fallback selector | `apps/agent-daemon/src/settlement/vrf-judge-selector.ts` | Selects a judge via FNV-1a hash over a task-specific seed when VRF is unavailable. |
| Rotation manager | `JudgeRotationManager` (same file) | Ensures recent judges are excluded to prevent collusion. |
| Rust stub | `programs/agent-arena/src/vrf.rs` | Placeholder `verify_vrf_proof_stub` and `select_judge_index` to keep the on-chain build green. |
| Tests | `apps/agent-daemon/tests/unit/vrf-judge-selector.test.ts` | 6 unit tests covering fallback selection, determinism, rotation, and graceful degradation. |

### Test Results

- **agent-daemon unit tests:** 23 files, 293 passed, 1 skipped
- **agentm-web tests:** 7 files, 47 passed
- **Foundry EVM tests:** 64 passed

---

## Upgrade Path (How To Unblock)

### Option A — MagicBlock Releases a TypeScript SDK

If `@magicblock-labs/vrf-sdk` (or equivalent) is published:

1. Install the SDK in `apps/agent-daemon` and `apps/agentm-web`.
2. Replace `readVRFResult()` in `vrf-judge-selector.ts` with SDK calls.
3. If the SDK still requires a callback program, implement the handler in
   `programs/agent-arena/src/vrf.rs` and deploy a new program version.
4. Update `vrf-judge-selector.test.ts` to mock the SDK and assert real
   randomness consumption.

### Option B — Custom Solana Callback Program

If we decide to build the callback handler ourselves:

1. Extend `programs/agent-arena/src/vrf.rs` to define an instruction that
   matches the MagicBlock `RequestRandomness` callback signature.
2. Deploy the updated program and record the new program ID.
3. Manually construct the `RequestRandomness` instruction using
   `@solana/web3.js` + `borsh` in `vrf-judge-selector.ts`.
4. After requesting, poll the callback destination account for the stored
   randomness value.

### Option C — MagicBlock Documents a Pull-Based Result Account

If MagicBlock later exposes a result PDA that can be read directly (no
callback required):

1. Derive the result PDA from the task seed.
2. Implement `readVRFResult()` as a simple `Connection.getAccountInfo()` +
   Borsh/Bytemuck deserialization.
3. Keep the existing fallback for RPC failures.

---

## References

- MagicBlock VRF GitHub:
  <https://github.com/magicblock-labs/ephemeral-vrf>
- `ephemeral-vrf-sdk` crate docs:
  <https://docs.rs/ephemeral-vrf-sdk/latest>
- Our fallback implementation:
  `apps/agent-daemon/src/settlement/vrf-judge-selector.ts`
- Our Rust program stub:
  `programs/agent-arena/src/vrf.rs`

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-08 | Keep fallback active and fully tested. | No TS SDK; full callback-program integration is out of current sprint scope. |
| 2026-04-08 | Document explicit upgrade path. | Enables instant resumption once upstream artifacts land. |
