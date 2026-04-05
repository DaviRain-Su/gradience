# AgentM Core Program Deployment

## Devnet Deployment

| Property | Value |
|----------|-------|
| **Program ID** | `2stkfkFaFLUvSR9yydmfQ7pZReo2M38zcVtL1QffCyDA` |
| **Deployment Date** | 2025-04-05 |
| **Network** | Devnet |
| **Program Data Address** | `JB3HuqfaAc3bDN7ypo5uZGwXUTh4BAaFigCT1fjmezLX` |
| **Authority** | `8uAPC2UxiBjKmUksVVwUA6q4RctiXkgSAsovBR39cd1i` |
| **Deployment Slot** | 453298805 |
| **Data Length** | 63856 bytes |

## Build Info

```bash
cargo build-sbf
solana program deploy ./programs/target/deploy/agentm_core.so --url devnet
```

## Verification

```bash
solana program show 2stkfkFaFLUvSR9yydmfQ7pZReo2M38zcVtL1QffCyDA --url devnet
```

## Keypair

Program keypair saved at:
`./programs/target/deploy/agentm_core-keypair.json`

## Instructions

| Discriminator | Instruction |
|---------------|-------------|
| 0 | initialize |
| 1 | register_user |
| 2 | update_profile |
| 3 | follow_user |
| 4 | unfollow_user |
| 5 | send_message |
| 6 | create_agent |
| 7 | update_agent_config |
| 8 | update_reputation |

## Configuration

Update your environment variable:
```bash
AGENTD_AGENTM_CORE_PROGRAM_ID=2stkfkFaFLUvSR9yydmfQ7pZReo2M38zcVtL1QffCyDA
```
