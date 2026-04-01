#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-devnet}"
BASE_URL="${2:-http://127.0.0.1:3400}"
POSTGRES_URL="${A2A_RELAY_POSTGRES_URL:-}"

if [[ "${PROFILE}" != "local" && "${PROFILE}" != "devnet" && "${PROFILE}" != "prod" ]]; then
  echo "invalid profile: ${PROFILE} (expected: local|devnet|prod)" >&2
  exit 1
fi

if [[ -z "${POSTGRES_URL}" ]]; then
  echo "error: set A2A_RELAY_POSTGRES_URL before running hosted cutover rehearsal" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REJECT_ELEVATED_ROLE="${A2A_RELAY_POSTGRES_REJECT_ELEVATED_ROLE:-false}"

CUTOVER_DONE="false"
ROLLED_BACK="false"
rollback_if_needed() {
  if [[ "${CUTOVER_DONE}" != "true" || "${ROLLED_BACK}" == "true" ]]; then
    return
  fi
  echo "warn: rehearsal failed, attempting rollback to file store..." >&2
  A2A_RELAY_STORE_MODE=file "${SCRIPT_DIR}/release-relay.sh" "${PROFILE}" || true
}
trap rollback_if_needed EXIT

A2A_RELAY_POSTGRES_REJECT_ELEVATED_ROLE="${REJECT_ELEVATED_ROLE}" \
"${SCRIPT_DIR}/preflight-hosted-postgres.sh"

A2A_RELAY_STORE_MODE=postgres \
A2A_RELAY_POSTGRES_REQUIRE_EXPLICIT=true \
A2A_RELAY_POSTGRES_EXTERNAL=true \
"${SCRIPT_DIR}/release-relay.sh" "${PROFILE}"

CUTOVER_DONE="true"
sleep 3

"${SCRIPT_DIR}/smoke-relay.sh" "${BASE_URL}"
"${SCRIPT_DIR}/smoke-postgres-persistence.sh" "${BASE_URL}"
"${SCRIPT_DIR}/replay-failed-alerts.sh" "${BASE_URL}" >/dev/null
"${SCRIPT_DIR}/trigger-alert-drill.sh" "${BASE_URL}" critical "Hosted Postgres cutover drill." >/dev/null

A2A_RELAY_STORE_MODE=file "${SCRIPT_DIR}/release-relay.sh" "${PROFILE}"
sleep 3
"${SCRIPT_DIR}/smoke-relay.sh" "${BASE_URL}"

ROLLED_BACK="true"
trap - EXIT

echo "hosted postgres cutover rehearsal passed (cutover + rollback)"
