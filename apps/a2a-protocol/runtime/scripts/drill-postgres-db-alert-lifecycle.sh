#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:3400}"
TOKEN="${A2A_RELAY_AUTH_TOKEN:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${RUNTIME_DIR}/docker-compose.yml"

request_json() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local tmp_file
  tmp_file="$(mktemp)"
  local status_code
  local url="${BASE_URL}${path}"

  if [[ -n "${TOKEN}" ]]; then
    if [[ "${method}" == "GET" ]]; then
      status_code="$(curl -q -sS -o "${tmp_file}" -w "%{http_code}" -H "Authorization: Bearer ${TOKEN}" "${url}")"
    else
      status_code="$(curl -q -sS -o "${tmp_file}" -w "%{http_code}" -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" -X "${method}" "${url}" --data "${data}")"
    fi
  else
    if [[ "${method}" == "GET" ]]; then
      status_code="$(curl -q -sS -o "${tmp_file}" -w "%{http_code}" "${url}")"
    else
      status_code="$(curl -q -sS -o "${tmp_file}" -w "%{http_code}" -H "Content-Type: application/json" -X "${method}" "${url}" --data "${data}")"
    fi
  fi

  if [[ "${status_code}" -lt 200 || "${status_code}" -ge 300 ]]; then
    echo "request failed: ${method} ${url} status=${status_code}" >&2
    cat "${tmp_file}" >&2
    rm -f "${tmp_file}"
    return 1
  fi

  cat "${tmp_file}"
  rm -f "${tmp_file}"
}

has_alert_code() {
  local payload="$1"
  local code="$2"
  python3 - "${code}" "${payload}" <<'PY'
import json
import sys

expected = sys.argv[1]
raw = sys.argv[2]
data = json.loads(raw)
alerts = data.get("items")
if not isinstance(alerts, list):
    sys.exit(1)
for alert in alerts:
    if isinstance(alert, dict) and alert.get("code") == expected:
        sys.exit(0)
sys.exit(1)
PY
}

postgres_stopped="false"
cleanup() {
  if [[ "${postgres_stopped}" == "true" ]]; then
    docker compose -f "${COMPOSE_FILE}" start postgres >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "deploying relay in postgres mode for fault drill..."
A2A_RELAY_STORE_MODE=postgres \
A2A_RELAY_ALERT_MIN_DB_QUERY_COUNT="${A2A_RELAY_ALERT_MIN_DB_QUERY_COUNT:-1}" \
A2A_RELAY_ALERT_MAX_DB_FAILURE_RATE="${A2A_RELAY_ALERT_MAX_DB_FAILURE_RATE:-0.49}" \
A2A_RELAY_ALERT_CRITICAL_DB_FAILURE_RATE="${A2A_RELAY_ALERT_CRITICAL_DB_FAILURE_RATE:-0.8}" \
A2A_RELAY_ALERT_DB_CONSECUTIVE_UNHEALTHY_TO_ALERT="${A2A_RELAY_ALERT_DB_CONSECUTIVE_UNHEALTHY_TO_ALERT:-1}" \
A2A_RELAY_ALERT_DB_CONSECUTIVE_HEALTHY_TO_RECOVER="${A2A_RELAY_ALERT_DB_CONSECUTIVE_HEALTHY_TO_RECOVER:-1}" \
A2A_RELAY_ALERT_DB_INCIDENT_REPEAT_COOLDOWN_CHECKS="${A2A_RELAY_ALERT_DB_INCIDENT_REPEAT_COOLDOWN_CHECKS:-2}" \
"${SCRIPT_DIR}/release-relay.sh" devnet >/dev/null

for _ in $(seq 1 30); do
  if request_json GET "/readyz" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

request_json GET "/healthz" >/dev/null
request_json GET "/v1/metrics" >/dev/null

echo "injecting postgres outage..."
docker compose -f "${COMPOSE_FILE}" stop postgres >/dev/null
postgres_stopped="true"

down_alert_observed="false"
for _ in $(seq 1 12); do
  snapshot="$(request_json GET "/v1/alerts")"
  if has_alert_code "${snapshot}" "db_query_failure_rate_high"; then
    down_alert_observed="true"
    break
  fi
  sleep 1
done

if [[ "${down_alert_observed}" != "true" ]]; then
  echo "failed to observe db_query_failure_rate_high during postgres outage" >&2
  exit 1
fi

echo "restoring postgres..."
docker compose -f "${COMPOSE_FILE}" start postgres >/dev/null
postgres_stopped="false"

for _ in $(seq 1 30); do
  if request_json GET "/readyz" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

recovery_observed="false"
for _ in $(seq 1 120); do
  snapshot="$(request_json GET "/v1/alerts")"
  if has_alert_code "${snapshot}" "db_health_recovered"; then
    recovery_observed="true"
    break
  fi
  sleep 1
done

if [[ "${recovery_observed}" != "true" ]]; then
  echo "failed to observe db_health_recovered after postgres restore" >&2
  exit 1
fi

echo "postgres fault drill passed: outage alert and recovery signal verified"
