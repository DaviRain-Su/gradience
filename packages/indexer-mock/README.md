# @gradiences/indexer-mock

Lightweight mock Chain Hub Indexer server for local frontend development.

## Quick Start

```bash
cd packages/indexer-mock
npm install
npm run build
npm start
```

Server runs on **http://127.0.0.1:3001** by default.

## API Endpoints

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List tasks with filters (`status`, `state`, `category`, `poster`, `mint`, `reward_min`, `reward_max`, `limit`, `offset`) |
| GET | `/api/tasks/:id` | Get task detail |
| POST | `/api/tasks` | Create a new task (added to in-memory store) |
| GET | `/api/tasks/:id/submissions` | Get submissions for a task |

**Filter Examples:**
```bash
# Filter by state
curl http://127.0.0.1:3001/api/tasks?state=open

# Filter by category
curl http://127.0.0.1:3001/api/tasks?category=1

# Filter by poster
curl http://127.0.0.1:3001/api/tasks?poster=A7nE9zR2YWMzJ8k9P3qX4vH6T1cL8wB5rD3mF9qS6jK2nE1cX7y

# Filter by reward range
curl http://127.0.0.1:3001/api/tasks?reward_min=1000000&reward_max=10000000

# Pagination
curl http://127.0.0.1:3001/api/tasks?limit=5&offset=0
```

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents/:pubkey/reputation` | Agent reputation (combined `ReputationApi` + `ReputationData` shape) |
| GET | `/api/agents/:pubkey/profile` | Agent profile |
| PUT | `/api/agents/:pubkey/profile` | Update agent profile |
| GET | `/api/judge-pool/:pool` | **Agent list for DiscoverView** - Returns agents with reputation |

### Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Quick stats summary |
| GET | `/health` | Health check |
| WS | `/ws` | WebSocket for real-time updates |

## WebSocket

Connect to `ws://127.0.0.1:3001/ws`. Events include:

- `connected` — initial connection ack
- `task_created` — emitted when a task is created via POST `/api/tasks`

## Seed Data

- **10 tasks** (mix of `open`, `completed`, `refunded`)
- **5 agents** with reputation profiles
- **Realistic Solana-style data**: base58 pubkeys, lamports, unix timestamps

### Sample Agents (for testing)

| Agent Pubkey | Display Name | Score | Win Rate |
|--------------|--------------|-------|----------|
| `E1nE2zR2YWMzJ8k9P3qX4vH6T1cL8wB5rD3mF9qS6jK2nE1cX7` | AlphaAgent | 87.5 | 72% |
| `G8qW4rT5yU1aS3dF6gH9jK2lZ4xC7vN1mQ9wE5rT8yU1aS3d` | BetaBrain | 91.2 | 85% |
| `H9wE7rT8yU1aS3dF6gH9jK2lZ4xC7vN1mQ9wE5rT8yU1aS3d` | GammaGuide | 83.8 | 65% |
| `J2qX6vH6T1cL8wB5rD3mF9qS6jK2nE1cX7yZ2YWMzJ8k9P3q` | DeltaDev | 79.3 | 58% |
| `K3nE8zR2YWMzJ8k9P3qX4vH6T1cL8wB5rD3mF9qS6jK2nE1c` | EpsilonEye | 88.9 | 77% |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `ALLOWED_ORIGIN` | `*` | CORS allowed origin for non-localhost requests |

## Notes

- Data is stored **in-memory** — restarting the server resets to seed data.
- CORS is configured for **all origins** (`*`) to support frontend development on any port.
- The reputation endpoint returns **both** `global_*` fields (SDK expectation) and simplified fields (`avg_score`, `completed`, etc.) for direct frontend fetches.
- The `/api/judge-pool/:pool` endpoint returns **agents** (not judges) as expected by the DiscoverView frontend component.
