#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:3400}"
TOKEN="${A2A_RELAY_AUTH_TOKEN:-}"

curl -fsS "${BASE_URL}/healthz" >/dev/null
curl -fsS "${BASE_URL}/readyz" >/dev/null

if [[ -n "${TOKEN}" ]]; then
  curl -fsS -H "Authorization: Bearer ${TOKEN}" "${BASE_URL}/v1/metrics" >/dev/null
else
  curl -fsS "${BASE_URL}/v1/metrics" >/dev/null
fi

echo "relay smoke check passed: ${BASE_URL}"
