#!/usr/bin/env bash
# deploy-core.sh u2014 Deploy only core backend services (agent-daemon + postgres)
#
# Usage:
#   ./deploy/deploy-core.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_FILE="${SCRIPT_DIR}/.env.prod"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} not found."
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

: "${DROPLET_IP:?DROPLET_IP must be set in .env.prod}"
: "${DEPLOY_USER:=gradience}"
: "${DEPLOY_DIR:=/opt/gradience}"

SSH_TARGET="${DEPLOY_USER}@${DROPLET_IP}"
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=20"

log() { echo "[deploy-core] $*"; }

# Step 1: Rsync
log "Syncing repository to ${SSH_TARGET}:${DEPLOY_DIR} ..."
rsync -az --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='target' \
  --exclude='.next' \
  --exclude='dist' \
  --exclude='*.env.local' \
  --exclude='.env' \
  --exclude='.turbo' \
  "${REPO_ROOT}/" \
  "${SSH_TARGET}:${DEPLOY_DIR}/"
log "Sync complete."

# Step 2: Build and start core services only
log "Building and starting core services ..."
ssh ${SSH_OPTS} "${SSH_TARGET}" "
  set -euo pipefail
  cd ${DEPLOY_DIR}

  # Clean old build cache to free space
  docker builder prune -f 2>/dev/null || true

  # Build and start
  docker compose \
    -f deploy/docker-compose.prod.yml \
    --env-file deploy/.env.prod \
    up --build --detach --remove-orphans

  echo ''
  echo 'Services:'
  docker compose -f deploy/docker-compose.prod.yml ps
"

log ""
log "Deployment complete!"
log "  Daemon API: http://${DROPLET_IP}:4001"
log "  Health:     http://${DROPLET_IP}:4001/health"
log ""
log "Check logs:"
log "  ssh ${SSH_TARGET} 'docker compose -f ${DEPLOY_DIR}/deploy/docker-compose.prod.yml logs -f'"
