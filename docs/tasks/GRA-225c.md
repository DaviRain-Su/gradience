---
linear-id: GRA-225c
title: '[Daemon] Aggregate Reputation API Endpoints'
status: todo
priority: P1
project: 'Agent Daemon'
created: 2026-04-05
assignee: ''
tags: [task, p1, daemon, reputation, api]
---

# GRA-225c: Aggregate Reputation API Endpoints

## Description

实现聚合声誉查询 API，供 Web 端使用。

## Implementation

**File**: `apps/agent-daemon/src/api/routes/ows-reputation.ts`

### 端点 1: 获取钱包声誉

```typescript
// GET /api/v1/ows/wallets/:id/reputation
interface WalletReputationResponse {
    walletId: string;
    agentAddress: string;
    reputationScore: number;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    completedTasks: number;
    avgRating: number;
    policy: {
        dailyLimitUsd: number;
        allowedChains: string[];
        autoApprove: boolean;
    };
    updatedAt: string;
}
```

### 端点 2: 获取聚合声誉

```typescript
// GET /api/v1/ows/wallets/master/:address/aggregate-reputation
interface AggregateReputationResponse {
    masterWallet: string;
    aggregateScore: number; // 加权平均
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    agentCount: number;
    totalCompletedTasks: number;
    agents: Array<{
        walletId: string;
        address: string;
        handle: string;
        reputationScore: number;
        tier: string;
        completedTasks: number;
        weight: number; // 用于聚合计算
    }>;
}
```

## 聚合计算逻辑

```typescript
function calculateAggregateScore(agents: AgentReputation[]): number {
    const totalWeight = agents.reduce((sum, a) => sum + a.completedTasks, 0);

    const weightedScore = agents.reduce((sum, a) => {
        const weight = a.completedTasks / totalWeight;
        return sum + a.reputationScore * weight;
    }, 0);

    return Math.round(weightedScore);
}
```

## Acceptance Criteria

- [ ] GET /api/v1/ows/wallets/:id/reputation
- [ ] GET /api/v1/ows/wallets/master/:address/aggregate-reputation
- [ ] 正确的聚合计算
- [ ] 缓存优化
- [ ] 认证和权限检查

## Dependencies

- GRA-225a (Chain Hub Reputation Integration)
- GRA-225b (Auto-Apply Policy)

## Related

- `apps/agentm-web/src/hooks/useAggregatedReputation.ts` - Web 端使用
