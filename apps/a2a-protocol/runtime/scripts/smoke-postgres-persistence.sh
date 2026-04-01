#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:3400}"
TOKEN="${A2A_RELAY_AUTH_TOKEN:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${RUNTIME_DIR}/docker-compose.yml"

curl_with_optional_auth() {
  if [[ -n "${TOKEN}" ]]; then
    curl -q -fsS -H "Authorization: Bearer ${TOKEN}" "$@"
    return
  fi
  curl -q -fsS "$@"
}

curl_with_optional_auth "${BASE_URL}/healthz" >/dev/null
curl_with_optional_auth "${BASE_URL}/readyz" >/dev/null

ENVELOPE_ID="pg-$(date +%s)-$RANDOM"
TARGET_AGENT="agent-postgres-target"
SOURCE_AGENT="agent-postgres-source"

curl_with_optional_auth \
  -H "Content-Type: application/json" \
  -X POST \
  "${BASE_URL}/v1/discovery/announce" \
  --data "{\"agent\":\"${TARGET_AGENT}\",\"capabilityMask\":\"1\",\"endpoint\":\"ws://${TARGET_AGENT}\"}" \
  >/dev/null

curl_with_optional_auth \
  -H "Content-Type: application/json" \
  -X POST \
  "${BASE_URL}/v1/envelopes/publish" \
  --data "{\"envelope\":{\"id\":\"${ENVELOPE_ID}\",\"threadId\":\"1\",\"sequence\":1,\"from\":\"${SOURCE_AGENT}\",\"to\":\"${TARGET_AGENT}\",\"messageType\":\"validation\",\"nonce\":\"1\",\"createdAt\":1,\"bodyHash\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"signature\":{\"r\":\"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\",\"s\":\"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc\"},\"paymentMicrolamports\":\"10\"},\"payload\":{\"check\":\"postgres-persistence\"}}" \
  >/dev/null

docker compose -f "${COMPOSE_FILE}" restart a2a-relay >/dev/null

for _ in $(seq 1 30); do
  if curl_with_optional_auth "${BASE_URL}/readyz" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

PULL_RESPONSE="$(curl_with_optional_auth "${BASE_URL}/v1/envelopes/pull?agent=${TARGET_AGENT}&limit=20")"
python3 - "${PULL_RESPONSE}" "${ENVELOPE_ID}" <<'PY'
import json
import sys

payload = json.loads(sys.argv[1])
expected_id = sys.argv[2]
items = payload.get("items", [])
for item in items:
    envelope = item.get("envelope", {})
    if envelope.get("id") == expected_id:
        print("postgres persistence check passed")
        break
else:
    raise SystemExit(f"missing expected envelope after restart: {expected_id}")
PY
