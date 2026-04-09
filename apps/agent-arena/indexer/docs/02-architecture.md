# Phase 2: Architecture — agent-arena/indexer

> **引用**: 项目级架构见 `docs/02-architecture.md`

---

## 架构概览

```
Solana Chain
    │
    ├── Triton Dragon's Mouth ──→ POST /webhook/triton
    ├── Helius Webhook ──────────→ POST /webhook/helius
    └── Generic ─────────────────→ POST /webhook/events
                                       │
                                       ▼
                              ┌─────────────────┐
                              │  Indexer (Rust)  │
                              │  ┌───────────┐  │
                              │  │ events.rs  │  │  ← 解析 8 种事件
                              │  └─────┬─────┘  │
                              │        ▼        │
                              │  ┌───────────┐  │
                              │  │  db.rs     │  │  ← PostgreSQL 持久化
                              │  └─────┬─────┘  │
                              │        ▼        │
                              │  ┌───────────┐  │
                              │  │ main.rs    │  │  ← REST API + WebSocket
                              │  └───────────┘  │
                              └─────────────────┘
                                  │         │
                                  ▼         ▼
                            REST API    WebSocket
                           (查询)      (实时推送)
```

## 数据流

1. Solana program 发出事件日志
2. Webhook 提供商（Triton/Helius）将交易数据推送到 Indexer
3. `events.rs` 按 discriminator 解析为 8 种事件类型
4. `db.rs` 写入 PostgreSQL（tasks, submissions, reputations, profiles, judge_pools）
5. REST API 供前端/CLI 查询
6. WebSocket 向订阅客户端实时推送新事件

## 技术选型

| 组件   | 选择                        | 原因                               |
| ------ | --------------------------- | ---------------------------------- |
| 语言   | Rust + Tokio                | 高性能异步，与 Program 共享类型    |
| HTTP   | Axum                        | 轻量、类型安全、WebSocket 原生支持 |
| 数据库 | PostgreSQL (tokio-postgres) | 无 ORM，直接 SQL，最大控制力       |
| Edge   | Cloudflare Worker           | 可选的 webhook 代理层              |
