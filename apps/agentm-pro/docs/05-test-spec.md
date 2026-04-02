# Phase 5: Test Spec — AgentM Pro

> **目的**: 定义 AgentM Pro 各组件的测试策略和验收用例
> **输入**: `03-technical-spec.md` + `04-task-breakdown.md`
> **输出物**: 本文档
> **日期**: 2026-04-03

---

## 5.1 测试策略

| 层 | 工具 | 运行环境 |
|----|------|---------|
| SDK 单元测试 | `tsx --test` + node:test | Node.js（无浏览器） |
| CLI 单元测试 | `tsx --test` + node:test | Node.js + mock SDK |
| Dashboard 组件 | 手动验证（无 E2E 框架） | 浏览器 |
| Indexer API | curl / E2E 脚本 | Docker + PostgreSQL |
| Profile Studio | `tsx --test` + E2E 脚本 | Node.js + Indexer |
| 端到端集成 | `scripts/e2e-w2-integration.ts` | 全栈 |

---

## 5.2 SDK 测试（已有 20 tests）

### 现有覆盖

| 测试文件 | 场景数 | 覆盖范围 |
|----------|--------|---------|
| `sdk.test.ts` | 20 | getTasks, getTask, getReputation, judgePool, attestations, config, postSimple, submitTaskResult |

### 新增测试（Profile 相关）

| # | 场景 | 输入 | 预期输出 |
|---|------|------|---------|
| S-01 | getAgentProfile 返回 Profile | pubkey 有 Profile | `{ display_name, bio, links, tags }` |
| S-02 | getAgentProfile 无 Profile 返回 null | pubkey 无记录 | `null` |
| S-03 | updateAgentProfile 成功更新 | 有效 Profile JSON | `{ ok: true }` |
| S-04 | updateAgentProfile 拒绝空 display_name | `display_name: ""` | 错误 |

---

## 5.3 CLI 测试（已有 13 tests）

### 现有覆盖

| 测试文件 | 场景数 | 覆盖范围 |
|----------|--------|---------|
| `gradience.test.ts` | 13 | task post/apply/submit/judge/cancel/refund/status, judge register/unstake, NO_DNA 输出 |

### 新增测试（Profile 命令）

| # | 场景 | 命令 | 预期输出 |
|---|------|------|---------|
| C-01 | profile show 返回当前 Profile | `gradience profile show` | JSON 格式 Profile |
| C-02 | profile update 更新 display_name | `gradience profile update --name "Alice"` | `{ ok: true }` |
| C-03 | NO_DNA profile show 输出纯 JSON | `NO_DNA=1 gradience profile show` | 结构化 JSON |

---

## 5.4 Profile Studio 测试

### Indexer Profile API

| # | 场景 | 方法 + 路径 | 预期 |
|---|------|------------|------|
| P-01 | GET profile 存在 | `GET /api/agents/{pubkey}/profile` | 200 + Profile JSON |
| P-02 | GET profile 不存在 | `GET /api/agents/{unknown}/profile` | 404 |
| P-03 | PUT profile 成功 | `PUT /api/agents/{pubkey}/profile` + auth | 200 + `{ ok: true }` |
| P-04 | PUT profile 无认证被拒 | `PUT /api/agents/{pubkey}/profile` 无 auth | 401 |
| P-05 | PUT profile 无效字段被拒 | `display_name` 超长 | 400 |

### 链上引用一致性

| # | 场景 | 预期 |
|---|------|------|
| P-06 | Profile 保存后链上 hash 匹配 | `AgentProfile.metadata_uri_hash == sha256(profile_json)` |
| P-07 | Profile 更新后链上 hash 更新 | 修改 bio → 链上 hash 变化 |

### AgentM 消费端

| # | 场景 | 预期 |
|---|------|------|
| P-08 | AgentM 详情 Modal 显示 display_name | Profile 有 display_name 时显示 |
| P-09 | AgentM 详情 Modal 无 Profile 时显示 pubkey | 降级显示 |

---

## 5.5 Dashboard 测试

| # | 页面 | 场景 | 预期 |
|---|------|------|------|
| D-01 | / (首页) | 钱包已连接 | 显示 Agent Overview（声誉/收入/任务） |
| D-02 | / (首页) | 钱包未连接 | 显示 "Connect Wallet" 提示 |
| D-03 | / (首页) | Indexer 离线 | 显示 "Indexer offline" |
| D-04 | /profile | 编辑并保存 | 数据持久化，刷新后仍在 |
| D-05 | /tasks/[id] | 查看任务详情 | 提交列表正确，Judge 按钮条件显示 |

---

## 5.6 端到端集成测试

### 已有（12 tests）

`scripts/e2e-w2-integration.ts`:
- Indexer health (2)
- Indexer REST API (6)
- SDK → Indexer (4)

### 新增（Profile 闭环）

| # | 场景 | 步骤 | 预期 |
|---|------|------|------|
| E-01 | Profile 发布闭环 | CLI update → Indexer GET → AgentM 详情 | 三层数据一致 |
| E-02 | Profile 链上引用 | CLI update → SDK getAgentProfile → 链上 hash | hash 一致 |

---

## 5.7 Agent 模板测试（P1）

| # | 场景 | 预期 |
|---|------|------|
| T-01 | `gradience create-agent my-agent` | 生成目录结构正确 |
| T-02 | 生成项目 `npm install` | 依赖安装成功 |
| T-03 | 生成项目 `npm start` | 启动成功（连接 devnet） |

---

## 5.8 测试覆盖目标

| 组件 | 现有 | 新增 | 目标 |
|------|------|------|------|
| SDK | 20 | 4 | 24 |
| CLI | 13 | 3 | 16 |
| Profile API | 0 | 7 | 7 |
| Dashboard | 0 | 5（手动） | 5 |
| E2E | 12 | 2 | 14 |
| Agent 模板 | 0 | 3 | 3 |
| **合计** | **45** | **24** | **69** |

---

## ✅ Phase 5 验收标准

- [x] 每个组件（SDK/CLI/Profile/Dashboard/E2E）都有测试用例
- [x] Happy Path + Boundary + Error 三类覆盖
- [x] Profile Studio 闭环测试（编辑→保存→链上→消费）
- [x] 与 Phase 4 任务一一对应
- [x] 测试工具和运行环境已明确
