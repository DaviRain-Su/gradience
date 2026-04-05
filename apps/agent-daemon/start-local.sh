#!/bin/bash

# Agent Daemon 本地开发启动脚本
# 禁用 indexer 连接，使用本地配置

echo "Starting Agent Daemon in local development mode..."
echo "================================================"

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 创建本地数据目录
mkdir -p ./data

# 设置环境变量
export NODE_ENV=development
export AGENTD_LOG_LEVEL=debug

# 启动参数 - 禁用 indexer
# 使用空字符串禁用 indexer 连接
ARGS=(
  "--port" "7420"
  "--chain-hub-url" ""
)

# 启动 daemon
echo "Starting with config:"
echo "  Port: 7420"
echo "  Indexer: disabled (no WebSocket connection)"
echo "  Database: ./data/agentd-dev.db"
echo "  Log Level: debug"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# 使用 npx 启动
exec npx @gradiences/agent-daemon start "${ARGS[@]}"
