# Phase 3: Technical Spec — MagicBlock VRF Judge Selection (GRA-207)

> **Status**: Implemented  
> **Date**: 2026-04-08  
> **Version**: v0.2  
> **Related Doc**: `docs/magicblock-vrf-integration-blocker.md`

---

## 0. Overview

GRA-207 integrates MagicBlock's ephemeral VRF network for verifiable judge
selection. The integration is **fully functional** end-to-end:

1. **Daemon** builds a `RequestRandomness` instruction manually (no npm SDK
   required).
2. **Caller** signs and submits the transaction to Solana.
3. **MagicBlock Oracle** computes VRF, verifies the proof on-chain, and
   invokes our callback via CPI.
4. **Callback handler** (`ReceiveVrfRandomness`) persists the randomness in
   a `vrf_result` PDA.
5. **Daemon** reads the PDA and deterministically selects a judge using
   `select_judge_index`.

---

## 1. Architecture

### 1.1 Sequence Diagram

```text
[Frontend / Daemon]      [Solana Network]         [MagicBlock Oracle]
        |                        |                           |
        |  RequestRandomness tx  |                           |
        |------------------------->|                           |
        |                        |  queue request            |
        |                        |---------------->|
        |                        |                           |
        |                        |  ProvideRandomness        |
        |                        |<---------------|
        |                        |  (verifies VRF proof)     |
        |                        |                           |
        |                        |  CPI callback             |
        |                        |---------------->----------|
        |                        |  receive_vrf_randomness   |
        |                        |  writes vrf_result PDA    |
        |                        |                           |
        |<-- poll vrf_result PDA --|                           |
        |                        |                           |
        |  JudgeAndPay tx        |                           |
        |------------------------->|                           |
```

### 1.2 Proof Verification Model

MagicBlock's `ephemeral-vrf` program performs **on-chain proof verification**
inside `ProvideRandomness`. The proof is cryptographically validated using
Curve25519/Ed25519 (RFC 9381) before the CPI to our callback handler is ever
executed. Gradience therefore **does not re-verify** the proof inside the
callback handler — the signed CPI itself is the guarantee of validity.

Reference: [`program/src/provide_randomness.rs`](https://github.com/magicblock-labs/ephemeral-vrf/blob/main/program/src/provide_randomness.rs)

---

## 2. Data Structures

### 2.1 Off-Chain TypeScript

| Component              | Path                                  | Responsibility                                                         |
| ---------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| `MagicBlockVRFClient`  | `settlement/magicblock-vrf-client.ts` | Build `RequestRandomness` ix, parse oracle queue, read `VrfResult` PDA |
| `VRFJudgeSelector`     | `settlement/vrf-judge-selector.ts`    | Generate seed, request VRF, read result, select judge                  |
| `JudgeRotationManager` | `settlement/vrf-judge-selector.ts`    | Exclude recent judges before selection                                 |

### 2.2 On-Chain Rust

| Type                   | Path                                   | Responsibility                                               |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------ |
| `VrfResult`            | `state/agent_layer.rs`                 | PDA schema: `task_id`, `randomness[32]`, `fulfilled`, `bump` |
| `select_judge_index`   | `vrf.rs`                               | `randomness % candidate_count`                               |
| `ReceiveVrfRandomness` | `instructions/receive_vrf_randomness/` | Callback handler that writes `VrfResult`                     |

---

## 3. API Surface

### 3.1 Daemon Routes

| Method | Path                             | Purpose                                 | Status      |
| ------ | -------------------------------- | --------------------------------------- | ----------- |
| `POST` | `/api/v1/magicblock/session`     | Create ER/PER session                   | Implemented |
| `POST` | `/api/v1/magicblock/judge-per`   | Settle via PER pipeline                 | Implemented |
| `POST` | `/api/v1/magicblock/request-vrf` | Build `RequestRandomness` ix for caller | Implemented |

### 3.2 On-Chain Instructions

| Instruction            | Description                                                             | Status      |
| ---------------------- | ----------------------------------------------------------------------- | ----------- |
| `PostTask`             | Uses `SlotHashes` fallback (`select_pool_judge`) when VRF not requested | Implemented |
| `ReceiveVrfRandomness` | Callback handler, writes randomness to `vrf_result` PDA                 | Implemented |
| `JudgeAndPay`          | Settles task after daemon reads `vrf_result` and selects winner         | Implemented |

---

## 4. Implementation Checklist

- [x] Fallback judge selector (`VRFJudgeSelector` + `JudgeRotationManager`)
- [x] Manual `RequestRandomness` instruction builder (`magicblock-vrf-client.ts`)
- [x] `ReceiveVrfRandomness` callback handler on-chain
- [x] `VrfResult` account definition and deserialization
- [x] Daemon `request-vrf` endpoint callable from frontend
- [x] Queue polling + result PDA reading
- [x] `select_judge_index` utility in Rust program
- [ ] Automated daemon worker that monitors `vrf_result` and auto-submits `JudgeAndPay` (future enhancement)

---

## 5. Security Notes

- VRF proof verification is **delegated** to the MagicBlock ephemeral-vrf
  program, which is audited (Zenith, Aug 2025).
- Gradience trusts the signed CPI from MagicBlock; no stub verification
  remains in the codebase.
- The fallback `FNV-1a` selector stays active for local/dev environments when
  the VRF queue is unavailable.

---

## 6. References

- MagicBlock `ephemeral-vrf` repo: https://github.com/magicblock-labs/ephemeral-vrf
- Blocker resolution doc: `docs/magicblock-vrf-integration-blocker.md`
- Daemon client: `apps/agent-daemon/src/settlement/magicblock-vrf-client.ts`
- On-chain callback: `programs/agent-arena/src/instructions/receive_vrf_randomness/`
