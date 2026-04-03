# Gradience 安全架构

> **文档状态**: v0.2 Draft
> **创建日期**: 2026-03-30
> **更新日期**: 2026-04-04
> **范围**: 协议内核 + 模块层的完整安全设计

---

## 1. 威胁模型总览

### 1.1 攻击面分类

```
攻击面:
┌─────────────────────────────────────────────────────────────────┐
│                    Gradience 协议攻击面                          │
├─────────────┬──────────────┬──────────────┬────────────────────┤
│ L1: 协议内核 │ L2: 经济攻击 │ L3: 通信/发现层│ L4: Agent 层       │
│             │              │              │                    │
│ • 合约漏洞   │ • 串通攻击   │ • 女巫攻击   │ • 密钥泄露         │
│ • 重入攻击   │ • 洗分攻击   │ • 日蚀攻击   │ • Agent 劫持       │
│ • 溢出攻击   │ • 抢跑/MEV   │ • DoS 攻击   │ • 恶意 Skill       │
│ • 权限绕过   │ • 价格操纵   │ • 中间人     │ • 数据投毒         │
└─────────────┴──────────────┴──────────────┴────────────────────┘
```

### 1.2 安全原则

1. **不可变费率** — 95/3/2 硬编码，消除治理攻击面
2. **无管理员密钥** — 合约部署后无 owner、无 proxy、无升级
3. **经济安全** — 攻击成本 > 攻击收益（比特币模型）
4. **最小信任** — 协议层只信任数学和代码，不信任人

---

## 2. L1: 协议内核安全

### 2.1 智能合约威胁

| 威胁 | 攻击方式 | 防护措施 | 严重度 |
|------|---------|---------|--------|
| 重入攻击 | `judgeAndPay` 发送 ETH/SOL 时回调 | CEI 模式 + ReentrancyGuard + Solana 原子性 | 🔴 Critical |
| 整数溢出 | 费用计算溢出 | Solana 原生 checked_math / Rust 默认 panic on overflow | 🟡 Medium |
| 权限绕过 | 非 Judge 调用 `judgeAndPay` | `require(msg.sender == task.judge)` 严格校验 | 🔴 Critical |
| 状态篡改 | 绕过状态机转换 | 枚举状态 + 每个函数入口校验当前状态 | 🔴 Critical |
| 资金锁死 | Task 创建后无法退出 | `refundExpired()` 无需许可 + `forceRefund()` 7天超时 | 🟡 Medium |

### 2.2 Solana 特有安全考量

```rust
// Anchor Program 安全清单

// ✅ 账户校验 — 每个指令的 Account 约束
#[derive(Accounts)]
pub struct JudgeAndPay<'info> {
    #[account(
        mut,
        has_one = judge,                    // 必须是指定 Judge
        constraint = task.status == TaskStatus::Open,  // 状态校验
    )]
    pub task: Account<'info, Task>,
    pub judge: Signer<'info>,               // 签名校验
    
    /// CHECK: 验证为 task.agent
    #[account(
        mut,
        constraint = agent.key() == task.assigned_agent
    )]
    pub agent: AccountInfo<'info>,
}

// ✅ PDA 种子唯一性 — 防止账户碰撞
// task PDA: [b"task", poster.key, task_id.to_le_bytes()]
// reputation PDA: [b"reputation", agent.key]

// ✅ 关闭账户时清零 — 防止复活攻击
// Anchor 的 close = xxx 自动处理

// ✅ 程序 ID 校验 — 跨程序调用时验证被调用者
```

### 2.3 不可变性保证

```
协议承诺（合约级保证）:
┌──────────────────────────────────────────────┐
│  JUDGE_FEE_BPS  = 300  (3%)   ← const       │
│  PROTOCOL_FEE_BPS = 200 (2%)  ← const       │
│  AGENT_SHARE    = 9500 (95%)  ← const       │
│  MIN_PASS_SCORE = 60          ← const       │
│  JUDGE_TIMEOUT  = 7 days      ← const       │
│                                              │
│  无 owner()                                  │
│  无 pause()                                  │
│  无 setFee()                                 │
│  无 upgrade()                                │
│  无 proxy pattern                            │
│                                              │
│  → 部署即定型，如同比特币的 21M 上限           │
└──────────────────────────────────────────────┘
```

### 2.4 审计策略

| 阶段 | 时间 | 方法 |
|------|------|------|
| 开发期 | 持续 | 单元测试 100% 覆盖 + Anchor 测试框架 |
| Alpha | 部署前 | Fuzzing（Trident/Honggfuzz） |
| Beta | 主网前 | 第三方审计（OtterSec / Neodyme） |
| 主网 | 上线后 | Bug Bounty 计划（Immunefi） |

---

## 3. L2: 经济攻击防护

### 3.1 串通攻击（Collusion）

**场景：** Agent A 和 Judge J 串通 → A 交垃圾 → J 给满分 → 分钱

```
防御层次:

Layer 1: 结构隔离
  Poster 选择 Judge（不是 Agent 选 Judge）
  → 串通需要 Poster + Agent + Judge 三方合谋
  → 如果 Poster 自己是串通者，本质是自己花钱买假信誉

Layer 2: 经济成本
  每次任务消耗 2% Protocol Fee（真金白银）
  Agent 需要 Stake（锁定资本）
  → 刷 100 次假任务 × 2% = 消耗真实价值的 200%
  → 比"挖矿电费"还真实

Layer 3: 透明审计
  evaluationCID 公开 → 任何人可审查评判标准
  所有提交链上可查 → 异常模式可被社区发现
  selfEvaluated = true 标记 → 市场自动折价

Layer 4: 信誉衰减
  只跟一个 Judge 合作的 Agent → 信誉集中度高 → 被市场怀疑
  信誉计算引入 Judge 多样性指标
```

**量化分析：**

```
刷 1000 点虚假信誉的成本:
  假设每次任务 100 USDC
  1000 次 × 100 USDC × 2% protocol fee = 2,000 USDC 纯损失
  + 1000 次 × minStake（锁定资本机会成本）
  + 被发现后信誉归零的风险

  对比: 诚实完成 1000 个任务的信誉 >> 刷出来的信誉
  → 经济上不划算
```

### 3.2 女巫攻击（Sybil）

**场景：** 创建大量假 Agent 抢占任务

```
防御:

1. Stake 要求
   每个 Agent 需要 minStake 才能提交
   1000 个假 Agent = 1000 × minStake 锁定资本
   → 资本效率极低

2. 信誉冷启动
   新 Agent 信誉 = 0 → 不会被优先选中
   → 女巫 Agent 没有竞争优势

3. Race Model 自然防御
   在竞争模式下，只有最好的提交赢
   → 1000 个垃圾 Agent 的提交不如 1 个真实 Agent
   → Sybil 没有效用
```

### 3.3 MEV / 抢跑攻击

**场景：** 验证者/机器人看到提交后抢先提交

```
防御:

1. 竞争模式本身就是「多个提交」
   → 抢跑没有意义，因为 Judge 选最好的，不是选最快的

2. Sealed 模式
   visibility = sealed → 提交加密
   → 抢跑者看不到内容，无法复制

3. Solana 特性
   Solana 没有 mempool（直接发给 leader）
   → MEV 攻击面比 EVM 小很多
```

### 3.4 洗分攻击（Reputation Washing）

**场景：** 完成大量低价值任务刷高 winRate

```
防御:

1. 加权信誉
   reputation = f(score, task_value, judge_reputation, task_diversity)
   → 1 USDC 的任务贡献远小于 100 USDC 的任务

2. 最低任务价值
   协议可设置 minTaskValue（可选参数）
   → 过滤微额刷分任务

3. 社区透明度
   所有任务链上可查 → 数据分析工具可识别异常模式
   → "该 Agent 90% 任务来自同一 Poster" 一目了然
```

---

## 4. L3: 通信层 / 发现层安全

### 4.1 数据可用性

```
评判标准（evaluationCID）的可用性保障:

推荐存储层:
  Tier 1: Arweave — 永久存储，200年保证
  Tier 2: Avail — DA 层，低成本高可用
  Tier 3: IPFS — 可接受，但需 pin

回退机制:
  evaluationCID 不可用 → Judge 无法评判
  → deadline 到期 → refundExpired() 自动触发
  → Poster 和 Agent 都不受损（除了时间成本）
```

### 4.2 XMTP 通信层安全

```
XMTP MLS E2E 加密消息安全模型:

1. MLS 协议 (Messaging Layer Security)
   → 替代旧的 NIP-04 加密（已迁移）
   → 前向保密 + 后向保密
   → 组消息支持（多 Agent 协作场景）

2. 钱包地址即身份
   Agent 的 XMTP 身份绑定钱包地址
   → 无需额外身份系统
   → 链上信誉与消息身份统一

3. 消息可用性
   XMTP 网络节点多副本存储
   → 单节点宕机不影响消息传递
   → 离线消息队列支持

4. NIP-04 迁移说明
   旧版设计曾考虑 Nostr NIP-04 DM 作为通信层
   → NIP-04 存在已知安全问题（无前向保密）
   → 已完全迁移到 XMTP MLS，提供更强加密保证
```

### 4.3 Nostr 发现层安全

```
Nostr NIP-89/90 发现层安全模型:

1. Relay 审查抵抗
   多 Relay 冗余，单 Relay 封禁不影响协议
   → Agent 可自选 Relay 发布服务声明
   → 链上数据是 Source of Truth，Nostr 只是发现层

2. 虚假 Handler 防护
   NIP-89 Handler 声明需与链上信誉交叉验证
   → 无链上信誉的 Handler 自动降权
   → 经济成本防御（刻印信誉需质押 + 任务完成）
```

### 4.4 MagicBlock 结算层增强安全 (可选组件)

```
MagicBlock ER/PER/VRF 作为结算层可选增强（非通信协议）:

1. 委托模型
   Agent Layer Account → delegate → ER
   → ER 只能在委托范围内操作
   → 无法触及未委托的资产

2. TEE 保护（Private ER）
   敏感协商在 Intel TDX TEE 中执行
   → 即使 ER 运营者也看不到内容

3. 自动回写
   ER 状态变更 → 自动 commit 回 Solana L1
   → 即使 ER 宕机，L1 状态始终是最终状态

4. 无桥风险
   ER 不是独立链，是 Solana 的临时执行环境
   → 没有跨链桥 → 没有桥攻击
```

---

## 5. L4: Agent 层安全

### 5.1 密钥管理

```
Agent 密钥分层:

┌─────────────────────────────────────────┐
│  Master Key（主密钥）                    │
│  作用：身份根 + 恢复                     │
│  存储：用户自持（助记词/硬件钱包）        │
│  使用频率：极低（仅恢复/迁移）            │
├─────────────────────────────────────────┤
│  Signing Key（签名密钥）                 │
│  作用：链上交易签名                      │
│  存储：本地加密存储 / TEE                │
│  使用频率：中（每次链上操作）             │
│  权限：可由 Master Key 轮换              │
├─────────────────────────────────────────┤
│  Session Key（会话密钥）                 │
│  作用：日常 Agent 操作（低价值）          │
│  存储：内存 / 临时存储                   │
│  使用频率：高（每次 Agent 动作）          │
│  权限：有金额上限 + 时间限制              │
│  实现：Solana Durable Nonce 或           │
│        Session Key Program               │
└─────────────────────────────────────────┘

安全升级路径:
  Phase 1 (MVP): 单密钥，用户自管
  Phase 2: Session Key + 金额限制
  Phase 3: MPC / Multi-sig 可选
```

### 5.2 Agent 运行时安全

```
Agent 执行 Skill 的安全边界:

安全分级（来自 Skill Protocol）:
┌──────────┬──────────────────┬─────────────────┐
│  安全级别 │ 操作类型          │ 执行环境         │
├──────────┼──────────────────┼─────────────────┤
│  🟢 安全  │ 只读（查询余额）   │ 本地直接执行     │
│  🟡 谨慎  │ 链下副作用（HTTP） │ 沙箱执行         │
│  🔴 危险  │ 链上操作（转账）   │ TEE + 人工确认   │
└──────────┴──────────────────┴─────────────────┘

沙箱设计:
  - Wasm 运行时隔离（wasmtime / wasmer）
  - 资源限制（CPU 时间、内存、网络）
  - 系统调用白名单
  - 链上操作需要 Session Key 签名
```

### 5.3 恶意 Skill 防护

```
Skill 安全检查流程:

1. 静态分析
   Skill 包上传到功法阁 → 自动扫描
   → 检查系统调用、网络请求、文件操作
   → 标记风险级别

2. 沙箱测试
   在隔离环境运行 Skill 自带的 tests/
   → 验证输入输出符合声明
   → 检查资源使用是否异常

3. 社区审计
   开源 Skill → 代码公开可查
   闭源 Skill → 必须在 TEE 中执行
   → 用户自选风险容忍度

4. 信誉关联
   Skill 创作者有链上信誉
   → 恶意 Skill 会毁掉创作者的全部信誉
   → 经济惩罚 > 恶意收益
```

---

## 6. 跨链安全

### 6.1 信誉跨链的信任模型

```
信誉跨链安全设计（零桥方案）:

步骤 1: 身份链接（纯密码学）
  Solana 钱包 A 签名消息: "I control Base wallet B"
  Base 钱包 B 签名消息: "I control Solana wallet A"
  → 双向签名存储在 Solana（信誉主链）
  → 零跨链成本，零桥依赖

步骤 2: 信誉携带（自证模型）
  Agent 在 Base 上参与任务时:
    → 携带来自 Solana 的签名信誉证明
    → Base 合约验证签名（不需要调用 Solana）
    → 等同于「带着推荐信去面试」

步骤 3: 信誉回写（异步单向）
  Agent 在 Base 完成任务后:
    → 提交结果证明到 Solana（~$0.001）
    → Solana 更新统一信誉
    → Agent 控制何时回写（无实时要求）

安全性分析:
  ✅ 无桥 → 无桥攻击
  ✅ 自证 → 无预言机依赖
  ✅ 异步 → 无实时跨链要求
  ⚠️ 延迟 → 跨链信誉有几分钟延迟（可接受）
  ⚠️ 回写依赖 Agent → Agent 可能不回写（但只影响自己的信誉）
```

### 6.2 跨链合约部署安全

```
多链部署策略:

每条链部署独立的 Agent Layer 合约
  → 不共享状态
  → 不依赖桥
  → 各自独立运行

信誉主链: Solana
  → 所有链的信誉最终汇聚到 Solana
  → Solana 是 Single Source of Truth

安全考虑:
  1. 每条链的合约代码相同（逻辑一致性）
  2. 每条链的费率常量相同（95/3/2 不变）
  3. 信誉证明格式统一（跨链可验证）
  4. 不同链的 Stake 互不影响
```

---

## 7. 事件响应

### 7.1 安全事件分级

| 级别 | 定义 | 响应时间 | 示例 |
|------|------|---------|------|
| P0 | 资金直接风险 | 立即 | 合约漏洞被利用 |
| P1 | 信誉系统被操纵 | 24h | 大规模洗分攻击 |
| P2 | 功能异常 | 72h | Nostr Relay 数据不一致 |
| P3 | 体验问题 | 1周 | 前端显示错误 |

### 7.2 P0 事件应对

```
由于合约不可升级:

1. 没有 pause() → 无法暂停合约
   → 这是 feature，不是 bug
   → 如同比特币：没有人能暂停比特币

2. 应对策略:
   a. 前端/SDK 层发出警告
   b. Judge Daemon 停止处理新任务
   c. 社区公告 + 迁移到修复版 Program
   d. 新 Program 通过跨程序认证读取旧数据

3. 资金安全:
   已锁定的 Escrow → 通过正常流程（judge/refund/forceRefund）退出
   → 所有退出路径在合约中已保证
   → 最坏情况：7天后任何人可触发 forceRefund
```

---

## 8. 安全路线图

| 阶段 | 时间 | 安全里程碑 |
|------|------|-----------|
| Phase 1 | 2026 Q2 | 合约审计 + Fuzzing + 单密钥 |
| Phase 2 | 2026 Q3 | Session Key + Bug Bounty |
| Phase 3 | 2026 Q4 | 多链部署安全审查 |
| Phase 4 | 2027 H1 | XMTP 通信层安全审查 + MagicBlock 结算增强安全设计 |
| Phase 5 | 2027 H2 | MPC 可选 + 全面安全审计 |

---

## 9. 与比特币安全模型的映射

```
比特币安全                    Gradience 安全
──────────                   ──────────────
51% 攻击成本高               串通攻击成本高（Stake + Fee）
不可逆交易                   不可变费率
无管理员                     无管理员
激励兼容                     GAN 对抗均衡
任何人可验证                 链上透明 + evaluationCID 公开
最长链 = 真相               最高信誉 = 可信
分叉 = 社区选择             新 Program = 自愿迁移
```

---

*安全不是功能，是协议的基石。*
*最安全的设计是最小的设计——攻击面 ∝ 代码量。*
*~300 行代码 = 最小的攻击面。*

_Gradience Security Architecture v0.2 · 2026-04-04_
