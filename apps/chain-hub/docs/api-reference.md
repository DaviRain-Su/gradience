# Chain Hub API Reference

> **Task**: GRA-152 - Write Chain Hub API Reference
> **Date**: 2026-04-03

## Base URL

```
https://api.gradience.xyz/chain-hub/v1
```

## Authentication

All requests require an API key:

```http
Authorization: Bearer YOUR_API_KEY
```

## Endpoints

### Protocols

#### List Protocols

```http
GET /protocols
```

**Query Parameters:**

- `chain` (optional): Filter by chain (solana, ethereum)
- `category` (optional): Filter by category
- `limit` (optional): Max results (default: 20)

**Response:**

```json
{
    "protocols": [
        {
            "id": "proto_123",
            "name": "My DeFi Protocol",
            "chain": "solana",
            "category": "defi",
            "endpoint": "https://api.myprotocol.com"
        }
    ]
}
```

#### Register Protocol

```http
POST /protocols
```

**Request Body:**

```json
{
    "name": "My Protocol",
    "description": "Protocol description",
    "chain": "solana",
    "endpoint": "https://api.example.com",
    "category": "defi"
}
```

### Skills

#### List Skills

```http
GET /skills
```

**Query Parameters:**

- `protocol` (optional): Filter by protocol ID
- `chain` (optional): Filter by chain

**Response:**

```json
{
    "skills": [
        {
            "id": "skill_456",
            "name": "yield_farm",
            "protocol": "proto_123",
            "parameters": [
                { "name": "token", "type": "string" },
                { "name": "amount", "type": "number" }
            ]
        }
    ]
}
```

#### Execute Skill

```http
POST /skills/{skill_id}/execute
```

**Request Body:**

```json
{
    "parameters": {
        "token": "USDC",
        "amount": 1000
    },
    "wallet": "7xKx...9Yz"
}
```

### Queries

#### Execute SQL Query

```http
POST /query
```

**Request Body:**

```json
{
    "query": "SELECT * FROM tasks WHERE status = 'open' LIMIT 10"
}
```

**Response:**

```json
{
    "results": [{ "task_id": 1, "status": "open", "reward": 5000 }]
}
```

## Error Codes

| Code | Description  |
| ---- | ------------ |
| 400  | Bad Request  |
| 401  | Unauthorized |
| 404  | Not Found    |
| 429  | Rate Limited |
| 500  | Server Error |

## Rate Limits

- 100 requests per minute per API key
- 1000 requests per hour per API key

## SDK Usage

```typescript
import { ChainHub } from '@gradiences/chain-hub';

const hub = new ChainHub({ apiKey: 'YOUR_KEY' });

// List protocols
const protocols = await hub.listProtocols();

// Execute skill
const result = await hub.executeSkill('skill_456', {
    token: 'USDC',
    amount: 1000,
});
```
