# Phase 3: Technical Spec — Solana Auto-Settlement (GRA-266)

> **Status**: Phase 3 — Ready for Implementation  
> **Date**: 2026-04-08  
> **Version**: v0.1  
> **Task**: GRA-266

---

## 0. Problem Statement

The Gradience Agent Arena program supports a full task lifecycle on Solana:
`PostTask` → `ApplyForTask` → `SubmitResult` → `JudgeAndPay`.

However, the daemon `TransactionManager` currently only implements the first
three instructions.  The `JudgeAndPay` instruction is missing, which means:

1. **Manual settlement bottleneck**: After a VRF result is written to the
   `vrf_result` PDA, someone must manually construct and sign a `JudgeAndPay`
   transaction.
2. **Incomplete VRF闭环**: GRA-207 wired the VRF request and callback, but
   the final settlement step is not automated.

This spec closes the loop by adding `judgeAndPay` to the daemon transaction
manager and an optional auto-settle worker that monitors VRF results.

---

## 1. Desired End-State

### 1.1 Daemon TransactionManager

`TransactionManager` gains a new public method:

```typescript
async judgeAndPay(params: {
  taskId: string;
  winner: string;          // base58 Solana pubkey
  score: number;           // 0-100
  reasonRef?: string;
}): Promise<string>       // tx signature
```

The method builds a Solana `TransactionInstruction` for `JudgeAndPay`
(discriminator = 4) and signs/sends it via the existing `signAndSendTransaction`
helper.

### 1.2 Auto-Settle Worker (VRF Result Monitor)

A lightweight background worker (`VrfAutoSettler`) that:

1. Polls a list of "pending VRF" tasks.
2. For each task, reads the `vrf_result` PDA.
3. If `fulfilled == true`, uses `select_judge_index(randomness, submissions)`
   to pick the winner.
4. Calls `TransactionManager.judgeAndPay(...)` to settle the task.
5. Marks the task as settled in local state to avoid double-settlement.

> **Scope decision**: The auto-settle worker is a **daemon-level convenience**.
> It is not a consensus-critical component.  If the daemon is offline, anyone
> can still call `JudgeAndPay` directly (permissionless on-chain).

---

## 2. Data Structures

### 2.1 `JudgeAndPay` Instruction Layout

Reference: `programs/agent-arena/src/instructions/judge_and_pay/`

**Discriminator**: `4` (u8)

**Accounts** (in order):
| # | Account | Role | Notes |
|---|---------|------|-------|
| 0 | `judge` | signer, writable | Daemon wallet |
| 1 | `task` | writable | Task PDA |
| 2 | `escrow` | writable | Escrow PDA |
| 3 | `poster_account` | writable | Task poster (reward refund target on low score) |
| 4 | `winner_account` | writable | Selected agent |
| 5 | `winner_application` | — | Application PDA for winner |
| 6 | `winner_submission` | — | Submission PDA for winner |
| 7 | `winner_reputation` | writable | Reputation PDA for winner |
| 8 | `judge_stake` | writable | Judge stake PDA (daemon wallet) |
| 9 | `treasury` | writable | Treasury PDA |
| 10 | `system_program` | — | SystemProgram |
| 11 | `event_authority` | — | Event authority PDA |
| 12 | `program` | — | Gradience program ID |
| 13+ | *optional token-path accounts* | — | SPL token ATAs if task.mint != [0;32] |

> **Token path out of scope for GRA-266**: This spec covers the SOL path
> first.  SPL token settlement can be added in a follow-up task.

**Instruction data**:
- `winner`: `[u8; 32]` — pubkey bytes of the winning agent
- `score`: `u8` — final score (0-100)
- `reason_ref`: `Option<String>` — optional evaluation reason CID

### 2.2 `VrfAutoSettler` Config

```typescript
interface VrfAutoSettlerConfig {
  pollIntervalMs: number;      // default: 30_000
  connection: Connection;
  transactionManager: TransactionManager;
  score: number;               // default: 85
  reasonRef?: string;
}
```

### 2.3 Internal Task Tracking

```typescript
interface PendingVrfTask {
  taskId: string;
  numericTaskId: bigint;
  candidates: string[];        // submission agents
  requestedAt: number;
}
```

---

## 3. Implementation Plan

### 3.1 Step 1 — `TransactionManager.judgeAndPay()`

Add the method to `apps/agent-daemon/src/solana/transaction-manager.ts`.

Key logic:
1. Convert `taskId` string to `bigint` and write 8-byte LE buffer.
2. Derive all PDAs using existing seeds:
   - `TASK_SEED + taskIdBuf` → task
   - `ESCROW_SEED + taskIdBuf` → escrow
   - `TREASURY_SEED` → treasury
   - `APPLICATION_SEED + taskIdBuf + winnerBytes` → winner_application
   - `SUBMISSION_SEED + taskIdBuf + winnerBytes` → winner_submission
   - `REPUTATION_SEED + winnerBytes` → winner_reputation
   - `STAKE_SEED + judgePubkeyBytes` → judge_stake
   - `EVENT_AUTHORITY_SEED` → event_authority
3. Fetch the `task` account to verify:
   - `task.state == Open`
   - `task.judge == daemon_pubkey`
   - `task.mint == [0;32]` (SOL path only for now)
   - `task.poster` address for `poster_account`
4. Build instruction data with Borsh-encoded `winner`, `score`, `reasonRef`.
5. Call `signAndSendTransaction()`.

### 3.2 Step 2 — `VrfAutoSettler` Worker

Create `apps/agent-daemon/src/settlement/vrf-auto-settler.ts`.

Key logic:
1. Maintain an in-memory `SettledTaskCache` (or SQLite row) keyed by taskId.
2. `addPendingTask(taskId, numericTaskId, candidates)` — called after
   `request-vrf` succeeds.
3. `start()` — begins `setInterval` poll loop.
4. `checkAndSettle()` — for each pending task:
   a. Read `vrf_result` PDA via `MagicBlockVRFClient.readVrfResultAccount()`.
   b. If not fulfilled, skip.
   c. If fulfilled, read all `submission` PDAs for the task to build a list
      of candidate agents.
   d. Use `select_judge_index(randomness_u64, candidates.length)` to pick
      the winner index.
   e. Call `transactionManager.judgeAndPay()`.
   f. On success, remove task from pending list and cache it.
5. `stop()` — clears interval.

### 3.3 Step 3 — Wire into Daemon lifecycle

In `apps/agent-daemon/src/daemon.ts` (or server bootstrap):

1. Instantiate `VrfAutoSettler` when the daemon starts.
2. Expose a control API (optional):
   - `POST /api/v1/magicblock/start-vrf-monitor`
   - `POST /api/v1/magicblock/stop-vrf-monitor`

### 3.4 Step 4 — Tests

- Unit test: `transaction-manager.test.ts` mocks `Connection` and asserts
  `judgeAndPay` builds correct account metas and data layout.
- Unit test: `vrf-auto-settler.test.ts` mocks `MagicBlockVRFClient` and
  asserts full poll-to-settle flow.

---

## 4. Risk & Mitigation

| Risk | Mitigation |
|------|------------|
| Double settlement | Local settled-task cache + on-chain `task.state != Open` guard |
| Daemon wallet lacks judge stake | Pre-flight check in `judgeAndPay`; fail fast with clear error |
| SPL token tasks rejected | Explicit check `task.mint == [0;32]`; throw "SPL path not yet supported" |
| Low-score refund path | Supported via same `JudgeAndPay` ix; `score < MIN_SCORE` triggers refund on-chain |

---

## 5. Acceptance Criteria

- [ ] `TransactionManager.judgeAndPay()` implemented and unit-tested
- [ ] `VrfAutoSettler` worker implemented and unit-tested
- [ ] Daemon can settle a task end-to-end: VRF request → callback → auto judge
- [ ] agent-daemon build and test suite passes (50+ test files)
- [ ] Update `06-implementation.md` log

---

## 6. References

- On-chain `JudgeAndPay` processor:
  `programs/agent-arena/src/instructions/judge_and_pay/processor.rs`
- Existing `TransactionManager`:
  `apps/agent-daemon/src/solana/transaction-manager.ts`
- VRF client:
  `apps/agent-daemon/src/settlement/magicblock-vrf-client.ts`
- VRF judge selector:
  `apps/agent-daemon/src/settlement/vrf-judge-selector.ts`
