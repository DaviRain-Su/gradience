#!/bin/bash
# Chain Hub Indexer Health Check Script
# Usage: ./health-check.sh [host] [port]

HOST=${1:-localhost}
PORT=${2:-8788}
HEALTH_URL="http://${HOST}:${PORT}/health"

echo "Checking Chain Hub Indexer health at ${HEALTH_URL}..."

# Use wget if curl is not available or has issues
if command -v wget &> /dev/null; then
    RESPONSE=$(wget -qO- --timeout=5 "${HEALTH_URL}" 2>/dev/null)
    STATUS=$?
else
    # Fallback to curl without reading .curlrc
    RESPONSE=$(curl -s --max-time 5 "${HEALTH_URL}" 2>/dev/null)
    STATUS=$?
fi

if [ $STATUS -eq 0 ] && [ -n "$RESPONSE" ]; then
    echo "✅ Indexer is healthy"
    echo "Response: ${RESPONSE}"
    exit 0
else
    echo "❌ Indexer health check failed"
    exit 1
fi
