---
name: monad-pay-exec
description: >
  Monad payment/settlement + execution skill for OpenClaw. Provides read/compose/execute tools
  and workflow for transfers, swaps, and lending plans.
---

# Monad Pay+Exec Skill (OpenClaw)

A focused Monad skill that exposes **payment/settlement**, **trade execution**, and **workflow orchestration** as OpenClaw tools.

## What this skill covers

- **Payment/settlement primitives**: per-call charge or subscription intent objects
- **Transfer + DEX swap compose**: native + ERC20 transfer, approve, swapExactTokensForTokens (ethers v6)
- **Lending planning**: supply/borrow/repay/withdraw plan objects (protocol-agnostic)
- **Workflow**: analysis → simulate → execute for transfers

> This skill is intentionally minimal and hackathon-ready. Extend the lending adapter when Monad protocol details are finalized.

---

## Prerequisites

1) Install plugin

```bash
openclaw plugins install /Users/davirian/dev/gradience
openclaw plugins enable monad-openclaw-skill
openclaw gateway restart
```

2) Configure RPC

```bash
export MONAD_RPC_URL="https://rpc.monad.xyz"
```

---

## Tool Inventory

### Read
- `monad_getBalance`
- `monad_getErc20Balance`
- `monad_getBlockNumber`

### Compose
- `monad_buildTransferNative`
- `monad_buildTransferErc20`
- `monad_buildErc20Approve`
- `monad_buildDexSwap`
- `monad_planLendingAction`
- `monad_morpho_vault_buildDeposit`
- `monad_morpho_vault_buildWithdraw`
- `monad_morpho_vault_buildRedeem`

### Execute
- `monad_sendSignedTransaction`

### Workflow
- `monad_runTransferWorkflow`

### Strategy
- `monad_strategy_templates`
- `monad_strategy_compile`
- `monad_strategy_validate`
- `monad_strategy_run`

### Payments
- `monad_paymentIntent_create`
- `monad_subscriptionIntent_create`

### Quotes
- `monad_lifi_getQuote`
- `monad_lifi_getRoutes`
- `monad_lifi_extractTxRequest`
- `monad_lifi_runWorkflow`

### Morpho
- `monad_morpho_vault_meta`
- `monad_morpho_vault_totals`
- `monad_morpho_vault_balance`
- `monad_morpho_vault_previewDeposit`
- `monad_morpho_vault_previewWithdraw`
- `monad_morpho_vault_previewRedeem`
- `monad_morpho_vault_convert`

---

## Payment/Settlement Pattern

You can create payment intents in your OpenClaw workflow and gate execution by payment status.

**Example: per-call payment intent object** (stored in OpenClaw state):

```json
{
  "paymentIntent": {
    "type": "pay_per_call",
    "token": "USDC",
    "amount": "1000000",
    "payer": "0x...",
    "payee": "0x...",
    "expiresAt": "2026-02-22T10:00:00Z",
    "memo": "analysis fee"
  }
}
```

Use OpenClaw workflow logic to ensure payment is observed before executing trades.

---

## Examples

### 0) Strategy compile (NL → spec)

```json
{
  "tool": "monad_strategy_compile",
  "params": {
    "intentText": "swap 10 USDC to MON",
    "params": {
      "router": "0xRouter",
      "tokenIn": "0xUSDC",
      "tokenOut": "0xMON",
      "amountIn": "10000000",
      "minOut": "9900000"
    }
  }
}
```

You can also pick explicit templates like `swap-deposit-v1`, `withdraw-swap-v1`, or `lifi-swap-v1`.

### 1) Read balances

```json
{
  "tool": "monad_getBalance",
  "params": {
    "address": "0xYourWallet"
  }
}
```

```json
{
  "tool": "monad_getErc20Balance",
  "params": {
    "address": "0xYourWallet",
    "tokenAddress": "0xToken"
  }
}
```

### 2) Compose transfer

```json
{
  "tool": "monad_buildTransferNative",
  "params": {
    "toAddress": "0xRecipient",
    "amountWei": "1000000000000000"
  }
}
```

```json
{
  "tool": "monad_buildTransferErc20",
  "params": {
    "tokenAddress": "0xToken",
    "toAddress": "0xRecipient",
    "amountRaw": "1000000"
  }
}
```

### 3) Compose swap

```json
{
  "tool": "monad_buildDexSwap",
  "params": {
    "router": "0xRouter",
    "amountIn": "1000000",
    "amountOutMin": "990000",
    "path": ["0xTokenIn", "0xTokenOut"],
    "to": "0xRecipient",
    "deadline": "1760000000"
  }
}
```

### 4) Plan lending

```json
{
  "tool": "monad_planLendingAction",
  "params": {
    "protocol": "monad-lend-v1",
    "market": "USDC",
    "action": "supply",
    "asset": "USDC",
    "amountRaw": "1000000"
  }
}
```

### 4.1) Payment intent (pay-per-call)

```json
{
  "tool": "monad_paymentIntent_create",
  "params": {
    "token": "USDC",
    "amountRaw": "1000000",
    "payee": "0xPayee",
    "payer": "0xPayer",
    "memo": "strategy fee"
  }
}
```

### 4.2) Subscription intent

```json
{
  "tool": "monad_subscriptionIntent_create",
  "params": {
    "token": "USDC",
    "amountRaw": "1000000",
    "payee": "0xPayee",
    "payer": "0xPayer",
    "cadenceSeconds": 2592000
  }
}
```

### 4.3) LI.FI quote

```json
{
  "tool": "monad_lifi_getQuote",
  "params": {
    "fromChain": 101,
    "toChain": 101,
    "fromToken": "0xTokenA",
    "toToken": "0xTokenB",
    "fromAmount": "1000000",
    "fromAddress": "0xYourWallet"
  }
}
```

```json
{
  "tool": "monad_lifi_getRoutes",
  "params": {
    "fromChain": 101,
    "toChain": 101,
    "fromToken": "0xTokenA",
    "toToken": "0xTokenB",
    "fromAmount": "1000000",
    "fromAddress": "0xYourWallet"
  }
}
```

```json
{
  "tool": "monad_lifi_extractTxRequest",
  "params": {
    "quote": { "transactionRequest": { "to": "0x...", "data": "0x..." } }
  }
}
```

```json
{
  "tool": "monad_lifi_runWorkflow",
  "params": {
    "runMode": "analysis",
    "fromChain": 101,
    "toChain": 101,
    "fromToken": "0xTokenA",
    "toToken": "0xTokenB",
    "fromAmount": "1000000",
    "fromAddress": "0xYourWallet"
  }
}
```

### 4.4) Morpho vault deposit

```json
{
  "tool": "monad_morpho_vault_buildDeposit",
  "params": {
    "vaultAddress": "0xVault",
    "amountRaw": "1000000",
    "receiver": "0xYourWallet"
  }
}
```

```json
{
  "tool": "monad_morpho_vault_totals",
  "params": {
    "vaultAddress": "0xVault"
  }
}
```

```json
{
  "tool": "monad_morpho_vault_previewDeposit",
  "params": {
    "vaultAddress": "0xVault",
    "amountRaw": "1000000"
  }
}
```

```json
{
  "tool": "monad_morpho_vault_previewRedeem",
  "params": {
    "vaultAddress": "0xVault",
    "sharesRaw": "1000000"
  }
}
```

### 5) Workflow: transfer (analysis → simulate → execute)

```json
{
  "tool": "monad_runTransferWorkflow",
  "params": {
    "runMode": "analysis",
    "fromAddress": "0xYourWallet",
    "toAddress": "0xRecipient",
    "amountRaw": "1000000000000000"
  }
}
```

```json
{
  "tool": "monad_runTransferWorkflow",
  "params": {
    "runMode": "simulate",
    "fromAddress": "0xYourWallet",
    "toAddress": "0xRecipient",
    "amountRaw": "1000000000000000"
  }
}
```

```json
{
  "tool": "monad_runTransferWorkflow",
  "params": {
    "runMode": "execute",
    "fromAddress": "0xYourWallet",
    "toAddress": "0xRecipient",
    "amountRaw": "1000000000000000",
    "signedTxHex": "0x..."
  }
}
```

---

## OpenClaw Playbook Skeleton

```yaml
name: monad-pay-exec
trigger: manual
steps:
  - tool: monad_getBalance
    params:
      address: "{{env.MONAD_WALLET}}"
    save_as: balance

  - condition: balance.balanceWei > "0"
    then:
      - tool: monad_buildTransferErc20
        params:
          tokenAddress: "0xToken"
          toAddress: "0xRecipient"
          amountRaw: "1000000"
        save_as: transfer

      - tool: monad_sendSignedTransaction
        params:
          signedTxHex: "{{secrets.SIGNED_TX}}"
```

---

## Notes

- **Signing is external**: OpenClaw (or your wallet service) signs and provides `signedTxHex`.
- **DEX swap**: Uses router-based calldata for `swapExactTokensForTokens`. You must `approve` first.
- **Lending**: `monad_planLendingAction` is a protocol-agnostic plan; attach your adapter to encode calldata.
- **Strategy engine**: NL → template is heuristic. You can always pass `template` + `params` explicitly.
