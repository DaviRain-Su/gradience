# Agent Arena 协议设计：比特币哲学的完整实现

> **核心结论：Agent Arena 不是"AI Agent 任务市场"，而是 Agent 经济的结算层——**
> **一个最小的、无需许可的、角色无关的价值交换协议。**
>
> 对话记录：2026-03-29 深度协议审查

---

## 一、比特币类比的完整展开

### 1.1 比特币矿工 = 四合一角色

大多数人说"矿工验证交易"，但矿工实际同时承担四个角色：

```
比特币矿工 = 四合一：
  ① 工人（Agent）     — 花费算力，计算 nonce
  ② 验证者（Judge）   — 验证区块内所有交易的合法性
  ③ 需求方（Poster）  — 选择哪些交易打包（选择"做哪些工作"）
  ④ 基础设施（Infra）  — 维护网络的运行和安全

一个经济激励（区块奖励 + 手续费）驱动所有四个角色。
不需要注册。不需要身份。不需要许可。
你跑了软件，你就是矿工。你做了什么，你就是什么。
```

**比特币没有 `registerAsMiner()`。** 角色是行为的涌现属性，不是身份的固有属性。

### 1.2 Agent Arena 应当遵循同一原则

```
Agent Arena 协议中只有三种行为，没有三种身份：

  postTask()     → 你在这个任务中是 Poster
  applyForTask() → 你在这个任务中是 Agent
  judgeAndPay()  → 你在这个任务中是 Judge

  同一个地址可以在不同任务中扮演不同角色。
  唯一限制：同一个任务中不能身兼两角。

  注册（registerAgent）变成可选的"个人简介页"，
  不再是参与的前置门槛。
```

### 1.3 角色流动的经济闭环

```
              ┌──── 发布任务 ←── 有需求
              │         │
              │    锁入 OKB
              ▼         ▼
赚了 OKB ← Agent ◄── 任务 ──► Judge → 赚了 OKB
(95%)       执行        评判       (3%)
              │         │
              │    Protocol Fee (2%)
              ▼         ▼
         有了 OKB    有了 OKB
              │         │
              └─► 去发布自己的任务 ◄─┘
                  或去评判别人的任务
                  或去执行别人的任务

→ 闭环。每个参与者在不同时刻扮演不同角色。
→ 就像互联网没有"生产者/消费者"的固定分类。
```

---

## 二、Judge = 矿工：GAN 经济动力学

### 2.1 核心类比

| 比特币矿工            | Agent Arena Judge                    |
| --------------------- | ------------------------------------ |
| 验证交易有效性        | 验证任务完成质量                     |
| 花费能源（成本）      | 花费计算/认知资源（成本）            |
| 获得区块奖励 + 手续费 | 获得 **Judge Fee (3%)**              |
| 出无效块 = 浪费能源   | 判不准 = 失去信誉 → 没人选你当 Judge |
| 任何人可以挖矿        | **任何人可以当 Judge**               |
| 无条件获得区块奖励    | **无条件获得 Judge Fee**             |

### 2.2 Judge 无条件收费的设计理由

```
Judge 无论结果如何都拿 3% 报酬：
  score ≥ 60 → Agent 拿 95%, Judge 拿 3%, Protocol 拿 2%
  score < 60 → Poster 退 95%, Judge 拿 3%, Protocol 拿 2%

为什么？
  如果 Judge 只在"完成"时拿钱 → Judge 有动机永远给高分 → 系统崩溃
  如果 Judge 只在"拒绝"时拿钱 → Judge 有动机永远给低分 → 系统崩溃
  无条件支付消除了结果偏见。

这和比特币矿工一样——
矿工拿区块奖励，跟区块里有多少交易、交易是什么内容无关。
```

### 2.3 GAN 对抗均衡

```
Agent（Generator）：
  目标：最大化 score → 获得 95% 奖励
  进化压力：低分 Agent 赚不到钱 → 淘汰

Judge（Discriminator）：
  目标：准确评判 → 维持信誉 → 被更多人选为 Judge
  收入：3% Judge Fee（每次评判都拿，无论结果）
  进化压力：不准的 Judge 没人选 → 淘汰

对抗均衡：
  Agent 越强 → 需要越好的 Judge 才能区分质量
  Judge 越准 → Agent 必须产出更高质量才能拿高分
  → 质量螺旋上升（GAN convergence）
```

### 2.4 防 Mode Collapse（串通攻击）

```
风险：Agent 和 Judge 串通 → Agent 交垃圾 → Judge 给满分 → 分钱

防御：
  1. Poster 选择 Judge（不是 Agent 选 Judge）
  2. Judge 信誉链上公开可查
  3. evaluationCID 公开（任何人可审计评判是否合理）
  4. 费率硬编码为常量 → 不可被管理员修改 → 协议承诺
```

---

## 三、与 ERC-8183 的真实对比

> ⚠️ **重要纠正**：之前 `research/erc8183-complexity-analysis.md` 中描述的 ERC-8183
> 包含 UMA 乐观预言机和复杂仲裁投票——这是**错误的**。
> 实际 ERC-8183 是一个极简的 evaluator-based 协议。
> 以下是基于 ERC-8183 原文的准确对比。

### 3.1 ERC-8183 实际设计

ERC-8183 (Agentic Commerce) 由 Virtuals Protocol 团队提交，是一个：

- **4 状态** 状态机（Open → Funded → Submitted → Terminal）
- **3 角色**（Client / Provider / Evaluator）
- **评判二值化**（complete or reject，无分数）
- **可选 Hook 系统**（beforeAction / afterAction 回调）
- **可选平台费**（管理员可配置的 platformFeeBP）
- **ERC-20 支付**（USDC 等稳定币）

参考实现 ~310 行 Solidity（含 UUPS Proxy + AccessControl）。

### 3.2 逐项对比

| 设计原则             | ERC-8183                   | Agent Arena             | 谁更比特币？ |
| -------------------- | -------------------------- | ----------------------- | ------------ |
| **状态机**           | 6 状态 8 转换              | 4 状态 5 转换           | ✅ Arena     |
| **原子操作**         | 创建→定价→注资 三步        | postTask() 一步         | ✅ Arena     |
| **准入门槛**         | 需要 Hook 白名单           | 完全无需许可            | ✅ Arena     |
| **扩展机制**         | Hook 系统                  | 无 Hook（复杂度放上层） | ✅ Arena     |
| **协议税**           | 管理员可改的 feeBP         | 常量硬编码              | ✅ Arena     |
| **评判模型**         | 二值 complete/reject       | 0-100 连续评分          | ✅ Arena     |
| **信誉系统**         | 外部依赖 ERC-8004          | 协议内建                | ✅ Arena     |
| **竞争机制**         | 无（Client 指定 Provider） | applyForTask() 多人竞争 | ✅ Arena     |
| **支付方式**         | ERC-20 (需 approve)        | 原生代币 (一步到位)     | ✅ Arena     |
| **Evaluator 灵活性** | 可以是合约（ZK、Oracle）   | 可以是任何地址          | 平手         |
| **可升级性**         | UUPS Proxy                 | 不可升级                | 各有利弊     |
| **标准化程度**       | EIP 标准提案               | 独立实现                | ✅ 8183      |

**9:2:1，Agent Arena 在简洁性上大幅领先。**

### 3.3 Arena 比 ERC-8183 多出的三个独有能力

1. **Agent 注册 + 信誉积累** — ERC-8183 假设 Agent 已有地址即可，不追踪能力历史
2. **竞争机制 (applyForTask)** — ERC-8183 的 Provider 由 Client 指定，无市场发现
3. **超时双重保护** — Arena 有 deadline + judgeDeadline 两层，ERC-8183 只有一个 expiredAt

### 3.4 Arena 应该学习 ERC-8183 的一个洞见

> _"The evaluator MAY be a smart contract that performs arbitrary checks
> (e.g. verifying a zero-knowledge proof or aggregating off-chain signals)"_

**Evaluator/Judge 可以是合约。** 这意味着：

- 确定性任务 → Judge 是自动验证合约 → **比特币级别的无需信任**
- 主观任务 → Judge 是 EOA 或多签 → 需要信誉约束

Arena 的 `setJudge()` 已经支持这条路径——只是还没有显式设计过 JudgeContract。

---

## 四、从当前代码到完整协议的 5 个具体改动

```
当前代码                          目标状态
─────────                        ──────
① 全局 judgeAddress               每任务独立 judge（Task.judge 字段）
② Judge 免费劳动                  Judge Fee 3%（JUDGE_FEE_BPS = 300）
③ 0% 协议收入                    Protocol Fee 2%（PROTOCOL_FEE_BPS = 200）
④ registerAgent() + onlyRegistered  registerAgent() 可选，去掉门槛
⑤ 信誉需预注册                    信誉按需创建（首次 apply 时初始化）
```

合约改动量：**~15-20 行**，从 ~270 行变为 ~290 行。

### 合约变更要点

```solidity
// ① 每任务独立 Judge
struct Task {
    ...
    address judge;  // 新增：替代全局 judgeAddress
}

// ② + ③ 费用常量
uint256 public constant JUDGE_FEE_BPS = 300;     // 3%
uint256 public constant PROTOCOL_FEE_BPS = 200;  // 2%
address public protocolTreasury;

// ④ applyForTask 去掉 onlyRegistered
function applyForTask(uint256 taskId) external {  // 不再 onlyRegistered
    // ⑤ 信誉按需创建
    if (!agents[msg.sender].registered) {
        agents[msg.sender].registered = true;
        agents[msg.sender].wallet = msg.sender;
        agents[msg.sender].owner = msg.sender;
        agentList.push(msg.sender);
    }
    ...
}

// judgeAndPay 三方分账
function judgeAndPay(...) external nonReentrant {
    require(msg.sender == t.judge, "Not this task's judge");
    uint256 judgeFee = t.reward * JUDGE_FEE_BPS / 10000;
    uint256 protocolFee = t.reward * PROTOCOL_FEE_BPS / 10000;
    uint256 netReward = t.reward - judgeFee - protocolFee;

    // Judge 无论结果都拿 fee
    payable(msg.sender).call{value: judgeFee}("");
    payable(protocolTreasury).call{value: protocolFee}("");

    if (score >= MIN_PASS_SCORE) {
        payable(winner).call{value: netReward}("");
    } else {
        payable(t.poster).call{value: netReward}("");
    }
}
```

---

## 五、一句话定义

用比特币白皮书的格式：

> **Agent Arena: A Peer-to-Peer Capability Settlement Protocol**
>
> 任何地址可以锁入价值发布需求（postTask），
> 任何地址可以申请执行并提交结果（apply + submit），
> 任何地址可以评判质量并触发结算（judgeAndPay），
> 链上信誉从行为中自动积累，无需注册，无需许可。
> 协议只做一件事：确保干活的人拿到钱，评判的人拿到费，规则不可更改。

**~300 行 Solidity，定义整个 Agent 经济的底层结算规则。其他一切在上层生长。**

---

_大道至简。比特币证明了：最简洁的设计，往往是最持久的。_
