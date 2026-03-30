# Agent Arena 文档整理说明

## 整理目标

将 `agent-arena/docs/` 中关于**高层思考层面**的文档，整合到 `gradience` 仓库，形成类似比特币白皮书的极简文档结构。

## 文档映射关系

### 已整合进 WHITEPAPER.md 的内容

| Agent Arena 文档 | 整合到 WHITEPAPER 章节 | 主要内容 |
|-----------------|----------------------|---------|
| `vision.md` | 第三章、第九章 | 三层协议栈、终局愿景 |
| `principles.md` | 第二章 | 竞争作为贪心算法、极简设计哲学 |
| `vision-arena.md` | 第七章、第九章 | 从 MVP 到基础设施的演化路径 |
| `ecosystem.md` | 第五章 | 与 Virtuals 等项目的定位关系 |

### 保持独立的实现文档（留在 agent-arena）

| 文档 | 保留位置 | 原因 |
|------|---------|------|
| `design/observability-design.md` | `agent-arena/docs/design/` | 具体实现细节 |
| `design/observability-implementation.md` | `agent-arena/docs/design/` | 工程实现指南 |
| `design/tighter-feedback-loop.md` | `agent-arena/docs/design/` | Sandbox 开发体验 |
| `design/v2-tech-selection.md` | `agent-arena/docs/design/` | 技术选型分析 |
| `design/absurd-sandbox-analysis.md` | `agent-arena/docs/design/` | 工具评估 |
| `design/architecture.md` | `agent-arena/docs/design/` | 详细架构文档 |
| `research/staking.md` | `agent-arena/docs/research/` | 质押机制研究 |
| `API.md` | `agent-arena/docs/` | API 文档 |
| `openapi.yaml` | `agent-arena/docs/` | OpenAPI 规范 |
| `demo-day-script.md` | `agent-arena/docs/` | 演示脚本 |

### 已移动到 gradience/research/ 的研究文档

| 文档 | 新位置 | 主题 |
|------|--------|------|
| `research/analysis.md` | `gradience/research/` | 竞品分析 |
| `research/db9-analysis.md` | `gradience/research/` | DB9 项目分析 |
| `research/change-review.md` | `gradience/research/` | 变更审查 |
| `research/final-review.md` | `gradience/research/` | 最终审查 |

## WHITEPAPER.md 结构

```
摘要
第一章：问题陈述
  - 新的经济主体
  - 基础设施缺失
  - 我们要解决的问题

第二章：核心设计哲学
  - 竞争作为验证机制
  - 极简原则
  - 为什么简单重要

第三章：三层协议栈
  - Chain Hub（工具层）
  - Agent Arena（市场层）
  - A2A 协议（网络层）

第四章：经济模型
  - 比特币式设计
  - 任务奖励机制
  - 双轨经济（能力+质押）

第五章：与其他项目的关系
  - 竞品对比
  - 与 Virtuals 的关系
  - 差异化优势

第六章：技术实现
  - 核心合约（4 个函数）
  - 协议消息（4 种类型）

第七章：路线图
  - MVP 到愿景
  - 演化路径

第八章：为什么是区块链

第九章：结论
  - 一句话总结
  - 核心设计原则

附录 A：核心概念定义
附录 B：与其他方案对比
附录 C：参考文献
```

## 关键设计决策

### 1. 为什么要整理？

**之前的问题：**
- `agent-arena/docs/design/` 有 10+ 个文档，分散且重复
- 新读者不知道该从哪开始
- 没有统一的叙事主线

**现在的改进：**
- 一个 `WHITEPAPER.md` 讲清楚整体愿景
- 每个章节有明确主题，不重复
- 类似比特币白皮书，简洁有力

### 2. 什么是"高层思考"？

**保留在 WHITEPAPER 的（Why & What）：**
- 为什么需要这个项目？
- 核心设计哲学是什么？
- 终局愿景是什么？
- 与其他项目的关系？

**保留在 agent-arena 的（How）：**
- 具体怎么实现？
- 技术选型细节
- API 设计
- 代码架构

### 3. 双轨文档策略

```
gradience/                    ← 愿景层（Why）
├── WHITEPAPER.md            ← 整体愿景（类似比特币白皮书）
├── README.md                ← 项目介绍
├── research/                ← 深度研究
│   ├── ai-native-protocol-design.md
│   ├── minimal-agent-economy-bitcoin-style.md
│   └── ...
└── ...

agent-arena/                  ← 实现层（How）
├── docs/
│   ├── design/              ← 详细设计文档
│   │   ├── observability-design.md
│   │   ├── architecture.md
│   │   └── ...
│   └── research/            ← 早期研究（可选移动）
├── contracts/               ← 智能合约代码
├── frontend/                ← 前端代码
└── ...
```

## 使用建议

### 对于新读者

1. **先看** `gradience/WHITEPAPER.md` — 理解整体愿景
2. **再看** `gradience/README.md` — 了解项目结构
3. **深入** `gradience/research/` — 阅读具体研究
4. **实现** 参考 `agent-arena/docs/design/` — 查看详细设计

### 对于开发者

1. **理解架构** — 阅读 `WHITEPAPER.md` 第三章
2. **查看 API** — 阅读 `agent-arena/docs/API.md`
3. **了解实现** — 阅读 `agent-arena/docs/design/architecture.md`
4. **运行代码** — 查看 `agent-arena/` 代码

### 对于研究者

1. **理论基础** — 阅读 `WHITEPAPER.md` 第二章、第四章
2. **竞品分析** — 阅读 `gradience/research/` 相关文档
3. **经济模型** — 阅读 `minimal-agent-economy-bitcoin-style.md`
4. **GAN 机制** — 阅读 `anthropic-gan-comparison.md`

## 后续维护

### WHITEPAPER.md 更新原则

- **只更新高层愿景和哲学**
- **不添加具体实现细节**
- **重大设计变更时才更新**
- **版本号管理（v0.1, v0.2...）**

### Agent Arena 文档更新原则

- **实现细节文档保持最新**
- **API 变更及时更新**
- **技术选型变化时更新 design/ 文档**

## 总结

通过这次整理：
- ✅ 形成了清晰的"愿景-实现"分层
- ✅ WHITEPAPER.md 类似比特币白皮书，简洁有力
- ✅ Agent Arena 保留实现细节，便于开发
- ✅ 读者知道从哪里开始阅读

---

*整理日期：2026-03-29*
*整理者：OpenClaw Agent*
