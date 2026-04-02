#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION_NAME="${TMUX_SESSION_NAME:-gradience-dev}"

if ! command -v tmux >/dev/null 2>&1; then
    echo "tmux is required but not installed."
    exit 1
fi

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "tmux session '$SESSION_NAME' already exists. Attaching..."
    exec tmux attach -t "$SESSION_NAME"
fi

: "${JUDGE_DAEMON_JUDGE_KEYPAIR:?Set JUDGE_DAEMON_JUDGE_KEYPAIR to an absolute keypair path}"

RPC_ENDPOINT="${GRADIENCE_RPC_ENDPOINT:-https://api.devnet.solana.com}"
INDEXER_ENDPOINT="${JUDGE_DAEMON_INDEXER_ENDPOINT:-http://127.0.0.1:3001}"
EVALUATOR_MODE="${JUDGE_DAEMON_EVALUATOR_MODE:-type_c1}"

tmux new-session -d -s "$SESSION_NAME" -n indexer \
    "cd \"$ROOT_DIR/apps/agent-arena/indexer\" && docker compose up --build"

tmux new-window -t "$SESSION_NAME" -n judge-daemon \
    "JUDGE_DAEMON_INDEXER_ENDPOINT=\"$INDEXER_ENDPOINT\" GRADIENCE_RPC_ENDPOINT=\"$RPC_ENDPOINT\" JUDGE_DAEMON_JUDGE_KEYPAIR=\"$JUDGE_DAEMON_JUDGE_KEYPAIR\" JUDGE_DAEMON_EVALUATOR_MODE=\"$EVALUATOR_MODE\" pnpm --dir \"$ROOT_DIR/apps/agent-arena\" judge-daemon:start"

tmux new-window -t "$SESSION_NAME" -n agent-arena \
    "pnpm --dir \"$ROOT_DIR/apps/agent-arena\" frontend:dev"

tmux new-window -t "$SESSION_NAME" -n agentm \
    "VITE_INDEXER_BASE_URL=\"$INDEXER_ENDPOINT\" pnpm --dir \"$ROOT_DIR/apps/agentm\" dev"

if [[ "${START_EVM:-0}" == "1" ]]; then
    tmux new-window -t "$SESSION_NAME" -n evm \
        "pnpm --dir \"$ROOT_DIR/apps/agent-layer-evm\" exec hardhat node"
fi

tmux select-window -t "$SESSION_NAME:indexer"
exec tmux attach -t "$SESSION_NAME"
