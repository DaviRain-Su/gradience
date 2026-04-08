# EVM Multi-Chain Deployment Guide

> Target chains: **Base Sepolia**, **Arbitrum Sepolia**

## Prerequisites

- [Foundry](https://book.getfoundry.sh/) installed (`forge`, `cast`, `anvil`)
- A funded testnet wallet on Base Sepolia and/or Arbitrum Sepolia
- RPC endpoints for both chains

## 1. Prepare Environment

```bash
cd apps/agent-layer-evm
cp .env.deploy.example .env.deploy
# Edit .env.deploy and set PRIVATE_KEY, RPC URLs, and optionally ORACLE_ADDRESS
```

## 2. Deploy to Base Sepolia

```bash
./scripts/deploy-base-sepolia.sh
```

## 3. Deploy to Arbitrum Sepolia

```bash
./scripts/deploy-arbitrum-sepolia.sh
```

## 4. Record Contract Addresses

After each deployment, Foundry prints broadcast receipts. Save the deployed proxy addresses:

| Contract | Purpose |
|----------|---------|
| `AgentArenaEVM` (proxy) | Core task/escrow/judge logic |
| `AgentMRegistry` | User/agent identity registry |
| `GradienceReputationFeed` (proxy) | Cross-chain reputation oracle feed |
| `SocialGraph` (proxy) | Follow/unfollow social graph |
| `JudgeRegistry` | Judge registration and pool management |

## 5. Update Frontend Configuration

Copy the deployed addresses into `apps/agentm-web/.env` (or `.env.local`):

```bash
NEXT_PUBLIC_AGENT_ARENA_EVM_ADDRESS=0x...
NEXT_PUBLIC_AGENT_M_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_GRADIENCE_REPUTATION_FEED_ADDRESS=0x...
NEXT_PUBLIC_SOCIAL_GRAPH_ADDRESS=0x...
NEXT_PUBLIC_JUDGE_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_EVM_RPC_ENDPOINT=https://sepolia.base.org
NEXT_PUBLIC_EVM_CHAIN_ID=84532
```

## 6. Update Subgraph Configuration

Fill the placeholder addresses in the subgraph manifests:

- `subgraph.base-sepolia.yaml`
- `subgraph.arbitrum-sepolia.yaml`

Then run:

```bash
cd subgraph
pnpm install
graph codegen subgraph.base-sepolia.yaml
graph build subgraph.base-sepolia.yaml
# Repeat for arbitrum-sepolia.yaml
```

## Deterministic Deployment (Optional)

If you want the **same contract addresses** on every chain, use the CREATE2 script:

```bash
forge script script/DeterministicDeploy.s.sol:DeterministicDeployScript \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast -vvvv
```

> Note: The deterministic deployer must have the same deployer nonce and salt on each chain.

## Troubleshooting

- `insufficient funds for gas * price + value` — Top up the deployer wallet with testnet ETH
- `verification failed` — Make sure `ETHERSCAN_API_KEY` matches the verifier URL domain
- `unsupported chain` — Add the custom chain to `foundry.toml` or pass `--legacy` / `--slow`
