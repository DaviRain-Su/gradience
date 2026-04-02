# Phase 3: Technical Spec — agent-arena/indexer

> **范围**: `apps/agent-arena/indexer/` — 链上事件解析、持久化、对外 API
> **上游**: `agent-arena/program` 发出的链上事件（通过 Triton Dragon's Mouth 或 Helius Webhook）
> **下游**: Judge Daemon、CLI、前端通过 REST/WebSocket 消费

---

## 1. 模块职责

Indexer 是**链外只读数据层**：

- 监听链上事件（webhook ingest）
- 解析并持久化到 PostgreSQL
- 通过 REST API 提供查询接口
- 通过 WebSocket 向订阅者实时推送事件

**不做**：

- 写链上数据（只读）
- 评判任务（Judge Daemon 负责）
- 业务决策逻辑

---

## 2. 技术栈

| 项目                           | 说明                                        |
| ------------------------------ | ------------------------------------------- |
| Rust + Tokio                   | 异步运行时                                  |
| Axum                           | HTTP + WebSocket 框架                       |
| tokio-postgres                 | PostgreSQL 驱动（无 ORM）                   |
| serde + serde_json             | JSON 序列化                                 |
| Docker Compose                 | 本地 PostgreSQL + Indexer 一键启动          |
| Cloudflare Worker (TypeScript) | 可选：轻量级 edge webhook 代理（`worker/`） |

---

## 3. 文件结构与职责

```
indexer/
├── src/
│   ├── main.rs        — HTTP 路由、WebSocket 升级、AppState、main 入口（582 行）
│   ├── config.rs      — 环境变量解析（DATABASE_URL, PORT, WEBHOOK_SECRET）
│   ├── db.rs          — 所有 SQL 查询（523 行），无 ORM，原生 tokio-postgres
│   ├── events.rs      — 链上事件结构体反序列化（8 种 ProgramEvent）
│   └── webhook.rs     — 解析 Triton / Helius / Generic webhook payload（181 行）
├── migrations/
│   ├── 0001_init.sql          — 主表：tasks, applications, submissions, reputation, stakes
│   └── 0002_judge_pool_members.sql — judge_pool_members 补充表
├── worker/                    — Cloudflare D1 Worker（TypeScript，可选部署）
│   ├── src/index.ts
│   ├── d1/
│   ├── tests/
│   └── wrangler.toml
├── mock/webhook.json          — 开发调试用 webhook payload 示例
├── Cargo.toml
├── Dockerfile
└── docker-compose.yml
```

---

## 4. API 路由规范

### REST

| Method | Path                              | 说明                                 |
| ------ | --------------------------------- | ------------------------------------ |
| GET    | `/healthz`                        | 健康检查，返回 `{"status":"ok"}`     |
| GET    | `/api/tasks`                      | 任务列表，支持过滤参数               |
| GET    | `/api/tasks/:task_id`             | 单任务详情                           |
| GET    | `/api/tasks/:task_id/submissions` | 任务的提交列表                       |
| GET    | `/api/agents/:pubkey/reputation`  | Agent 声誉查询                       |
| GET    | `/api/reputation/:agent`          | 同上（兼容旧路径）                   |
| GET    | `/api/judge-pool/:category`       | 指定 category 的 Judge Pool 成员列表 |
| POST   | `/webhook/triton`                 | Triton Dragon's Mouth 事件接收       |
| POST   | `/webhook/helius`                 | Helius Webhook 事件接收              |
| POST   | `/webhook/events`                 | Generic 事件接收（测试/备用）        |

### 查询参数（GET /api/tasks）

| 参数       | 类型   | 说明                              |
| ---------- | ------ | --------------------------------- |
| `status`   | string | `open` / `completed` / `refunded` |
| `category` | u8     | 任务类别 0–7                      |
| `mint`     | string | 支付 mint 地址过滤                |
| `poster`   | string | 发布者地址过滤                    |
| `limit`    | u32    | 分页大小（默认 20，最大 100）     |
| `offset`   | u32    | 分页偏移                          |

### WebSocket

| Path                     | 说明                 |
| ------------------------ | -------------------- |
| `/ws`                    | 订阅所有事件         |
| `/ws/tasks?task_id=<id>` | 仅订阅指定任务的事件 |

WsEvent 结构：

```json
{ "event": "TaskJudged", "task_id": 42, "slot": 300000000, "timestamp": 1743465600 }
```

---

## 5. 数据库 Schema（核心表）

| 表名                 | 用途                                     |
| -------------------- | ---------------------------------------- |
| `tasks`              | Task 主表（对应链上 Task 账户）          |
| `applications`       | Agent 申请记录                           |
| `submissions`        | Agent 提交记录                           |
| `reputation`         | Agent 声誉分（score, completed, failed） |
| `stakes`             | Judge 质押记录                           |
| `judge_pool_members` | JudgePool 成员列表（category → judges）  |

---

## 6. Webhook 解析策略

`webhook.rs` 支持三种 payload 格式，按顺序尝试匹配：

1. **Triton style** — `{ transactions: [{ meta: { logMessages: [...] } }] }`
2. **Helius style** — `{ type: "...", logs: [...] }`
3. **Generic** — `{ logs: [...] }` 或 `{ events: [...] }`

事件识别：扫描 `logMessages` 中以 `Program data:` 开头的行，base64 解码，
按 Anchor EVENT_IX_TAG（前 8 字节）匹配 8 种事件类型（见 `events.rs`）。

---

## 7. WebSocket 广播架构

```
Webhook Ingest → parse events → broadcast::Sender<WsEvent> (容量 1024)
                                          ↓
                           N 个 WebSocket 连接各持有 Receiver
                           按 task_id 过滤后推送给订阅者
```

---

## 8. 本地运行

```bash
# 启动 PostgreSQL + Indexer
cd apps/agent-arena/indexer
docker-compose up -d

# 单独运行（需手动配置 .env）
DATABASE_URL=postgres://... INDEXER_BIND_ADDR=127.0.0.1:8787 cargo run -p gradience-indexer

# 发送测试 webhook
curl -X POST http://127.0.0.1:8787/webhook/events \
  -H "Content-Type: application/json" \
  -d @mock/webhook.json
```

---

## 9. 环境变量

| 变量                | 必须 | 默认                                                    | 说明                                       |
| ------------------- | ---- | ------------------------------------------------------- | ------------------------------------------ |
| `DATABASE_URL`      | ✅   | `<POSTGRES_CONNECTION_URI>`                              | PostgreSQL 连接串                          |
| `INDEXER_BIND_ADDR` | ❌   | `127.0.0.1:8787`                                        | HTTP 监听地址（host:port）                 |
| `MOCK_WEBHOOK`      | ❌   | `false`                                                 | 启用 mock webhook 模式（bool）             |
| `MOCK_WEBHOOK_FILE` | ❌   | `indexer/mock/webhook.json`                             | mock webhook 数据文件路径                  |
| `MOCK_WEBHOOK_ONLY` | ❌   | `false`                                                 | 仅处理 mock 数据，忽略真实 webhook（bool） |

---

## 10. 接口契约

### ← Program（上游）

- 事件通过 Triton Dragon's Mouth gRPC 或 Helius Webhook 推送
- 事件格式由 `program/src/events/` 定义，Indexer 的 `events.rs` 必须与之同步

### → Judge Daemon（下游）

- Judge Daemon 轮询 `GET /api/tasks?status=open` 获取待评判任务
- 监听 `GET /ws/tasks?task_id=<id>` 获取实时状态变化

### → CLI / Frontend（下游）

- 直接调用 REST API 查询任务、声誉、Judge Pool
