#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:3400}"
MAX_ITEMS="${2:-100}"
TOKEN="${A2A_RELAY_AUTH_TOKEN:-}"

if [[ -n "${TOKEN}" ]]; then
  curl -q -fsS \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -X POST \
    "${BASE_URL}/v1/alerts/replay-failed" \
    --data "{\"maxItems\":${MAX_ITEMS}}"
else
  curl -q -fsS \
    -H "Content-Type: application/json" \
    -X POST \
    "${BASE_URL}/v1/alerts/replay-failed" \
    --data "{\"maxItems\":${MAX_ITEMS}}"
fi

echo
