#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-devnet}"
if [[ "${PROFILE}" != "local" && "${PROFILE}" != "devnet" && "${PROFILE}" != "prod" ]]; then
  echo "invalid profile: ${PROFILE} (expected: local|devnet|prod)" >&2
  exit 1
fi

if [[ "${PROFILE}" == "prod" && -z "${A2A_RELAY_AUTH_TOKEN:-}" ]]; then
  echo "warning: A2A_RELAY_AUTH_TOKEN is empty for prod profile" >&2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

A2A_RELAY_PROFILE="${PROFILE}" \
docker compose -f "${RUNTIME_DIR}/docker-compose.yml" up -d --build
