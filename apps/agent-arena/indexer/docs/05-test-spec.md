# Phase 5: Test Spec — Unified Gradience Indexer

> **输入**: Phase 3 Technical Spec + Phase 4 Task Breakdown  
> **目标**: 在写代码之前定义所有测试用例，确保 TDD 执行。  
> **模块**: `apps/agent-arena/indexer/`

---

## 5.1 测试策略

| 测试类型          | 覆盖范围                                                                               | 工具                                                             | 运行环境      |
| ----------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------- |
| 单元测试          | `events.rs` 中的 Chain Hub 事件解码器、`mappers.rs` 新增映射函数、`db.rs` 新增查询函数 | Rust `cargo test`                                                | 本地开发      |
| 集成测试          | Webhook → DB 写入 → REST API 返回；Program ID 路由分发                                 | Rust `cargo test` + `tokio-postgres` testcontainers (或 mock DB) | CI / 本地     |
| 前端 API 契约测试 | `useSocial.ts` 调用目标修正、`resolveIndexerBase` 一致性                               | Vitest + `msw` (or fetch mock)                                   | 本地 / CI     |
| 端到端测试        | 统一 Indexer Docker 启动后 healthz + tasks + skills 全通                               | Docker Compose + `curl` / Playwright                             | 本地 / 预发布 |
| 性能测试          | 分页 limit=100 的响应时间 < 200ms                                                      | `cargo bench` 或 `wrk`                                           | 可选          |

---

## 5.2 测试用例表

### 5.2.1 Chain Hub 事件解码 (`events.rs`)

**正常路径 (Happy Path)**

| #   | 测试名称                         | 输入                                             | 预期输出                                            | 预期状态变化                     |
| --- | -------------------------------- | ------------------------------------------------ | --------------------------------------------------- | -------------------------------- |
| H1  | `decode_skill_registered`        | Base64 编码的 `SkillRegistered` 日志             | `ProgramEvent::SkillRegistered`                     | 事件字段完全匹配                 |
| H2  | `decode_protocol_registered`     | Base64 编码的 `ProtocolRegistered` 日志          | `ProgramEvent::ProtocolRegistered`                  | endpoint/docs_uri 解析正确       |
| H3  | `decode_invocation_created`      | `InvocationCreated` + `InvocationCompleted` 日志 | 两个事件按顺序解析                                  | success=true, royalty_amount=100 |
| H4  | `decode_skill_status_updated`    | `SkillStatusUpdated` 日志 (status=1)             | `ProgramEvent::SkillStatusUpdated { status: 1 }`    | —                                |
| H5  | `decode_protocol_status_updated` | `ProtocolStatusUpdated` 日志 (status=1)          | `ProgramEvent::ProtocolStatusUpdated { status: 1 }` | —                                |

**边界条件 (Boundary)**

| #   | 测试名称                       | 输入                               | 预期行为        | 备注         |
| --- | ------------------------------ | ---------------------------------- | --------------- | ------------ |
| B1  | `decode_empty_logs`            | 空日志数组 `[]`                    | 返回空 Vec      | 正常退化     |
| B2  | `decode_unknown_discriminator` | discriminator = 0xFF               | 返回 `Ok(None)` | 不应 panic   |
| B3  | `decode_truncated_payload`     | 截断的 base64 payload              | 返回 Err        | 异常输入处理 |
| B4  | `decode_zero_length_string`    | name 长度为 0 的 `SkillRegistered` | name=""         | 允许空字符串 |

**异常/攻击 (Error/Attack)**

| #   | 测试名称                 | 输入/操作                    | 预期错误码  | 攻击类型         |
| --- | ------------------------ | ---------------------------- | ----------- | ---------------- |
| E1  | `decode_invalid_base64`  | 非 base64 字符串             | Parsing Err | 格式破坏         |
| E2  | `decode_wrong_event_tag` | 正确的 base64 但 tag 不匹配  | `Ok(None)`  | 无关程序日志干扰 |
| E3  | `decode_malformed_utf8`  | String 字段为非法 UTF-8 字节 | Parsing Err | 数据污染         |

### 5.2.2 Webhook Program ID 路由分发 (`webhook.rs` / `main.rs` handlers)

**正常路径 (Happy Path)**

| #   | 测试名称                  | 输入                                       | 预期输出                               | 预期状态变化     |
| --- | ------------------------- | ------------------------------------------ | -------------------------------------- | ---------------- |
| H6  | `route_arena_program`     | program_id = Agent Arena ID + Arena 日志   | `apply_events` 中只出现 Arena 事件     | Arena 表写入     |
| H7  | `route_chain_hub_program` | program_id = Chain Hub ID + Chain Hub 日志 | `apply_events` 中只出现 Chain Hub 事件 | Chain Hub 表写入 |
| H8  | `route_mixed_programs`    | 同一 payload 包含 Arena + Chain Hub 日志   | 两类事件分别解析入库                   | 两个表都有新数据 |

**异常/攻击 (Error/Attack)**

| #   | 测试名称                   | 输入/操作                           | 预期错误码             | 攻击类型     |
| --- | -------------------------- | ----------------------------------- | ---------------------- | ------------ |
| E4  | `route_unknown_program`    | program_id = 随机 Pubkey + 任意日志 | `Ok(0 events applied)` | 未知程序干扰 |
| E5  | `route_missing_program_id` | payload 无 program_id 字段          | 返回 400 Bad Request   | 非法 webhook |

### 5.2.3 Chain Hub REST API (`main.rs` / `db.rs`)

**正常路径 (Happy Path)**

| #   | 测试名称                    | 输入                    | 预期输出                     | 预期状态变化 |
| --- | --------------------------- | ----------------------- | ---------------------------- | ------------ |
| H9  | `get_skills_list`           | DB 中存在 3 条 skills   | 返回 skills 数组，total=3    | —            |
| H10 | `get_skill_by_id`           | skill_id = 1            | 返回对应 SkillApi            | —            |
| H11 | `get_protocols_filtered`    | ?status=0               | 只返回 status=0 的 protocols | —            |
| H12 | `get_invocations_paginated` | ?limit=2&page=2         | 返回第 2 页 2 条记录         | offset=2     |
| H13 | `get_royalty_by_agent`      | agent 存在 royalty 记录 | 返回 RoyaltyApi              | —            |

**边界条件 (Boundary)**

| #   | 测试名称                          | 输入              | 预期行为                              | 备注       |
| --- | --------------------------------- | ----------------- | ------------------------------------- | ---------- |
| B5  | `get_skills_limit_zero`           | ?limit=0          | 返回空数组，total 正确                | 正常退化   |
| B6  | `get_skills_limit_over_max`       | ?limit=101        | HTTP 400, 错误码 `INVALID_PAGINATION` | 硬上限检查 |
| B7  | `get_nonexistent_skill`           | skill_id = 999999 | HTTP 404, `SKILL_NOT_FOUND`           | —          |
| B8  | `get_invocations_with_bad_status` | ?status=invalid   | 忽略无效 filter 或返回 400            | 需具体决策 |

### 5.2.4 前端 API 目标修复 (`agentm-web`)

**正常路径 (Happy Path)**

| #   | 测试名称                        | 输入                                  | 预期输出                                         | 预期状态变化     |
| --- | ------------------------------- | ------------------------------------- | ------------------------------------------------ | ---------------- |
| H14 | `social_follow_uses_daemon_url` | 调用 `follow()` in `useSocial.ts`     | `fetch` 目标为 `DAEMON_URL/api/follow`           | 不再发往 indexer |
| H15 | `social_feed_uses_daemon_url`   | 调用 `getFeed()` in `useSocial.ts`    | `fetch` 目标为 `DAEMON_URL/api/feed`             | 不再发往 indexer |
| H16 | `resolveIndexerBase_consistent` | `NODE_ENV=production` / `development` | 都返回统一 Indexer URL                           | 无硬切换逻辑     |
| H17 | `discover_agents_uses_indexer`  | 调用 `useDiscoverAgents`              | `fetch` 目标为 Indexer `/api/agents` (或 Daemon) | 路径存在         |

**异常/攻击 (Error/Attack)**

| #   | 测试名称                    | 输入/操作                                  | 预期错误码             | 攻击类型 |
| --- | --------------------------- | ------------------------------------------ | ---------------------- | -------- |
| E6  | `social_api_xss_in_content` | post content = `<script>alert(1)</script>` | 内容被转义或纯文本存储 | XSS 注入 |

---

## 5.3 集成测试场景

### I1: Chain Hub 完整数据流

**步骤**:

1. 启动 Postgres 容器，执行所有 migrations (Arena + Chain Hub 表)。
2. 启动统一 Indexer，连接空数据库。
3. 构造一个 `SkillRegistered` 的 Triton webhook payload (program_id = Chain Hub)。
4. POST 到 `/webhook/events`。
5. GET `/api/skills`。
6. GET `/api/skills/1`。

**预期结果**:

- Step 4 返回 200/204。
- Step 5 返回 `{"skills": [{...}], "total": 1}`。
- Step 6 返回单个 skill 详情，字段与 webhook 数据一致。

### I2: Agent Arena + Chain Hub 事件共存

**步骤**:

1. 同一 webhook payload 同时包含：
    - `TaskCreated` (Agent Arena program)
    - `SkillRegistered` (Chain Hub program)
2. POST 到 `/webhook/events`。
3. 分别 GET `/api/tasks` 和 `/api/skills`。

**预期结果**:

- 两个事件都被正确解析。
- `tasks` 表和 `skills` 表各新增一条记录。
- 两个 REST API 都能查询到新数据。

### I3: 统一 Indexer 启动健康检查

**步骤**:

1. `docker compose -f apps/agent-arena/indexer/docker-compose.yml up -d --build`
2. `curl http://localhost:3001/healthz`
3. `curl http://localhost:3001/api/tasks`
4. `curl http://localhost:3001/api/skills`

**预期结果**:

- `/healthz` 返回 `{"ok": true, ...}`。
- `/api/tasks` 和 `/api/skills` 均返回 200 + 空数组（数据库为空时）。

### I4: 前端 Social 降级测试

**步骤**:

1. 启动 agent-daemon (localhost:7420) 和 agentm-web (localhost:5200)。
2. 登录钱包，创建一条 post。
3. 点赞、关注另一个地址。
4. 刷新 Feed 页面。

**预期结果**:

- Post / Like / Follow 请求的 URL 均指向 `localhost:7420/api/*`。
- 数据在本地 SQLite 中持久化，刷新后仍能显示。
- Indexer (3001) 不应收到任何 `/api/social/*` 或 `/api/posts` 请求（如果前端已修复为全部发向 Daemon）。

---

## 5.4 安全测试场景

| #   | 攻击名称                 | 攻击方式                             | 预期防御                                      | 验证方法                      |
| --- | ------------------------ | ------------------------------------ | --------------------------------------------- | ----------------------------- |
| S1  | SQL 注入 (skills filter) | `?authority='; DROP TABLE tasks; --` | 返回空结果或 400，表不被删除                  | 集成测试后检查 `tasks` 表行数 |
| S2  | 过度分页 DoS             | `?limit=1000000`                     | 400 `INVALID_PAGINATION`                      | 自动化测试                    |
| S3  | Webhook 重放             | 重复发送相同的 webhook payload       | 幂等写入（同一 event 多次应用结果一致）或去重 | 两次 POST 后 DB 记录数不变    |
| S4  | 路径遍历 (protocol_id)   | `protocol_id = ../../../etc/passwd`  | 404 `PROTOCOL_NOT_FOUND`，不读取文件系统      | API 测试                      |

---

## 5.5 测试代码骨架

### 5.5.1 Rust 单元/集成测试 (`indexer/src/`)

```rust
// src/events.rs (新增 Chain Hub 测试)

#[cfg(test)]
mod chain_hub_tests {
    use super::*;

    // Happy Path
    #[test]
    fn decode_skill_registered_success() {
        // TODO: implement
    }

    #[test]
    fn decode_protocol_registered_success() {
        // TODO: implement
    }

    #[test]
    fn decode_invocation_created_and_completed() {
        // TODO: implement
    }

    // Boundary
    #[test]
    fn decode_unknown_discriminator_returns_none() {
        // TODO: implement
    }

    #[test]
    fn decode_truncated_payload_fails() {
        // TODO: implement
    }

    // Error
    #[test]
    fn decode_invalid_base64_fails() {
        // TODO: implement
    }
}
```

```rust
// tests/integration_test.rs (新增)

use gradience_indexer::db::Database;

#[tokio::test]
async fn webhook_skill_registered_flow() {
    // TODO: setup DB, send webhook, assert GET /api/skills
}

#[tokio::test]
async fn webhook_mixed_arena_and_chain_hub_events() {
    // TODO: send payload with both program logs, assert both tables updated
}

#[tokio::test]
async fn get_skills_pagination_boundary() {
    // TODO: assert limit=101 returns 400
}
```

### 5.5.2 前端 API 目标修正测试 (`agentm-web`)

```typescript
// apps/agentm-web/src/hooks/useSocial.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useSocial API target fix', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    it('H14: should call DAEMON_URL for follow', async () => {
        // TODO: mock fetch, call follow(), assert URL matches daemon base
    });

    it('H15: should call DAEMON_URL for feed', async () => {
        // TODO: mock fetch, call getFeed(), assert URL matches daemon base
    });

    it('H16: resolveIndexerBase should not switch services by env', () => {
        // TODO: assert resolveIndexerBase always returns unified indexer
    });
});
```

```typescript
// apps/agentm-web/src/app/utils.test.ts

import { describe, it, expect } from 'vitest';
import { resolveIndexerBase } from './utils';

describe('resolveIndexerBase', () => {
    it('should return production URL in production', () => {
        // TODO
    });

    it('should return localhost:3001 in development', () => {
        // TODO
    });
});
```

---

## 5.6 测试覆盖目标

| 指标                          | 目标                                                           |
| ----------------------------- | -------------------------------------------------------------- |
| Rust 语句覆盖率               | ≥ 80% (新增代码)                                               |
| Rust 分支覆盖率 (events + db) | ≥ 75%                                                          |
| 前端 hooks/API 测试           | 所有 `useSocial.ts` 方法至少 1 个 happy path + 1 个 error path |
| 集成测试场景                  | 4 个全部通过                                                   |
| 安全测试场景                  | 4 个全部通过                                                   |
| Docker E2E 启动               | `healthz` + `tasks` + `skills` 在 30s 内全部 200               |

---

## ✅ Phase 5 验收标准

- [x] 技术规格中的每个新增接口/函数都有对应测试用例
- [x] Happy Path + Boundary + Error 三类齐全
- [x] 安全测试场景已覆盖 SQL 注入、DoS、重放、路径遍历
- [x] 集成测试至少 4 个完整场景（Chain Hub 流、混合事件、Docker 启动、前端 Social 降级）
- [x] 前端 API 修正测试骨架已编写
- [x] 覆盖目标已定义

**验收通过后，进入 Phase 6: Implementation →**
