# 架构重构：协议栈分层重定位 — 任务拆解

> **创建日期**: 2026-04-03
> **触发原因**: 经过深入调研 Nostr NIP-89/90、XMTP、MagicBlock 产品线后，
> 发现现有架构存在组件职责错位问题，需要重新分层。
> **涉及范围**: 白皮书、README、架构文档、代码、任务系统

---

## 核心变更总结

### 新四层架构

```
Layer 4: 互操作层  Google A2A + MCP
Layer 3: 发现层    Nostr NIP-89/90 (替代 Indexer)
Layer 2: 通信层    XMTP (替代 libp2p/WebRTC/Nostr DM)
Layer 1: 结算层    Solana L1 (Home Chain) + EVM Guest Chains
         ├── ChainHub 核心合约 + Agent 身份 PDA
         ├── MagicBlock ER/PER/VRF (Solana 可选增强)
         ├── x402/OWS 微支付
         ├── 跨链桥: Wormhole / LayerZero
         └── EVM 轻量合约 + 凭证回传
Layer 0: 协议内核  Escrow + Judge + Reputation (链无关状态机)
```

> 注意: MagicBlock 不是独立的"执行层"。Agent 执行任务是 off-chain 的。
> MagicBlock 是 Solana 结算层的可选增强 (高频加速 + TEE 隐私)。
> 多链架构详见 docs/architecture-refactor/01-multichain-credential-architecture.md

### 变更矩阵

| 组件 | 之前定位 | 新定位 | 动作 |
|------|---------|--------|------|
| MagicBlock ER | A2A 通信协议 (adapter) | 任务执行引擎 (Layer 2) | **重定位** |
| MagicBlock PER | 未使用 | sealed 模式执行 (Layer 2) | **新增** |
| MagicBlock VRF | 未使用 | Judge 随机选择 (Layer 2) | **新增** |
| Nostr | 发现+DM+声誉 (混合) | 只做发现 (Layer 4) | **缩小职责** |
| Nostr NIP-90 DVM | 无 | 去中心化任务市场 (Layer 4) | **新增** |
| XMTP | packages/xmtp-adapter 存在但未集成 | Agent 通信主力 (Layer 3) | **升级为主力** |
| Google A2A | adapter 存在 | 互操作标准 (Layer 5) | **保留** |
| libp2p | A2A 通信协议 | - | **移除** |
| WebRTC | A2A 通信协议 | - | **移除** |
| Nostr NIP-04 DM | A2A 加密消息 | - | **移除** (deprecated) |
| 自建 Indexer | Agent 发现服务 | - | **移除** |

---

## 任务拆解

### Phase A: 文档更新 (白皮书 + README + 架构)

#### GRA-138: [Arch] 白皮书 §8.4 MagicBlock 重定位
- **优先级**: P0
- **内容**:
  - §8.4 "Option A: Ephemeral Rollups" 重写为 "Execution Layer"
  - 明确 ER 用于任务执行 (非通信), PER 用��� sealed 模式, VRF 用于 Judge
  - 从 Transport Adapters 表格中移除 MagicBlock (它不是 transport)
  - 更新 "Option C: Hybrid" 映射表
- **文件**: `protocol/WHITEPAPER.md`

#### GRA-139: [Arch] 白皮书 Transport Adapters 表格更新
- **优先级**: P0
- **内容**:
  - 去掉: libp2p, MagicBlock (不是 transport)
  - 新增: xmtp (Agent E2E 通信), nostr-dvm (发现+任务市场)
  - 保留: http-json, websocket, grpc, solana-rpc, google-a2a, openai-compat, mcp
  - 更新适配器总数描述
- **文件**: `protocol/WHITEPAPER.md`

#### GRA-140: [Arch] 白皮书架构图 + Indexer 引用更新
- **优先级**: P0
- **内容**:
  - L1201 架构图: "Indexer" 改为 "Nostr Discovery"
  - §8.3 Network Layer 描述更新: 加入 XMTP 通信层
  - 新增执行层 (MagicBlock ER/PER/VRF) 描述
  - §5.4 "MagicBlock Private ER with TEE" 引用更新为正确定位
- **文件**: `protocol/WHITEPAPER.md`

#### GRA-141: [Arch] 白皮书新增 Nostr 发现层 + XMTP 通信层章节
- **优先级**: P1
- **内容**:
  - 新增/改写: Discovery Layer — Nostr NIP-89 (Agent 公告) + NIP-90 (DVM 任务市场)
  - 新增/改写: Messaging Layer — XMTP (MLS E2E, 钱包即身份)
  - 说明为什么用 NIP-90 替代 Indexer
  - 说明为什么用 XMTP 替代 libp2p/WebRTC
- **文件**: `protocol/WHITEPAPER.md`

#### GRA-142: [Arch] README.md 架构图 + MagicBlock 段落更新
- **优先级**: P0
- **内容**:
  - L183 "Execution: MagicBlock Ephemeral Rollups" → 重写定位为执行层
  - L164 "Agent messaging (libp2p)" → 改为 XMTP
  - L192 mermaid 图 → 更新为五层架构
  - 确保 XMTP/Nostr/MagicBlock 各在正确的层
- **文件**: `README.md`

#### GRA-143: [Arch] README-zh.md 中文版同步更新
- **优先级**: P1
- **内容**: 与 README.md 同步所有架构变更
- **文件**: `protocol/README-zh.md`

#### GRA-144: [Arch] a2a-protocol-spec.md 设计文档更新
- **优先级**: P1
- **内��**:
  - 更新 A2A 协议层定义
  - MagicBlock 从协议层移除，改为执行引擎引用
  - 加入 XMTP 作为通信传输层
  - 加入 Nostr NIP-90 作为发现机制
- **文件**: `protocol/design/a2a-protocol-spec.md`

#### GRA-145: [Arch] system-architecture.md + security-architecture.md 更新
- **优先级**: P1
- **内容**: 系统架构和安全架构文档同步更新
- **文件**: `protocol/design/system-architecture.md`, `protocol/design/security-architecture.md`

### Phase B: 代码重构

#### GRA-146: [Code] A2ARouter 移除 libp2p/WebRTC adapter
- **优先级**: P1
- **内容**:
  - 从 A2ARouter 移除 LibP2PAdapter, WebRTCAdapter
  - 更新 ProtocolType 类型定义
  - 更新 protocolPriority 配置
  - 更新相关测试
- **文件**: `apps/agentm/src/main/a2a-router/`, `apps/agentm/src/shared/`

#### GRA-147: [Code] MagicBlockAdapter 从 A2ARouter 移出，重构为 ExecutionEngine
- **优先级**: P1
- **内容**:
  - MagicBlockAdapter 从 router adapters 中移除
  - 创建 `apps/agentm/src/main/execution/magicblock-engine.ts`
  - 实现 Delegation → Execute → Commit → Undelegate 生命周期
  - 关联到 ChainHub 合约调用
  - 区分 ER (普通执行) 和 PER (sealed 模式)
- **文件**: 新文件 + 重构

#### GRA-148: [Code] Nostr adapter 缩小为发现层 (NIP-89/90)
- **优先级**: P1
- **内容**:
  - 移除 Nostr DM 功能 (NIP-04)
  - 保留/新增: NIP-89 Agent 公告 (kind:31990)
  - 新增: NIP-90 DVM 任务发布/匹配
  - 保留: kind:10004 声誉广播
  - 更新 nostr-types.ts
- **文件**: `apps/agentm/src/main/a2a-router/adapters/nostr-adapter.ts`, `apps/agentm/src/shared/nostr-types.ts`

#### GRA-149: [Code] XMTP adapter 集成为主通信层
- **优先级**: P1
- **内容**:
  - 将 packages/xmtp-adapter 集成到 A2ARouter
  - 创建 XMTPAdapter implements ProtocolAdapter
  - 配置为 direct_message/task_negotiation 的首选协��
  - 升级到 @xmtp/agent-sdk
- **文件**: `packages/xmtp-adapter/`, `apps/agentm/src/main/a2a-router/`

#### GRA-150: [Code] 移除 packages/indexer-mock
- **优先级**: P2
- **内容**:
  - 删除 packages/indexer-mock/
  - 从 pnpm-workspace.yaml 移除
  - 更新所有引用
- **文件**: `packages/indexer-mock/`, `pnpm-workspace.yaml`

#### GRA-151: [Code] A2ARouter protocolPriority 更新
- **优先级**: P1
- **内容**:
  - 更新路由优先级:
    - broadcast → ['nostr']
    - discovery → ['nostr'] (NIP-89/90)
    - direct_message → ['xmtp']
    - task_negotiation → ['nostr-dvm', 'xmtp']
    - interop → ['google-a2a']
  - 移除: 'libp2p', 'magicblock', 'webrtc' 从所有优先级
- **文件**: `apps/agentm/src/main/a2a-router/router.ts`, `apps/agentm/src/main/a2a-router/constants.ts`

### Phase C: 任务系统清理

#### GRA-152: [Tasks] 取消/更新过时任务
- **优先级**: P2
- **内容**:
  - GRA-65 (Indexer setup) → 取消，改为 Nostr NIP-89/90
  - 更新 OWS 相关任务描述
  - 更新任何引用 libp2p/WebRTC 的任务
- **文件**: `docs/tasks/`

---

## 执行顺序

```
Phase A (文档) — 先确定架构设计
  GRA-138 → GRA-139 → GRA-140 → GRA-141  (白皮书，可并行)
  GRA-142 → GRA-143                        (README)
  GRA-144 → GRA-145                        (设计文档)

Phase B (代码) — 按依赖关系
  GRA-146 (去 libp2p/WebRTC)
  GRA-147 (MagicBlock → ExecutionEngine)   依赖 GRA-146
  GRA-148 (Nostr 缩小)                    可并行
  GRA-149 (XMTP 集成)                     可并行
  GRA-150 (去 indexer-mock)                可随时
  GRA-151 (Router priority)               依赖 GRA-146~149

Phase C (清理)
  GRA-152 (任务清理)                       最后
```

## 预计工作量

| Phase | 任务数 | 预计时间 |
|-------|-------|---------|
| A 文档 | 8 | 4-6 小时 |
| B 代码 | 6 | 8-12 小时 |
| C 清理 | 1 | 1 小时 |
| **总计** | **15** | **13-19 小时** |
