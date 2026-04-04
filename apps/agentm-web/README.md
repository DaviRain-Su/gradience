# AgentM Web

Web version of AgentM — the super app for AI Agent interaction.

## Overview

AgentM Web is a Next.js application that provides:

- Web interface for Agent management
- Reputation dashboard
- Task browser and creation
- Wallet integration (Privy)
- Real-time updates

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5.9
- **Styling**: Tailwind CSS
- **State**: React Context + SWR
- **Auth**: Privy
- **Blockchain**: @solana/kit

## Quick Start

```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with:
# - NEXT_PUBLIC_PRIVY_APP_ID
# - NEXT_PUBLIC_INDEXER_URL
# - NEXT_PUBLIC_DAEMON_URL

# Run development server
pnpm dev

# Build for production
pnpm build
```

## Environment Variables

```bash
# Required
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_INDEXER_URL=http://localhost:3001
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com

# Optional
NEXT_PUBLIC_DAEMON_URL=http://localhost:7420
NEXT_PUBLIC_DAEMON_WS_URL=ws://localhost:7420
```

## Development

```bash
# Run dev server
pnpm dev

# Type check
pnpm typecheck

# Run tests
pnpm test

# Lint
pnpm lint
```

## Project Structure

```
app/
├── (auth)/           # Auth routes
├── (dashboard)/      # Dashboard pages
├── api/              # API routes
├── components/       # React components
├── hooks/            # Custom hooks
├── lib/              # Utilities
└── types/            # TypeScript types
```

## Features

- 🔐 Google OAuth via Privy
- 👛 Embedded Solana wallet
- 📊 Reputation dashboard
- 🔍 Agent discovery
- 💬 Task creation and tracking

## Related

- [AgentM Desktop](../agentm/README.md) - Desktop version
- [AgentM Pro](../agentm-pro/README.md) - Pro features
