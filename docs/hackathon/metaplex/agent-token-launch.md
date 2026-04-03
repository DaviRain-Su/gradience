# Metaplex Agent Token Launch

> **Task**: GRA-94 - Launch Agent Token with Genesis Protocol
> **Date**: 2026-04-03
> **Status**: In Progress

## Overview

Launch a Metaplex Genesis Token for Gradience Agents, enabling:
- Agent ownership and governance
- Token-gated features
- Revenue sharing

## Token Economics

| Parameter | Value |
|-----------|-------|
| Token Name | GRAD Agent Token |
| Symbol | GAT |
| Total Supply | 100,000,000 |
| Decimals | 9 |

## Distribution

| Allocation | Percentage | Amount |
|------------|-----------|--------|
| Community | 40% | 40M |
| Team | 20% | 20M |
| Treasury | 25% | 25M |
| Liquidity | 15% | 15M |

## Genesis Protocol Integration

```rust
// Token mint authority
const MINT_AUTHORITY: Pubkey = ...;

// Genesis configuration
const GENESIS_CONFIG: GenesisConfig = GenesisConfig {
    name: "Gradience Agent Token",
    symbol: "GAT",
    uri: "https://gradience.xyz/token-metadata.json",
    seller_fee_basis_points: 500, // 5%
    creators: Some(vec![
        Creator {
            address: TEAM_WALLET,
            verified: true,
            share: 100,
        }
    ]),
};
```

## Implementation Steps

1. [ ] Create Metaplex token metadata
2. [ ] Deploy token mint
3. [ ] Configure Genesis Protocol
4. [ ] Distribute initial supply
5. [ ] Enable token-gated features

## References

- [Metaplex Token Metadata](https://docs.metaplex.com/programs/token-metadata/)
- [Genesis Protocol](https://docs.metaplex.com/programs/genesis/)
