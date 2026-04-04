# Agent Daemon

Backend daemon for Gradience Protocol — handles Agent sessions, A2A routing, and task processing.

## Overview

The Agent Daemon is a Fastify-based Node.js server that:

- Manages Agent sessions and authentication
- Routes A2A (Agent-to-Agent) messages
- Processes tasks and workflows
- Integrates with Solana blockchain
- Provides REST API for Agent operations

## Tech Stack

- **Runtime**: Node.js 22+
- **Framework**: Fastify
- **Database**: PostgreSQL (sessions), SQLite (local state)
- **Blockchain**: Solana (via @solana/kit)
- **Protocol**: A2A messaging

## Quick Start

```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Run development server
pnpm dev

# Run production build
pnpm build
pnpm start
```

## Environment Variables

```bash
AGENTD_HOST=0.0.0.0
AGENTD_PORT=4001
AGENTD_LOG_LEVEL=info
AGENTD_DB_PATH=/data/agentd.db
AGENTD_SOLANA_RPC_URL=https://api.devnet.solana.com
```

## API Endpoints

- `GET /health` - Health check
- `POST /api/sessions` - Create session
- `GET /api/sessions/:id` - Get session
- `POST /api/a2a/message` - Send A2A message
- `GET /api/agents/:id/reputation` - Get Agent reputation

## Development

```bash
# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Docker

```bash
# Build image
docker build -f ../../docker/Dockerfile.agent-daemon -t gradience/agent-daemon .

# Run with docker-compose
docker compose -f ../../deploy/docker-compose.prod.yml up agent-daemon
```

## Architecture

See [Architecture Docs](../../docs/architecture/README.md)
