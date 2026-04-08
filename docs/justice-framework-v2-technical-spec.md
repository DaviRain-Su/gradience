# Phase 3: Technical Spec — Justice Framework v2

> **输入**: Gradience Protocol PRD + Architecture docs  
> **日期**: 2026-04-08  
> **版本**: v0.1  
> **关联任务**: GRA-261, GRA-262, GRA-263, GRA-264, GRA-265  
> ⚠️ **代码必须与本文档 100% 一致。**

---

## 1. 概述

Justice Framework v2 是对 Gradience 协议信任层的三层防御升级，解决三个核心问题：

1. **Agent 作恶**：Sybil 攻击、洗钱钱包、接任务不交付
2. **Poster 作恶**：发布钓鱼任务、恶意评判、不支付
3. **Judge 作恶**：偏袒、收贿、随机判决（v1 已通过 VRF 轮换部分解决）

### 1.1 设计原则

| 原则 | 说明 |
|------|------|
| **Defense in Depth** | 不依赖单一机制，链上行为 + 身份绑定 + 合约博弈三层叠加 |
| **Privacy-Preserving** | 身份验证结果用 ZK 或哈希上链，不暴露原始 PII |
| **Economically Rational** | 攻击成本必须显著高于攻击收益 |
| **Gradual Trust** | 新用户可低门槛进入，但高价值任务逐步解锁 |

---

## 2. 三层防御架构

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: 合约博弈层 (Contract Game Theory)                    │
│  - Escrow 强制锁定 reward                                      │
│  - Poster / Agent / Judge 三方 Stake + Slashing               │
│  - Dispute + Appeal 二次裁决                                   │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: 身份反 Sybil 层 (Identity & Anti-Sybil)              │
│  - Wallet ↔ Account 唯一绑定                                   │
│  - Social OAuth / ZK-KYC / Proof-of-Humanity                 │
│  - 换绑冷却期 + 设备指纹风控                                    │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: 链上行为预检层 (On-Chain Risk Oracle)                │
│  - GoldRush / Nansen / Arkham 地址标签查询                     │
│  - 钱包年龄、资金来源、恶意合约交互、混币器关联                 │
│  - 生成 RiskScore，接入 applyForTask 准入控制                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Layer 1: OnChain Risk Scorer (GRA-261)

### 3.1 职责

在 Agent `applyForTask` 之前，对 Agent 钱包进行链上风险预检，阻止高风险地址进入任务池。

### 3.2 核心数据类型

```typescript
// apps/agent-daemon/src/risk/onchain-risk-scorer.ts

export interface RiskSignal {
  source: 'goldrush' | 'nansen' | 'arkham' | 'chainalysis' | 'internal';
  category: 'mixer' | 'hack' | 'phish' | 'sanctions' | 'bot' | 'new_wallet';
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string; // tx hash, label, or API reference
}

export interface RiskScore {
  wallet: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-100, higher = riskier
  signals: RiskSignal[];
  checkedAt: number;
}

export interface RiskPolicy {
  maxScoreForApplication: number;
  blockedCategories: RiskSignal['category'][];
  minWalletAgeDays: number;
  minTransactionCount: number;
}
```

### 3.3 检查维度与权重（MVP）

| 检查项 | 权重 | 数据来源 | 红灯行为 |
|--------|------|---------|---------|
| 混币器关联 | 30 | GoldRush `tornado_cash` tag | 任何 direct inflow |
| 被盗资金 | 30 | GoldRush / Arkham alert | 与已知 exploit tx 关联 |
| 制裁名单 | 40 | Chainalysis / OFAC | 地址命中 sanctions list |
| 钱包年龄 | 15 | First tx timestamp | < 14 days |
| 交易活跃度 | 10 | Tx count | < 5 tx |
| 合约交互红旗 | 15 | Known phishing contract | 任何授权或交互 |

### 3.4 模块设计

```typescript
export class OnChainRiskScorer {
  constructor(
    private goldrushApiKey: string,
    private policy: RiskPolicy
  ) {}

  async assess(wallet: string, chain: 'solana' | 'ethereum'): Promise<RiskScore>;
  
  // 内部方法
  private async fetchGoldrushLabels(wallet: string, chain: string): Promise<RiskSignal[]>;
  private async fetchTransactionHistory(wallet: string, chain: string): Promise<{ ageDays: number; txCount: number }>;
  private calculateScore(signals: RiskSignal[], ageDays: number, txCount: number): number;
}
```

### 3.5 接入点

**AgentM Web**: 在 `useTaskApply.ts` 中，调用前检查：
```typescript
const risk = await riskScorer.assess(agentWallet, chain);
if (risk.score > policy.maxScoreForApplication) {
  throw new TaskApplyRejectedError(`Risk score ${risk.score} exceeds threshold`);
}
```

**AgentArenaEVM / Solana Program**: Oracle 签名将 RiskScore 作为可选字段写入 application data。合约不直接调用外部 API，但可读取 Oracle 签名的 Risk 摘要。

### 3.6 缓存策略

- 每个钱包风险分缓存 24 小时（Redis / SQLite）
- 被标记为 `critical` 的钱包缓存 7 天

---

## 4. Layer 2: Anti-Sybil & Identity Binding (GRA-262 / GRA-265)

### 4.1 核心目标

确保一个真实身份对应一个 Gradience 账户，防止同一人创建大量钱包接任务刷量。

### 4.2 账户绑定模型

```
Gradience Account (1)
    ├── Primary Wallet (1) — 不可同时绑定多个账户
    ├── Linked Wallets (N) — 只读/提现，不能接任务
    └── Identity Proofs (1-N)
            ├── OAuth Hash (Google)
            ├── ZK-KYC Nullifier (WorldID / Holonym)
            └── Social Graph Endorsements
```

### 4.3 合约/表设计

```typescript
// apps/agent-daemon/src/identity/account-binding.ts

export interface AccountBindingRecord {
  accountId: string; // Gradience internal UUID
  primaryWallet: string;
  linkedWallets: string[];
  oauthHash?: string; // SHA256(email) — 可验证但不暴露邮箱
  zkNullifier?: string; // WorldID / Holonym nullifier
  createdAt: number;
  lastWalletChangeAt: number;
}
```

### 4.4 关键规则

| 规则 | 实现 |
|------|------|
| **主钱包唯一性** | `primaryWallet` 全局唯一索引 |
| **换绑冷却期** | 更换 primary wallet 需等待 30 天 |
| **OAuth 唯一性** | 同一个 `oauthHash` 只能绑定一个 account |
| **ZK Nullifier 唯一性** | 同一个 `zkNullifier` 只能绑定一个 account |
| **设备指纹风控** | 同设备/IP 短时间内大量注册触发 rate limit |

### 4.5 分阶段验证策略

```typescript
export interface VerificationTier {
  tier: 'guest' | 'verified' | 'trusted' | 'pro';
  requirements: {
    walletAgeDays: number;
    oauth: boolean;
    zkKyc: boolean;
    minCompletedTasks: number;
    minReputationScore: number;
  };
  permissions: {
    maxTaskValue: bigint;
    canBeJudge: boolean;
    canPostHighValueTask: boolean;
  };
}

const DEFAULT_TIERS: VerificationTier[] = [
  {
    tier: 'guest',
    requirements: { walletAgeDays: 0, oauth: false, zkKyc: false, minCompletedTasks: 0, minReputationScore: 0 },
    permissions: { maxTaskValue: 0.1e18, canBeJudge: false, canPostHighValueTask: false },
  },
  {
    tier: 'verified',
    requirements: { walletAgeDays: 7, oauth: true, zkKyc: false, minCompletedTasks: 0, minReputationScore: 0 },
    permissions: { maxTaskValue: 1e18, canBeJudge: false, canPostHighValueTask: true },
  },
  {
    tier: 'trusted',
    requirements: { walletAgeDays: 14, oauth: true, zkKyc: false, minCompletedTasks: 3, minReputationScore: 60 },
    permissions: { maxTaskValue: 10e18, canBeJudge: true, canPostHighValueTask: true },
  },
  {
    tier: 'pro',
    requirements: { walletAgeDays: 30, oauth: true, zkKyc: true, minCompletedTasks: 10, minReputationScore: 75 },
    permissions: { maxTaskValue: 100e18, canBeJudge: true, canPostHighValueTask: true },
  },
];
```

### 4.6 ZK-KYC 集成（GRA-265）

- **Provider**: WorldID (Orb) 或 Holonym
- **链上验证**: 合约只存储 `nullifierHash`，证明用户已完成唯一性验证
- **隐私**: 不存储护照/身份证，只存“这个真人已通过一次”的零知识证明摘要
- **触发条件**: 任务 value > tier threshold 时，前端提示用户完成 ZK-KYC

---

## 5. Layer 3: Poster Reputation + Dispute (GRA-263)

### 5.1 当前缺失

现有 `AgentArenaEVM` 只记录 Agent reputation，Poster 发布任务后几乎不受约束。

### 5.2 Poster Reputation 扩展

新增 `PosterProfile` 状态到 `AgentArenaEVM`：

```solidity
struct PosterProfile {
    uint256 tasksPosted;
    uint256 tasksCompleted;
    uint256 tasksDisputed;
    uint256 successfulRefunds;
    uint256 avgReward;
    uint64 lastPostedAt;
    uint8 reputationTier; // 0-3
    bool exists;
}

mapping(address => PosterProfile) public posterProfiles;
```

#### Poster Reputation Tier 规则

| Tier | 条件 | 后果 |
|------|------|------|
| 0 (New) | tasksPosted < 3 | 必须 escrow 110% reward |
| 1 (Regular) | 3+ tasks, < 5% disputed | 正常 escrow 100% |
| 2 (Trusted) | 10+ tasks, < 2% disputed | 可降低 escrow 到 95% |
| 3 (Elite) | 50+ tasks, < 1% disputed | 优先曝光 + 降低 minStake 要求 |

### 5.3 Dispute & Appeal 机制

#### 流程图

```
JudgeAndPay(第一轮 Judge 裁决)
    └── Agent 不满意，在 judgeDeadline + 24h 内发起 Dispute
            └── DisputeCommittee (第二轮随机 3 名 Judge) 重新审阅
                    └── 2/3 多数决
                            ├── Poster 恶意 → Poster stake slashed, Agent 获补偿
                            └── Agent 恶意 → Agent stake slashed, Judge 获补偿
```

#### 合约扩展

```solidity
struct Dispute {
    uint256 taskId;
    address appellant; // Agent who disputes
    bytes32 reasonHash; // IPFS hash of dispute evidence
    uint8 originalScore;
    uint8 finalScore;
    bool overturned;
    uint64 createdAt;
    uint64 resolvedAt;
    DisputeState state;
}

enum DisputeState { None, Pending, Resolved }

mapping(uint256 => Dispute) public disputes;

function raiseDispute(uint256 taskId, bytes32 reasonHash) external payable nonReentrant;
function resolveDispute(uint256 taskId, address winner, uint8 finalScore) external;
```

#### Staking 要求

| 角色 | Dispute Stake | 结果 |
|------|--------------|------|
| Appellant (Agent) | 0.05 ether / 0.5 SOL | 胜诉退还 + 50% Poster slash 奖励；败诉没收 |
| Poster | 自动锁定 task reward 的 10% | 败诉时 10% 补偿 Agent + 5% 补偿 Committee |
| Dispute Committee | 无（获得协议发放的 dispute fee 作为激励） |

### 5.4 Dispute Committee 选择

- 使用 VRF（GRA-207 的 `VRFJudgeSelector`）从 **非原 Judge 的 JudgePool** 中随机选 3 人
- 2/3 多数决后自动执行 `resolveDispute`
- Committee 成员获得固定 `disputeFee` 的 60% 平分，协议保留 40%

---

## 6. 数据流与交互图

### 6.1 Agent 首次注册 + 接任务流程

```
Agent Wallet
    ├── 1. OnChainRiskScorer.assess(wallet)
    │       └── RiskScore (cached 24h)
    ├── 2. AccountBinding.bind(wallet, oauthHash)
    │       └── check: wallet not bound, oauthHash not bound
    ├── 3. VerificationTierResolver.resolve(wallet, riskScore, reputation)
    │       └── tier = 'verified' | 'trusted' | etc.
    └── 4. applyForTask(taskId)
            ├── Contract checks: tier.permission.maxTaskValue >= task.reward
            ├── Contract checks: riskScore <= policy.maxScore
            └── Application accepted
```

### 6.2 Poster 发布任务 + Agent 交付 + Dispute 流程

```
Poster
    ├── postTask(reward, escrow)
    │       └── PosterProfile updated
    ├── Agent.submitResult()
    ├── Judge.judgeAndPay(taskId, agent, score)
    │       └── TaskState = Completed or Refunded
    └── (optional) Agent.raiseDispute(taskId, evidence)
                └── VRF selects DisputeCommittee (3 Judges)
                        └── Committee.resolveDispute()
                                └── Slashing / Compensation executed
```

---

## 7. API 接口规范

### 7.1 Risk Scorer API

```typescript
// POST /api/v1/risk/assess
interface RiskAssessRequest {
  wallet: string;
  chain: 'solana' | 'ethereum';
}

interface RiskAssessResponse {
  wallet: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  signals: RiskSignal[];
  cacheHit: boolean;
  checkedAt: number;
}
```

### 7.2 Identity Binding API

```typescript
// POST /api/v1/identity/bind
interface BindRequest {
  primaryWallet: string;
  oauthToken: string; // server exchanges for hash
  signature: string; // wallet signs nonce
}

// POST /api/v1/identity/zk-verify
interface ZKVerifyRequest {
  wallet: string;
  nullifierHash: string;
  proof: string;
}
```

### 7.3 Dispute API

```typescript
// POST /api/v1/disputes
interface CreateDisputeRequest {
  taskId: string;
  reason: string;
  evidenceCid: string;
}

// GET /api/v1/disputes/:taskId
interface DisputeResponse {
  taskId: string;
  state: 'pending' | 'resolved';
  committee: string[];
  originalScore: number;
  finalScore?: number;
  overturned?: boolean;
}
```

---

## 8. 安全与隐私考量

| 威胁 | 缓解措施 |
|------|---------|
| **API key 泄露** (GoldRush/Nansen) | 服务端代理，Web 不直接调用 |
| **隐私泄露** (OAuth 邮箱) | 只存 SHA256 hash，原始 token 不落地 DB |
| **ZK 证明重放** | nullifier 全局唯一，合约记录已使用 |
| **Dispute Committee 串通** | VRF 随机选 + 与原 Judge 隔离 + 2/3 多数 |
| **Poster 刷好评** | 只有自己接自己任务的 score 不计入 reputation（用 graph analysis 检测自交易） |
| **Agent 故意接高价值任务失败** | tier 逐步解锁，新 Agent 无法接 >$100 任务 |

---

## 9. 实现顺序与里程碑

### Milestone 1: Layer 1 MVP (GRA-261) — Week 1
- [ ] 集成 GoldRush SDK，实现 `OnChainRiskScorer`
- [ ] `/api/v1/risk/assess` 端点
- [ ] 接入 `useTaskApply` 前端流程

### Milestone 2: Layer 2 Binding + Tier (GRA-262) — Week 1-2
- [ ] `AccountBinding` SQLite 表 + API
- [ ] Wallet 换绑冷却期
- [ ] `VerificationTierResolver`
- [ ] 接入 `postTask` / `applyForTask` 权限检查

### Milestone 3: Layer 3 Contract Extension (GRA-263) — Week 2-3
- [ ] `AgentArenaEVM.PosterProfile` + tier logic
- [ ] `raiseDispute` / `resolveDispute` 合约函数
- [ ] Dispute Committee VRF 选择集成
- [ ] Foundry test coverage

### Milestone 4: ZK-KYC Gate (GRA-265) — Week 3-4
- [ ] WorldID / Holonym SDK 集成
- [ ] 前端 KYC 提示弹窗
- [ ] 合约 `zkNullifier` 记录与校验

---

## 10. 验收标准

- [ ] 高风险钱包无法在 AgentM Web 成功 `applyForTask`
- [ ] 同一 primary wallet / oauth hash 只能绑定一个 Gradience 账户
- [ ] Poster 信誉分影响 escrow 比例和任务发布的 minStake
- [ ] Dispute 流程端到端可执行（raise → committee → resolve → slash/transfer）
- [ ] 所有新增合约函数有 Foundry 测试覆盖 > 80%
- [ ] 所有新增 API 端点有 Supertest 集成测试
