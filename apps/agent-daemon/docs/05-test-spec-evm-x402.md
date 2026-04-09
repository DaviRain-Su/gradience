# Phase 5 Test Spec: EVM X402 Micropayments

> **Scope**: Define tests for `X402Settlement.sol`, `X402EvmClient`, and end-to-end EVM X402 flows in agent-daemon.

---

## 1. Smart Contract Tests (`forge test`)

### 1.1 Lock & Permit

| ID  | Test Name                                   | Expected Result                                                                                                     |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| T1  | `test_lockWithPermit_USDC`                  | Permit signature succeeds; contract receives `maxAmount`; `Authorization` stored correctly; `Locked` event emitted. |
| T2  | `test_lockWithPermit_RevertIfPermitInvalid` | Reverts with custom error or standard ERC-2612 revert when signature is tampered.                                   |
| T3  | `test_lockWithPermit_RevertIfChannelExists` | Reverts `ChannelAlreadyExists` when locking same `channelId` twice.                                                 |
| T4  | `test_lockWithApproval_FallbackToken`       | Works for non-permit tokens using prior `approve()`; `Authorization` stored.                                        |

### 1.2 Settlement

| ID  | Test Name                            | Expected Result                                                                                               |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| T5  | `test_settle_Partial`                | Recipient receives `actualAmount`; payer receives refund `maxAmount - actualAmount`; `Settled` event emitted. |
| T6  | `test_settle_FullAmount`             | Recipient receives entire `maxAmount`; zero refund; status `settled = true`.                                  |
| T7  | `test_settle_RevertIfNotRecipient`   | Non-recipient caller reverts `UnauthorizedCaller`.                                                            |
| T8  | `test_settle_RevertIfExceedsMax`     | `actualAmount > maxAmount` reverts `SettlementTooHigh`.                                                       |
| T9  | `test_settle_RevertIfAlreadySettled` | Second `settle` call reverts `AlreadySettled`.                                                                |
| T10 | `test_settle_RevertIfRolledBack`     | `settle` after `rollback` reverts `AlreadyRolledBack`.                                                        |

### 1.3 Rollback

| ID  | Test Name                                   | Expected Result                                                                      |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| T11 | `test_rollback_ByRecipient`                 | Full `maxAmount` refunded to payer; `RolledBack` event emitted; `rolledBack = true`. |
| T12 | `test_rollback_ByPayerAfterDeadline`        | Payer can rollback only if `block.timestamp > auth.deadline`; refund sent.           |
| T13 | `test_rollback_RevertIfPayerBeforeDeadline` | Payer rollback before deadline reverts `DeadlineNotReached`.                         |
| T14 | `test_rollback_RevertIfAlreadySettled`      | `rollback` after `settle` reverts `AlreadySettled`.                                  |

### 1.4 Re-entrancy & Edge Cases

| ID  | Test Name                    | Expected Result                                                                                  |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| T15 | `test_settle_ReentrancySafe` | Attempted re-entrancy attack does not drain contract (use `ReentrancyGuard` or verify balances). |
| T16 | `test_permitNonceUsedTwice`  | Second lock with same ERC-2612 nonce reverts on token contract.                                  |

---

## 2. Daemon Unit/Integration Tests (`vitest`)

### 2.1 `X402EvmClient`

| ID  | Test Name                              | Expected Result                                                                                                                                 |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| T17 | `should lockWithPermit on local anvil` | Spins up `anvil` fork, deploys `X402Settlement` + a mock ERC-2612 token, calls `lockWithPermit`, verifies `authorizations(channelId)` on-chain. |
| T18 | `should settle on local anvil`         | After T17, calls `settle` and verifies recipient/payer balances.                                                                                |
| T19 | `should rollback on local anvil`       | After T17, calls `rollback` and verifies full refund.                                                                                           |
| T20 | `should reject settle exceeding max`   | `settle` with `actualAmount > maxAmount` throws `DaemonError`.                                                                                  |

### 2.2 `X402Handler` EVM Path

| ID  | Test Name                                            | Expected Result                                                                                                              |
| --- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| T21 | `should accept evm_permit authorization type`        | `processAuthorization` with `type: 'evm_permit'` submits `lockWithPermit` successfully; session status becomes `authorized`. |
| T22 | `should reject unsupported evm authorization format` | Malformed JSON payload throws `DaemonError` with `PAYMENT_TYPE_NOT_SUPPORTED` or validation error.                           |
| T23 | `should settle after authorization via handler`      | `handler.settle(paymentId, actualAmount)` calls `X402EvmClient.settle`; session status becomes `completed`.                  |
| T24 | `should rollback after authorization via handler`    | `handler.rollback(paymentId)` calls `X402EvmClient.rollback`; session status becomes `rolled_back`.                          |

---

## 3. End-to-End Test (Hardhat/Anvil)

### E2E1: Full Permit → Service → Settle Flow

```typescript
it('E2E: payer authorizes, provider locks, service completes, provider settles', async () => {
    // 1. Provider creates requirements
    // 2. Payer signs ERC-2612 permit
    // 3. Payer sends authorization to provider
    // 4. Provider processes authorization (locks funds)
    // 5. Provider executes mock service
    // 6. Provider settles 80% of maxAmount
    // 7. Assert recipient balance += 80%, payer balance += 20%
});
```

### E2E2: Full Permit → Service Failure → Rollback Flow

```typescript
it('E2E: service fails, provider rolls back', async () => {
    // Steps 1-4 same as E2E1
    // 5. Mock service throws error
    // 6. Provider calls rollback
    // 7. Assert payer receives 100% refund
});
```

### E2E3: Payer Timeout Rollback

```typescript
it('E2E: provider ignores settlement, payer rolls back after deadline', async () => {
    // Steps 1-4 same as E2E1
    // 5. Warp time past deadline
    // 6. Payer calls rollback
    // 7. Assert full refund to payer
});
```

---

## 4. CI Requirements

- Add `forge test` for `X402Settlement.t.sol` to existing `.github/workflows/test-evm-foundry.yml`.
- Add daemon vitest for `x402-evm.integration.test.ts` to `.github/workflows/test-agent-daemon.yml` (existing daemon test workflow).

---

## 5. Test Fixtures

### Mock ERC-2612 Token

A simple `MockPermitERC20.sol` for Foundry/Hardhat tests:

- Inherits OpenZeppelin `ERC20Permit`
- `mint(to, amount)` available in test builds

### Anvil/Hardhat Network Setup

- Deploy `MockPermitERC20`
- Deploy `X402Settlement`
- Fund test wallets with tokens and native gas
