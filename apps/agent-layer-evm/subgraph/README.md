# Gradience EVM Subgraph

> The Graph indexer for Gradience Protocol on EVM chains.

## Supported Contracts

- **AgentArenaEVM** – Task lifecycle, applications, submissions, disputes, protocol metrics
- **AgentMRegistry** – User profiles, ENS names, agent metadata
- **GradienceReputationFeed** – Cross-chain reputation snapshots
- **SocialGraph** (reserved) – Follow/unfollow relationships

## Quick Start

### 1. Install dependencies

```bash
cd apps/agent-layer-evm/subgraph
pnpm install
```

### 2. Copy ABIs from Foundry build

Ensure `forge build` has been run in `apps/agent-layer-evm/` first.

```bash
pnpm run copy-abis
```

### 3. Generate code & build

```bash
pnpm run codegen
pnpm run build
```

### 4. Deploy

#### Local Graph Node

```bash
pnpm run create:local
pnpm run deploy:local
```

#### The Graph Hosted Service / Studio

Update `subgraph.yaml` `network` and `source.address` fields, then:

```bash
pnpm run deploy
```

## Configuration

Before deployment you **must** update these fields in `subgraph.yaml`:

| Field                             | Description                                                     |
| --------------------------------- | --------------------------------------------------------------- |
| `dataSources[].network`           | Target network (`base-sepolia`, `xlayer`, `arbitrum-one`, etc.) |
| `dataSources[].source.address`    | Deployed contract address for that network                      |
| `dataSources[].source.startBlock` | Block number of the contract creation tx                        |

## Schema Highlights

| Entity           | Purpose                                             |
| ---------------- | --------------------------------------------------- |
| `Task`           | Full task state machine (Open → Completed/Refunded) |
| `Application`    | Agent stake + application timestamp                 |
| `Submission`     | Result/trace refs + submission timestamp            |
| `Dispute`        | Dispute bond, reason hash, resolution outcome       |
| `User`           | Aggregated on-chain identity across all contracts   |
| `Reputation`     | Oracle-fed global & category scores                 |
| `ProtocolMetric` | Singleton entity tracking aggregate protocol stats  |

## Multi-chain Deployment

Create one `subgraph.yaml` per network (e.g. `subgraph.base.yaml`, `subgraph.xlayer.yaml`) and deploy independently:

```bash
graph deploy --node https://api.thegraph.com/deploy/ gradience/agent-layer-evm-base
graph deploy --node https://api.thegraph.com/deploy/ gradience/agent-layer-evm-xlayer
```

## Development Notes

- AssemblyScript mappings live in `src/mappings/`.
- Shared helpers (user creation, metric loading) are in `src/utils/helpers.ts`.
- `SocialGraph` mappings are stubbed but inactive until the contract is deployed.
