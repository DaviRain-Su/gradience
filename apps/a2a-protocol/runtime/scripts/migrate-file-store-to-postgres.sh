#!/usr/bin/env bash
set -euo pipefail

SOURCE_FILE_INPUT="${1:-./data/devnet-relay-state.json}"
SINGLETON_KEY="${2:-default}"
POSTGRES_URL="${A2A_RELAY_POSTGRES_URL:-}"
TABLE_NAME="${A2A_RELAY_POSTGRES_TABLE:-a2a_relay_state}"

if [[ -z "${POSTGRES_URL}" ]]; then
  echo "error: set A2A_RELAY_POSTGRES_URL before running migration" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${RUNTIME_DIR}/docker-compose.yml"

if [[ "${SOURCE_FILE_INPUT}" = /* ]]; then
  SOURCE_FILE="${SOURCE_FILE_INPUT}"
else
  SOURCE_FILE="${RUNTIME_DIR}/${SOURCE_FILE_INPUT#./}"
fi

if [[ ! -f "${SOURCE_FILE}" ]]; then
  echo "error: source file not found: ${SOURCE_FILE}" >&2
  exit 1
fi

docker compose -f "${COMPOSE_FILE}" run --rm --no-deps \
  -v "${SOURCE_FILE}:/tmp/relay-state.json:ro" \
  -e A2A_RELAY_POSTGRES_URL="${POSTGRES_URL}" \
  -e A2A_RELAY_POSTGRES_TABLE="${TABLE_NAME}" \
  -e A2A_RELAY_POSTGRES_SINGLETON_KEY="${SINGLETON_KEY}" \
  a2a-relay node --input-type=module <<'NODE'
import { readFileSync } from "node:fs";
import { Client } from "pg";

const connectionString = process.env.A2A_RELAY_POSTGRES_URL;
const tableName = process.env.A2A_RELAY_POSTGRES_TABLE ?? "a2a_relay_state";
const singletonKey = process.env.A2A_RELAY_POSTGRES_SINGLETON_KEY ?? "default";
if (!connectionString) {
  throw new Error("missing postgres connection string");
}
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
  throw new Error(`invalid table name: ${tableName}`);
}

const raw = readFileSync("/tmp/relay-state.json", "utf8");
const parsed = JSON.parse(raw);
if (parsed.version !== 1 || !Array.isArray(parsed.agents) || !Array.isArray(parsed.envelopes)) {
  throw new Error("invalid relay state file format");
}

const client = new Client({ connectionString });
await client.connect();
try {
  await client.query(
    `CREATE TABLE IF NOT EXISTS ${tableName} (
      singleton_key TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  );
  await client.query(
    `INSERT INTO ${tableName} (singleton_key, state_json)
     VALUES ($1, $2)
     ON CONFLICT (singleton_key)
     DO UPDATE SET state_json = EXCLUDED.state_json, updated_at = NOW()`,
    [singletonKey, JSON.stringify(parsed)],
  );
  console.log(
    `[migration] imported relay state -> table=${tableName} key=${singletonKey} agents=${String(parsed.agents.length)} envelopes=${String(parsed.envelopes.length)}`,
  );
} finally {
  await client.end();
}
NODE
