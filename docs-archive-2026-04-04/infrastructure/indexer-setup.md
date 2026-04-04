# Chain Hub Indexer Infrastructure Setup

> **Task**: GRA-65 - Setup Indexer service infrastructure
> **Date**: 2026-04-03
> **Status**: In Progress

---

## Overview

The Chain Hub Indexer provides real-time indexing of Gradience Protocol events, enabling fast queries for agent profiles, tasks, and reputation data.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Indexer Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────┐  │
│  │   Solana     │──────▶│   Indexer    │──────▶│  Postgre │  │
│  │   Events     │      │   Service    │      │   SQL     │  │
│  └──────────────┘      └──────┬───────┘      └─────┬────┘  │
│                               │                    │       │
│                               ▼                    ▼       │
│                        ┌──────────────┐      ┌──────────┐  │
│                        │    Cache     │      │   API    │  │
│                        │   (Redis)    │      │  Server  │  │
│                        └──────────────┘      └─────┬────┘  │
│                                                    │       │
│                                                    ▼       │
│                                             ┌──────────┐  │
│                                             │  Client  │  │
│                                             └──────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. PostgreSQL Database

**Purpose**: Primary data store for indexed events

**Schema**:
- `tasks` - Task data
- `applications` - Agent applications
- `submissions` - Task submissions
- `reputations` - Agent reputation scores
- `events` - Raw event log

**Setup**:
```bash
docker-compose up postgres
```

### 2. Indexer Service

**Purpose**: Consume Solana events and write to database

**Technology**: Rust + tokio + sqlx

**Environment Variables**:
```env
DATABASE_URL=postgres://postgres:password@localhost:5433/gradience
RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=gradience_program_id
```

**Run**:
```bash
docker-compose up indexer
```

### 3. API Server

**Purpose**: Serve indexed data to clients

**Endpoints**:
- `GET /api/agents` - List agents
- `GET /api/agents/:pubkey/profile` - Agent profile
- `GET /api/agents/:pubkey/reputation` - Reputation data
- `GET /api/tasks` - List tasks
- `GET /api/tasks/:id` - Task details

### 4. Redis Cache (Optional)

**Purpose**: Cache frequent queries

**Setup**:
```yaml
redis:
  image: redis:7-alpine
  ports:
    - '6379:6379'
```

---

## Local Development

### Prerequisites

- Docker & Docker Compose
- Rust (for local development)
- PostgreSQL client (optional)

### Quick Start

```bash
# 1. Navigate to indexer directory
cd apps/agent-arena/indexer

# 2. Start all services
docker-compose up -d

# 3. Check status
docker-compose ps

# 4. View logs
docker-compose logs -f indexer
```

### Database Migrations

Migrations are automatically applied on startup.

To manually run migrations:
```bash
docker-compose up migrate
```

### API Testing

```bash
# Get agent profile
curl http://localhost:3001/api/agents/7xKx...9Yz/profile

# List tasks
curl http://localhost:3001/api/tasks
```

---

## Production Deployment

### Cloudflare Workers (Recommended)

**Why Cloudflare Workers**:
- Edge deployment (low latency)
- Native D1 database integration
- WebSocket support
- Generous free tier

**Setup**:
```bash
# 1. Install Wrangler
npm install -g wrangler

# 2. Login to Cloudflare
wrangler login

# 3. Create D1 database
wrangler d1 create gradience-indexer

# 4. Deploy
wrangler deploy
```

### AWS Deployment

**Architecture**:
- ECS Fargate (Indexer service)
- RDS PostgreSQL (Database)
- ElastiCache Redis (Cache)
- Application Load Balancer

**Terraform**:
See `infra/terraform/` directory.

### GCP Deployment

**Architecture**:
- Cloud Run (Indexer service)
- Cloud SQL (PostgreSQL)
- Memorystore (Redis)
- Cloud Load Balancing

---

## Monitoring

### Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `indexer_lag` | Blocks behind head | > 10 blocks |
| `api_latency` | API response time | > 500ms |
| `db_connections` | Active DB connections | > 80% |
| `error_rate` | Error percentage | > 1% |

### Logging

Structured JSON logging:
```json
{
  "timestamp": "2026-04-03T10:00:00Z",
  "level": "info",
  "component": "indexer",
  "event": "task_indexed",
  "task_id": "123",
  "slot": 123456789
}
```

### Health Checks

**Indexer Health**:
```bash
curl http://localhost:3001/health
```

**Response**:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "last_indexed_slot": 123456789,
  "db_connected": true
}
```

---

## Scaling

### Horizontal Scaling

**Read Replicas**:
```yaml
# Add read replica for API queries
postgres_replica:
  image: postgres:16-alpine
  environment:
    POSTGRES_DB: gradience
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  # Replication configuration...
```

**Multiple Indexer Instances**:
- Partition by program account
- Each instance handles subset of accounts
- Shared database

### Vertical Scaling

**Database**:
- Increase instance size
- Optimize queries
- Add indexes

**Indexer**:
- Increase CPU/memory
- Batch processing
- Parallel event handling

---

## Backup & Recovery

### Database Backup

**Automated Backups**:
```bash
# Daily backup at 2 AM
0 2 * * * pg_dump gradience > backup-$(date +%Y%m%d).sql
```

**Point-in-Time Recovery**:
- Enable WAL archiving
- Set retention policy (7 days)

### Disaster Recovery

**RTO**: 1 hour
**RPO**: 5 minutes

**Steps**:
1. Restore database from backup
2. Replay events from last indexed slot
3. Verify data consistency

---

## Security

### Database

- SSL/TLS encryption in transit
- Password authentication
- Network isolation (VPC)
- Regular security patches

### API

- Rate limiting (100 req/min per IP)
- CORS configuration
- Input validation
- SQL injection prevention

---

## Cost Estimates

### Development (Local)

| Component | Cost |
|-----------|------|
| Docker Desktop | Free |
| Total | **$0/month** |

### Production (Cloudflare)

| Component | Cost |
|-----------|------|
| Workers (10M requests) | $5/month |
| D1 Database | Free tier |
| Total | **~$5/month** |

### Production (AWS)

| Component | Cost |
|-----------|------|
| ECS Fargate (2 vCPU, 4GB) | $75/month |
| RDS PostgreSQL (db.t3.micro) | $15/month |
| ElastiCache (cache.t3.micro) | $15/month |
| Data Transfer | $10/month |
| Total | **~$115/month** |

---

## Troubleshooting

### Common Issues

**Indexer Lagging**:
```bash
# Check RPC endpoint
curl $RPC_URL -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'

# Restart indexer
docker-compose restart indexer
```

**Database Connection Issues**:
```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Verify connection
psql $DATABASE_URL -c "SELECT 1"
```

**High Memory Usage**:
- Reduce batch size
- Enable swap
- Increase container memory limit

---

## References

- [Indexer README](../indexer/README.md)
- [API Documentation](../indexer/docs/api.md)
- [Database Schema](../indexer/migrations/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)

---

*Infrastructure setup for GRA-65*
