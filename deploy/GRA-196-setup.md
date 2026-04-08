# GRA-196: Production Deployment & DNS Setup

## Prerequisites
- Server IP: `64.23.248.73`
- Docker & Docker Compose installed
- DNS management access for `gradiences.xyz`

## Step 1: DNS Configuration

At your DNS provider, create/update the following A records:

| Record | Type | Value |
|--------|------|-------|
| `api.gradiences.xyz` | A | `64.23.248.73` |
| `indexer.gradiences.xyz` | A | `64.23.248.73` |

Wait for DNS propagation (use `dig indexer.gradiences.xyz` to verify).

## Step 2: Obtain SSL Certificates

Run certbot on the host **before** starting Docker Compose (or via a one-off container):

```bash
# For api.gradiences.xyz (renewal only — should already exist)
# For indexer.gradiences.xyz (new certificate)
docker run -it --rm \
  -v gradience_certbot-data:/etc/letsencrypt \
  -v gradience_certbot-www:/var/www/certbot \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d indexer.gradiences.xyz \
  --agree-tos --no-eff-email -m admin@gradiences.xyz
```

> If `api.gradiences.xyz` certificate is missing, run the same command with `-d api.gradiences.xyz`.

## Step 3: Prepare Environment File

```bash
cd /path/to/gradience/deploy
cp .env.prod.example .env.prod
# Edit .env.prod and set strong passwords / API keys
```

## Step 4: Deploy Services

> Note: The production indexer is built from `apps/chain-hub/indexer-service` (unified Chain Hub + Agent Arena indexer) and exposes port `8788` internally. Nginx proxies `indexer.gradiences.xyz` to this container.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

## Step 5: Verify Deployment

```bash
curl https://indexer.gradiences.xyz/healthz
curl https://api.gradiences.xyz/api/v1/status
```

## Step 6: Agent Daemon CORS Check

Agent Daemon CORS already includes `http://localhost:5200` in `src/api/server.ts`.
No code changes are required. Ensure the daemon is restarted after `.env.prod` updates.

## Step 7: Auto-Renewal

The `certbot` service in `docker-compose.prod.yml` runs a loop that renews certificates every 12 hours.
No additional cron job is needed.

## Verification Checklist

- [ ] `curl https://indexer.gradiences.xyz/healthz` returns 200
- [ ] `curl https://api.gradiences.xyz/api/v1/status` returns running
- [ ] agent-daemon logs no longer show `ENOTFOUND indexer.gradiences.xyz`
- [ ] Frontend (e.g., `https://agentm.gradiences.xyz`) can query indexer REST API without CORS errors
