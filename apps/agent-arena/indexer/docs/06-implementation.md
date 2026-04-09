# Phase 6: Implementation Log — agent-arena/indexer

---

## 实现概览

| 文件             | 职责                                       | 状态 |
| ---------------- | ------------------------------------------ | ---- |
| `src/main.rs`    | HTTP 服务器、路由、API handlers、WebSocket | ✅   |
| `src/db.rs`      | PostgreSQL 数据访问层                      | ✅   |
| `src/events.rs`  | 链上事件日志解析（8 种事件）               | ✅   |
| `src/webhook.rs` | Webhook adapter (Triton/Helius/Generic)    | ✅   |
| `src/config.rs`  | 环境变量配置                               | ✅   |
| `worker/`        | Cloudflare Worker edge proxy               | ✅   |

## API 端点

| Method | Path                              | 说明                 |
| ------ | --------------------------------- | -------------------- |
| GET    | `/healthz`                        | 健康检查             |
| GET    | `/metrics`                        | Prometheus 指标      |
| GET    | `/api/tasks`                      | 任务列表（支持筛选） |
| GET    | `/api/tasks/{id}`                 | 单个任务             |
| GET    | `/api/tasks/{id}/submissions`     | 任务提交列表         |
| GET    | `/api/agents/{pubkey}/profile`    | Agent Profile        |
| GET    | `/api/agents/{pubkey}/reputation` | Agent 声誉           |
| GET    | `/api/judge-pool/{category}`      | Judge Pool           |
| GET    | `/ws`                             | WebSocket 事件流     |
| POST   | `/webhook/*`                      | Webhook 接收         |

详见 [API Reference](./api-reference.md)。

## 事件类型

| Discriminator | 事件               |
| :-----------: | ------------------ |
|       1       | TaskCreated        |
|       2       | SubmissionReceived |
|       3       | TaskJudged         |
|       4       | TaskRefunded       |
|       5       | JudgeRegistered    |
|       6       | TaskApplied        |
|       7       | TaskCancelled      |
|       8       | JudgeUnstaked      |

## 数据模型

- **tasks**: task_id, poster, judge, state, reward, deadline, etc.
- **submissions**: task_id, agent, result_ref, trace_ref, runtime info
- **reputations**: agent, global scores, win_rate, total_earned
- **agent_profiles**: agent, display_name, bio, links, publish_mode
- **judge_pools**: judge, category, stake, weight
