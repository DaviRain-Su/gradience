---
linear-id: GRA-225d
title: "[Web] Reputation Wallet UI Integration"
status: todo
priority: P1
project: "AgentM Web"
created: 2026-04-05
assignee: ""
tags: [task, p1, web, reputation, ui]
---

# GRA-225d: Reputation Wallet UI Integration

## Description

在 My Agent Tab 中集成声誉钱包显示，展示主钱包聚合声誉和各 Agent 声誉。

## Implementation

### 1. Master Wallet Reputation Card

**文件**: `apps/agentm-web/src/components/wallet/MasterReputationCard.tsx`

显示:
- 聚合声誉分数
- 等级徽章 (Bronze/Silver/Gold/Platinum)
- Agent 数量
- 总完成任务数
- 基于声誉的权限摘要

```
┌─ Master Wallet Reputation ─┐
│                            │
│  💎 Platinum               │
│  Score: 87/100             │
│                            │
│  Agents: 5                 │
│  Tasks Completed: 1,247    │
│                            │
│  Permissions:              │
│  • $1000 daily limit       │
│  • Auto-approval           │
│  • All chains              │
│                            │
└────────────────────────────┘
```

### 2. Agent Wallet List with Reputation

**文件**: 更新 `apps/agentm-web/src/app/app/page.tsx` MeView

在 Agent Wallet 列表中显示:
- 每个 wallet 的声誉分数
- 等级图标
- 完成的任务数
- 基于声誉的策略提示

### 3. Reputation Trend Chart

**文件**: `apps/agentm-web/src/components/wallet/ReputationTrend.tsx`

显示声誉历史趋势 (如果数据可用)。

## Acceptance Criteria

- [ ] MasterReputationCard 组件
- [ ] Agent list 显示声誉信息
- [ ] 声誉等级可视化
- [ ] 权限说明
- [ ] 响应式设计

## Dependencies

- GRA-225c (Aggregate Reputation API)
- `apps/agentm-web/src/hooks/useAggregatedReputation.ts`
