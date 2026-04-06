#!/usr/bin/env bash
# deploy-workflow-marketplace.sh — Build and deploy/upgrade the Workflow Marketplace Solana program
#
# Usage:
#   ./deploy/deploy-workflow-marketplace.sh [devnet|mainnet|localnet]
#
# Environment:
#   SOLANA_KEYPAIR  — Path to deployer/upgrade authority keypair (required for upgrades)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROGRAM_DIR="${REPO_ROOT}/programs/workflow-marketplace"
BUILD_OUTPUT="${PROGRAM_DIR}/target/deploy/workflow_marketplace.so"

CLUSTER="${1:-devnet}"
RPC_URL=""

case "${CLUSTER}" in
  devnet)
    RPC_URL="https://api.devnet.solana.com"
    ;;
  mainnet)
    RPC_URL="https://api.mainnet-beta.solana.com"
    ;;
  localnet|testnet)
    RPC_URL="http://127.0.0.1:8899"
    ;;
  *)
    echo "ERROR: Unknown cluster '${CLUSTER}'. Use: devnet | mainnet | localnet"
    exit 1
    ;;
esac

log() { echo "[deploy-wm] $*"; }

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------
command -v solana >/dev/null 2>&1 || { echo "ERROR: solana CLI not found"; exit 1; }
command -v cargo >/dev/null 2>&1 || { echo "ERROR: cargo not found"; exit 1; }

log "Cluster: ${CLUSTER} (${RPC_URL})"

# ---------------------------------------------------------------------------
# Ensure correct Solana config
# ---------------------------------------------------------------------------
solana config set --url "${RPC_URL}" >/dev/null

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
log "Building workflow_marketplace.so ..."
cd "${PROGRAM_DIR}"
cargo build-sbf

if [[ ! -f "${BUILD_OUTPUT}" ]]; then
  echo "ERROR: Build output not found: ${BUILD_OUTPUT}"
  exit 1
fi

BUILT_BYTES=$(stat -f%z "${BUILD_OUTPUT}" 2>/dev/null || stat -c%s "${BUILD_OUTPUT}" 2>/dev/null || echo "unknown")
log "Build complete: ${BUILD_OUTPUT} (${BUILT_BYTES} bytes)"

# ---------------------------------------------------------------------------
# Deploy or Upgrade
# ---------------------------------------------------------------------------
if [[ -n "${SOLANA_KEYPAIR:-}" ]]; then
  log "Using keypair: ${SOLANA_KEYPAIR}"
  if [[ ! -f "${SOLANA_KEYPAIR}" ]]; then
    echo "ERROR: Keypair file not found: ${SOLANA_KEYPAIR}"
    exit 1
  fi

  # Check if this keypair already has an upgradable program deployed
  PUBKEY=$(solana-keygen pubkey "${SOLANA_KEYPAIR}")
  log "Deployer/Authority: ${PUBKEY}"

  # Attempt to show existing program for this keypair; if none, fresh deploy
  PROGRAM_ID=$(solana address -k "${SOLANA_KEYPAIR}")
  if solana program show "${PROGRAM_ID}" >/dev/null 2>&1; then
    log "Upgrading existing program ${PROGRAM_ID} ..."
    solana program deploy \
      --program-id "${PROGRAM_ID}" \
      --keypair "${SOLANA_KEYPAIR}" \
      "${BUILD_OUTPUT}"
  else
    log "Deploying new program from keypair ${PROGRAM_ID} ..."
    solana program deploy \
      --keypair "${SOLANA_KEYPAIR}" \
      "${BUILD_OUTPUT}"
  fi
else
  log "No SOLANA_KEYPAIR provided. Performing fresh deploy with ephemeral keypair ..."
  DEPLOY_OUTPUT=$(solana program deploy "${BUILD_OUTPUT}" 2>&1)
  echo "${DEPLOY_OUTPUT}"
  PROGRAM_ID=$(echo "${DEPLOY_OUTPUT}" | grep -oE 'Program Id: [^ ]+' | awk '{print $3}' || true)
fi

if [[ -z "${PROGRAM_ID:-}" ]]; then
  echo "ERROR: Failed to determine Program ID after deploy"
  exit 1
fi

# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------
log "Verifying on-chain program ${PROGRAM_ID} ..."
sleep 3
solana program show "${PROGRAM_ID}"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
log ""
log "========================================"
log "  Workflow Marketplace Deployed"
log "========================================"
log "  Cluster:   ${CLUSTER}"
log "  RPC:       ${RPC_URL}"
log "  Program:   ${PROGRAM_ID}"
log "  Explorer:  https://explorer.solana.com/address/${PROGRAM_ID}?cluster=${CLUSTER}"
log "========================================"
