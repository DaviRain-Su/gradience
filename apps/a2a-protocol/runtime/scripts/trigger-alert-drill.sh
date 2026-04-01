#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:3400}"
SEVERITY="${2:-critical}"
MESSAGE="${3:-Manual relay alert drill triggered via script.}"
TOKEN="${A2A_RELAY_AUTH_TOKEN:-}"

if [[ "${SEVERITY}" != "warning" && "${SEVERITY}" != "critical" ]]; then
  echo "invalid severity: ${SEVERITY} (expected: warning|critical)" >&2
  exit 1
fi

if [[ -n "${TOKEN}" ]]; then
  curl -q -fsS \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -X POST \
    "${BASE_URL}/v1/alerts/test" \
    --data "{\"severity\":\"${SEVERITY}\",\"message\":\"${MESSAGE}\"}"
else
  curl -q -fsS \
    -H "Content-Type: application/json" \
    -X POST \
    "${BASE_URL}/v1/alerts/test" \
    --data "{\"severity\":\"${SEVERITY}\",\"message\":\"${MESSAGE}\"}"
fi

echo
