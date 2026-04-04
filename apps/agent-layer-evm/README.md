# Agent Layer EVM

EVM-compatible implementation of the Gradience Agent Layer.

## Overview

This package provides:

- EVM smart contracts for Agent reputation and task settlement
- TypeScript SDK for EVM interaction
- CLI tools for EVM operations

## Tech Stack

- **Contracts**: Solidity 0.8+
- **Framework**: Hardhat / Foundry
- **SDK**: ethers.js / viem
- **Chains**: Ethereum, Base, Arbitrum, Optimism

## Quick Start

```bash
# Install dependencies
pnpm install

# Compile contracts
pnpm build

# Run tests
pnpm test

# Deploy to testnet
pnpm deploy:sepolia
```

## Project Structure

```
agent-layer-evm/
├── contracts/          # Solidity contracts
├── src/               # TypeScript SDK
├── test/              # Test suite
└── hardhat.config.ts  # Hardhat configuration
```

## Contracts

| Contract              | Description                    |
| --------------------- | ------------------------------ |
| `AgentReputation.sol` | On-chain reputation tracking   |
| `TaskEscrow.sol`      | Task escrow and settlement     |
| `JudgeRegistry.sol`   | Judge registration and staking |

## Environment Variables

```bash
PRIVATE_KEY=your_private_key
INFURA_API_KEY=your_infura_key
ETHERSCAN_API_KEY=your_etherscan_key
```

## Development

```bash
# Run local node
pnpm node

# Deploy locally
pnpm deploy:local

# Verify on Etherscan
pnpm verify --network mainnet CONTRACT_ADDRESS
```

## Integration

See [SDK Documentation](../sdk/README.md)
