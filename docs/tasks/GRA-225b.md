---
linear-id: GRA-225b
title: "[Daemon] Auto-Apply Reputation Policy on Wallet Creation"
status: todo
priority: P1
project: "Agent Daemon"
created: 2026-04-05
assignee: ""
tags: [task, p1, daemon, reputation, policy, ows]
---

# GRA-225b: Auto-Apply Reputation Policy on Wallet Creation

## Description

创建 OWS Wallet 时，自动获取 Agent 声誉并应用对应的策略。

## Implementation

**File**: `apps/agent-daemon/src/wallet/ows-wallet-manager.ts`

修改 `createWallet()` 方法:

```typescript
async createWallet(input: CreateWalletInput): Promise<Wallet> {
  // 1. 创建钱包
  const wallet = await this.createWalletInternal(input);
  
  // 2. 获取声誉 (新增)
  const reputation = await this.chainHubReputation.getReputation(
    input.agentAddress
  );
  
  // 3. 计算策略 (新增)
  const policy = calculatePolicyFromReputation(reputation.score);
  
  // 4. 创建声誉策略 (新增)
  const policyRecord = await this.policyEngine.createPolicy({
    name: `Reputation-Derived: ${policy.tier}`,
    walletId: wallet.id,
    rules: convertToDaemonRules(policy),
  });
  
  // 5. 存储声誉关联 (新增)
  await this.walletStore.update(wallet.id, {
    reputationScore: reputation.score,
    reputationTier: policy.tier,
    policyId: policyRecord.id,
  });
  
  return wallet;
}
```

## Acceptance Criteria

- [ ] 创建钱包时自动获取声誉
- [ ] 根据声誉自动设置策略
- [ ] 存储声誉分数和 tier
- [ ] 返回包含声誉信息的 wallet 对象

## Dependencies

- GRA-225a (Chain Hub Reputation Integration)
- GRA-220 (Policy Engine)

## Related

- `apps/agentm-web/src/lib/ows/reputation-policy.ts` - 策略计算逻辑
