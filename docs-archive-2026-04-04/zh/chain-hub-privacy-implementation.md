# Chain Hub 隐私扩展：实施路线图

> **文档类型**: 技术实施计划  
> **日期**: 2026-04-03  
> **核心思路**: 极简 Kernel + 可选隐私层（通过 Chain Hub SDK 封装）  
> **技术栈**: Solana Confidential Transfers + Elusiv/ElGamal

---

## 1. 架构原则

### 核心设计

```
┌─────────────────────────────────────────────────────────────┐
│  Gradience Kernel（保持不变）                                │
│  ├── Escrow: 公开托管                                        │
│  ├── Judge: 公开评分（0-100）                                │
│  └── Reputation: 公开声誉积累                                │
│                                                              │
│  原则：竞争过程透明，结果可验证                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  Chain Hub SDK（新增隐私层）                                 │
│  ├── Privacy Plugin（可选）                                  │
│  │   ├── Confidential Settlement（隐藏金额）                │
│  │   ├── Shielded Identity（隐私身份）                      │
│  │   └── ZK Proof of Reputation（不暴露历史）               │
│  └── 开发者接口：一键启用隐私                                │
│                                                              │
│  原则：隐私是选项，不是必须                                   │
└─────────────────────────────────────────────────────────────┘
```

### 为什么这样设计？

| 层级 | 公开 | 隐私 | 原因 |
|------|------|------|------|
| **竞争过程** | ✅ | ❌ | 公平可验证，防止作弊 |
| **Judge 评分** | ✅ | ❌ | 透明评判，建立信任 |
| **声誉积累** | ✅ | 可选 | 公开证明能力，但可选择性披露 |
| **结算金额** | 可选 | ✅ | 防止竞争对手推测收入 |
| **Agent 身份** | 默认 | 可选 | 公开竞标 vs 隐私参与 |

---

## 2. 第一阶段：Confidential Settlement（2 周）

### 2.1 技术选型

**选择：Solana Token-2022 Confidential Transfers**

**原因**:
- ✅ 官方原生支持（2024 已上线）
- ✅ 速度快（sub-second finality）
- ✅ 有 Rust/JS SDK
- ✅ 支持 Auditor Key（合规友好）
- ✅ 与现有 SPL Token 兼容

**技术细节**:
```
ElGamal 同态加密 + ZK proofs
├── 隐藏：转账金额、余额、mint/burn
├── 保留：交易发生（时间戳、双方地址可选）
└── 审计：可选 auditor key 解密
```

### 2.2 SDK 接口设计

```typescript
// Chain Hub SDK - Privacy Extension

interface PrivacyConfig {
  level: 'public' | 'confidential' | 'anonymous';
  auditorKey?: PublicKey;  // 可选审计者（如 Judge）
  memo?: string;           // 加密备注
}

interface SettlementRequest {
  taskId: string;
  winner: AgentPubkey;
  judgeScore: number;      // 0-100，公开
  amount: BN;              // 金额（可能被隐藏）
  privacy: PrivacyConfig;
}

class GradienceChainHub {
  // 基础结算（公开）
  async settleTask(
    request: SettlementRequest
  ): Promise<TransactionSignature>;
  
  // 隐私结算（新增）
  async settleTaskPrivate(
    request: SettlementRequest
  ): Promise<ConfidentialSettlementResult>;
  
  // 查询结算（根据隐私级别）
  async getSettlement(
    taskId: string,
    decryptKey?: PrivateKey  // 需要密钥才能解密
  ): Promise<SettlementInfo | EncryptedSettlement>;
  
  // 生成审计报告（给 Judge/Poster）
  async generateAuditReport(
    taskIds: string[],
    auditorKey: PrivateKey
  ): Promise<AuditReport>;
}

// 使用示例
const hub = new GradienceChainHub(connection, programId);

// 场景 1：公开结算（默认）
await hub.settleTask({
  taskId: 'task-123',
  winner: agentPubkey,
  judgeScore: 95,
  amount: new BN(1000000000),  // 1 SOL
  privacy: { level: 'public' }
});

// 场景 2：隐私结算（隐藏金额）
await hub.settleTaskPrivate({
  taskId: 'task-456',
  winner: agentPubkey,
  judgeScore: 88,
  amount: new BN(5000000000),  // 5 SOL（隐藏）
  privacy: {
    level: 'confidential',
    auditorKey: judgePubkey    // Judge 可以审计
  }
});

// 场景 3：完全匿名（高级）
await hub.settleTaskPrivate({
  taskId: 'task-789',
  winner: stealthAddress,      // 一次性地址
  judgeScore: 92,
  amount: new BN(10000000000), // 10 SOL
  privacy: {
    level: 'anonymous',
    // 无 auditorKey = 完全私密
  }
});
```

### 2.3 实施步骤

**Week 1: 调研与原型**
- [ ] 阅读 Solana Confidential Transfer 官方文档
- [ ] 研究 Helius/QuickNode 的示例代码
- [ ] 在 devnet 部署测试合约
- [ ] 编写 ZK proof 生成逻辑

**Week 2: SDK 开发与测试**
- [ ] 封装 `settleTaskPrivate` 方法
- [ ] 集成 ElGamal 加密
- [ ] 编写单元测试
- [ ] 编写开发者文档

**关键代码片段**:
```rust
// Rust 端：Confidential Transfer 指令构建
use solana_sdk::instruction::Instruction;
use spl_token_2022::extension::confidential_transfer::instruction;

pub fn create_confidential_settle_ix(
    task_id: &str,
    winner: &Pubkey,
    encrypted_amount: &ElGamalCiphertext,
    proof: &ZkProof,
) -> Instruction {
    // 构建机密转账指令
    instruction::transfer(
        token_program_id,
        source_account,
        destination_account,
        authority,
        encrypted_amount,
        proof,
    )
}
```

---

## 3. 第二阶段：Shielded Identity（4 周）

### 3.1 技术选型

**选择：Elusiv + Stealth Addresses**

**原因**:
- ✅ 成熟的隐私身份方案
- ✅ TypeScript SDK 可用
- ✅ 与 Solana 原生兼容
- ✅ 支持选择性披露

### 3.2 SDK 接口设计

```typescript
interface AgentIdentity {
  publicId: string;          // 公开身份（可选）
  shieldedId: ShieldedId;    // 隐私身份
  reputationProof: ZkProof;  // 声誉证明（不暴露历史）
}

interface ShieldedRegistration {
  shieldedId: ShieldedId;
  reputationCommitment: Commitment;  // 声誉承诺（隐藏数值）
  capabilities: ZkProof[];          // 能力证明（零知识）
}

class GradienceIdentityHub {
  // 注册隐私身份
  async registerShielded(
    capabilities: string[]
  ): Promise<ShieldedRegistration>;
  
  // 隐私竞标（不暴露真实身份）
  async bidShielded(
    taskId: string,
    shieldedId: ShieldedId,
    reputationProof: ZkProof,  // 证明声誉 > X，但不暴露具体值
    bidAmount: BN
  ): Promise<ShieldedBid>;
  
  // 揭示身份（获胜后）
  async revealIdentity(
    taskId: string,
    revealKey: PrivateKey
  ): Promise<AgentPubkey>;
  
  // 生成声誉证明（ZK）
  async generateReputationProof(
    minReputation: number,     // 证明声誉 >= 这个值
    actualReputation: number   // 实际声誉（不暴露）
  ): Promise<ZkProof>;
}

// 使用示例
// 场景：Agent 想参与高价值任务，但不想暴露身份和收入
const identity = await hub.registerShielded(['rust', 'solana', 'defi']);

// 证明"我的声誉 > 80"，但不暴露具体值
const proof = await hub.generateReputationProof(80, 95);

// 用隐私身份竞标
await hub.bidShielded('high-value-task', identity.shieldedId, proof, amount);

// 获胜后揭示身份（结算用）
const realPubkey = await hub.revealIdentity('high-value-task', revealKey);
```

### 3.3 与 zCloak ATP 的集成点

```typescript
// 可选：与 ATP 互操作
interface ATPBridge {
  // 导入 zCloak AI-ID
  async importFromATP(aiId: ATP_AI_ID): Promise<AgentIdentity>;
  
  // 导出声誉到 ATP
  async exportReputationToATP(
    shieldedId: ShieldedId,
    reputationProof: ZkProof
  ): Promise<ATPCredential>;
}
```

---

## 4. 第三阶段：ZK Reputation（8 周）

### 4.1 高级功能

```typescript
interface ZkReputationQuery {
  // 查询："有没有声誉 >= 80 的 Agent？"
  // 返回：符合条件的 Agent 列表（不暴露具体声誉值）
  async queryAgentsByReputation(
    minReputation: number
  ): Promise<ShieldedAgent[]>;
  
  // 证明："我完成了 100+ 任务"
  // 不暴露具体任务细节
  async proveTaskCompletion(
    taskCount: number
  ): Promise<ZkProof>;
  
  // 聚合声誉（跨平台）
  async aggregateReputation(
    sources: Platform[]  // ['gradience', 'zcloak', 'helixa']
  ): Promise<AggregatedReputation>;
}
```

---

## 5. 开发者体验

### 5.1 一键启用隐私

```typescript
// 最简单的使用方式
const hub = new GradienceChainHub({
  connection,
  programId,
  privacy: {
    enabled: true,           // 启用隐私
    defaultLevel: 'confidential',
    auditor: judgePubkey     // 可选审计者
  }
});

// 之后所有结算自动使用隐私模式
await hub.settleTask({...});  // 自动变成 confidential
```

### 5.2 渐进式隐私

```typescript
// 场景：开发者不想一下子全隐私，可以渐进
const hub = new GradienceChainHub({
  privacy: {
    // 只有高价值任务用隐私
    conditionalPrivacy: {
      threshold: new BN(1000000000),  // > 1 SOL 自动隐私
      level: 'confidential'
    }
  }
});
```

---

## 6. 与 zCloak 的差异化定位

### 对比表

| 维度 | zCloak ATP | Gradience Chain Hub + Privacy |
|------|-----------|------------------------------|
| **定位** | 身份 + 隐私基础设施 | 市场 + 经济 + 可选隐私 |
| **核心** | "你是谁"（AI-ID） | "你做了什么"（Battle） |
| **隐私** | 强隐私（ZKP + ICP） | 可选隐私（Solana CT） |
| **场景** | 合规、KYC、企业 | 任务经济、竞争、结算 |
| **开发者** | 需要理解 ZKP | 一键启用，无感知 |
| **优势** | 身份可信、强隐私 | 经济激励、开箱即用 |

### 合作点

```
理想集成：
zCloak ATP（身份层）
    ↓
Gradience Chain Hub（市场层 + 可选隐私）
    ↓
Agent Arena（竞争 + 结算）

= 完整的"身份-市场-隐私"栈
```

---

## 7. X 宣传文案

### 主帖

```
We're making privacy optional, not mandatory.

Gradience Chain Hub now supports:
✅ Confidential settlements (hide amounts)
✅ Shielded identities (compete anonymously)
✅ ZK reputation proofs (prove ability without exposing history)

Built on Solana Token-2022 + ElGamal.
One SDK call: `settleTaskPrivate()`

Full privacy when you need it.
Full transparency when you don't.

The best of both worlds.

👇 Try it: github.com/DaviRain-Su/gradience
```

### 回复 @xiao_zcloak 的变体

```
@xiao_zcloak 你们的 ATP 是身份隐私层，我们在 Chain Hub 上加了经济隐私层。

结合一下：
- ATP: "你是谁"（AI-ID + ZKP）
- Gradience: "你做了什么"（Battle + Confidential settlement）

Agent 先用 ATP 证明身份，再用 Gradience 隐私赚钱。

完整的 Agent 信任栈 🙌
```

---

## 8. 实施时间表

| 阶段 | 功能 | 时间 | 里程碑 |
|------|------|------|--------|
| **Phase 1** | Confidential Settlement | 2 周 | SDK v0.1，支持隐藏金额 |
| **Phase 2** | Shielded Identity | 4 周 | SDK v0.2，支持隐私竞标 |
| **Phase 3** | ZK Reputation | 8 周 | SDK v1.0，完整隐私栈 |
| **Phase 4** | ATP Integration | 4 周 | 与 zCloak 互操作 |

---

## 9. 风险评估

| 风险 | 概率 | 应对 |
|------|------|------|
| Solana CT 性能问题 | 低 | 已在主网运行 2 年 |
| ZK proof 生成慢 | 中 | 用 WASM 优化，预计算 |
| 开发者学习成本 | 中 | 提供一键启用，渐进式 |
| 与 zCloak 冲突 | 低 | 明确定位互补 |

---

## 10. 下一步行动

### 今天
- [ ] 确认实施计划
- [ ] 创建 `chain-hub-privacy` 分支

### 本周
- [ ] 调研 Solana CT 官方文档
- [ ] 搭建 devnet 测试环境
- [ ] 编写第一阶段原型

### 下周
- [ ] 发 X 宣布隐私扩展计划
- [ ] 联系 @xiao_zcloak 探讨合作
- [ ] 更新 README 和文档

---

*文档状态: 草案 v0.1*  
*下一步: 确认 Phase 1 开始时间*
