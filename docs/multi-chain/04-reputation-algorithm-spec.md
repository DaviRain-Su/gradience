# Gradience 信誉评分算法规范 v1.0

> **文档状态**: 草案 (Draft)  
> **创建日期**: 2026-04-06  
> **关联文档**:
>
> - `02-architecture.md` 多链架构设计
> - `03-reputation-oracle-spec.md` Reputation Oracle 技术规范  
>   **适用范围**: Gradience Reputation Oracle 链下计算层

---

## 1. 设计原则

### 1.1 核心信条

1. **链下计算，链上验证**: 复杂算法在 Oracle 层执行，链上仅验证密码学证明和存储结果。
2. **可解释性优先**: 每个分数都必须能追溯到具体的指标和原始数据。
3. **模块化权重**: 不同场景允许使用不同的权重模板，但基础指标保持一致。
4. **抗操纵性**: 算法设计必须考虑 Sybil 攻击、刷分、历史包袱等风险。
5. **跨链统一**: Solana 是协议核心链，所有声誉事件在此生成；Reputation Oracle 将标准化分数通过桥接传递至 Base / Arbitrum 等 EVM 客链。

### 1.2 非目标

- 本规范**不**定义合约层面的存储结构（见 `03-reputation-oracle-spec.md`）。
- 本规范**不**定义前端展示逻辑。
- 本规范**不**保证算法的"公平性"绝对无争议，但保证其"一致性"和"可审计性"。

---

## 2. 架构定位

```
┌─────────────────────────────────────────────────────────────┐
│              Gradience Reputation Oracle                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Reputation Algorithm Engine (本规范)          │  │
│  │  • 读取多链原始数据                                   │  │
│  │  • 计算 8 维度 / 24 指标                              │  │
│  │  • 合成 overallScore + confidence                     │  │
│  │  • 生成 Merkle Proof                                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Submission Layer                            │  │
│  │  • ERC-8004 Registry                                  │  │
│  │  • GradienceReputationFeed (链上验证)                 │  │
│  │  • Off-Chain API Cache                                │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**关键约束**: 合约层**不允许**直接执行本规范中的复杂计算。合约只允许：

- 验证 Oracle 签名
- 验证 Merkle Inclusion Proof
- 验证 `overallScore` 是否等于各维度按**默认权重**加权的结果（可选校验）
- 存储最终结果

---

## 3. 维度与指标总览

| 维度     | 英文              | 默认权重 | 指标数 | 性质            |
| -------- | ----------------- | -------- | ------ | --------------- |
| 任务表现 | Performance       | 30%      | 4      | 正向激励        |
| 活跃度   | Activity          | 15%      | 4      | 正向激励        |
| 经济投入 | Economic Stake    | 15%      | 4      | 正向激励        |
| 可靠性   | Reliability       | 15%      | 4      | 正向激励 + 惩罚 |
| 专业能力 | Domain Expertise  | 10%      | 4      | 按类别细分      |
| 社交网络 | Social Graph      | 7.5%     | 4      | 正向激励        |
| 安全性   | Security          | 5%       | 4      | 惩罚性          |
| 时间趋势 | Temporal Dynamics | 2.5%     | 4      | 动态调节        |

**总计**: 8 个维度，24 个底层指标。

---

## 4. 原始数据输入

### 4.1 单链原始数据

```typescript
interface ChainReputationData {
    chainId: string; // "solana" | "base" | "arbitrum" | ...
    agentAddress: string; // 链原生地址格式

    // 任务统计
    totalApplied: number; // 申请任务总数
    totalCompeted: number; // 参与竞速任务数
    totalCompleted: number; // 完成任务数
    totalWon: number; // 获胜任务数（竞速模式）
    totalCancelled: number; // 取消/退出任务数
    totalLate: number; // 逾期交付数

    // 评分统计
    totalRated: number; // 被评委评分的任务数
    sumScores: number; // 所有评分总和 (0-100 each)
    sumScoresSq: number; // 评分平方和（用于计算方差）

    // 经济统计
    totalEarned: string; //  bigint string (wei/lamports)
    totalStaked: string; //  bigint string
    totalEscrowed: string; //  bigint string (参与任务的总金额)

    // 争议统计
    totalDisputes: number; // 被争议次数
    disputesWon: number; // 争议胜诉次数

    // 时间统计
    firstActivityAt: number; // Unix timestamp (ms)
    lastActivityAt: number; // Unix timestamp (ms)

    // 类别统计 (8 categories)
    categoryStats: CategoryStat[];
}

interface CategoryStat {
    categoryId: number; // 0-7
    applied: number;
    completed: number;
    won: number;
    sumScores: number;
    sumScoresSq: number;
    firstActivityAt: number;
    lastActivityAt: number;
}
```

### 4.2 跨链聚合数据

```typescript
interface AggregatedAgentData {
    agentId: string; // ERC-8004 agentId
    solanaAddress?: string;
    evmAddress?: string;

    chains: ChainReputationData[];

    // 跨链聚合值
    globalApplied: number;
    globalCompleted: number;
    globalWon: number;
    globalEarned: bigint;
    globalStaked: bigint;
    globalDisputes: number;
    globalDisputesWon: number;
    firstGlobalActivity: number;
    lastGlobalActivity: number;

    // 社交图数据 (来自 AgentM Core)
    followersCount: number;
    endorsementsReceived: number;
    networkPageRank: number;
    delegationsCompleted: number;
    delegationsSuccessRate: number;

    // 安全数据 (来自反作弊系统)
    sybilRiskScore: number; // 0-1
    behaviorAnomalyScore: number; // 0-1
    botPatternScore: number; // 0-1
    isBlacklisted: boolean;
}
```

---

## 5. 维度详解与计算公式

> 所有中间指标在计算前先做**截断处理**：`clamp(x, 0, 1)`，除非另有说明。

### 5.1 维度 1: 任务表现 (Performance) — 权重 30%

**定义**: Agent 完成任务的核心能力和质量。

#### 指标

| 指标       | 符号 | 计算方式                                                                 |
| ---------- | ---- | ------------------------------------------------------------------------ |
| 完成率     | `CR` | `globalCompleted / max(globalApplied, 1)`                                |
| 平均质量分 | `AQ` | `globalSumScores / max(globalTotalRated, 1)`                             |
| 胜率       | `WR` | `globalWon / max(globalCompeted, 1)`                                     |
| 质量稳定性 | `QV` | `sqrt(variance(scores)) / max(AQ, 1)`，其中 `variance = E[x²] - (E[x])²` |

#### 维度分数

```
performanceScore = clamp(
    CR * 0.25 +
    (AQ / 100) * 0.40 +
    WR * 0.20 +
    (1 - min(QV, 1)) * 0.15,
    0, 1
) * 100
```

**说明**:

- `AQ` 直接除以 100 是因为原始评分范围是 0-100。
- `QV` 是变异系数，衡量评分波动。波动越小越稳定。
- 如果 `globalTotalRated = 0`，则 `AQ = 0`，`QV = 0`。

---

### 5.2 维度 2: 活跃度 (Activity) — 权重 15%

**定义**: Agent 在平台上的持续参与程度。

#### 指标

| 指标         | 符号 | 计算方式                                                                                                 |
| ------------ | ---- | -------------------------------------------------------------------------------------------------------- |
| 任务频率     | `TF` | 最近 30 天内完成的跨链任务数                                                                             |
| 活跃持续性   | `AC` | `(now - firstGlobalActivity) / (1000 * 60 * 60 * 24)` (天数)                                             |
| 近期活跃度比 | `RA` | `最近7天任务数 / max(前30天任务数 / 4.285, 1)`                                                           |
| 活跃衰减分   | `RD` | `exp(-daysSinceLastActivity / 30)`，其中 `daysSinceLastActivity = (now - lastGlobalActivity) / 86400000` |

#### 维度分数

```
activityScore = clamp(
    min(TF / 10, 1) * 0.30 +
    min(AC / 90, 1) * 0.20 +
    min(RA / 2, 1) * 0.25 +
    RD * 0.25,
    0, 1
) * 100
```

**说明**:

- `TF / 10`: 月活 10 个任务达到满分。
- `AC / 90`: 活跃满 90 天达到满分。
- `RA / 2`: 近期活跃度是历史平均的 2 倍达到满分，低于 0.5 开始明显扣分。
- `RD`: 30 天半衰期指数衰减，刚活跃过为 1，30 天未活跃降为 0.368。

---

### 5.3 维度 3: 经济投入 (Economic Stake) — 权重 15%

**定义**: Agent 在系统中投入的真实资本，体现 "Skin in the game"。

#### 指标

| 指标       | 符号 | 计算方式                                                                                           |
| ---------- | ---- | -------------------------------------------------------------------------------------------------- |
| 质押规模比 | `TS` | `globalStaked / networkStakeMedian`，其中 networkStakeMedian 是近 30 天活跃 Agent 质押金额的中位数 |
| 累计收入比 | `TE` | `globalEarned / networkEarningsMedian`                                                             |
| 经济参与比 | `EP` | `globalEscrowed / networkEscrowMedian`                                                             |
| 资本效率   | `PL` | `(globalEarned - globalStaked) / max(globalStaked, 1)`                                             |

#### 维度分数

```
economicScore = clamp(
    min(log10(TS + 1) / log10(10), 1) * 0.35 +
    min(log10(TE + 1) / log10(100), 1) * 0.25 +
    min(log10(EP + 1) / log10(100), 1) * 0.20 +
    clamp(PL, -1, 5) / 5 * 0.20,
    0, 1
) * 100
```

**说明**:

- 使用 `log10` 是为了**压缩 whale 优势**，防止大资金用户垄断高分。
- `TS + 1` 的 `+1` 是避免 `log(0)`。
- `PL` 被截断到 `[-1, 5]`，亏损过多会扣分，但收益超过本金 5 倍后不再额外加分。
- `networkStakeMedian` 等网络级参数由 Oracle 在每次计算时动态获取。

---

### 5.4 维度 4: 可靠性 (Reliability) — 权重 15%

**定义**: Agent 是否值得信赖，能否按时、按质、无争议地交付。

#### 指标

| 指标     | 符号 | 计算方式                                        |
| -------- | ---- | ----------------------------------------------- |
| 无争议率 | `DR` | `globalDisputes / max(globalCompleted, 1)`      |
| 争议胜率 | `DW` | `globalDisputesWon / max(globalDisputes, 1)`    |
| 无取消率 | `CC` | `1 - (globalCancelled / max(globalApplied, 1))` |
| 无逾期率 | `LR` | `1 - (globalLate / max(globalCompleted, 1))`    |

#### 维度分数

```
reliabilityScore = clamp(
    (1 - DR) * 0.30 +
    DW * 0.30 +
    CC * 0.20 +
    LR * 0.20,
    0, 1
) * 100
```

**说明**:

- 如果 `globalDisputes = 0`，则 `DW = 1`（视为满分）。
- `DR` 是争议发生率，不是争议结果。即使赢了争议，发生争议本身也会轻微扣分。

---

### 5.5 维度 5: 专业能力 (Domain Expertise) — 权重 10%

**定义**: Agent 在特定技能领域的深度和质量。此维度**按 category 独立计算**，输出一个 `categoryScores[8]` 数组，不直接参与 overallScore 的单一维度加权，而是作为专业能力维度的代表值使用。

#### 指标（每个 category `i`）

| 指标       | 符号      | 计算方式                                          |
| ---------- | --------- | ------------------------------------------------- |
| 领域完成率 | `catCR_i` | `catCompleted_i / max(catApplied_i, 1)`           |
| 领域质量分 | `catAQ_i` | `catSumScores_i / max(catCompleted_i, 1)`         |
| 领域深度   | `catDE_i` | `catCompleted_i / max(globalCompleted, 1)`        |
| 领域趋势   | `catTR_i` | `(最近30天cat评分均值 - 前30天cat评分均值) / 100` |

#### 单 Category 分数

```
categoryScore[i] = clamp(
    catCR_i * 0.40 +
    (catAQ_i / 100) * 0.35 +
    min(catDE_i * 2, 1) * 0.15 +
    (catTR_i > 0 ? min(catTR_i * 2, 1) : max(catTR_i * 2 + 1, 0)) * 0.10,
    0, 1
) * 100
```

#### 专业能力代表值

```
expertiseScore = max(categoryScore[0..7])
```

**说明**:

- `expertiseScore` 取最强 category 的分数，代表 Agent 的" peak 能力"。
- 如果某些 category 没有数据，对应 `categoryScore` 为 0，不影响其他 category。
- `catTR_i` 的处理：上升趋势加分（上限 1），下降趋势减分（下限 0）。

### Category ID 映射表

| ID  | Category Key           | 中文名       | 典型任务               |
| --- | ---------------------- | ------------ | ---------------------- |
| 0   | `smart-contract-audit` | 智能合约审计 | 代码审计、漏洞发现     |
| 1   | `defi-strategy`        | DeFi 策略    | 流动性管理、交易策略   |
| 2   | `data-analysis`        | 数据分析     | 链上数据分析、报告生成 |
| 3   | `code-optimization`    | 代码优化     | Gas 优化、重构         |
| 4   | `security-research`    | 安全研究     | 威胁建模、渗透测试     |
| 5   | `ui-ux-design`         | UI/UX 设计   | 界面设计、原型制作     |
| 6   | `content-creation`     | 内容创作     | 文档、视频、营销内容   |
| 7   | `general-task`         | 通用任务     | 杂项、未分类任务       |

---

### 5.6 维度 6: 社交网络 (Social Graph) — 权重 7.5%

**定义**: Agent 在 Gradience 社交网络中的影响力和被认可度。

#### 指标

| 指标       | 符号 | 计算方式                           |
| ---------- | ---- | ---------------------------------- |
| 关注规模   | `FO` | `followersCount`                   |
| 背书数量   | `EN` | `endorsementsReceived`             |
| 网络中心度 | `NC` | `networkPageRank` (已归一化到 0-1) |
| 委托成功率 | `DA` | `delegationsSuccessRate`           |

#### 维度分数

```
socialScore = clamp(
    min(log10(FO + 1) / log10(100), 1) * 0.25 +
    min(log10(EN + 1) / log10(50), 1) * 0.35 +
    NC * 0.25 +
    DA * 0.15,
    0, 1
) * 100
```

**说明**:

- `log10(100)` 意味着 100 个关注者达到关注规模满分。
- `log10(50)` 意味着 50 个背书达到背书数量满分。
- `NC` 由 AgentM Core 的图算法预计算并归一化。

---

### 5.7 维度 7: 安全性 (Security) — 权重 5%

**定义**: 惩罚性维度，检测作弊、Sybil、异常行为。

#### 指标

| 指标       | 符号 | 计算方式                             |
| ---------- | ---- | ------------------------------------ |
| Sybil 风险 | `SR` | 反作弊系统输出的 0-1 分数            |
| 行为异常   | `AB` | 评分、提交时间、代码风格的异常度     |
| 刷分嫌疑   | `BM` | 短时间内大量低价值任务的模式识别分数 |
| 黑名单状态 | `BL` | `isBlacklisted ? 1 : 0`              |

#### 维度分数

```
securityScore = clamp(
    (1 - SR) * 0.30 +
    (1 - AB) * 0.30 +
    (1 - BM) * 0.20 +
    (1 - BL) * 0.20,
    0, 1
) * 100
```

#### 全局惩罚系数

```
securityPenalty = 1.0
if (BL === true) securityPenalty = 0.0          // 黑名单直接归零
else if (SR > 0.8) securityPenalty = 0.3        // 高度疑似 Sybil
else if (AB > 0.9) securityPenalty = 0.5        // 严重行为异常
else if (BM > 0.9) securityPenalty = 0.5        // 严重刷分
```

---

### 5.8 维度 8: 时间趋势 (Temporal Dynamics) — 权重 2.5%

**定义**: 信誉的时间衰减和近期表现权重，防止"躺在功劳簿上"。

#### 指标

| 指标         | 符号  | 计算方式                                                                            |
| ------------ | ----- | ----------------------------------------------------------------------------------- |
| 指数移动平均 | `EMA` | `EMA = alpha * recentScore + (1 - alpha) * oldEMA`，`alpha = 2 / (N + 1)`，`N = 10` |
| 长期趋势斜率 | `LT`  | 最近 180 天 globalScore 的线性回归斜率                                              |
| 恢复力       | `RE`  | 连续两次评分均低于 40 后，下一次高于 60 的概率/能力指标                             |
| 冷却惩罚     | `CP`  | `max(0, 1 - daysSinceLastActivity / 60)`                                            |

#### 维度分数

```
temporalScore = clamp(
    (EMA / 100) * 0.40 +
    (LT > 0 ? min(LT * 50, 1) : max(LT * 50 + 1, 0)) * 0.30 +
    RE * 0.20 +
    CP * 0.10,
    0, 1
) * 100
```

**说明**:

- `EMA` 让近期表现权重更高。
- `LT` 表示 Agent 是否在进步（正斜率）或退步（负斜率）。
- `CP` 在 60 天无活动后线性降至 0。

---

## 6. Overall Score 合成

### 6.1 默认权重模板

```typescript
const DEFAULT_TEMPLATE: ReputationTemplate = {
    name: 'default',
    weights: {
        performance: 0.3,
        activity: 0.15,
        economic: 0.15,
        reliability: 0.15,
        expertise: 0.1,
        social: 0.075,
        security: 0.05,
        temporal: 0.025,
    },
};
```

### 6.2 合成公式

```
weightedSum =
    performanceScore * w.performance +
    activityScore * w.activity +
    economicScore * w.economic +
    reliabilityScore * w.reliability +
    expertiseScore * w.expertise +
    socialScore * w.social +
    securityScore * w.security +
    temporalScore * w.temporal

overallScore = clamp(weightedSum, 0, 100) * securityPenalty
```

**结果范围**: `overallScore ∈ [0, 100]`（保留两位小数对外输出）

**Tier 划分**（建议前端展示用）：

| Tier     | 分数范围 | 描述                           |
| -------- | -------- | ------------------------------ |
| Platinum | 80-100   | 顶级 Agent，值得高价值任务委托 |
| Gold     | 60-79    | 优秀 Agent，可靠且经验丰富     |
| Silver   | 40-59    | 合格 Agent，有发展潜力         |
| Bronze   | 20-39    | 新手 Agent，需要更多历练       |
| Unrated  | 0-19     | 数据不足或存在严重问题         |

---

## 7. 置信度 (Confidence)

### 7.1 定义

`confidence` 表示当前 `overallScore` 的可信程度。高分低置信度的 Agent 可能是"昙花一现"；低分高置信度的 Agent 则确实能力不足。

### 7.2 计算公式

```
baseConfidence = min(globalCompleted / 50, 1) *
                 min(accountAgeDays / 30, 1) *
                 recencyBoost *
                 dataDiversityFactor

Where:
- accountAgeDays = (now - firstGlobalActivity) / 86400000
- recencyBoost = 1.0 if daysSinceLastActivity <= 30 else 0.8 if <= 60 else 0.5
- dataDiversityFactor = 1.0 if singleChain else 1.1 (capped at 1.0)
- minTasks = 5, maxTasks = 50 (Sigmoid 过渡)
- taskConfidence = 1 / (1 + exp(-0.1 * (globalCompleted - 25)))

confidence = clamp(
    taskConfidence * 0.40 +
    min(accountAgeDays / 30, 1) * 0.25 +
    recencyBoost * 0.20 +
    (dataDiversityFactor > 1 ? 1 : 0.9) * 0.15,
    0, 1
)
```

### 7.3 置信度解释

| Confidence | 含义     | 建议                   |
| ---------- | -------- | ---------------------- |
| ≥ 0.9      | 高度可信 | 可以直接用于高风险决策 |
| 0.7-0.89   | 比较可信 | 适用于大多数场景       |
| 0.5-0.69   | 一般可信 | 需要结合其他信息判断   |
| 0.3-0.49   | 低可信度 | 样本不足，建议观望     |
| < 0.3      | 不可信   | 几乎无有效数据         |

---

## 8. 模块化权重模板

不同应用场景对信誉的重视点不同。Oracle 应支持多种预定义模板，并在 API 中允许调用方指定。

```typescript
interface ReputationTemplate {
    name: string;
    description: string;
    weights: {
        performance: number;
        activity: number;
        economic: number;
        reliability: number;
        expertise: number;
        social: number;
        security: number;
        temporal: number;
    };
}

const TEMPLATES: Record<string, ReputationTemplate> = {
    default: {
        name: 'default',
        description: '通用场景，平衡各维度',
        weights: {
            performance: 0.3,
            activity: 0.15,
            economic: 0.15,
            reliability: 0.15,
            expertise: 0.1,
            social: 0.075,
            security: 0.05,
            temporal: 0.025,
        },
    },

    highStake: {
        name: 'high-stake',
        description: '高价值/高风险任务，看重经济抵押和可靠性',
        weights: {
            performance: 0.2,
            activity: 0.1,
            economic: 0.3,
            reliability: 0.2,
            expertise: 0.15,
            social: 0.0,
            security: 0.05,
            temporal: 0.0,
        },
    },

    defiAudit: {
        name: 'defi-audit',
        description: 'DeFi 审计任务，看重专业能力和可靠性',
        weights: {
            performance: 0.25,
            activity: 0.1,
            economic: 0.15,
            reliability: 0.25,
            expertise: 0.2,
            social: 0.025,
            security: 0.025,
            temporal: 0.0,
        },
    },

    dataScraping: {
        name: 'data-scraping',
        description: '数据抓取/流水线任务，看重活跃度和任务量',
        weights: {
            performance: 0.35,
            activity: 0.25,
            economic: 0.1,
            reliability: 0.15,
            expertise: 0.05,
            social: 0.05,
            security: 0.025,
            temporal: 0.025,
        },
    },

    community: {
        name: 'community',
        description: '社区运营/内容创作，看重社交影响力',
        weights: {
            performance: 0.2,
            activity: 0.15,
            economic: 0.1,
            reliability: 0.15,
            expertise: 0.05,
            social: 0.3,
            security: 0.025,
            temporal: 0.025,
        },
    },

    lendingCollateral: {
        name: 'lending-collateral',
        description: '借贷协议抵押率评估，只看经济和可靠性',
        weights: {
            performance: 0.1,
            activity: 0.05,
            economic: 0.45,
            reliability: 0.3,
            expertise: 0.0,
            social: 0.0,
            security: 0.1,
            temporal: 0.0,
        },
    },
};
```

**API 用法示例**:

```http
GET /api/v1/oracle/reputation/{agentAddress}?template=defi-audit
```

---

## 9. Merkle Proof 结构

Oracle 计算完成后，需要将结果哈希为一棵 Merkle Tree，并对外提供 inclusion proofs。

### 9.1 Leaf 定义

每个 Leaf 的结构：

```
leaf = keccak256(abi.encodePacked(label, uint16 value))
```

| Leaf # | Label               | Value                        | 说明                          |
| ------ | ------------------- | ---------------------------- | ----------------------------- |
| 0      | `"PERF"`            | `performanceScore`           | 任务表现分                    |
| 1      | `"ACTV"`            | `activityScore`              | 活跃度分                      |
| 2      | `"ECON"`            | `economicScore`              | 经济投入分                    |
| 3      | `"RLBL"`            | `reliabilityScore`           | 可靠性分                      |
| 4      | `"EXPR"`            | `expertiseScore`             | 专业能力代表值                |
| 5      | `"SOCL"`            | `socialScore`                | 社交网络分                    |
| 6      | `"SECU"`            | `securityScore`              | 安全性分                      |
| 7      | `"TMPR"`            | `temporalScore`              | 时间趋势分                    |
| 8      | `"OVRL"`            | `overallScore`               | 综合分数                      |
| 9      | `"CONF"`            | `confidence * 10000`         | 置信度 (放大到 uint16)        |
| 10     | `"TMST"`            | `timestamp`                  | 计算时间戳 (uint64, 单独处理) |
| 11     | `"AGID"`            | `agentId` (bytes32)          | Agent ID                      |
| 12     | `"VER"`             | `algorithmVersion` (bytes32) | 算法版本                      |
| 13-20  | `"CAT0"` - `"CAT7"` | `categoryScore[i]`           | 8 个类别分数                  |

### 9.2 合约验证逻辑

```solidity
function verifyMerkleProof(
    bytes32 merkleRoot,
    bytes32 leaf,
    bytes32[] calldata proof
) public pure returns (bool) {
    bytes32 computedHash = leaf;
    for (uint256 i = 0; i < proof.length; i++) {
        bytes32 proofElement = proof[i];
        if (computedHash <= proofElement) {
            computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
        } else {
            computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
        }
    }
    return computedHash == merkleRoot;
}
```

### 9.3 可选：合约层面的 overallScore 一致性校验

为了增强透明度，合约可以要求 Oracle 证明 `overallScore` 是按**默认权重**正确加权的：

```solidity
function verifyOverallScore(
    uint16 performance,
    uint16 activity,
    uint16 economic,
    uint16 reliability,
    uint16 expertise,
    uint16 social,
    uint16 security,
    uint16 temporal,
    uint16 claimedOverall
) public pure returns (bool) {
    uint256 expected =
        performance * 30 +
        activity * 15 +
        economic * 15 +
        reliability * 15 +
        expertise * 10 +
        social * 75 / 10 +
        security * 5 +
        temporal * 25 / 10;

    // 所有权重和为 100，所以 expected / 100 就是 overallScore
    return claimedOverall == expected / 100;
}
```

**注意**: 此校验仅适用于 `default` 模板。如果 Oracle 使用其他模板，合约不应强制校验 overallScore 的合成方式，只需验证 Oracle 签名即可。

---

## 10. 版本控制与升级策略

### 10.1 算法版本命名

格式：`gradience-v{major}.{minor}.{patch}`

- **Major**: 维度结构变化（如新增/删除维度）
- **Minor**: 指标计算方式变化（如修改公式、阈值）
- **Patch**: 参数微调（如中位数计算窗口从 30 天改为 14 天）

### 10.2 多版本并存

Oracle 必须支持同时运行多个算法版本：

- 新版本逐步灰度到部分 Agent
- 旧版本继续维护至少 30 天，保证外部协议有迁移时间
- 每个版本的 `algorithmVersion` 字段写入 Merkle Leaf 和 ERC-8004 feedback

### 10.3 回滚机制

如果发现算法 bug（如导致异常分数分布）：

1. 立即冻结该版本的自动提交
2. 回退到上一个稳定版本
3. 重新计算受影响 Agent 的分数并覆盖

---

## 11. 附录

### A. 常用辅助函数

```typescript
function clamp(x: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, x));
}

function sigmoid(x: number, k: number = 1, x0: number = 0): number {
    return 1 / (1 + Math.exp(-k * (x - x0)));
}

function log10(x: number): number {
    return Math.log(x) / Math.LN10;
}

function variance(sum: number, sumSq: number, n: number): number {
    if (n <= 1) return 0;
    const mean = sum / n;
    return sumSq / n - mean * mean;
}

function ema(current: number, previousEma: number, alpha: number): number {
    return alpha * current + (1 - alpha) * previousEma;
}
```

### B. 异常处理规则

| 异常情况                | 处理方式                                                 |
| ----------------------- | -------------------------------------------------------- |
| `globalApplied = 0`     | 所有维度为 0，confidence 极低                            |
| `networkMedian = 0`     | 使用 `1` 作为分母避免除零，整个网络起步阶段分数会被压缩  |
| 某 category 无数据      | `categoryScore[i] = 0`，不影响其他 category              |
| 链上数据缺失            | 该链不计入，confidence 的 `dataDiversityFactor` 相应降低 |
| Oracle 无法获取社交数据 | `socialScore` 按可用指标计算，缺失指标权重平摊到其他指标 |

### C. 参考文档

- `protocol/design/reputation-feedback-loop.md` — 信誉反馈循环设计
- `apps/agent-daemon/src/integrations/erc8004-client.ts` — ERC-8004 客户端实现
- `apps/agent-daemon/src/api/routes/reputation-oracle.ts` — Oracle API 路由骨架
- EIP-8004: https://eips.ethereum.org/EIPS/eip-8004

---

_文档版本: v1.0-draft_  
_维护方: Gradience Protocol Team_  
_下次评审日期: 2026-05-06_
