# Phase 5: Test Spec — agent-arena/indexer

---

## 1. 当前测试文件

| 文件            | 位置            | 测试内容                       | 状态 |
| --------------- | --------------- | ------------------------------ | ---- |
| `index.test.ts` | `worker/tests/` | Cloudflare Worker webhook 路由 | ✅   |

> Rust indexer 主体（main.rs / db.rs / events.rs / webhook.rs）**暂无测试**。

---

## 2. 运行方式

```bash
# Cloudflare Worker 测试
cd apps/agent-arena/indexer/worker
pnpm test

# Rust indexer 测试（暂无，占位）
cargo test -p gradience-indexer
```

---

## 3. 覆盖要求

### 必须覆盖（P0）

| 场景                                               | 建议测试位置          |
| -------------------------------------------------- | --------------------- |
| `POST /webhook/triton` — 正确解析 TaskCreated 事件 | `webhook.rs` 单元测试 |
| `POST /webhook/helius` — 正确解析 TaskJudged 事件  | `webhook.rs` 单元测试 |
| `GET /api/tasks` — 基础分页返回                    | `main.rs` 集成测试    |
| `GET /api/tasks/:id` — 不存在的 task_id 返回 404   | `main.rs` 集成测试    |
| `GET /healthz` — 返回 200                          | `main.rs` 集成测试    |
| WebSocket 事件推送 — ingest 后订阅者收到事件       | `main.rs` 集成测试    |
| `decode_webhook` — 三种 payload 格式各一个正例     | `webhook.rs` 单元测试 |

### 应覆盖（P1）

| 场景                                   | 说明       |
| -------------------------------------- | ---------- |
| 无效 base64 事件数据 — 应跳过而非崩溃  | 健壮性     |
| WEBHOOK_SECRET 验证 — 签名错误返回 401 | 安全性     |
| 数据库连接断开 — 优雅降级返回 503      | 容错性     |
| `GET /api/tasks` 所有过滤参数组合      | 查询正确性 |

### 暂缓（P2）

- 高并发 WebSocket 压力测试
- PostgreSQL 事务并发写入竞态

---

## 4. 测试环境要求

| 项目           | 说明                                                  |
| -------------- | ----------------------------------------------------- |
| PostgreSQL     | 集成测试需要真实 DB（不可 mock，见 Chain Hub 的原则） |
| Docker Compose | `docker-compose up -d` 启动测试 DB                    |
| Testcontainers | 备选：在 CI 中用 testcontainers-rs 自动启动 PG        |

---

## 5. 缺口优先级

| 优先级 | 任务                                                          |
| ------ | ------------------------------------------------------------- |
| P0     | 补充 `webhook.rs` 单元测试（用 `mock/webhook.json` 数据驱动） |
| P0     | 补充 `main.rs` HTTP 路由集成测试（axum::test）                |
| P1     | WebSocket 端到端推送测试                                      |
| P1     | 数据库查询层（`db.rs`）独立测试                               |
