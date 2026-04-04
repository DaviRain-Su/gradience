# Gradience Solana Programs

This directory contains all Solana programs for the Gradience Protocol.

## Programs

| Program                 | Description                                                   | Status      |
| ----------------------- | ------------------------------------------------------------- | ----------- |
| `agent-arena/`          | Core protocol for Agent task settlement with race competition | ✅ Live     |
| `chain-hub/`            | Chain Hub for unified on-chain tooling access                 | 📐 Designed |
| `agentm-core/`          | AgentM Core identity and messaging                            | 📐 Designed |
| `a2a-protocol/`         | Agent-to-Agent communication protocol                         | 📐 Designed |
| `workflow-marketplace/` | Workflow and marketplace functionality                        | 📐 Designed |

## Architecture

```
programs/
├── Cargo.toml          # Workspace configuration
├── agent-arena/        # Task settlement + reputation
├── chain-hub/          # Tooling layer
├── agentm-core/        # Identity + messaging
├── a2a-protocol/       # Agent communication
└── workflow-marketplace/ # Workflows
```

## Development

### Prerequisites

- Rust 1.75+
- Solana CLI 2.2+
- `cargo-build-sbf` (install via `solana-install init 2.2`)

### Build

```bash
# Build all programs
cargo build-sbf

# Build specific program
cargo build-sbf --manifest-path agent-arena/Cargo.toml
```

### Test

```bash
# Run all tests
cargo test

# Run specific program tests
cargo test --manifest-path agent-arena/Cargo.toml
```

### Deploy

```bash
# Deploy to devnet
solana program deploy target/deploy/agent_arena.so

# Deploy script (from root)
./deploy/devnet-deploy.sh
```

## Program IDs

| Program      | Devnet | Mainnet |
| ------------ | ------ | ------- |
| agent-arena  | TBD    | TBD     |
| chain-hub    | TBD    | TBD     |
| agentm-core  | TBD    | TBD     |
| a2a-protocol | TBD    | TBD     |

## Documentation

- [Protocol Whitepaper](../../protocol/whitepaper/gradience-en.pdf)
- [Architecture Diagrams](../../public/diagrams/index.html)
- [SDK Documentation](../../packages/sdk/README.md)

## Security

See [SECURITY.md](../../SECURITY.md) for vulnerability reporting.
