# 多链凭证架构：EVM 操作如何回传 Solana 核心

> **状态**: 设计讨论稿
> **创建**: 2026-04-03
> **目的**: 想清楚多链场景下信誉凭证的完整流转逻辑

---

## 一、核心原则

```
Solana = 唯一信任根 (Single Source of Truth)

· 协议内核 (Escrow + Judge + Reputation) 部署在 Solana
· 每个 Agent 的身份 PDA 账户在 Solana 上
· 所有链上的操作最终都要"回传"到这个账户
· 其他链是"分支"，Solana 是"主干"
```

---

## 二、Agent 身份账户模型 (Solana PDA)

```
Agent Identity PDA (Solana)
├── base_info
│   ├── solana_pubkey: "5Y3d..."         # Solana 主地址
│   ├── evm_addresses: [                  # 已链接的 EVM 地址
│   │   { chain_id: 1,    address: "0xABC..." },   # Ethereum
│   │   { chain_id: 42161, address: "0xDEF..." },  # Arbitrum
│   │   { chain_id: 10,    address: "0x123..." },   # Optimism
│   │ ]
│   ├── identity_proofs: [                # 跨链身份证明
│   │   { chain: "ethereum", sig: "..." },  # EVM 地址签了 Solana 公钥
│   │   { chain: "solana",   sig: "..." },  # Solana 地址签了 EVM 公钥
│   │ ]
│   └── nostr_pubkey: "npub1..."          # Nostr 发现层身份
│
├── reputation
│   ├── global_score: 85                  # 全局综合评分
│   ├── total_tasks_completed: 142
│   ├── total_tasks_applied: 200
│   ├── win_rate: 0.71
│   ├── judge_reliability: 0.95
│   └── per_chain_stats: {               # 每条链的统计
│       "solana":   { completed: 100, score: 87 },
│       "arbitrum": { completed: 30,  score: 82 },
│       "base":     { completed: 12,  score: 80 },
│     }
│
├── credentials[]                         # 凭证列表
│   ├── Credential {
│   │   id: "cred-001",
│   │   type: "task_completion",
│   │   source_chain: "solana",
│   │   task_id: "task-abc",
│   │   score: 92,
│   │   judge: "5Xyz...",
│   │   timestamp: 1712345678,
│   │   tx_sig: "solana_tx_hash",
│   │ }
│   ├── Credential {
│   │   id: "cred-042",
│   │   type: "task_completion",
│   │   source_chain: "arbitrum",         # ← 来自 EVM 链！
│   │   task_id: "0xabc...def",
│   │   score: 88,
│   │   judge: "0x456...",
│   │   timestamp: 1712345999,
│   │   bridge_proof: {                   # 跨链证明
│   │     bridge: "wormhole",
│   │     vaa: "...",                     # Wormhole VAA 验证消息
│   │     source_tx: "0xevm_tx_hash",
│   │   },
│   │ }
│   └── ...
│
└── staking
    ├── staked_amount: 1000 GRAD
    ├── cooldown_until: null
    └── slash_history: []
```

---

## 三、三种场景的凭证流转

### 场景 A: 纯 Solana 操作 (当前已有)

```
Customer 发任务 (Solana)
    ↓ postTask()
Agent 在本地执行任务 (off-chain)
    ↓
Agent 提交结果 (Solana)
    ↓ submitResult()
Judge 评判 (Solana)
    ↓ judgeAndPay()
    ↓ → 自动更新 Agent PDA 里的 reputation + credentials
    ↓ → 结算支付
完成 ✅

凭证直接写入 Solana PDA，不需要跨链。
```

### 场景 B: Agent 带着 Solana 信誉去 EVM 链操作

```
Agent 要在 Arbitrum 上接任务
    ↓
Agent 从 Solana PDA 生成"声誉证明" (ReputationProof)
    ↓
    ReputationProof = {
      agent: "5Y3d...",
      global_score: 85,
      completed: 142,
      win_rate: 0.71,
      timestamp: now,
      signature: solana_sign(hash(above))  # Solana 私钥签名
    }
    ↓
Agent 提交 ReputationProof 到 Arbitrum 上的 Gradience 验证合约
    ↓
Arbitrum 合约验证:
    1. ed25519 签名验证 (Solana 签名)
    2. 检查 timestamp 没过期 (比如 24h 有效)
    3. 可选: 通过 Wormhole 查询 Solana 上的实际状态
    ↓
验证通过 → Agent 可以在 Arbitrum 上参与任务

成本: Agent 自己决定什么时候同步，~$0.001/次
不需要实时桥，不需要中心化聚合
```

### 场景 C: Agent 在 EVM 链上完成任务后回传凭证 ← 你问的核心问题

```
                    EVM 链 (Arbitrum)                          Solana
                    ─────────────────                         ──────

1. Customer 在 Arbitrum 发任务
   GradienceEVM.postTask()
       ↓
2. Agent 在本地执行 (off-chain)
       ↓
3. Agent 提交结果到 Arbitrum
   GradienceEVM.submitResult()
       ↓
4. Judge 在 Arbitrum 评判
   GradienceEVM.judgeAndPay()
       ↓
   emit TaskCompleted(agent, score, taskId)
       ↓
   ┌──────────────────────────────────┐
   │  跨链回传 (3 种方式选其一)        │
   │                                  │
   │  方式 1: Wormhole 自动消息       │    ───→  Solana 合约收到 VAA
   │  方式 2: LayerZero 自动消息      │    ───→  Solana 合约收到证明
   │  方式 3: Agent 自行提交证明      │    ───→  Agent 调 updateCredential()
   │                                  │
   └──────────────────────────────────┘
                                                    ↓
                                        5. Solana 合约验证 + 写入
                                           verifyAndStoreCredential()
                                               ↓
                                           验证内容:
                                           · 跨链消息签名 (Wormhole VAA / LZ proof)
                                           · 或 EVM tx 的 Merkle proof
                                           · task_id 没有被重复提交
                                           · score 在合理范围内
                                               ↓
                                           写入 Agent PDA:
                                           · credentials[] 新增一条
                                           · per_chain_stats.arbitrum 更新
                                           · global_score 重新计算
                                               ↓
                                           完成 ✅
```

---

## 四、三种回传方式的对比

### 方式 1: Wormhole 自动消息 (推荐)

```solidity
// Arbitrum 上的 GradienceEVM 合约
function judgeAndPay(...) external {
    // ... 正常评判逻辑 ...

    // 自动通过 Wormhole 发消息到 Solana
    wormhole.publishMessage(
        nonce,
        abi.encode(
            agent,          // Agent EVM 地址
            taskId,
            score,
            judge,
            block.timestamp
        ),
        consistencyLevel  // 需要多少 Guardian 签名
    );
}
```

```rust
// Solana 上的 Gradience 合约
fn receive_wormhole_message(ctx: Context<ReceiveMsg>, vaa: Vec<u8>) -> Result<()> {
    // 1. 验证 Wormhole VAA (Guardian 签名)
    let posted_message = verify_vaa(&vaa)?;

    // 2. 解码消息
    let (agent_evm, task_id, score, judge, timestamp) = decode(posted_message.payload);

    // 3. 找到 Agent 的 PDA (通过 identity_proofs 里的 EVM 地址映射)
    let agent_pda = find_agent_by_evm_address(agent_evm)?;

    // 4. 写入凭证
    agent_pda.credentials.push(Credential {
        source_chain: "arbitrum",
        task_id,
        score,
        judge: judge.to_string(),
        bridge_proof: BridgeProof::Wormhole { vaa_hash: hash(vaa) },
        timestamp,
    });

    // 5. 更新全局声誉
    recalculate_reputation(agent_pda)?;

    Ok(())
}
```

优点: 自动化, 去信任 (Guardian 网络验证)
缺点: 每次跨链消息有 gas 成本 (~$0.05-0.50)
适合: 每笔任务都很重要，需要及时同步

### 方式 2: Agent 自行批量提交 (最经济)

```
Agent 在 Arbitrum 完成 10 个任务
    ↓
Agent 收集 10 个 TaskCompleted event 的 receipt proof
    ↓
Agent 提交到 Solana:
    batchUpdateCredentials(
        proofs: [
            { chain: "arbitrum", tx_hash, log_index, receipt_proof },
            { chain: "arbitrum", tx_hash, log_index, receipt_proof },
            ...
        ]
    )
    ↓
Solana 合约验证每个 proof:
    · 验证 EVM receipt 的 Merkle proof (需要 block header oracle)
    · 或者验证 Wormhole VAA (如果 Agent 去 Wormhole 拿了证明)
    ↓
批量写入 10 条 credentials
```

优点: Agent 控制节奏, 可以攒一批再同步, 省钱
缺点: 有延迟, Agent 可能偷懒不同步
适合: 日常操作, 非紧急凭证

### 方式 3: LayerZero 消息 (中间方案)

类似方式 1，但用 LayerZero 替代 Wormhole。
LayerZero 更轻量，支持更多链，但安全模型不同。

---

## 五、EVM 链上需要部署的合约

```
GradienceEVM (部署在每条 EVM 链上)
├── GradienceCore.sol
│   ├── postTask()          # 发布任务
│   ├── submitResult()      # 提交结果
│   ├── judgeAndPay()       # 评判 + 结算 + 触发跨链回传
│   └── cancelTask()
│
├── ReputationVerifier.sol
│   ├── verifyReputationProof()   # 验证 Agent 从 Solana 带来的声誉证明
│   ├── getAgentReputation()      # 查询缓存的声誉
│   └── isAgentEligible()         # 检查 Agent 是否有资格参与
│
├── IdentityLinker.sol
│   ├── linkSolanaIdentity()      # Agent 将 EVM 地址关联到 Solana 身份
│   └── verifyIdentityLink()      # 验证关联
│
└── BridgeAdapter.sol
    ├── sendToSolana()            # 通过 Wormhole/LayerZero 发消息
    └── receiveFromSolana()       # 接收 Solana 的消息
```

合约是**轻量级**的:
· 不存储完整声誉历史 (那在 Solana 上)
· 只缓存最近验证过的 ReputationProof (有时效性)
· 核心逻辑和 Solana 版本一致 (Escrow + Judge + Pay)
· 多出一个 BridgeAdapter 用于跨链通信

---

## 六、关键设计决策

### Q1: EVM 上的 Judge 怎么选？

两种模式:
a) Solana Judge 跨链服务 — Judge 在 Solana 上有信誉，通过签名远程评判 EVM 上的任务
b) 本地 Judge — EVM 链上也有 Judge，但声誉还是从 Solana 读取

推荐 (a)，因为 Judge 的信誉是核心资产，应该统一管理。

### Q2: EVM 上结算用什么币？

· 任务结算: USDC (各链都有)
· 质押: 该链上的 GRAD token (如果有) 或 USDC
· 协议费: 2% 照收，一部分通过桥回传到 Solana 金库

### Q3: 声誉计算在哪里做？

**只在 Solana 上做。** EVM 链不计算全局声誉。

```
EVM 链: 只记录原始事件 (谁完成了什么，得了多少分)
         ↓ 跨链回传
Solana: 汇总所有链的数据 → 计算全局声誉 → 更新 PDA
```

这保证了声誉的一致性，不会出现"在 Arbitrum 上 90 分，
在 Base 上 60 分，不知道该信哪个"的问题。

### Q4: 如果跨链桥挂了怎么办？

Agent 自行提交 (方式 2) 作为后备。
Agent 可以拿着 EVM 链上的 tx receipt 手动提交到 Solana。
这不依赖任何桥，只需要 EVM block header 可验证。

---

## 七、完整的多链生命周期

```
              Nostr (发现层)
              ┌─────────────────────────┐
              │ Agent 公告: "我在         │
              │ Solana + Arbitrum 上接活" │
              │ 声誉: 85 分              │
              └───────────┬─────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
    ┌─────┴─────┐                   ┌─────┴─────┐
    │  Solana    │                   │ Arbitrum   │
    │            │                   │            │
    │ postTask() │                   │ postTask() │
    │    ↓       │                   │    ↓       │
    │ Agent 执行 │←─── XMTP 协商 ──→│ Agent 执行 │
    │    ↓       │                   │    ↓       │
    │ Judge 评判 │                   │ Judge 评判 │
    │    ↓       │                   │    ↓       │
    │ 写入 PDA ✅│←── Wormhole ─────│ 回传凭证   │
    │            │                   │            │
    └────────────┘                   └────────────┘
          │
    ┌─────┴─────┐
    │ Agent PDA  │
    │ (信任根)   │
    │            │
    │ Solana: 87 │
    │ Arb:    82 │
    │ Global: 85 │
    └────────────┘
```

---

## 八、架构图更新 (最终版)

```
┌────────────────────────────────────────────────────────────┐
│  互操作层   Google A2A (能力声明) + MCP (Tool 调用)         │
├────────────────────────────────────────────────────────────┤
│  发现层     Nostr NIP-89 (Agent 公告) + NIP-90 (DVM 任务)  │
├────────────────────────────────────────────────────────────┤
│  通信层     XMTP (Agent E2E 加密通信, MLS)                  │
├────────────────────────────────────────────────────────────┤
│  结算层                                                     │
│  ┌──────────────────────┐    ┌──────────────────────┐      │
│  │ Solana (Home Chain)  │    │ EVM Guest Chains     │      │
│  │ · ChainHub 核心合约  │←──→│ · 轻量 Gradience 合约│      │
│  │ · Agent 身份 PDA     │    │ · ReputationVerifier │      │
│  │ · 声誉计算 (唯一)    │    │ · BridgeAdapter      │      │
│  │ · MagicBlock ER/PER  │    │ · L2: Arb/OP/Base    │      │
│  │ · MagicBlock VRF     │    │ · 凭证回传到 Solana  │      │
│  │ · x402/OWS 微支付    │    │                      │      │
│  └──────────┬───────────┘    └──────────┬───────────┘      │
│             │         跨链桥             │                  │
│             └── Wormhole / LayerZero ────┘                  │
├────────────────────────────────────────────────────────────┤
│  协议内核   Escrow + Judge + Reputation (链无关状态机)       │
└────────────────────────────────────────────────────────────┘
```
