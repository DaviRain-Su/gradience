#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/.deployments/devnet"
RELEASES_DIR="${DEPLOY_DIR}/releases"

RPC_URL="${GRADIENCE_RPC_ENDPOINT:-https://api.devnet.solana.com}"
PROGRAM_KEYPAIR="${GRADIENCE_PROGRAM_KEYPAIR:-${ROOT_DIR}/program/keypairs/program-keypair.json}"
PROGRAM_SO="${GRADIENCE_PROGRAM_SO:-${ROOT_DIR}/target/deploy/gradience.so}"
BUILD_FIRST="${GRADIENCE_BUILD_BEFORE_DEPLOY:-1}"

if ! command -v solana >/dev/null 2>&1; then
    echo "solana CLI is required but not found in PATH" >&2
    exit 1
fi

if [[ ! -f "${PROGRAM_KEYPAIR}" ]]; then
    echo "Program keypair not found: ${PROGRAM_KEYPAIR}" >&2
    exit 1
fi

if [[ "${BUILD_FIRST}" == "1" ]]; then
    cargo build-sbf --manifest-path "${ROOT_DIR}/program/Cargo.toml"
fi

if [[ ! -f "${PROGRAM_SO}" ]]; then
    echo "Program binary not found: ${PROGRAM_SO}" >&2
    exit 1
fi

mkdir -p "${RELEASES_DIR}"
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
RELEASE_DIR="${RELEASES_DIR}/${TIMESTAMP}"
mkdir -p "${RELEASE_DIR}"

ARTIFACT_PATH="${RELEASE_DIR}/gradience.so"
cp "${PROGRAM_SO}" "${ARTIFACT_PATH}"

PROGRAM_ID="$(solana address -k "${PROGRAM_KEYPAIR}")"
GIT_SHA="$(git -C "${ROOT_DIR}" rev-parse --short HEAD)"

if [[ -f "${DEPLOY_DIR}/latest.json" ]]; then
    cp "${DEPLOY_DIR}/latest.json" "${DEPLOY_DIR}/previous.json"
fi

echo "Deploying ${PROGRAM_ID} to ${RPC_URL} using ${ARTIFACT_PATH}"
solana program deploy \
    --url "${RPC_URL}" \
    --program-id "${PROGRAM_KEYPAIR}" \
    "${ARTIFACT_PATH}"

MANIFEST_PATH="${RELEASE_DIR}/manifest.json"
cat > "${MANIFEST_PATH}" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "rpc_url": "${RPC_URL}",
  "program_id": "${PROGRAM_ID}",
  "program_keypair": "${PROGRAM_KEYPAIR}",
  "artifact_path": "${ARTIFACT_PATH}",
  "git_sha": "${GIT_SHA}"
}
EOF

cp "${MANIFEST_PATH}" "${DEPLOY_DIR}/latest.json"
echo "Deployment manifest written to ${MANIFEST_PATH}"
