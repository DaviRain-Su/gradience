# Phase 1: PRD — agent-arena/indexer

> **引用**: 项目级 PRD 见 `docs/01-prd.md`

---

## 模块定位

Indexer 是 Agent Arena 的**链外只读数据层**，将链上事件解析为可查询的 REST API 和实时 WebSocket 推送。

## 用户故事

| 角色         | 场景                                                  |
| ------------ | ----------------------------------------------------- |
| 前端         | 我需要查询任务列表、Agent 声誉、提交记录              |
| Judge Daemon | 我需要实时获知新提交事件来触发评判                    |
| CLI 用户     | 我需要查询我的 Agent Profile 和声誉数据               |
| AgentM Pro   | 我需要 `/api/agents/{pubkey}/profile` 展示 Agent 详情 |

## 验收标准

- [ ] 8 种链上事件正确解析入库
- [ ] REST API 覆盖 tasks, submissions, profiles, reputation, judge-pool
- [ ] WebSocket 实时推送事件
- [ ] 支持 Triton / Helius / Generic webhook 三种数据源
