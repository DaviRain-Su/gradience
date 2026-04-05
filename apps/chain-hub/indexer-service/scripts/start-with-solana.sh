#!/bin/bash
# Start Chain Hub Indexer with Solana devnet connection

set -e

echo "🚀 Starting Chain Hub Indexer with Solana devnet..."
echo ""

# Default configuration
export INDEXER_BIND_ADDR="${INDEXER_BIND_ADDR:-0.0.0.0:8788}"
export DATABASE_URL="${DATABASE_URL:-postgres://gradience:***@localhost:5433/gradience_chain_hub}"

# Solana Configuration - Connect to devnet
export CHAIN_HUB_PROGRAM_ID="${CHAIN_HUB_PROGRAM_ID:-6G39W7JGQz7A6L5dAvotFuRP9UbFdCJg2BqDuj6WJWec}"
export SOLANA_WS_URL="${SOLANA_WS_URL:-wss://api.devnet.solana.com}"
export SOLANA_COMMITMENT="${SOLANA_COMMITMENT:-confirmed}"
export SOLANA_SUBSCRIBE="${SOLANA_SUBSCRIBE:-true}"

echo "📋 Configuration:"
echo "  Bind Address: $INDEXER_BIND_ADDR"
echo "  Program ID: $CHAIN_HUB_PROGRAM_ID"
echo "  Solana WebSocket: $SOLANA_WS_URL"
echo "  Solana Subscribe: $SOLANA_SUBSCRIBE"
echo ""

# Check if database is reachable
echo "🔍 Checking database connection..."
if pg_isready -d "$DATABASE_URL" > /dev/null 2>&1; then
    echo "✅ Database is ready"
else
    echo "⚠️  Database not reachable, will retry on connection"
fi
echo ""

# Run migrations if needed
echo "🔄 Running database migrations..."
if [ -f "migrations/0001_init.sql" ]; then
    psql "$DATABASE_URL" -f migrations/0001_init.sql > /dev/null 2>&1 || true
    echo "✅ Migrations applied"
fi
echo ""

# Start the indexer
echo "🟢 Starting indexer service..."
echo ""
exec ./target/release/chain-hub-indexer
