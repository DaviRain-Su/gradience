# Phase 3: Technical Spec — Unified Gradience Indexer

> **模块**: `apps/agent-arena/indexer/` (将作为统一 Indexer 服务运行)  
> **目标**: 将 `chain-hub/indexer-service` 的功能合并到 `agent-arena/indexer`，消除本地/生产 Indexer 不一致的问题，并修复前端 API 调用目标。  
> **部署名称**: `gradience-indexer:latest`  
> **对外 URL**: `https://api.gradiences.xyz/indexer/` (生产) / `http://localhost:3001` (本地)

---

## 3.1 数据结构定义

### 3.1.1 链下数据结构 — 统一数据库 Schema

统一 Indexer 使用单一 PostgreSQL 数据库，包含以下表：

#### 原有 Agent Arena 表

```sql
-- 任务
CREATE TABLE tasks (
    task_id BIGINT PRIMARY KEY,
    poster TEXT NOT NULL,
    judge TEXT NOT NULL,
    judge_mode SMALLINT NOT NULL,
    reward BIGINT NOT NULL,
    mint TEXT NOT NULL,
    min_stake BIGINT NOT NULL,
    state SMALLINT NOT NULL,
    category SMALLINT NOT NULL,
    eval_ref TEXT NOT NULL,
    deadline BIGINT NOT NULL,
    judge_deadline BIGINT NOT NULL,
    submission_count SMALLINT DEFAULT 0,
    winner TEXT,
    created_at BIGINT NOT NULL,
    slot BIGINT NOT NULL
);

CREATE INDEX idx_tasks_state ON tasks(state);
CREATE INDEX idx_tasks_category ON tasks(category);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_tasks_poster ON tasks(poster);

-- 提交
CREATE TABLE submissions (
    task_id BIGINT NOT NULL,
    agent TEXT NOT NULL,
    result_ref TEXT NOT NULL,
    trace_ref TEXT NOT NULL,
    runtime_provider TEXT NOT NULL,
    runtime_model TEXT NOT NULL,
    runtime_runtime TEXT NOT NULL,
    runtime_version TEXT NOT NULL,
    submission_slot BIGINT NOT NULL,
    submitted_at BIGINT NOT NULL,
    PRIMARY KEY (task_id, agent)
);

CREATE INDEX idx_submissions_agent ON submissions(agent);

-- 声誉汇总
CREATE TABLE reputations (
    agent TEXT PRIMARY KEY,
    global_avg_score INTEGER NOT NULL DEFAULT 0,
    global_win_rate INTEGER NOT NULL DEFAULT 0,
    global_completed INTEGER NOT NULL DEFAULT 0,
    global_total_applied INTEGER NOT NULL DEFAULT 0,
    total_earned BIGINT NOT NULL DEFAULT 0,
    updated_slot BIGINT NOT NULL DEFAULT 0
);

-- 分类声誉
CREATE TABLE reputation_by_category (
    agent TEXT NOT NULL,
    category SMALLINT NOT NULL,
    avg_score INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (agent, category)
);

-- Agent Profile
CREATE TABLE agent_profiles (
    agent TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    website TEXT,
    github TEXT,
    x TEXT,
    onchain_ref TEXT,
    publish_mode TEXT NOT NULL DEFAULT 'manual',
    updated_at BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_agent_profiles_updated_at ON agent_profiles(updated_at DESC);

-- 评委池成员
CREATE TABLE judge_pool_members (
    category SMALLINT NOT NULL,
    judge TEXT NOT NULL,
    stake BIGINT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    updated_slot BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (category, judge)
);

CREATE INDEX idx_judge_pool_category_active ON judge_pool_members(category, active);
```

#### 新增 Chain Hub 表

```sql
-- 技能
CREATE TABLE skills (
    skill_id        BIGINT PRIMARY KEY,
    authority       VARCHAR(44) NOT NULL,
    judge_category  SMALLINT NOT NULL DEFAULT 0,
    status          SMALLINT NOT NULL DEFAULT 0, -- 0=active, 1=paused
    name            VARCHAR(32) NOT NULL,
    metadata_uri    VARCHAR(128) NOT NULL,
    created_at      BIGINT NOT NULL,
    slot            BIGINT NOT NULL
);

CREATE INDEX idx_skills_status ON skills(status);
CREATE INDEX idx_skills_category ON skills(judge_category);
CREATE INDEX idx_skills_authority ON skills(authority);

-- 协议
CREATE TABLE protocols (
    protocol_id         VARCHAR(32) PRIMARY KEY,
    authority           VARCHAR(44) NOT NULL,
    protocol_type       SMALLINT NOT NULL DEFAULT 0,
    trust_model         SMALLINT NOT NULL DEFAULT 0,
    auth_mode           SMALLINT NOT NULL DEFAULT 0,
    status              SMALLINT NOT NULL DEFAULT 0, -- 0=active, 1=paused
    capabilities_mask   BIGINT NOT NULL DEFAULT 0,
    endpoint            VARCHAR(128) NOT NULL DEFAULT '',
    docs_uri            VARCHAR(128) NOT NULL DEFAULT '',
    program_id          VARCHAR(44) NOT NULL DEFAULT '11111111111111111111111111111111',
    idl_ref             VARCHAR(128) NOT NULL DEFAULT '',
    created_at          BIGINT NOT NULL,
    slot                BIGINT NOT NULL
);

CREATE INDEX idx_protocols_status ON protocols(status);
CREATE INDEX idx_protocols_type ON protocols(protocol_type);
CREATE INDEX idx_protocols_authority ON protocols(authority);

-- 版税收益
CREATE TABLE royalties (
    agent           VARCHAR(44) PRIMARY KEY,
    total_earned    BIGINT NOT NULL DEFAULT 0,
    total_paid      BIGINT NOT NULL DEFAULT 0,
    balance         BIGINT NOT NULL DEFAULT 0,
    updated_slot    BIGINT NOT NULL DEFAULT 0
);

-- 调用记录
CREATE TABLE invocations (
    invocation_id   BIGINT PRIMARY KEY,
    task_id         BIGINT NOT NULL,
    requester       VARCHAR(44) NOT NULL,
    skill_id        BIGINT NOT NULL REFERENCES skills(skill_id),
    protocol_id     VARCHAR(32) NOT NULL REFERENCES protocols(protocol_id),
    agent           VARCHAR(44) NOT NULL,
    judge           VARCHAR(44) NOT NULL,
    amount          BIGINT NOT NULL DEFAULT 0,
    status          SMALLINT NOT NULL DEFAULT 0, -- 0=pending, 1=completed, 2=failed
    royalty_amount  BIGINT NOT NULL DEFAULT 0,
    created_at      BIGINT NOT NULL,
    completed_at    BIGINT,
    slot            BIGINT NOT NULL
);

CREATE INDEX idx_invocations_agent ON invocations(agent);
CREATE INDEX idx_invocations_skill ON invocations(skill_id);
CREATE INDEX idx_invocations_protocol ON invocations(protocol_id);
CREATE INDEX idx_invocations_status ON invocations(status);
CREATE INDEX idx_invocations_created ON invocations(created_at DESC);
```

### 3.1.2 配置与常量

| 常量名 | 值 | 类型 | 说明 | 可变性 |
|--------|----|------|------|--------|
| `AGENT_ARENA_PROGRAM_ID` | `5CUY2V1odYZghA54WH7YQRPzh3JaKhe1S84CRbeKfVYs` | `&str` | Agent Arena program | immutable |
| `CHAIN_HUB_PROGRAM_ID` | `6G39W7JGQz7A6L5dAvotFuRP9UbFdCJg2BqDuj6WJWec` | `&str` | Chain Hub program | immutable |
| `A2A_PROTOCOL_PROGRAM_ID` | `FPaeaqQCziLidnwTtQndUB1SiaqBuBUad6UCnshfMd3H` | `&str` | A2A protocol program | immutable (预留) |
| `DEFAULT_BIND_ADDR` | `0.0.0.0:3001` | `&str` | HTTP 监听地址 | configurable |
| `DEFAULT_SOLANA_WS_URL` | `wss://api.devnet.solana.com` | `&str` | WebSocket RPC | configurable |
| `TRITON_STALE_AFTER_SECONDS` | `30` | `u64` | Webhook 超时阈值 | configurable |

---

## 3.2 接口定义

### 3.2.1 REST API — Agent Arena (保留)

**`GET /api/tasks`**
```
Query:
  ?state={open|completed|refunded}
  &category={u8}
  &mint={string}
  &poster={string}
  &limit={default:20}
  &offset={u32}
  &page={u32}
  &sort={task_id_desc|task_id_asc|newest|deadline|reward}

Response 200:
  {
    "tasks": [TaskApi],
    "total": number,
    "limit": number,
    "offset": number
  }
```

**`GET /api/tasks/{task_id}`**
```
Response 200: TaskApi (单个任务详情)
Response 404: { "error": "task_not_found" }
```

**`GET /api/tasks/{task_id}/submissions`**
```
Query: ?sort={submitted_at_desc|score_desc}
Response 200: { "submissions": [SubmissionApi] }
```

**`GET /api/agents/{pubkey}/profile`**
```
Response 200: AgentProfileApi
Response 404: { "error": "profile_not_found" }
```

**`GET /api/agents/{pubkey}/reputation`**
```
Response 200: ReputationApi
```

**`GET /api/reputation/{agent}`** (legacy)
```
Response 200: ReputationApi (兼容旧版)
```

**`GET /api/judge-pool/{category}`**
```
Response 200: { "category": number, "members": [JudgePoolEntryApi] }
```

### 3.2.2 REST API — Chain Hub (新增)

**`GET /api/skills`**
```
Query:
  ?status={0|1}
  &category={smallint}
  &authority={string}
  &limit={default:20}
  &offset={u32}
  &page={u32}

Response 200:
  {
    "skills": [SkillApi],
    "total": number,
    "limit": number,
    "offset": number
  }
```

**`GET /api/skills/{skill_id}`**
```
Response 200: SkillApi
Response 404: { "error": "skill_not_found" }
```

**`GET /api/protocols`**
```
Query:
  ?status={0|1}
  &protocol_type={0|1}
  &authority={string}
  &limit={default:20}
  &offset={u32}
  &page={u32}

Response 200:
  {
    "protocols": [ProtocolApi],
    "total": number,
    "limit": number,
    "offset": number
  }
```

**`GET /api/protocols/{protocol_id}`**
```
Response 200: ProtocolApi
Response 404: { "error": "protocol_not_found" }
```

**`GET /api/royalties/{agent}`**
```
Response 200: RoyaltyApi
Response 404: { "error": "royalty_not_found" }
```

**`GET /api/invocations`**
```
Query:
  ?agent={string}
  &skill_id={i64}
  &protocol_id={string}
  &status={pending|completed|failed}
  &limit={default:20}
  &offset={u32}
  &page={u32}

Response 200:
  {
    "invocations": [InvocationApi],
    "total": number,
    "limit": number,
    "offset": number
  }
```

**`GET /api/invocations/{invocation_id}`**
```
Response 200: InvocationApi
Response 404: { "error": "invocation_not_found" }
```

### 3.2.3 Webhook 端点（公共）

所有 webhook 端点接收 Triton / Helius / Generic 推送的交易日志，并根据日志中的 `program_id` 将事件路由到对应的解析器。

- `POST /webhook/triton`
- `POST /webhook/helius`
- `POST /webhook/events`
- `POST /webhook/profile-sync` (保留，用于 Agent Profile 同步)

### 3.2.4 WebSocket 端点

- `GET /ws` — 统一事件推送流（包含 Arena + Chain Hub 事件）
- `GET /ws/tasks` — 向后兼容的任务事件子流

### 3.2.5 前端修复清单（API 调用目标修正）

| 前端文件 | 当前行为 | 修复后行为 |
|---------|---------|-----------|
| `apps/agentm-web/src/hooks/useSocial.ts` | 所有 Social 请求发给 `INDEXER_URL` (`/api/social/*`) | 全部改为 `DAEMON_URL`，路径前缀去掉 `/social/` |
| `apps/agentm-web/src/hooks/useDiscoverAgents.ts` | 调用 `/api/agents` 并声称来自 Chain Hub Indexer | 确认调用目标为统一 Indexer `/api/agents`，或改为调用 Daemon |
| `apps/agentm-web/src/app/app/MainAppLazy.tsx` | 混合使用 `resolveIndexerBase()`，本地/生产指向不同服务 | `resolveIndexerBase()` 始终指向统一 Indexer（`localhost:3001` 或 `api.gradiences.xyz/indexer`） |
| `apps/agentm-web/src/hooks/useOWSAgentRouter.ts` | `indexerBase` 用于 `/api/agents/sub-wallet`、`/api/agents/route-signature` | 两个端点需在统一 Indexer 中实现，或改为 Daemon 端点 |

**Social API 路由映射表**（前端 → Daemon）：

| 前端旧路径 | Daemon 正确路径 | 方法 |
|-----------|----------------|------|
| `/api/social/follow` | `/api/follow` | POST |
| `/api/social/unfollow` | `/api/unfollow` | POST |
| `/api/social/posts` | `/api/posts` | POST |
| `/api/social/posts/delete` | `/api/posts/:id` (带 delete 逻辑) 或新路由 `/api/posts/:id/delete` | DELETE/POST |
| `/api/social/feed/{addr}` | `/api/feed?author={addr}` 或保持 `/api/feed` | GET |
| `/api/social/feed/global` | `/api/feed` | GET |
| `/api/social/posts/like` | `/api/posts/:id/like` | POST |
| `/api/social/followers/{target}` | `/api/followers/:target` | GET |
| `/api/social/following/{target}` | `/api/following/:target` | GET |
| `/api/social/notifications/{addr}` | **新增** `/api/notifications/:addr` (Daemon) | GET |
| `/api/social/notifications/{addr}/unread` | **新增** `/api/notifications/:addr/unread` (Daemon) | GET |
| `/api/social/notifications/{addr}/read` | **新增** `/api/notifications/:addr/read` (Daemon) | POST |

> **决策**: 如果 Daemon 尚未实现 notifications 路由，则在 Daemon 的 `social.ts` 中新增，而不是在 Indexer 中实现。

---

## 3.3 错误码定义

| 错误码 | 名称 | 触发条件 | 用户提示 |
|--------|------|---------|---------|
| `4000` | `INVALID_TASK_ID` | task_id 格式错误或 <= 0 | "Invalid task ID" |
| `4001` | `INVALID_SKILL_ID` | skill_id 格式错误或 <= 0 | "Invalid skill ID" |
| `4002` | `INVALID_INVOCATION_ID` | invocation_id 格式错误或 <= 0 | "Invalid invocation ID" |
| `4003` | `INVALID_PROTOCOL_ID` | protocol_id 为空 | "Invalid protocol ID" |
| `4004` | `INVALID_PAGINATION` | limit > 100 或 page/offset 非法 | "Invalid pagination parameters" |
| `4005` | `INVALID_CATEGORY` | category 值超出 u8 范围 | "Invalid category" |
| `4040` | `TASK_NOT_FOUND` | task_id 不存在 | "Task not found" |
| `4041` | `SKILL_NOT_FOUND` | skill_id 不存在 | "Skill not found" |
| `4042` | `PROTOCOL_NOT_FOUND` | protocol_id 不存在 | "Protocol not found" |
| `4043` | `INVOCATION_NOT_FOUND` | invocation_id 不存在 | "Invocation not found" |
| `4044` | `AGENT_NOT_FOUND` | pubkey 未注册 profile/reputation | "Agent not found" |
| `4045` | `ROYALTY_NOT_FOUND` | agent 无版税记录 | "Royalty record not found" |
| `5000` | `INTERNAL_ERROR` | 数据库或解析异常 | "Internal server error" |

---

## 3.4 状态机精确定义

### 任务状态 (Agent Arena)

| 当前状态 | 触发动作 | 条件 | 新状态 | 副作用 |
|---------|---------|------|--------|--------|
| Open | `postTask()` | — | Open | 创建任务记录 |
| Open | `applyForTask()` | stake >= min_stake | Open | 记录申请者 |
| Open | `submitResult()` | 已申请 | Open | 增加 submission_count |
| Open | `judgeAndPay()` | Judge 评分 | Completed | 更新 winner, state=1 |
| Open | `refundExpired()` | deadline 过期 | Refunded | state=2, 退款 |
| Open | `cancelTask()` | poster 调用 | Refunded | state=2, 退款 |
| Completed | — | — | Completed | 不可变更 |
| Refunded | — | — | Refunded | 不可变更 |

### 调用状态 (Chain Hub)

| 当前状态 | 触发动作 | 条件 | 新状态 | 副作用 |
|---------|---------|------|--------|--------|
| Pending | `invokeSkill()` | — | Pending | 创建 invocation |
| Pending | `completeInvocation()` | success=true | Completed | status=1, 更新 royalty |
| Pending | `completeInvocation()` | success=false | Failed | status=2 |
| Completed | — | — | Completed | 不可变更 |
| Failed | — | — | Failed | 不可变更 |

---

## 3.5 算法与计算

### 收益分配 (Agent Arena)

```
agent_payout    = reward * 9500 / 10000   // 95%
judge_fee       = reward *  300 / 10000   // 3%
protocol_fee    = reward *  200 / 10000   // 2%

// 验证：agent_payout + judge_fee + protocol_fee <= reward
// 精度：整数除法，向下取整；剩余 wei 归 agent_payout
```

### Webhook 事件路由算法

```rust
fn route_events_by_program(logs: &[String], program_id: &str) -> Result<Vec<EventEnvelope>> {
    match program_id {
        AGENT_ARENA_PROGRAM_ID => parse_arena_events_from_logs(logs),
        CHAIN_HUB_PROGRAM_ID   => parse_chain_hub_events_from_logs(logs),
        _ => Ok(vec![]), // 忽略未知 program
    }
}
```

> **注**: Triton/Helius webhook payload 中通常包含触发交易的 `account_keys[0]` 或 `program_id` 字段。如果 webhook 无法直接提供 program_id，则需要在日志中通过 `Program <ID> invoke` 行来推断。

---

## 3.6 安全规则

| 规则 | 实现方式 | 验证方法 |
|------|---------|--------- |
| 参数化查询防 SQL 注入 | 所有 SQL 使用 `tokio-postgres` 参数化查询 | 集成测试 + 源码审计 |
| Webhook 来源验证 | Triton/Helius 签名验证（未来扩展） |  currently 不验证，留接口 |
| 分页上限限制 | `limit` 最大 100 | 单元测试 |
| ID 参数校验 | 所有 ID 路径参数经过 `validate_task_id` 等校验函数 | 单元测试 |
| CORS 配置 | 由 nginx 统一配置，Indexer 本身不处理跨域 | 配置文件审计 |

---

## 3.7 升级与迁移

由于 `agent-arena/indexer` 现有的 PostgreSQL 数据库需要新增 Chain Hub 表，迁移策略如下：

1. **新增 migration 文件**: `apps/agent-arena/indexer/migrations/0005_chain_hub_tables.sql`
   - 包含 `skills`, `protocols`, `royalties`, `invocations` 的 CREATE TABLE / INDEX 语句。
2. **Docker Compose 启动时自动执行**: `docker-compose.yml` 中通过 `volumes` 将 `migrations/` 挂载到 Postgres 容器的 `/docker-entrypoint-initdb.d/`。
3. **现有数据保留**: Arena 表（tasks, submissions, reputations 等）数据完全保留，不受影响。
4. **Chain Hub 数据冷启动**: Chain Hub 的事件历史不会被回溯索引。新表从部署时刻开始接收 webhook 事件。如需历史数据，需额外运行一次性 backfill 脚本（不在本次范围内）。

---

## 3.8 边界条件清单

| # | 边界条件 | 预期行为 | 备注 |
|---|---------|---------|------|
| 1 | `limit = 0` | 返回空数组，total 正常 | 允许 |
| 2 | `limit = 101` (> max) | 返回 `INVALID_PAGINATION` (4004) | 硬上限 100 |
| 3 | `offset` 超过 total | 返回空数组 | 正常行为 |
| 4 | `task_id = 0` | 返回 `INVALID_TASK_ID` (4000) | 路径参数校验 |
| 5 | `skill_id = -1` | 返回 `INVALID_SKILL_ID` (4001) | 路径参数校验 |
| 6 | Webhook payload 为空 | 忽略，返回 204 | 不报错 |
| 7 | Webhook 包含未知 program 日志 | 忽略未知事件，只解析匹配的事件 | 正常行为 |
| 8 | 数据库连接断开 | REST API 返回 `INTERNAL_ERROR` (5000)，待连接恢复 | 需健康检查捕获 |
| 9 | `created_at` / `completed_at` 为 NULL | `completed_at` 可为 NULL；`created_at` 不可为 NULL | Schema 约束 |
| 10 | `amount` / `reward` = 0 | 允许 0，但 UI 应提示 "Free task" | 业务层处理 |
| 11 | `protocol_id` 包含非法字符 | 返回 `INVALID_PROTOCOL_ID` (4003) | 正则校验 `[a-zA-Z0-9_-]+` |
| 12 | `invocations` 中 `skill_id` 或 `protocol_id` 外键不存在 | 写入时如遇外键冲突，跳过该 invocation 并记录 warn | 防止乱序事件 |

---

## 3.9 部署方案

### Docker Compose (本地)

`apps/agent-arena/indexer/docker-compose.yml` 保持不变，但确保：
- `migrations/` 目录包含 `0005_chain_hub_tables.sql`
- 端口映射 `3001:3001`

### Nginx (生产)

`deploy/nginx-api.conf` 保持不变：
- `api.gradiences.xyz/indexer/` → `127.0.0.1:3001`
- `indexer.gradiences.xyz` → `127.0.0.1:3001`

### 生产 docker-compose.prod.yml

`deploy/docker-compose.prod.yml` 中的 `indexer` 服务需要：
1. **构建上下文改为 `agent-arena/indexer`**（不再是 `chain-hub/indexer-service`）
2. **Migration 挂载改为 `apps/agent-arena/indexer/migrations`**
3. **Image 名称保持 `gradience/indexer:latest`**

修改内容：
```yaml
  indexer:
    build:
      context: ../apps/agent-arena/indexer
      dockerfile: Dockerfile
    image: gradience/indexer:latest
    # ... 其他 env 和端口保持不变
```

---

## ✅ Phase 3 验收标准

- [x] 所有数据结构精确到字段类型和字节大小
- [x] 所有接口有完整的参数、返回值、错误码定义
- [x] 错误码统一编号，无遗漏
- [x] 状态机转换条件精确，无歧义
- [x] 所有计算有伪代码/公式，精度处理已说明
- [x] 安全规则已从架构文档映射到具体实现
- [x] 边界条件已列出（>= 10 个）
- [x] 前端 API 调用修复清单已明确
- [x] 部署迁移方案已定义
- [x] 本文档可以直接交给任何开发者（或 AI），不需要额外口头解释即可实现
