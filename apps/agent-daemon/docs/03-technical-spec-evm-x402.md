# Phase 3 Technical Spec: EVM X402 Micropayments

> **Scope**: Add EVM-native X402 payment settlement to the Gradience agent-daemon, enabling Agent-to-Agent (A2A) micropayments on EVM chains (Base Sepolia as first target).
> **Related Systems**: `payments/x402-handler.ts`, `payments/x402-manager.ts`, `evm/transaction-manager.ts`, `agent-layer-evm`

---

## 1. Objective

Enable the daemon to create, authorize, settle, and rollback X402 micropayments on EVM using a lightweight on-chain escrow contract. The design must:
- Reuse the existing `X402Handler` / `X402PaymentManager` interfaces where possible.
- Support ERC-20 tokens (USDC as primary) via ERC-2612 `permit()` for gasless authorization.
- Fall back to standard `approve()` + `transferFrom()` when `permit()` is unavailable.
- Provide deterministic settlement with optional rollback for service failure.

---

## 2. Architecture Overview

### 2.1 Existing Patterns
- **Solana X402** (`src/payments/x402-handler.ts`): server responds with `402 Payment Required`; client returns a signed Solana transaction; server submits it.
- **EVM Transaction Manager** (`src/evm/transaction-manager.ts`): uses `viem` to call `AgentArenaEVM` functions.

### 2.2 EVM X402 Addition
We introduce a new smart contract **`X402Settlement`** in `apps/agent-layer-evm/src/` and extend the daemon payment layer.

```
┌─────────────┐      402 + requirements      ┌─────────────┐
│  Agent A    │ ◄──────────────────────────── │  Agent B    │
│   (payer)   │                              │ (provider)  │
└──────┬──────┘                              └──────┬──────┘
       │                                            │
       │  authorization (permit signature)          │
       │ ─────────────────────────────────────────► │
       │                                            │
       │         settle(actualAmount)               │
       │ ◄───────────────────────────────────────── │
       │                                            │
       │              rollback()                    │
       │ ◄───────────────────────────────────────── │
```

---

## 3. Smart Contract: `X402Settlement.sol`

### 3.1 State

```solidity
struct Authorization {
    address payer;
    address recipient;
    address token;
    uint256 maxAmount;
    uint256 lockedAmount;   // amount actually locked in escrow
    uint256 deadline;
    bytes32 nonce;
    bool exists;
    bool settled;
    bool rolledBack;
}

mapping(bytes32 => Authorization) public authorizations;
mapping(address => mapping(bytes32 => bool)) public usedNonces;
```

### 3.2 Key Functions

#### `createAuthorization`
Called by **provider** (Agent B) to register a payment channel before receiving the client signature. This is optional; the provider can also derive the channel ID off-chain and call `lockWithPermit` directly.

#### `lockWithPermit`
```solidity
function lockWithPermit(
    bytes32 channelId,
    address payer,
    address recipient,
    address token,
    uint256 maxAmount,
    uint256 deadline,
    bytes32 nonce,
    uint8 v,
    bytes32 r,
    bytes32 s
) external;
```
- Verifies `permit(token, maxAmount, deadline, v, r, s)` on the ERC-20.
- Transfers `maxAmount` from `payer` into this contract.
- Stores the `Authorization`.
- Emits `Locked(channelId, payer, recipient, token, maxAmount)`.

#### `lockWithApproval`
Fallback for tokens without ERC-2612.
```solidity
function lockWithApproval(
    bytes32 channelId,
    address payer,
    address recipient,
    address token,
    uint256 maxAmount,
    bytes32 nonce
) external;
```
- Requires prior `approve()` on the ERC-20.
- Transfers `maxAmount` from `payer` via `transferFrom`.

#### `settle`
```solidity
function settle(bytes32 channelId, uint256 actualAmount) external;
```
- Only callable by `authorization.recipient`.
- Requires `actualAmount <= maxAmount`.
- Transfers `actualAmount` to `recipient`.
- Refunds `maxAmount - actualAmount` to `payer`.
- Emits `Settled(channelId, actualAmount, refunded)`.

#### `rollback`
```solidity
function rollback(bytes32 channelId) external;
```
- Callable by `recipient` (provider failed) or `payer` (after timeout).
- Requires `block.timestamp > authorization.deadline` for payer rollback.
- Refunds full `maxAmount` to `payer`.
- Emits `RolledBack(channelId)`.

### 3.3 Events

```solidity
event Locked(bytes32 indexed channelId, address indexed payer, address indexed recipient, address token, uint256 maxAmount);
event Settled(bytes32 indexed channelId, uint256 actualAmount, uint256 refunded);
event RolledBack(bytes32 indexed channelId);
```

---

## 4. Daemon Integration

### 4.1 New Module: `src/payments/x402-evm.ts`

Wraps `viem` interactions with `X402Settlement`.

```typescript
export interface EvmX402Config {
  rpcUrl: string;
  chain: Chain;               // e.g. baseSepolia
  settlementAddress: `0x${string}`;
  walletPrivateKey: `0x${string}`;
}

export class X402EvmClient {
  async lockWithPermit(params: LockPermitParams): Promise<`0x${string}`>;
  async lockWithApproval(params: LockApprovalParams): Promise<`0x${string}`>;
  async settle(channelId: string, actualAmount: bigint): Promise<`0x${string}`>;
  async rollback(channelId: string): Promise<`0x${string}`>;
}
```

### 4.2 Extending `X402Handler`

Update `X402Authorization.type` to support:
- `'evm_permit'` — contains the packed `v,r,s` signature + permit deadline.
- `'evm_transaction'` — fallback pre-signed EVM transaction (for wallets that don't support permit).

When `processAuthorization()` receives `type === 'evm_permit'`:
1. Deserialize the authorization payload (JSON with `channelId, maxAmount, deadline, nonce, v, r, s`).
2. Call `X402EvmClient.lockWithPermit(...)` to move funds on-chain.
3. On success, update session status to `authorized` (not `completed` yet — settlement happens later).

When `settle(channelId, actualAmount)` is called:
1. Call `X402EvmClient.settle(channelId, actualAmount)`.
2. Update session status to `completed`.

### 4.3 Extending `X402PaymentManager`

Replace the mock `executeTransfer` with real EVM path when `rpcUrl` is an EVM endpoint:

```typescript
private async executeTransfer(from, to, amount): Promise<string> {
  if (this.isEvmEndpoint()) {
    return this.evmClient.settle(channelId, amount);
  }
  // existing Solana placeholder
}
```

### 4.4 ABI (contract)

Stored in `src/evm/abi/x402-settlement.ts` as a `viem`-compatible ABI array.

---

## 5. Payment Flow Detail

### Sequence: Permit → Lock → Settle

1. **Provider** (`Agent B`) creates `X402PaymentRequirements` via `X402Handler.createPaymentRequirements()`.
2. **Payer** (`Agent A`) receives 402 headers.
3. **Payer** signs an ERC-2612 `permit(X402Settlement, maxAmount, deadline, v, r, s)`.
4. **Payer** sends the signature back as `X402Authorization { type: 'evm_permit', ... }`.
5. **Provider** calls `X402Handler.processAuthorization()`.
   - `processAuthorization` invokes `X402EvmClient.lockWithPermit(...)`.
   - Funds are locked in `X402Settlement`.
6. **Provider** executes the service.
7. **Provider** calls `X402Handler.settle(paymentId, actualAmount)`.
   - Funds are transferred to provider; remainder refunded to payer.

### Sequence: Rollback

- If service fails, provider calls `rollback(paymentId)` which triggers `X402EvmClient.rollback(channelId)`.
- If provider never settles and deadline passes, payer can also call rollback (front-end or daemon watchdog).

---

## 6. Security & Error Handling

| Risk | Mitigation |
|------|------------|
| Replay of permit signature | `usedNonces` mapping in contract + EIP-2612 nonce tracking on token |
| Provider steals more than max | `settle` enforces `actualAmount <= maxAmount` |
| Payer double-spends off-chain | Lock happens on-chain before service execution |
| Provider never settles | `rollback` callable by payer after deadline |
| Re-entrancy on ERC-20 transfer | Use `ReentrancyGuard` or checks-effects-interactions pattern |
| Invalid token contract | Validate token address is a contract (`extcodesize > 0`) on first lock |

### Custom Errors (Solidity)
- `InvalidChannelId()`
- `ChannelAlreadyExists(bytes32)`
- `UnauthorizedCaller(address)`
- `ChannelNotFound(bytes32)`
- `AlreadySettled(bytes32)`
- `AlreadyRolledBack(bytes32)`
- `SettlementTooHigh(uint256 requested, uint256 max)`
- `DeadlineNotReached(bytes32)`
- `PermitFailed(bytes32)`

---

## 7. Configuration

Add to `apps/agent-daemon/src/config.ts`:

```typescript
x402Evm: {
  enabled: boolean;
  settlementAddress: `0x${string}`;
  acceptedTokens: { address: `0x${string}`; symbol: string; decimals: number; permit?: boolean }[];
}
```

Environment variables:
```bash
AGENTD_X402_EVM_ENABLED=true
AGENTD_X402_EVM_SETTLEMENT=0x...
AGENTD_X402_EVM_USDC=0x...
```

---

## 8. Deployment

### X Layer Testnet (chainId 195)

| Contract | Address |
|----------|---------|
| `X402Settlement` | `0x1Af0E217d434323f428609a42Df36B3D93c2452a` |

*Deployer:* `0x067aBc270C4638869Cd347530Be34cBdD93D0EA1`  
*Deployed at:* 2026-04-09

### Deployment Steps

1. Deploy `X402Settlement.sol` to X Layer Testnet via Foundry script:
   ```bash
   cd apps/agent-layer-evm
   PRIVATE_KEY=0x... forge script script/DeployX402Settlement.s.sol --rpc-url xlayer-testnet --broadcast
   ```
2. Record address in `apps/agent-layer-evm/DEPLOYMENT.md`.
3. Update daemon `.env` with the deployed address:
   ```bash
   AGENTD_X402_EVM_SETTLEMENT_ADDRESS=0x1Af0E217d434323f428609a42Df36B3D93c2452a
   ```

---

## 9. References

- `apps/agent-daemon/src/payments/x402-handler.ts`
- `apps/agent-daemon/src/payments/x402-manager.ts`
- `apps/agent-daemon/src/evm/transaction-manager.ts`
- `apps/agent-layer-evm/src/AgentArenaEVM.sol`
- [ERC-2612](https://eips.ethereum.org/EIPS/eip-2612)
- [X402 Specification](https://x402.org/)
