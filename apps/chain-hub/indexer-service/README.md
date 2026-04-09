# Chain Hub Indexer Service

A Rust-based indexer service for the Chain Hub Solana program. This service indexes on-chain events including skill registrations, protocol registrations, and invocation tracking.

## Features

- **Skill Indexing**: Track registered skills with metadata
- **Protocol Indexing**: Monitor protocol registrations and status
- **Royalty Tracking**: Track agent earnings from invocations
- **Invocation History**: Query invocation records
- **Real-time WebSocket**: Subscribe to live events
- **Webhook Support**: Receive events from Triton, Helius, or generic sources

## Quick Start

### Using Docker Compose (Recommended)

The indexer now connects to Solana devnet by default for real-time indexing.

```bash
# Copy environment file (optional - defaults are pre-configured)
cp .env.example .env

# Start services (first time will build)
docker-compose up -d --build

# View logs - you should see Solana subscriber starting
docker-compose logs -f indexer
```

You should see output like:

```
Starting Solana subscriber...
  Program ID: 6G39W7JGQz7A6L5dAvotFuRP9UbFdCJg2BqDuj6WJWec
  WebSocket: wss://api.devnet.solana.com
Solana subscriber started successfully
chain-hub-indexer listening on 0.0.0.0:8788
```

### Verification

```bash
# Check all containers are running
docker ps | grep indexer

# Test API
curl http://localhost:8788/api/skills
curl http://localhost:8788/api/protocols
```

### Local Development

```bash
# Set up database
export DATABASE_URL=postgres://gradience:gradience_dev@localhost:5433/gradience_chain_hub

# Run migrations
psql $DATABASE_URL -f migrations/0001_init.sql

# Build and run
cargo build --release
./target/release/chain-hub-indexer
```

## API Endpoints

### Health & Metrics

- `GET /healthz` - Health check
- `GET /metrics` - Prometheus metrics

### Skills

- `GET /api/skills` - List all skills
    - Query params: `status`, `category`, `authority`, `limit`, `offset`, `page`
- `GET /api/skills/{skill_id}` - Get skill by ID

### Protocols

- `GET /api/protocols` - List all protocols
    - Query params: `status`, `protocol_type`, `authority`, `limit`, `offset`, `page`
- `GET /api/protocols/{protocol_id}` - Get protocol by ID

### Royalties

- `GET /api/royalties/{agent}` - Get royalty info for an agent

### Invocations

- `GET /api/invocations` - List invocations
    - Query params: `agent`, `skill_id`, `protocol_id`, `status`, `limit`, `offset`, `page`
- `GET /api/invocations/{invocation_id}` - Get invocation by ID

### Webhooks

- `POST /webhook/triton` - Triton webhook endpoint
- `POST /webhook/helius` - Helius webhook endpoint
- `POST /webhook/events` - Generic webhook endpoint

### WebSocket

- `GET /ws` - WebSocket endpoint for real-time events

## Environment Variables

| Variable                     | Description                    | Default                            |
| ---------------------------- | ------------------------------ | ---------------------------------- |
| `INDEXER_BIND_ADDR`          | Server bind address            | `0.0.0.0:8788`                     |
| `DATABASE_URL`               | PostgreSQL connection string   | -                                  |
| `CHAIN_HUB_PROGRAM_ID`       | Chain Hub program ID           | `11111111111111111111111111111111` |
| `SOLANA_WS_URL`              | Solana WebSocket URL           | `wss://api.devnet.solana.com`      |
| `SOLANA_SUBSCRIBE`           | Enable Solana log subscription | `false`                            |
| `TRITON_STALE_AFTER_SECONDS` | Triton webhook stale threshold | `30`                               |

## Events

The indexer processes the following events:

- `SkillRegistered` - New skill registration
- `ProtocolRegistered` - New protocol registration
- `SkillStatusUpdated` - Skill status change (active/paused)
- `ProtocolStatusUpdated` - Protocol status change
- `InvocationCreated` - New invocation initiated
- `InvocationCompleted` - Invocation completed with royalty

## Database Schema

### skills

- `skill_id` (BIGINT, PK)
- `authority` (VARCHAR)
- `judge_category` (SMALLINT)
- `status` (SMALLINT)
- `name` (VARCHAR)
- `metadata_uri` (VARCHAR)
- `created_at` (BIGINT)
- `slot` (BIGINT)

### protocols

- `protocol_id` (VARCHAR, PK)
- `authority` (VARCHAR)
- `protocol_type` (SMALLINT)
- `trust_model` (SMALLINT)
- `auth_mode` (SMALLINT)
- `status` (SMALLINT)
- `capabilities_mask` (BIGINT)
- `endpoint` (VARCHAR)
- `docs_uri` (VARCHAR)
- `program_id` (VARCHAR)
- `idl_ref` (VARCHAR)
- `created_at` (BIGINT)
- `slot` (BIGINT)

### royalties

- `agent` (VARCHAR, PK)
- `total_earned` (BIGINT)
- `total_paid` (BIGINT)
- `balance` (BIGINT)
- `updated_slot` (BIGINT)

### invocations

- `invocation_id` (BIGINT, PK)
- `task_id` (BIGINT)
- `requester` (VARCHAR)
- `skill_id` (BIGINT, FK)
- `protocol_id` (VARCHAR, FK)
- `agent` (VARCHAR)
- `judge` (VARCHAR)
- `amount` (BIGINT)
- `status` (SMALLINT)
- `royalty_amount` (BIGINT)
- `created_at` (BIGINT)
- `completed_at` (BIGINT)
- `slot` (BIGINT)

## License

MIT
