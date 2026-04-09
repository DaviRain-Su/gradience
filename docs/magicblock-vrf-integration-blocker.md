# MagicBlock VRF Integration — RESOLVED (GRA-207)

## Status

**Closed — 2026-04-08**

The original blocker (missing `@magicblock-labs/vrf-sdk` on npm) has been
resolved by consuming MagicBlock's open-source Rust definitions directly and
manually implementing the TypeScript side. Proof verification is performed
by the MagicBlock `ephemeral-vrf` program itself during `ProvideRandomness`;
Gradience only needs to trust the signed CPI callback.

---

## Resolution Summary

| Item                                  | Status       | Details                                                                              |
| ------------------------------------- | ------------ | ------------------------------------------------------------------------------------ |
| RequestRandomness instruction builder | ✅ Done      | `MagicBlockVRFClient` in `apps/agent-daemon/src/settlement/magicblock-vrf-client.ts` |
| Queue polling + result PDA reading    | ✅ Done      | `VRFJudgeSelector` + `MagicBlockVRFClient`                                           |
| On-chain callback handler             | ✅ Done      | `ReceiveVrfRandomness` instruction in `programs/agent-arena`                         |
| Proof verification                    | ✅ Delegated | MagicBlock `ephemeral-vrf` program verifies proofs before CPI callback               |
| Judge selection from randomness       | ✅ Done      | `select_judge_index()` in `programs/agent-arena/src/vrf.rs`                          |
| Daemon API route                      | ✅ Done      | `POST /api/v1/magicblock/request-vrf`                                                |

---

## What Changed

### 1. We Do Not Need an NPM SDK

MagicBlock's ephemeral-vrf repo (`magicblock-labs/ephemeral-vrf`) contains
all the necessary layout definitions in `api/src/instruction.rs`. We built
our own minimal TypeScript client (`magicblock-vrf-client.ts`) that:

- Serializes `RequestRandomness` arguments using the exact Borsh layout.
- Parses the oracle queue account to detect pending requests.
- Deserializes the Gradience `VrfResult` PDA written by our callback handler.

### 2. Proof Verification Happens Upstream

MagicBlock's `ProvideRandomness` instruction performs full Curve25519/Ed25519
VRF proof verification on-chain. Only after the proof is valid does it invoke
the callback program (`agent-arena`) via a signed CPI. Therefore Gradience's
`ReceiveVrfRandomness` handler can safely trust the randomness value without
re-verifying the proof.

Reference: [`program/src/provide_randomness.rs`](https://github.com/magicblock-labs/ephemeral-vrf/blob/main/program/src/provide_randomness.rs)

### 3. Full End-to-End Flow

```
1. Frontend/Daemon  →  POST /api/v1/magicblock/request-vrf
                        (returns serialized RequestRandomness ix)

2. Caller signs & submits tx to Solana

3. MagicBlock Oracle  →  sees request in queue

4. Oracle computes VRF, verifies proof on-chain

5. MagicBlock Program  →  CPI callback to agent-arena::ReceiveVrfRandomness
                           writes randomness into vrf_result PDA

6. Daemon polls vrf_result PDA (or reads it directly)

7. Daemon uses select_judge_index(randomness, candidates) to pick winner

8. Daemon submits JudgeAndPay (or manual settlement) to finalize task
```

---

## Files of Interest

| File                                                            | Purpose                                       |
| --------------------------------------------------------------- | --------------------------------------------- |
| `apps/agent-daemon/src/settlement/magicblock-vrf-client.ts`     | Manual VRF instruction builder + queue parser |
| `apps/agent-daemon/src/settlement/vrf-judge-selector.ts`        | Judge selection with fallback + rotation      |
| `apps/agent-daemon/src/api/routes/magicblock.ts`                | API surface (`request-vrf`)                   |
| `programs/agent-arena/src/vrf.rs`                               | `select_judge_index`                          |
| `programs/agent-arena/src/instructions/receive_vrf_randomness/` | Callback handler that persists randomness     |

---

## Future Enhancements (Optional)

- **Automated settlement worker**: A background daemon job that monitors
  `vrf_result` PDAs and auto-submits `JudgeAndPay` without manual caller
  intervention.
- **Pull-based result reading without callback**: If MagicBlock ever exposes
  a direct result PDA, we can remove the callback handler and simplify the
  flow.

---

## References

- MagicBlock VRF GitHub:
  <https://github.com/magicblock-labs/ephemeral-vrf>
- `ephemeral-vrf-sdk` crate docs:
  <https://docs.rs/ephemeral-vrf-sdk/latest>
- Phase 3 Spec:
  `apps/agent-daemon/docs/03-technical-spec-vrf.md`
