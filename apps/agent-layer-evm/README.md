# Agent Layer EVM

EVM-compatible implementation of the Gradience Agent Layer.

## Overview

This package provides:

- EVM smart contracts for Agent marketplace (task escrow, judge registry, agent/user registry, cross-chain reputation)
- Hardhat + Foundry dual test matrix
- Forge deployment scripts (standard + deterministic CREATE2)
- The Graph Subgraph for on-chain indexing

## Tech Stack

- **Contracts**: Solidity ^0.8.24, OpenZeppelin Contracts v5
- **Test Framework**: Hardhat (functional regression) + Foundry (fuzz / invariant / gas snapshot)
- **Deployment**: Foundry Forge Scripts
- **SDK Consumer**: `packages/sdk` (viem-based EVM adapter)
- **Indexing**: The Graph (AssemblyScript)
- **Target Chains**: Base, Arbitrum, Ethereum, XLayer

## Quick Start

```bash
cd apps/agent-layer-evm

# Install dependencies
pnpm install

# Compile contracts (Hardhat + Foundry)
npx hardhat compile
forge build

# Run tests
npx hardhat test
forge test

# Fork test against XLayer testnet
forge test --fork-url xlayer-testnet
```

## Project Structure

```
agent-layer-evm/
├── src/                    # Solidity contracts
├── test/                   # Hardhat (.js) + Foundry (.t.sol) tests
├── script/                 # Forge deployment scripts
├── subgraph/               # The Graph indexing
├── docs/                   # Phase docs (implementation log)
├── hardhat.config.js       # Hardhat configuration
└── foundry.toml            # Foundry + multi-chain RPC config
```

## Core Contracts

| Contract                      | Description                                     |
| ----------------------------- | ----------------------------------------------- |
| `AgentArenaEVM.sol`           | Production task escrow (UUPS proxy, ERC20)      |
| `AgentLayerRaceTask.sol`      | Legacy-compatible task escrow                   |
| `JudgeRegistry.sol`           | Judge registration, score, slash, re-assignment |
| `AgentMRegistry.sol`          | User profile + Agent on-chain registry          |
| `GradienceReputationFeed.sol` | Cross-chain reputation Oracle feed (ECDSA)      |
| `ReputationVerifier.sol`      | Ed25519 cross-chain signature verifier (legacy) |
| `DeterministicDeployer.sol`   | CREATE2 multi-chain deterministic deployer      |

## Test Strategy

We run a **dual test framework** intentionally (see `docs/06-implementation.md`):

| Framework   | Purpose                                                                       | Files                                    |
| ----------- | ----------------------------------------------------------------------------- | ---------------------------------------- |
| **Hardhat** | Full functional regression (ERC20, judge, dispute, quorum, cancel edge cases) | `test/*.test.js` (52 tests)              |
| **Foundry** | Fuzz, invariant, smoke, and gas-snapshot tests                                | `test/*.t.sol` (20 tests including fuzz) |

There are **no obsolete test suites to delete**; all files in `test/` are actively maintained. If you add a new economic invariant or edge case, prefer adding a Foundry fuzz test. If you add a new contract feature (e.g. new judge mode), add a Hardhat integration test first.

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=
BASESCAN_API_KEY=
ARBISCAN_API_KEY=
```

Optional RPC overrides (defaults are already baked into `foundry.toml`):

```bash
XLAYER_RPC_URL=https://rpc.xlayer.tech
BASE_RPC_URL=https://mainnet.base.org
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
ETHEREUM_RPC_URL=https://eth.llamarpc.com
```

## Deployment

### Standard UUPS Proxy Deploy

```bash
source .env
forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
```

### Deterministic CREATE2 Deploy (same address on every chain)

```bash
source .env
forge script script/DeterministicDeploy.s.sol --rpc-url base --broadcast
```

## Subgraph

```bash
cd subgraph
pnpm exec graph codegen
pnpm exec graph build
```

## Integration

See the unified SDK in [`packages/sdk`](../sdk/README.md) which now exports:

- `EVMTaskClient` — viem-based client for `AgentArenaEVM`
- `EVMAdapter` — minimal wallet adapter for EIP-1193 providers
- `MULTICALL3_ABI` / `encodeAggregate3Value` — batch EVM calls without native batch functions
