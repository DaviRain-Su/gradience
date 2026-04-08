# gUSD Stablecoin Design Specification

> Task: GRA-237  
> Status: Phase 1 — Design Complete  
> Target: Solana SPL primary, EVM bridged via Wormhole  
> Priority: P3

---

## 1. Executive Summary

**gUSD** is the native stablecoin of the Gradience Protocol. It is designed to serve as the settlement layer for agent task escrows, reputation staking, protocol fees, and cross-chain payments.

### Design Choice: Over-Collateralized + Protocol Revenue Backstop

| Mechanism | Rationale |
|-----------|-----------|
| **Over-collateralized minting** | Mature, auditable, avoids death-spiral risks of pure algorithmic models |
| **Dynamic collateral ratio** | Starts at 150%, adjusted by DAO-governance based on on-chain volatility feeds |
| **Protocol revenue backstop** | A portion of Gradience settlement fees (2% protocol take) accumulates in a Stability Pool to absorb bad debt |

This is a **hybrid model** combining the safety of MakerDAO/DAI with the capital efficiency of FRAX-style revenue backing.

---

## 2. Architecture

### 2.1 Core Components

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   gUSD Vault    │────▶│   Price Oracle  │◀────│  Chainlink Pyth │
│ (collateral mgmt)│     │  (SOL/USDC/gUSD)│     │   Aggregator    │
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   gUSD Token    │◀────│ Stability Pool  │◀────│ Protocol Fee    │
│   (SPL Token)   │     │  (backstop)     │     │   Router        │
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Wormhole Token  │────▶ Base / Arbitrum ERC-20
│    Bridge       │
└─────────────────┘
```

### 2.2 Solana Program Structure

| Program | Language | Responsibility |
|---------|----------|----------------|
| `gusd_token` | Rust / Anchor | SPL token mint with freeze/mint authority managed by `gusd_vault` |
| `gusd_vault` | Rust / Anchor | Collateral deposits, gUSD minting/redemption, liquidation engine |
| `gusd_oracle` | Rust / Anchor | Price feed aggregation, TWAP smoothing, circuit breakers |
| `gusd_stability_pool` | Rust / Anchor | Revenue accumulation, debt auction, surplus distribution |

### 2.3 EVM Bridged Token

- **Base/Arbitrum contract**: Standard `WormholeWrappedToken` (ERC-20) that unlocks original gUSD locked in the Wormhole Token Bridge on Solana.
- **Future upgrade path**: Native minting on EVM via `gusd_vault_evm` once cross-chain messaging matures.

---

## 3. Minting & Redemption Mechanics

### 3.1 Deposit & Mint

1. User deposits accepted collateral (SOL, USDC, or staked SOL derivatives like mSOL/bSOL) into `gusd_vault`.
2. Vault mints gUSD against collateral at the **current collateral ratio** (default 150%).
3. A **minting fee** (0.5%) is charged in gUSD and sent to the Stability Pool.

```rust
// Pseudocode
fn deposit_and_mint(ctx, collateral_amount, min_gusd_out) -> Result {
    let price = oracle.get_price(collateral_mint)?;
    let collateral_value = collateral_amount * price;
    let max_mint = collateral_value * LIQUIDATION_RATIO / 1.5;
    require!(mint_amount <= max_mint, Error::UnderCollateralized);
    token::mint_to(gusd_mint, user_ata, mint_amount)?;
    stability_pool.add_fee(mint_amount * MINT_FEE_BPS / 10_000)?;
}
```

### 3.2 Burn & Redeem

1. User burns gUSD to unlock collateral.
2. A **redemption fee** (0.5%, dynamic based on reserve ratio) is charged.
3. Collateral is returned to the user's wallet.

### 3.3 Liquidation

If a vault's collateral ratio drops below the **liquidation threshold** (initially 120%):
- Liquidators can repay the vault's gUSD debt and seize collateral at a **5% discount**.
- If no liquidator acts within 1 hour, the Stability Pool automatically absorbs the bad debt.

---

## 4. Collateral Types & Risk Parameters

| Collateral | Initial Ratio | Liquidation Threshold | Debt Ceiling |
|------------|---------------|----------------------|--------------|
| SOL | 150% | 120% | 5M gUSD |
| USDC | 110% | 105% | 10M gUSD |
| mSOL | 160% | 130% | 2M gUSD |
| bSOL | 160% | 130% | 2M gUSD |

- **Debt ceiling** limits systemic exposure to any single collateral type.
- Risk parameters are adjustable via DAO governance (`gDAO` token holders).

---

## 5. Stability Pool & Revenue

### 5.1 Inflows

- Minting fees (0.5%)
- Redemption fees (0.25%–1.0%, dynamic)
- Protocol settlement fees (2% of every Agent Arena task)
- Liquidation surplus (collateral seized above debt value)

### 5.2 Outflows

- **Bad debt absorption**: Auto-liquidation of underwater vaults
- **Surplus auction**: When Stability Pool exceeds 5% of total gUSD supply, excess is used to buy back and burn `gDAO` governance tokens

---

## 6. Oracle & Price Feeds

| Source | Asset | Latency | Fallback |
|--------|-------|---------|----------|
| Pyth Network | SOL/USD, mSOL/USD | ~400ms | Switchboard |
| Chainlink Data Streams | USDC/USD | ~1s | Pyth |

- **TWAP**: 5-minute exponential moving average to prevent flash-loan manipulation.
- **Circuit breaker**: If price deviation exceeds 10% in a single block, minting is paused for 15 minutes.

---

## 7. Compliance & Freeze

- `gusd_token` is implemented as a **SPL Token 2022** mint with the `PermanentDelegate` extension.
- The `PermanentDelegate` (controlled by Gradience DAO multisig) can freeze accounts **only** in response to a valid legal order or on-chain fraud proof.
- Freeze capability is **time-locked**: any freeze action requires a 48-hour timelock, except for emergency protocol pauses triggered by oracle circuit breakers.

---

## 8. Cross-Chain (EVM) Strategy

### Phase 1 (MVP)
- Mint natively on Solana.
- Bridge to Base/Arbitrum via **Wormhole Token Bridge**.
- EVM AMM liquidity bootstrapped on Uniswap V3 (Base) and Camelot (Arbitrum).

### Phase 2 (Future)
- Deploy `gusd_vault_evm` on Base for native collateralized minting using ETH and cbETH.
- Use **Wormhole NTT (Native Token Transfers)** for unified liquidity across chains.

---

## 9. Security Considerations

| Risk | Mitigation |
|------|------------|
| Oracle manipulation | Multi-source aggregation + TWAP + circuit breaker |
| Smart contract bugs | Audits by OtterSec + Neodyme, formal verification of vault math |
| Bank run / depeg | Over-collateralization + Stability Pool + redemption velocity limits (max 100k gUSD/hour) |
| Governance attack | 3-day timelock on all parameter changes, veto power by security council multisig |

---

## 10. Implementation Roadmap

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1: Design** | 2 weeks | This spec + economic model simulation |
| **Phase 2: Contracts** | 2 weeks | `gusd_vault`, `gusd_oracle`, `gusd_stability_pool` (Rust/Anchor) |
| **Phase 3: Audit** | 2 weeks | External audit + remediation |
| **Phase 4: Launch** | 1 week | Devnet → Mainnet-beta, liquidity bootstrapping, frontend integration |

---

## 11. Open Questions

1. Should we include **Gradience reputation score** as a collateral discount factor (e.g., high-reputation agents get lower minting fees)?
2. Do we want a **native savings rate** (gUSD deposited into Stability Pool earns yield) to increase demand?
3. Should the initial launch be **private beta** (whitelisted minting) or **permissionless** from day one?

---

*Last updated: 2026-04-08*  
*Author: Gradience Protocol Design Team*  
*Next step: Phase 2 contract implementation (pending resource allocation)*
