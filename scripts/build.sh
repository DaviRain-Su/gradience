#!/bin/bash
# Build script for Gradience project

set -e

echo "🔧 Building Gradience Project..."

# 1. Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# 2. Build packages in dependency order
echo "🏗️ Building packages..."

# Workflow Engine (no internal deps)
echo "  - Building @gradiences/workflow-engine..."
pnpm --filter @gradiences/workflow-engine build

# Chain Hub SDK
echo "  - Building @gradiences/chain-hub-sdk..."
pnpm --filter @gradiences/chain-hub-sdk build

# Arena SDK
echo "  - Building @gradiences/arena-sdk..."
pnpm --filter @gradiences/arena-sdk build

# SDK (depends on arena-sdk and chain-hub-sdk)
echo "  - Building @gradiences/sdk..."
pnpm --filter @gradiences/sdk build

# Agent Daemon (depends on workflow-engine)
echo "  - Building @gradiences/agent-daemon..."
pnpm --filter @gradiences/agent-daemon build

# AgentM Web
echo "  - Building @gradiences/agentm-web..."
pnpm --filter @gradiences/agentm-web build

echo "✅ Build complete!"
echo ""
echo "To start the project:"
echo "  Terminal 1: pnpm --filter @gradiences/agent-daemon dev"
echo "  Terminal 2: pnpm --filter @gradiences/agentm-web dev"
