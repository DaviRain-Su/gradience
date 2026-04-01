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
COMPOSE_FILE="${RUNTIME_DIR}/docker-compose.yml"

STORE_MODE="${A2A_RELAY_STORE_MODE:-file}"
REQUIRE_EXPLICIT_POSTGRES_URL="${A2A_RELAY_POSTGRES_REQUIRE_EXPLICIT:-false}"
POSTGRES_EXTERNAL="${A2A_RELAY_POSTGRES_EXTERNAL:-false}"
USE_LOCAL_POSTGRES_PROFILE="false"

if [[ "${STORE_MODE}" == "postgres" ]]; then
  if [[ -z "${A2A_RELAY_POSTGRES_URL:-}" ]]; then
    if [[ "${REQUIRE_EXPLICIT_POSTGRES_URL}" == "true" ]]; then
      echo "error: A2A_RELAY_POSTGRES_URL is required for postgres store mode" >&2
      exit 1
    fi
    export A2A_RELAY_POSTGRES_URL="postgres://postgres@postgres:5432/a2a_relay?sslmode=disable"
    export A2A_RELAY_POSTGRES_PASSWORD="${A2A_RELAY_POSTGRES_PASSWORD:-postgres}"
    USE_LOCAL_POSTGRES_PROFILE="true"
    echo "info: defaulting A2A_RELAY_POSTGRES_URL=${A2A_RELAY_POSTGRES_URL}" >&2
  elif [[ "${A2A_RELAY_POSTGRES_URL}" == *"@postgres:"* && "${POSTGRES_EXTERNAL}" != "true" ]]; then
    USE_LOCAL_POSTGRES_PROFILE="true"
  fi
fi

if [[ "${PROFILE}" == "prod" && "${STORE_MODE}" == "postgres" ]]; then
  REQUIRE_EXPLICIT_POSTGRES_URL="true"
  export A2A_RELAY_POSTGRES_REJECT_ELEVATED_ROLE="${A2A_RELAY_POSTGRES_REJECT_ELEVATED_ROLE:-true}"
  export A2A_RELAY_POSTGRES_REQUIRE_SSL="${A2A_RELAY_POSTGRES_REQUIRE_SSL:-true}"
  if [[ -z "${A2A_RELAY_POSTGRES_URL:-}" ]]; then
    echo "error: prod postgres mode requires explicit A2A_RELAY_POSTGRES_URL" >&2
    exit 1
  fi
  URL_LOWER="$(printf '%s' "${A2A_RELAY_POSTGRES_URL}" | tr '[:upper:]' '[:lower:]')"
  if [[ "${URL_LOWER}" == *"sslmode=disable"* || "${URL_LOWER}" == *"ssl=false"* ]]; then
    echo "error: prod postgres mode requires SSL (found insecure flags in A2A_RELAY_POSTGRES_URL)" >&2
    exit 1
  fi
  if [[ "${URL_LOWER}" != *"sslmode=require"* && "${URL_LOWER}" != *"sslmode=verify-ca"* && "${URL_LOWER}" != *"sslmode=verify-full"* && "${URL_LOWER}" != *"ssl=true"* ]]; then
    echo "error: prod postgres mode requires explicit SSL parameters in A2A_RELAY_POSTGRES_URL" >&2
    exit 1
  fi
fi

if [[ "${USE_LOCAL_POSTGRES_PROFILE}" == "true" ]]; then
  A2A_RELAY_PROFILE="${PROFILE}" \
  COMPOSE_PROFILES="${COMPOSE_PROFILES:-local-db}" \
  docker compose -f "${COMPOSE_FILE}" up -d --build
else
  A2A_RELAY_PROFILE="${PROFILE}" \
  docker compose -f "${COMPOSE_FILE}" up -d --build --no-deps a2a-relay
fi
