---
linear-id: GRA-225a
title: '[Daemon] Chain Hub Reputation Integration'
status: todo
priority: P1
project: 'Agent Daemon'
created: 2026-04-05
assignee: ''
tags: [task, p1, daemon, reputation, chain-hub]
---

# GRA-225a: Chain Hub Reputation Integration

## Description

在 Daemon 中集成 Chain Hub Indexer，获取 Agent 声誉数据。

## Implementation

**File**: `apps/agent-daemon/src/integrations/chain-hub-reputation.ts`

```typescript
interface ChainHubReputationClient {
    // 获取 Agent 声誉
    getReputation(agentAddress: string): Promise<{
        score: number;
        completedTasks: number;
        avgRating: number;
        updatedAt: string;
    }>;

    // 获取 Master Wallet 下所有 Agent 的声誉
    getReputationsByMaster(masterWallet: string): Promise<
        Array<{
            agentAddress: string;
            score: number;
            completedTasks: number;
        }>
    >;
}
```

**Chain Hub API**:

```
GET /api/agents/{address}/reputation
GET /api/agents?master={masterWallet}&includeReputation=true
```

## Acceptance Criteria

- [ ] ChainHubReputationClient 实现
- [ ] 缓存机制 (5分钟 TTL)
- [ ] 错误降级处理
- [ ] 单元测试

## Dependencies

- Chain Hub Indexer 部署并可用
- GRA-193 (Indexer 接入真实数据)
