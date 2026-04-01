#!/usr/bin/env bash
set -euo pipefail

POSTGRES_URL="${A2A_RELAY_POSTGRES_PRECHECK_URL:-${A2A_RELAY_POSTGRES_URL:-}}"
if [[ -z "${POSTGRES_URL}" ]]; then
  echo "error: set A2A_RELAY_POSTGRES_URL (and optional A2A_RELAY_POSTGRES_PRECHECK_URL) before running preflight" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${RUNTIME_DIR}/docker-compose.yml"

docker compose -f "${COMPOSE_FILE}" run --rm --no-deps \
  -e A2A_RELAY_POSTGRES_URL="${POSTGRES_URL}" \
  a2a-relay node --input-type=module <<'NODE'
import { Client } from "pg";

const connectionString = process.env.A2A_RELAY_POSTGRES_URL;
if (!connectionString) {
  throw new Error("missing connection string");
}

const client = new Client({ connectionString });
await client.connect();
try {
  const basic = await client.query("SELECT current_user, current_database() AS db");
  const role = await client.query(
    "SELECT rolsuper, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = current_user",
  );
  const roleFlags = role.rows[0] ?? {};
  if (roleFlags.rolsuper === true) {
    console.warn("[preflight] warning: current user has superuser privilege");
  }
  if (roleFlags.rolcreaterole === true || roleFlags.rolcreatedb === true) {
    console.warn("[preflight] warning: current user has elevated role/db privileges");
  }

  const tableName = `a2a_preflight_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  await client.query("BEGIN");
  await client.query(`CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, value TEXT NOT NULL)`);
  await client.query(`INSERT INTO ${tableName} (id, value) VALUES (1, 'ok')`);
  const verify = await client.query(`SELECT value FROM ${tableName} WHERE id = 1`);
  if (verify.rows[0]?.value !== "ok") {
    throw new Error("roundtrip mismatch");
  }
  await client.query("ROLLBACK");

  const user = basic.rows[0]?.current_user ?? "unknown";
  const db = basic.rows[0]?.db ?? "unknown";
  console.log(`[preflight] postgres connectivity and write-check passed (user=${user}, db=${db})`);
} finally {
  await client.end();
}
NODE
