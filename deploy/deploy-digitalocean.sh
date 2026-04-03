#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-digitalocean.sh — Deploy Gradience backend to a DigitalOcean droplet
#
# Prerequisites (local machine):
#   - SSH key added to the droplet (ssh-copy-id root@<DROPLET_IP>)
#   - deploy/.env.prod filled in (copy from .env.prod.example)
#   - rsync installed locally
#
# Usage:
#   cd <repo-root>
#   ./deploy/deploy-digitalocean.sh
#
# What it does:
#   1. Loads deploy/.env.prod for DROPLET_IP, DEPLOY_USER, DEPLOY_DIR, etc.
#   2. Installs Docker + Docker Compose plugin on the droplet (idempotent)
#   3. Rsyncs the required files to DEPLOY_DIR on the droplet
#   4. Builds images and starts services with docker compose
#   5. Installs nginx and certbot, writes nginx.conf, obtains SSL certs
#   6. Reloads nginx
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Load .env.prod ─────────────────────────────────────────────────────────────
ENV_FILE="${SCRIPT_DIR}/.env.prod"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} not found."
  echo "       Copy deploy/.env.prod.example → deploy/.env.prod and fill in the values."
  exit 1
fi

# Export only the vars we need for this script; docker compose reads the file itself
set -a
# shellcheck source=/dev/null
source "${ENV_FILE}"
set +a

: "${DROPLET_IP:?DROPLET_IP must be set in .env.prod}"
: "${DEPLOY_USER:=root}"
: "${DEPLOY_DIR:=/opt/gradience}"
: "${CERTBOT_EMAIL:?CERTBOT_EMAIL must be set in .env.prod}"

SSH_TARGET="${DEPLOY_USER}@${DROPLET_IP}"
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o BatchMode=yes"

log() { echo "[deploy] $*"; }

# ── Step 1: Install Docker on the droplet ─────────────────────────────────────
log "Ensuring Docker is installed on ${SSH_TARGET} ..."
ssh ${SSH_OPTS} "${SSH_TARGET}" 'bash -s' << 'REMOTE_DOCKER'
set -euo pipefail
if command -v docker &>/dev/null; then
  echo "Docker already installed: $(docker --version)"
  exit 0
fi
echo "Installing Docker..."
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg lsb-release
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable docker
systemctl start docker
echo "Docker installed: $(docker --version)"
REMOTE_DOCKER

# ── Step 2: Create deploy directory on the droplet ───────────────────────────
log "Creating ${DEPLOY_DIR} on droplet ..."
ssh ${SSH_OPTS} "${SSH_TARGET}" "mkdir -p ${DEPLOY_DIR}"

# ── Step 3: Rsync required files ──────────────────────────────────────────────
# We send only what's needed to build the images (the full monorepo is needed
# because the Dockerfiles use turbo prune from the repo root).
log "Syncing repository to ${SSH_TARGET}:${DEPLOY_DIR} ..."

rsync -az --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='target' \
  --exclude='.next' \
  --exclude='dist' \
  --exclude='*.env.local' \
  --exclude='.env' \
  --include='deploy/.env.prod' \
  "${REPO_ROOT}/" \
  "${SSH_TARGET}:${DEPLOY_DIR}/"

log "Sync complete."

# ── Step 4: Build images and start services ───────────────────────────────────
log "Building images and starting services ..."
ssh ${SSH_OPTS} "${SSH_TARGET}" "
  set -euo pipefail
  cd ${DEPLOY_DIR}

  # docker compose reads .env.prod as the env-file
  docker compose \
    -f deploy/docker-compose.prod.yml \
    --env-file deploy/.env.prod \
    up --build --detach --remove-orphans

  echo 'Services started:'
  docker compose -f deploy/docker-compose.prod.yml ps
"

# ── Step 5: Install and configure nginx ───────────────────────────────────────
log "Installing nginx and certbot ..."
ssh ${SSH_OPTS} "${SSH_TARGET}" 'bash -s' << 'REMOTE_NGINX_INSTALL'
set -euo pipefail
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx
systemctl enable nginx
systemctl start nginx
REMOTE_NGINX_INSTALL

# ── Step 6: Upload nginx.conf and reload ──────────────────────────────────────
log "Deploying nginx config ..."
scp ${SSH_OPTS} \
  "${SCRIPT_DIR}/nginx.conf" \
  "${SSH_TARGET}:/etc/nginx/sites-available/gradience"

ssh ${SSH_OPTS} "${SSH_TARGET}" '
  set -euo pipefail
  ln -sf /etc/nginx/sites-available/gradience /etc/nginx/sites-enabled/gradience
  rm -f /etc/nginx/sites-enabled/default
  # Validate before reload
  nginx -t
  systemctl reload nginx
'

# ── Step 7: Obtain SSL certificates via certbot ───────────────────────────────
log "Obtaining SSL certificates ..."
ssh ${SSH_OPTS} "${SSH_TARGET}" "
  set -euo pipefail

  # Check if certs already exist for the primary domain
  if [ -d /etc/letsencrypt/live/api.gradiences.xyz ]; then
    echo 'Certificates already exist. Renewing if needed...'
    certbot renew --quiet
  else
    echo 'Requesting new certificates...'
    certbot --nginx \
      --non-interactive \
      --agree-tos \
      --email '${CERTBOT_EMAIL}' \
      -d api.gradiences.xyz \
      -d daemon.gradiences.xyz
  fi

  # Enable auto-renewal
  systemctl enable certbot.timer 2>/dev/null || true
  (crontab -l 2>/dev/null; echo '0 3 * * * /usr/bin/certbot renew --quiet') \
    | sort -u | crontab -

  nginx -t && systemctl reload nginx
"

# ── Done ──────────────────────────────────────────────────────────────────────
log ""
log "Deployment complete!"
log ""
log "  API (indexer-mock):   https://api.gradiences.xyz"
log "  Daemon:               https://daemon.gradiences.xyz"
log ""
log "Check service health:"
log "  ssh ${SSH_TARGET} 'docker compose -f ${DEPLOY_DIR}/deploy/docker-compose.prod.yml ps'"
log ""
log "View logs:"
log "  ssh ${SSH_TARGET} 'docker compose -f ${DEPLOY_DIR}/deploy/docker-compose.prod.yml logs -f'"
