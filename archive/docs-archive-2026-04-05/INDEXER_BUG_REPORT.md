# Indexer API Bug 报告

**日期**: 2026-04-04  
**服务器**: 64.23.248.73:3001  
**状态**: ❌ 有 Bug 需要修复

---

## 🧪 测试结果

| 端点                              | 状态   | 说明           |
| --------------------------------- | ------ | -------------- |
| `GET /healthz`                    | ✅ 200 | 正常           |
| `GET /metrics`                    | ✅ 200 | 正常           |
| `GET /api/tasks`                  | ❌ 500 | 数据库类型错误 |
| `GET /api/tasks/1`                | ❌ 500 | 数据库类型错误 |
| `GET /api/agents/{id}/profile`    | ❌ 500 | 数据库类型错误 |
| `GET /api/agents/{id}/reputation` | ❌ 500 | 数据库类型错误 |
| `GET /api/reputation/{id}`        | ❌ 500 | 数据库类型错误 |
| `GET /api/judge-pool/{id}`        | ❌ 500 | 数据库类型错误 |

---

## ❌ 错误详情

### 错误 1: `character varying = smallint`

```
GET /api/tasks
Error: operator does not exist: character varying = smallint
```

**原因**: Indexer 代码试图用 smallint 查询 state 字段，但 state 是 varchar(20) 类型

### 错误 2: `i64 vs int4`

```
GET /api/tasks/1
Error: cannot convert between Rust type 'i64' and Postgres type 'int4'
```

**原因**: Indexer 代码使用 i64 查询 task_id，但 task_id 是 integer 类型

---

## 🔧 根本原因

**Indexer Rust 代码中的类型定义与 PostgreSQL Schema 不匹配**:

| 字段     | PostgreSQL 类型 | Rust 类型 | 匹配 |
| -------- | --------------- | --------- | ---- |
| task_id  | integer (i32)   | i64       | ❌   |
| state    | varchar(20)     | smallint  | ❌   |
| category | integer (i32)   | ?         | ?    |

---

## 🛠️ 修复方案

### 方案 1: 修复 Rust 代码（推荐）

修改 `apps/agent-arena/indexer/src/db.rs`:

- 将 `task_id` 查询参数从 `i64` 改为 `i32`
- 将 `state` 查询参数从 `smallint` 改为 `String`

然后重新构建 Docker 镜像：

```bash
cd /opt/gradience/apps/agent-arena
docker build -f indexer/Dockerfile -t gradience/indexer:latest .
docker restart gradience-indexer
```

### 方案 2: 修改数据库 Schema

将 PostgreSQL 表结构改为匹配 Rust 代码：

```sql
ALTER TABLE tasks ALTER COLUMN task_id TYPE bigint;
ALTER TABLE tasks ALTER COLUMN state TYPE smallint;
```

**不推荐** - 需要修改种子数据

---

## 📝 当前状态总结

- ✅ Indexer 服务正在运行
- ✅ 数据库连接正常
- ✅ 种子数据已插入 (4 tasks)
- ❌ API 查询由于类型不匹配而失败

**需要修复 Indexer 代码中的类型定义**

---

## 🔗 相关文件

- Indexer 源码: `apps/agent-arena/indexer/src/`
- Database 模块: `apps/agent-arena/indexer/src/db.rs`
- Schema: `apps/chain-hub/indexer/migrations/001_initial_schema.sql`
