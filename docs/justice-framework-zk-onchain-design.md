# Justice Framework: zkNullifier On-Chain Design

> **Status:** ARCHIVED — EVM core protocol removed. Solana is the only core protocol chain.  
> **Note:** ZK-KYC gating is implemented on the Solana program (`programs/agent-arena/`). EVM chains may receive reputation proofs via cross-chain bridge but do not host native Gradience core logic.  
> **Date:** 2026-04-08 (archived 2026-04-11)  
> **Related:** GRA-265 (ZK-KYC), GRA-263 (Justice Framework v2)

---

## 1. Goal (Archived Context)

This document originally designed ZK-KYC enforcement for an EVM `AgentArenaEVM.sol` contract. After the architecture decision to make **Solana the sole core protocol chain**, the EVM contract path is no longer pursued. Equivalent functionality (ZK-KYC gating for applicants and judges) belongs in the Solana Agent Arena program.

---

## Original Design (Retained for Reference)

Prevent unverified users from participating in high-value tasks or serving as judges for them by enforcing **ZK-KYC completion on-chain**. The backend `AccountBindingStore` already captures the `zkNullifier` via `/api/v1/identity/zk-verify`; this design adds the on-chain scaffold so the EVM contract can independently verify that a wallet has completed ZK-KYC.

---

## 2. Data Structures

### 2.1 New Storage Variables

```solidity
/// wallet => registered nullifier hash
mapping(address => bytes32) public zkNullifiers;

/// nullifier hash => already consumed on chain
mapping(bytes32 => bool) public usedNullifiers;

/// task => require ZK-KYC for applicants / judges
mapping(uint256 => bool) public requireZkKyc;
```

### 2.2 New Access Control

```solidity
address public zkOracle;   // address authorised to relay verified nullifiers
```

_Rationale:_ the contract does **not** verify a ZK proof directly; it trusts an oracle (e.g. the Gradience daemon or a dedicated relayer) to only submit nullifiers that have already passed backend verification. This keeps gas low while moving the gate from backend-only to backend + on-chain dual enforcement.

---

## 3. New / Modified Functions

### 3.1 Nullifier Registration

```solidity
function registerZkNullifier(address wallet, bytes32 nullifierHash)
    external
    onlyZkOracle
{
    require(nullifierHash != bytes32(0), "Invalid nullifier");
    require(!usedNullifiers[nullifierHash], "Nullifier already used");

    bytes32 old = zkNullifiers[wallet];
    if (old != bytes32(0)) {
        usedNullifiers[old] = false; // release previous binding
    }

    zkNullifiers[wallet] = nullifierHash;
    usedNullifiers[nullifierHash] = true;

    emit ZkNullifierRegistered(wallet, nullifierHash);
}
```

_Notes:_

- Re-binding a wallet releases the old nullifier so it can be re-registered elsewhere (matches the 30-day cooldown in `AccountBindingStore`).
- The nullifier itself is WorldID / Holonym output; it is already designed to be globally unique.

### 3.2 Task Posting — ZK Flag

**Modified:** `postTask`, `postTaskQuorum`, `postTaskErc20`, `postTaskErc20Quorum`

Append a new bool parameter:

```solidity
function postTask(
    string calldata eval_ref,
    uint64 deadline,
    uint64 judge_deadline,
    address judge,
    uint8 category,
    uint256 min_stake,
    bool requireZkKyc   // NEW
) external payable returns (uint256 task_id);
```

Store the flag:

```solidity
requireZkKyc[task_id] = requireZkKyc;
```

Emit updated `TaskCreated` event (append `bool requireZkKyc`).

_Default:_ `false` for backward compatibility.

### 3.3 Application Gate

**Modified:** `applyForTask`

```solidity
function applyForTask(uint256 task_id) external payable nonReentrant {
    Task storage task = _loadOpenTask(task_id);
    if (block.timestamp >= task.deadline) revert DeadlinePassed(task_id);
    if (_isJudge(task_id, msg.sender)) revert JudgeCannotApply(task_id, msg.sender);

    // NEW
    if (requireZkKyc[task_id]) {
        require(zkNullifiers[msg.sender] != bytes32(0), "ZkKycRequired");
    }

    // ...existing logic
}
```

_Alternative (with custom error):_ add `error ZkKycRequired(address wallet);` instead of `require` string.

### 3.4 Judge Assignment / Enforcement

**Modified:** `judgeAndPay`, `judgeWithProof`, `submitJudgement`, `settleWithQuorum`

When `requireZkKyc[task_id] == true`, the **designated judge** and **every judge in a quorum pool** must have a registered nullifier.

_Designated judge check:_ inside `judgeAndPay` / `judgeWithProof`:

```solidity
if (requireZkKyc[task_id] && zkNullifiers[msg.sender] == bytes32(0)) {
    revert ZkKycRequired(msg.sender);
}
```

_Quorum pool check:_ inside `postTaskQuorum` / `postTaskErc20Quorum`, optionally validate each supplied judge at task creation:

```solidity
if (requireZkKyc) {
    for (uint256 i = 0; i < judges.length; i++) {
        if (zkNullifiers[judges[i]] == bytes32(0)) revert ZkKycRequired(judges[i]);
    }
}
```

This fails fast and prevents a poster from appointing unverified judges to a high-stakes task.

### 3.5 Admin Functions

```solidity
function setZkOracle(address oracle) external onlyOwner {
    zkOracle = oracle;
    emit ZkOracleUpdated(oracle);
}
```

### 3.6 New Events

```solidity
event ZkNullifierRegistered(address indexed wallet, bytes32 indexed nullifierHash);
event ZkOracleUpdated(address indexed oracle);
```

_Amend `TaskCreated`_ to include the new flag (indexers / SDK need it).

---

## 4. Oracle / Sync Mechanism

### 4.1 Daemon Relayer Flow

```
User completes World ID / Holonym in frontend
    |
    v
Frontend calls POST /api/v1/identity/zk-verify
    |
    v
AccountBindingStore records nullifierHash  (existing)
    |
    v
Daemon Relayer polls new verified wallets
    |
    v
Daemon calls AgentArenaEVM.registerZkNullifier(wallet, nullifierHash)
```

### 4.2 Relay Mode: Per-Transaction (MVP)

- **Pros:** immediate, simple, easy to debug.
- **Cons:** one `tx` per user as they verify; gas paid by relayer.
- **MVP Decision:** use per-tx relay. The frequency is bounded by user onboarding rate.

### 4.3 Future Optimization: Batch Relay

Add `batchRegisterZkNullifiers(address[] calldata wallets, bytes32[] calldata nullifierHashes) external onlyZkOracle` if onboarding volume justifies the gas savings.

### 4.4 Relayer Security

- The daemon wallet is a hot wallet with a small ETH allowance.
- Failed transactions are retried with exponential backoff.
- A Subgraph / event listener can back-fill missed registrations by replaying `ZkNullifierRegistered` events.

---

## 5. Security Considerations

| Risk                           | Mitigation                                                                                                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nullifier reuse / Sybil**    | `usedNullifiers` mapping rejects duplicates. Re-binding releases the old nullifier atomically.                                                                                                |
| **Front-running registration** | Not exploitable: the oracle is the only caller, and the nullifier is already bound to a specific wallet in the backend before the tx is broadcast.                                            |
| **Privacy leakage**            | Only `bytes32 nullifierHash` is stored; no PII (name, email, passport) ever touches the blockchain.                                                                                           |
| **Oracle compromise**          | Limited blast radius: a compromised oracle can only register false nullifiers, not steal funds. `onlyOwner` can rotate the oracle instantly via `setZkOracle`.                                |
| **Contract bypass**            | Backend checks remain in place (`/api/v1/identity/tier`), so even if the on-chain check were somehow circumvented, the backend would still reject an unverified applicant during SDK routing. |
| **Quorum judge evasion**       | Fast-fail validation at `postTaskQuorum` ensures unverified judges cannot be appointed. Runtime checks in `submitJudgement` provide defense in depth.                                         |

---

## 6. Implementation Checklist

### 6.1 Contract Layer

1. Add `zkNullifiers`, `usedNullifiers`, `requireZkKyc`, `zkOracle` to `AgentArenaEVM.sol`.
2. Add `onlyZkOracle` modifier.
3. Implement `registerZkNullifier`, `setZkOracle`, batch variant (optional).
4. Modify `postTask*` signatures to accept `bool requireZkKyc` and persist it.
5. Update `TaskCreated` event (append `bool requireZkKyc`).
6. Add `ZkKycRequired` custom error.
7. Gate `applyForTask` with `requireZkKyc` + `zkNullifiers` check.
8. Gate `judgeAndPay`, `judgeWithProof`, `submitJudgement` for designated / quorum judges.
9. Validate quorum judge list at task creation when flag is set.
10. Run `forge build` and fix any stack-too-deep / warning issues.

### 6.2 Daemon / Backend Layer

11. Add `EVMZkRelayer` module in `agent-daemon` (or reuse `EVMTaskBuilder`).
12. Hook into `/api/v1/identity/zk-verify` success handler to trigger on-chain registration.
13. Implement retry queue with idempotency key (`wallet+nullifierHash`).
14. Add an event back-fill script for disaster recovery.

### 6.3 Frontend / SDK Layer

15. Update `packages/sdk` EVM ABI to include new events / functions.
16. Update `apps/agentm-web` task-posting forms to expose “Require ZK-KYC” toggle when reward > threshold.

### 6.4 Testing Layer

17. Foundry unit test: `registerZkNullifier` success, duplicate revert, re-bind release.
18. Foundry unit test: `applyForTask` rejected when `requireZkKyc=true` and caller has no nullifier.
19. Foundry unit test: `judgeAndPay` rejected for unverified judge on ZK-gated task.
20. Foundry unit test: `postTaskQuorum` rejects unverified judges in the list.
21. Foundry integration test: full flow — register nullifier → post ZK-gated task → apply → judge.
22. Update `test/AgentArenaEVM.t.sol` to compile with new signatures (add `false` default flags to existing tests).

---

_End of design. No implementation code yet — proceed to Phase 5 Test Spec updates before coding._
