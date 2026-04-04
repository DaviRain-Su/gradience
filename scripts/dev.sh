#!/bin/bash
# Development startup script for Gradience

set -e

echo "🚀 Starting Gradience Development Environment..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to cleanup processes on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down...${NC}"
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}
trap cleanup EXIT INT TERM

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    pnpm install
fi

# Start Agent Daemon
echo -e "${GREEN}Starting Agent Daemon...${NC}"
pnpm --filter @gradiences/agent-daemon dev &
DAEMON_PID=$!
echo "Agent Daemon PID: $DAEMON_PID"

# Wait for daemon to start
sleep 3

# Start AgentM Web
echo -e "${GREEN}Starting AgentM Web...${NC}"
pnpm --filter @gradiences/agentm-web dev &
WEB_PID=$!
echo "AgentM Web PID: $WEB_PID"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}All services started!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Agent Daemon: http://localhost:3000"
echo "AgentM Web:   http://localhost:5200"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for all background processes
wait
