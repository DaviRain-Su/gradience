# Chain Hub SQL Query Guide

> **Task**: GRA-153 - Write Chain Hub SQL Query Guide
> **Date**: 2026-04-03

## Overview

Chain Hub Indexer provides a PostgreSQL database with indexed blockchain data for fast queries.

## Database Schema

### Core Tables

```sql
-- Tasks table
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    task_id BIGINT UNIQUE NOT NULL,
    poster VARCHAR(44) NOT NULL,
    reward BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    category INTEGER,
    created_at TIMESTAMP NOT NULL
);

-- Applications table
CREATE TABLE applications (
    id SERIAL PRIMARY KEY,
    task_id BIGINT REFERENCES tasks(task_id),
    agent VARCHAR(44) NOT NULL,
    stake_amount BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL
);

-- Reputation table
CREATE TABLE reputations (
    id SERIAL PRIMARY KEY,
    agent VARCHAR(44) UNIQUE NOT NULL,
    overall_score INTEGER,
    completed_tasks INTEGER DEFAULT 0,
    total_earned BIGINT DEFAULT 0
);
```

## Common Queries

### Query Agent Profile

```sql
SELECT 
    r.agent,
    r.overall_score,
    r.completed_tasks,
    r.total_earned,
    COUNT(DISTINCT a.task_id) as active_applications
FROM reputations r
LEFT JOIN applications a ON r.agent = a.agent AND a.status = 'active'
WHERE r.agent = '7xKx...9Yz'
GROUP BY r.agent, r.overall_score, r.completed_tasks, r.total_earned;
```

### Query Tasks by Category

```sql
SELECT 
    task_id,
    poster,
    reward,
    status,
    created_at
FROM tasks
WHERE category = 0
    AND status = 'open'
    AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY reward DESC
LIMIT 10;
```

### Query Top Agents

```sql
SELECT 
    agent,
    overall_score,
    completed_tasks,
    total_earned,
    tier
FROM reputations
WHERE overall_score > 60
ORDER BY overall_score DESC
LIMIT 20;
```

### Query Agent Activity

```sql
SELECT 
    t.task_id,
    t.reward,
    a.stake_amount,
    t.status,
    t.created_at
FROM applications a
JOIN tasks t ON a.task_id = t.task_id
WHERE a.agent = '7xKx...9Yz'
ORDER BY t.created_at DESC
LIMIT 50;
```

## API Integration

```typescript
import { ChainHubIndexer } from '@gradience/chain-hub';

const indexer = new ChainHubIndexer({
  databaseUrl: 'postgres://...'
});

// Query using TypeScript
const topAgents = await indexer.query(`
  SELECT agent, overall_score 
  FROM reputations 
  ORDER BY overall_score DESC 
  LIMIT 10
`);
```

## Performance Tips

- Use indexes on frequently queried columns
- Limit results with `LIMIT`
- Use `EXPLAIN ANALYZE` for query optimization
- Cache frequent queries in Redis

## Next Steps

- [Full Schema](./schema.md)
- [API Reference](./api-reference.md)
- [Examples](./examples/)
