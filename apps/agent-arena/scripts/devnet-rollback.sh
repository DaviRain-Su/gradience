#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/.deployments/devnet"
MANIFEST_PATH="${1:-${DEPLOY_DIR}/previous.json}"

RPC_URL="${GRADIENCE_RPC_ENDPOINT:-https://api.devnet.solana.com}"
PROGRAM_KEYPAIR="${GRADIENCE_PROGRAM_KEYPAIR:-${ROOT_DIR}/program/keypairs/program-keypair.json}"

if ! command -v solana >/dev/null 2>&1; then
    echo "solana CLI is required but not found in PATH" >&2
    exit 1
fi

if [[ ! -f "${MANIFEST_PATH}" ]]; then
    echo "Rollback manifest not found: ${MANIFEST_PATH}" >&2
    exit 1
fi

if [[ ! -f "${PROGRAM_KEYPAIR}" ]]; then
    echo "Program keypair not found: ${PROGRAM_KEYPAIR}" >&2
    exit 1
fi

ARTIFACT_PATH="$(python3 - "${MANIFEST_PATH}" <<'PY'
import json,sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    data = json.load(f)
print(data.get('artifact_path', ''))
PY
)"

if [[ -z "${ARTIFACT_PATH}" ]]; then
    echo "artifact_path missing in manifest: ${MANIFEST_PATH}" >&2
    exit 1
fi

if [[ ! -f "${ARTIFACT_PATH}" ]]; then
    echo "Rollback artifact not found: ${ARTIFACT_PATH}" >&2
    exit 1
fi

echo "Rolling back program using artifact ${ARTIFACT_PATH} on ${RPC_URL}"
solana program deploy \
    --url "${RPC_URL}" \
    --program-id "${PROGRAM_KEYPAIR}" \
    "${ARTIFACT_PATH}"

ROLLBACK_TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
ROLLBACK_DIR="${DEPLOY_DIR}/rollbacks/${ROLLBACK_TIMESTAMP}"
mkdir -p "${ROLLBACK_DIR}"
cp "${MANIFEST_PATH}" "${ROLLBACK_DIR}/source-manifest.json"
cp "${ARTIFACT_PATH}" "${ROLLBACK_DIR}/gradience.so"

cat > "${ROLLBACK_DIR}/manifest.json" <<EOF
{
  "timestamp": "${ROLLBACK_TIMESTAMP}",
  "rpc_url": "${RPC_URL}",
  "program_keypair": "${PROGRAM_KEYPAIR}",
  "artifact_path": "${ROLLBACK_DIR}/gradience.so",
  "source_manifest": "${MANIFEST_PATH}",
  "action": "rollback"
}
EOF

cp "${ROLLBACK_DIR}/manifest.json" "${DEPLOY_DIR}/latest.json"
echo "Rollback manifest written to ${ROLLBACK_DIR}/manifest.json"
