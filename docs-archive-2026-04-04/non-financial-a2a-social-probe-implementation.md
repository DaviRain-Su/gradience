# 非金融 A2A 社交探路实现指南：Nostr + XMTP + Google A2A + Chain Hub

> **文档类型**: 技术实现指南  
> **更新日期**: 2026-04-04  
> **核心栈**: Nostr (发现) + XMTP (消息) + Google A2A (互操作) + Chain Hub (匹配引擎)  
> **可选增强**: MagicBlock ER (实时通信) + TEE (隐私计算)

---

## 执行摘要

### 推荐技术栈 (2026-04 当前实现)

| 层级 | 技术 | 作用 | 状态 |
|------|------|------|------|
| **发现** | Nostr (NIP-01/04) | Agent 在线状态 + 能力广播 | ✅ 已实现 |
| **消息** | XMTP (v3) | 点对点加密通信 | ✅ 已实现 |
| **互操作** | Google A2A Protocol | 跨框架 Agent 互通 | ✅ 已实现 |
| **匹配** | Chain Hub Soul Engine | Embedding + LLM 分析 | 🟡 设计完成 |
| **实时** | MagicBlock ER (可选) | 高频实时消息通道 | 🔵 适配器已有 |

### 架构决策变更

**原架构 (已废弃)**:
```
❌ libp2p + A2A = 通信主干 (P2P 复杂度过高)
```

**新架构 (当前实现)**:
```
✅ Nostr = 发现层 (轻量、开放、无需中心化服务器)
✅ XMTP = 消息层 (端到端加密、Web3 原生)
✅ Google A2A = 互操作层 (跨生态兼容)
✅ MagicBlock ER = 可选实时层 (高频场景)
```

**变更原因**:
1. **libp2p 复杂度过高** - NAT 穿透、连接管理、中继节点运维成本高
2. **Nostr + XMTP 更轻量** - 开发者无需运行节点，依赖公共中继
3. **更好的 Web3 集成** - XMTP 原生支持钱包身份，Nostr 生态成熟

---

## 1. 架构设计

### 1.1 三层架构 (更新后)

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: 应用层 (Application)                                 │
│  ├── AgentM (用户入口)                                         │
│  │   ├── GUI: 社交发现、探路、匹配报告                        │
│  │   ├── API: Agent 自动化调用                                │
│  │   └── A2A Router (协议路由)                                │
│  │                                                           │
│  ├── Google A2A Protocol                                      │
│  │   ├── Agent Card (能力声明)                                │
│  │   ├── Task/Message (结构化对话)                            │
│  │   └── 跨框架互操作 (LangChain/CrewAI/AutoGen)            │
│  │                                                           │
│  └── SOUL.md Profile System                                   │
│      ├── 身份：价值观、边界、兴趣                            │
│      ├── 隐私：public / zk-selective / private               │
│      └── 存储：IPFS / Arweave (链上仅存 hash)                │
└──────────────────────┬──────────────────────────────────────────┘
                       │ 消息路由
┌──────────────────────▼──────────────────────────────────────────┐
│  Layer 2: 协议层 (Protocol Layer)                              │
│  ├── Nostr (发现层)                                           │
│  │   ├── NIP-01: 基础事件                                     │
│  │   ├── NIP-04: 加密消息 (已迁移到 XMTP)                    │
│  │   ├── Agent Presence (在线状态)                           │
│  │   └── Capability Broadcast (能力广播)                     │
│  │                                                           │
│  ├── XMTP v3 (消息层)                                         │
│  │   ├── 端到端加密 (Signal Protocol)                        │
│  │   ├── 钱包身份 (无需额外注册)                            │
│  │   ├── 消息历史同步                                        │
│  │   └── 跨设备支持                                         │
│  │                                                           │
│  └── MagicBlock ER (可选实时层)                               │
│      ├── Ephemeral Rollup (短暂状态)                         │
│      ├── 高频消息 (游戏、实时协作)                          │
│      └── TEE 隐私保护                                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │ 数据处理
┌──────────────────────▼──────────────────────────────────────────┐
│  Layer 1: 计算与结算层 (Compute & Settlement)                  │
│  ├── Chain Hub Soul Matching Engine                           │
│  │   ├── Embedding 快速筛选 (sentence-transformers)          │
│  │   ├── LLM 深度分析 (GPT-4o-mini / Claude-3-haiku)        │
│  │   ├── 多维度评分 (价值观/语气/边界/兴趣)                  │
│  │   └── 生成匹配报告 + 建议话题                             │
│  │                                                           │
│  ├── Solana Settlement                                        │
│  │   ├── Reputation PDA (社交准确率)                         │
│  │   ├── Escrow (付费匹配服务)                               │
│  │   └── Judge Verification (可选)                           │
│  │                                                           │
│  └── 可选: MagicBlock TEE                                     │
│      ├── 隐私匹配计算                                         │
│      ├── ZK 证明生成                                         │
│      └── 结果签名上链                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 数据流 (更新后)

```
发现阶段:
Agent A → Nostr Relay → 查询 Agent Presence 事件
       ← 返回: Agent B (pubkey, capabilities, reputation, SOUL hash)

建立连接:
Agent A → XMTP Network → 发起加密会话 → Agent B
       (Signal Protocol 端到端加密，钱包签名身份验证)

社交探路:
Agent A ─ XMTP 加密通道 ─→ Agent B
        (15 轮结构化对话，受 SOUL.md 边界约束)
        
        对话记录 (加密存储) → IPFS / Arweave

匹配分析:
对话记录 CID → Chain Hub Soul Engine
                ↓
            1. Embedding 相似度 (快速)
                ↓
            2. LLM 深度分析 (主观)
                ↓
            3. 生成匹配报告
                ├── 总分 (0-100)
                ├── 维度评分 (价值观/语气/边界/兴趣)
                ├── 匹配亮点 (共同点)
                ├── 风险提示 (冲突点)
                └── 建议话题 (破冰)

可选 TEE 增强 (高隐私场景):
对话记录 → MagicBlock TEE 环境
            ↓
        隐私计算 (Agent 看不到原始数据)
            ↓
        ZK 证明 + 匹配结果哈希

链上结算:
匹配结果 hash → Solana Reputation PDA
                ├── 更新 Agent 社交准确率
                └── 记录匹配历史 (仅 hash)
```

---

## 2. Chain Hub SDK 接口定义

### 2.1 核心接口 (更新后)

```typescript
// packages/chain-hub/src/social/index.ts

import { A2ARouter } from '@gradience/agentm/a2a-router';
import { NostrAdapterOptions } from '@gradience/agentm/a2a-router/adapters/nostr-adapter';
import { XMTPAdapterOptions } from '@gradience/agentm/a2a-router/adapters/xmtp-adapter';
import { GoogleA2AAdapterOptions } from '@gradience/agentm/a2a-router/adapters/google-a2a-adapter';

interface SocialProbeConfig {
  // 身份
  agentId: string;
  soulProfile: SoulProfile;
  walletPrivateKey: string;  // 用于 XMTP 和 Nostr 签名
  
  // A2A Router 配置 (多协议支持)
  router: {
    enableNostr: boolean;      // 默认 true (发现层)
    enableXMTP: boolean;       // 默认 true (消息层)
    enableGoogleA2A: boolean;  // 默认 true (互操作层)
    enableMagicBlock?: boolean; // 可选 (实时层)
    
    nostrOptions?: NostrAdapterOptions;
    xmtpOptions?: XMTPAdapterOptions;
    googleA2AOptions?: GoogleA2AAdapterOptions;
  };
  
  // 匹配引擎配置
  matching: {
    embeddingModel: string;       // 'sentence-transformers/all-MiniLM-L6-v2'
    llmModel: string;             // 'gpt-4o-mini' | 'claude-3-haiku'
    minScoreThreshold: number;    // 默认 75
  };
  
  // 可选: MagicBlock TEE 增强
  magicblock?: {
    enabled: boolean;
    endpoint: string;
    teeConfig: TEEConfig;
  };
}

class ChainHubSocial {
  private router: A2ARouter;
  private matchingEngine: SoulMatchingEngine;
  private magicblock?: MagicBlockClient;
  
  constructor(config: SocialProbeConfig) {
    // 初始化 A2A Router (Nostr + XMTP + Google A2A)
    this.router = new A2ARouter({
      agentId: config.agentId,
      enableNostr: config.router.enableNostr,
      enableXMTP: config.router.enableXMTP,
      nostrOptions: config.router.nostrOptions,
      xmtpOptions: config.router.xmtpOptions,
      googleA2AOptions: config.router.googleA2AOptions,
    });
    
    this.matchingEngine = new SoulMatchingEngine(config.matching);
    
    if (config.magicblock?.enabled) {
      this.magicblock = new MagicBlockClient(config.magicblock);
    }
  }
  
  async initialize(): Promise<void> {
    await this.router.initialize();
    console.log('[ChainHubSocial] Initialized with protocols:', 
      this.router.getAvailableProtocols());
  }
  
  /**
   * =====================================
   * 1. 发现对等 Agent (多协议发现)
   * =====================================
   */
  
  async discoverPeers(filters: {
    interests?: string[];
    minReputation?: number;
    soulType?: 'human' | 'agent';
    capabilities?: string[];
  }): Promise<PeerInfo[]> {
    const allPeers: PeerInfo[] = [];
    
    // 1. Nostr 发现 (主要方式 - 轻量、实时)
    try {
      const nostrAdapter = this.router.getAdapter('nostr');
      if (nostrAdapter) {
        const nostrPeers = await nostrAdapter.discoverAgents({
          minReputation: filters.minReputation,
          capabilities: filters.capabilities,
          availableOnly: true,  // 只返回在线 Agent
          limit: 100
        });
        allPeers.push(...nostrPeers.map(p => ({
          id: p.address,
          address: p.address,
          displayName: p.displayName,
          capabilities: p.capabilities,
          reputationScore: p.reputationScore,
          nostrPubkey: p.nostrPubkey,
          discoveredVia: 'nostr' as const,
          lastSeenAt: p.lastSeenAt
        })));
      }
    } catch (error) {
      console.error('[ChainHubSocial] Nostr discovery failed:', error);
    }
    
    // 2. Google A2A 发现 (补充 - 跨生态)
    try {
      const a2aAdapter = this.router.getAdapter('google-a2a');
      if (a2aAdapter) {
        const a2aPeers = await a2aAdapter.discoverAgents({
          capabilities: ['social-probe', 'soul-matching'],
        });
        allPeers.push(...a2aPeers.map(p => ({
          id: p.address,
          address: p.address,
          displayName: p.displayName,
          capabilities: p.capabilities,
          reputationScore: p.reputationScore,
          a2aEndpoint: p.a2aEndpoint,
          discoveredVia: 'google-a2a' as const,
          lastSeenAt: p.lastSeenAt
        })));
      }
    } catch (error) {
      console.error('[ChainHubSocial] Google A2A discovery failed:', error);
    }
    
    // 3. 合并、去重、过滤
    const uniquePeers = deduplicateByAddress(allPeers);
    
    return uniquePeers.filter(peer => {
      if (filters.minReputation && peer.reputationScore < filters.minReputation) {
        return false;
      }
      if (filters.capabilities && 
          !filters.capabilities.some(c => peer.capabilities.includes(c))) {
        return false;
      }
      return true;
    });
  }
  
  /**
   * =====================================
   * 2. 发起社交探路 (核心方法 - 更新版)
   * =====================================
   */
  
  async probe(params: {
    // 目标
    targetAddress: string;      // Solana 地址 (用于 XMTP)
    targetNostrPubkey?: string; // 可选 Nostr 公钥
    
    // 探路配置
    probeConfig: {
      depth: 'light' | 'deep';
      maxTurns: number;
      topics?: string[];
      avoidTopics?: string[];
      timeoutMs: number;
    };
    
    // 边界约束 (来自双方 SOUL.md)
    boundaries: {
      prober: SoulBoundaries;
      target: SoulBoundaries;
    };
    
    // 协议选择
    preferredProtocol?: 'xmtp' | 'nostr' | 'google-a2a';
    
    // 回调
    onProgress?: (turn: number, message: A2AMessage) => void;
    onComplete?: (result: ProbeResult) => void;
    
  }): Promise<ProbeSession> {
    const sessionId = generateSessionId();
    
    // 1. 选择协议 (默认 XMTP)
    const protocol = params.preferredProtocol ?? 'xmtp';
    
    // 2. 发送探路邀请
    const inviteResult = await this.router.send({
      to: params.targetAddress,
      type: 'task_proposal',
      preferredProtocol: protocol,
      payload: {
        sessionId,
        type: 'social-probe',
        depth: params.probeConfig.depth,
        maxTurns: params.probeConfig.maxTurns,
        proberSoulHash: hashSoul(this.soulProfile),
        timestamp: Date.now()
      }
    });
    
    if (!inviteResult.success) {
      throw new Error(`Failed to send probe invite: ${inviteResult.error}`);
    }
    
    // 3. 等待对方接受 (订阅回复)
    const accepted = await this.waitForAcceptance(sessionId, params.probeConfig.timeoutMs);
    if (!accepted) {
      throw new Error('Probe invitation not accepted');
    }
    
    // 4. 执行受控对话
    const conversation: A2AMessage[] = [];
    
    for (let turn = 0; turn < params.probeConfig.maxTurns; turn++) {
      // 生成探路问题 (受边界约束)
      const question = await this.generateProbeQuestion({
        turn,
        conversation,
        boundaries: params.boundaries,
        topics: params.probeConfig.topics,
        avoidTopics: params.probeConfig.avoidTopics
      });
      
      // 通过 A2A Router 发送
      const sendResult = await this.router.send({
        to: params.targetAddress,
        type: 'direct_message',
        preferredProtocol: protocol,
        payload: {
          sessionId,
          turn,
          role: 'prober',
          content: question,
          timestamp: Date.now()
        }
      });
      
      if (!sendResult.success) {
        console.error(`Turn ${turn} send failed:`, sendResult.error);
        break;
      }
      
      conversation.push({
        id: sendResult.messageId,
        from: this.agentId,
        to: params.targetAddress,
        type: 'direct_message',
        protocol,
        timestamp: sendResult.timestamp,
        payload: { content: question, turn, role: 'prober' }
      });
      
      params.onProgress?.(turn, conversation[conversation.length - 1]);
      
      // 等待回复
      const response = await this.waitForResponse(
        sessionId,
        turn,
        params.probeConfig.timeoutMs
      );
      
      if (!response) {
        console.error(`Turn ${turn} timeout, ending probe`);
        break;
      }
      
      conversation.push(response);
      params.onProgress?.(turn, response);
      
      // 检查是否应结束
      if (await this.shouldEndProbe(conversation, params.boundaries)) {
        break;
      }
    }
    
    // 5. 上传对话记录到 IPFS/Arweave (加密)
    const conversationCID = await this.uploadEncryptedConversation(conversation);
    
    // 6. 返回会话
    const session: ProbeSession = {
      id: sessionId,
      targetAddress: params.targetAddress,
      protocol,
      conversation,
      conversationCID,
      status: 'completed',
      timestamp: Date.now()
    };
    
    params.onComplete?.(session);
    
    return session;
  }
  
  /**
   * 等待对方接受探路邀请
   */
  private async waitForAcceptance(
    sessionId: string,
    timeoutMs: number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), timeoutMs);
      
      const unsubscribe = this.router.subscribe(async (message) => {
        if (message.payload?.sessionId === sessionId &&
            message.type === 'task_accept') {
          clearTimeout(timeout);
          await unsubscribe();
          resolve(true);
        }
      });
    });
  }
  
  /**
   * 等待特定轮次的回复
   */
  private async waitForResponse(
    sessionId: string,
    turn: number,
    timeoutMs: number
  ): Promise<A2AMessage | null> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), timeoutMs);
      
      const unsubscribe = this.router.subscribe(async (message) => {
        if (message.payload?.sessionId === sessionId &&
            message.payload?.turn === turn &&
            message.payload?.role === 'target') {
          clearTimeout(timeout);
          await unsubscribe();
          resolve(message);
        }
      });
    });
  }
  
  /**
   * =====================================
   * 3. 灵魂匹配 (核心方法)
   * =====================================
   */
  
  async soulMatching(params: {
    // 输入
    probeSession: ProbeSession;
    targetSoul: SoulProfile;
    
    // 匹配配置
    dimensions: SoulDimension[];
    useLLM: boolean;
    useTEE: boolean;
    
    // 可选: Judge 验证
    judgeVerification?: boolean;
    
  }): Promise<MatchingResult> {
    // 1. 提取对话特征
    const conversationFeatures = await this.extractFeatures(
      params.probeSession.conversation
    );
    
    // 2. 计算匹配分数
    let scores: DimensionScores;
    
    if (params.useTEE && this.magicblock) {
      // 使用 MagicBlock TEE 隐私计算
      scores = await this.magicblock.computeMatching({
        proberSoul: this.soulProfile,
        targetSoul: params.targetSoul,
        conversation: conversationFeatures,
        dimensions: params.dimensions
      });
    } else {
      // 本地计算
      scores = await this.matchingEngine.computeScores({
        proberSoul: this.soulProfile,
        targetSoul: params.targetSoul,
        conversation: conversationFeatures,
        dimensions: params.dimensions,
        useLLM: params.useLLM
      });
    }
    
    // 3. 生成匹配报告
    const report = await this.generateMatchingReport({
      scores,
      conversation: params.probeSession.conversation,
      useLLM: params.useLLM
    });
    
    // 4. 可选: Judge 验证
    let judgeResult: JudgeVerification | undefined;
    if (params.judgeVerification) {
      judgeResult = await this.requestJudgeVerification({
        sessionId: params.probeSession.id,
        report
      });
    }
    
    // 5. 上链结果 (只存哈希)
    const resultHash = await this.publishToSolana({
      sessionId: params.probeSession.id,
      targetId: params.targetSoul.id,
      overallScore: report.overallScore,
      evidenceHash: hashEvidence(report)
    });
    
    return {
      sessionId: params.probeSession.id,
      overallScore: report.overallScore,
      dimensionScores: scores,
      report: report.summary,
      keyMatches: report.keyMatches,
      risks: report.risks,
      suggestedTopics: report.suggestedTopics,
      judgeVerification: judgeResult,
      resultHash,
      timestamp: Date.now()
    };
  }
  
  /**
   * =====================================
   * 4. 辅助方法
   * =====================================
   */
  
  private async generateProbeQuestion(params: {
    turn: number;
    conversation: A2AMessage[];
    boundaries: { prober: SoulBoundaries; target: SoulBoundaries };
    topics?: string[];
    avoidTopics?: string[];
  }): Promise<string> {
    // 基于当前轮次和话题生成问题
    const availableTopics = params.topics?.filter(
      t => !params.avoidTopics?.includes(t) && 
           !params.boundaries.target.forbiddenTopics?.includes(t)
    ) || ['general'];
    
    const topic = availableTopics[params.turn % availableTopics.length];
    
    // 使用轻量 LLM 生成自然问题
    return await this.matchingEngine.generateQuestion({
      topic,
      turn: params.turn,
      previousContext: params.conversation.slice(-3),
      tone: params.boundaries.prober.communicationStyle
    });
  }
  
  private async shouldEndProbe(
    conversation: A2AMessage[],
    boundaries: { prober: SoulBoundaries; target: SoulBoundaries }
  ): Promise<boolean> {
    // 检查是否触发结束条件
    const lastMessage = conversation[conversation.length - 1];
    
    // 1. 对方明确结束
    if (lastMessage.metadata?.endSignal) {
      return true;
    }
    
    // 2. 触及边界禁忌
    if (boundaries.target.forbiddenTopics?.some(
      topic => lastMessage.content.includes(topic)
    )) {
      return true;
    }
    
    // 3. 自然结束信号
    if (lastMessage.content.match(/(?:goodbye|bye|end|stop)/i)) {
      return true;
    }
    
    return false;
  }
  
  private async publishToSolana(params: {
    sessionId: string;
    targetId: string;
    overallScore: number;
    evidenceHash: string;
  }): Promise<string> {
    // 通过 Chain Hub 发布到 Solana
    return await this.hub.solana.publishSocialResult({
      ...params,
      proberId: this.agentId,
      timestamp: Date.now()
    });
  }
}
```

### 2.2 类型定义

```typescript
// types/social.ts

interface PeerInfo {
  id: string;
  endpoint: string;
  multiaddr: string;
  card?: AgentCard;
  reputation?: number;
}

interface AgentCard {
  // Google A2A 标准字段
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
  };
  
  // Gradience 扩展
  extensions?: {
    gradience?: {
      soulType: 'human' | 'agent';
      soulHash: string;
      reputation: number;
      socialCapabilities: string[];
    };
  };
}

interface ProbeSession {
  id: string;
  taskId: string;
  targetPeerId: string;
  conversation: A2AMessage[];
  status: 'pending' | 'probing' | 'completed' | 'failed';
  timestamp: number;
  error?: string;
}

interface A2AMessage {
  id: string;
  taskId: string;
  role: 'prober' | 'target';
  content: string;
  metadata?: {
    turn?: number;
    timestamp: number;
    endSignal?: boolean;
  };
}

interface MatchingResult {
  sessionId: string;
  overallScore: number;
  dimensionScores: Record<SoulDimension, number>;
  report: string;
  keyMatches: string[];
  risks: string[];
  suggestedTopics: string[];
  judgeVerification?: JudgeVerification;
  resultHash: string;
  timestamp: number;
}

type SoulDimension = 
  | 'values' 
  | 'tone' 
  | 'boundaries' 
  | 'riskPreference' 
  | 'interests';

interface SoulBoundaries {
  forbiddenTopics?: string[];
  communicationStyle: string;
  maxConversationLength?: number;
  autoEndTriggers?: string[];
}
```

---

## 3. 纯 Off-Chain vs MagicBlock TEE 对比

### 3.1 对比表

| 维度 | 纯 Off-Chain (libp2p + A2A) | + MagicBlock TEE |
|------|----------------------------|------------------|
| **延迟** | < 100ms (本地计算) | 200-500ms (TEE 往返) |
| **隐私** | 端到端加密，但计算可见 | 计算过程加密，仅输出可见 |
| **信任假设** | 信任本地环境 | 信任 Intel TDX TEE |
| **成本** | 几乎为零 | MagicBlock 使用费 |
| **复杂度** | 低 | 中等 (需集成 PER) |
| **ZK 证明** | 需额外生成 | 原生支持 |
| **适用场景** | 普通社交探路 | 高敏感匹配、付费服务 |

### 3.2 决策树

```
开始
  ↓
匹配敏感度?
├── 普通 (公开 Soul Profile)
│   └── 纯 Off-Chain ✅
│       └── libp2p + A2A + 本地 LLM
│
└── 高敏感 (隐私 Soul Profile)
    └── 付费匹配服务?
        ├── 是
        │   └── MagicBlock TEE ✅
        │       └── PER 隐私计算 + ZK 证明
        │
        └── 否
            └── 纯 Off-Chain + ZK-Selective ✅
                └── 选择性披露属性
```

### 3.3 集成成本估算

| 方案 | 开发时间 | 运维成本 | 用户成本 |
|------|---------|---------|---------|
| **纯 Off-Chain** | 2-3 天 | 极低 | 免费 |
| **+ MagicBlock TEE** | +3-5 天 | 低 | ~$0.01/次 |

### 3.4 推荐配置

```typescript
// 默认配置: 纯 Off-Chain
const defaultConfig: SocialProbeConfig = {
  libp2p: {
    transports: [new WebSockets(), new WebRTC()],
    connectionEncryption: [new Noise()],
    peerDiscovery: [new Bootstrap({ list: bootstrapNodes })]
  },
  a2a: {
    protocol: 'google-a2a-v1',
    messageFormat: 'json'
  },
  matching: {
    embeddingModel: 'local/all-MiniLM-L6-v2',
    llmModel: 'local/phi-3-mini',
    minScoreThreshold: 75
  }
  // MagicBlock 不启用
};

// 高敏感配置: + MagicBlock TEE
const premiumConfig: SocialProbeConfig = {
  ...defaultConfig,
  magicblock: {
    enabled: true,
    endpoint: 'https://api.magicblock.xyz',
    teeConfig: {
      runtime: 'tdx',
      attestation: 'required'
    }
  }
};
```

---

## 4. Soul Probe Workflow (可交易功法)

### 4.1 Workflow 定义

```typescript
// workflow/soul-probe-premium.ts

export const soulProbeWorkflow: GradienceWorkflow = {
  id: 'workflow-soul-probe-premium-v1',
  name: '深度灵魂匹配探路',
  description: '多轮 A2A 对话 + LLM 深度分析 + 可选 TEE 隐私计算',
  version: '1.0.0',
  
  type: 'social',  // 非金融 Workflow
  
  steps: [
    {
      id: 'discover',
      name: '发现对等 Agent',
      chain: 'off-chain',  // 纯 off-chain
      action: 'discoverPeers',
      params: {
        filters: {
          capabilities: ['social-probe'],
          soulType: 'any'
        }
      },
      next: 'connect'
    },
    {
      id: 'connect',
      name: 'libp2p 建立连接',
      chain: 'off-chain',
      action: 'establishConnection',
      params: {
        encryption: 'noise',
        timeout: 30000
      },
      next: 'probe'
    },
    {
      id: 'probe',
      name: 'A2A 受控对话',
      chain: 'off-chain',
      action: 'runA2AProbe',
      params: {
        depth: 'deep',
        maxTurns: 15,
        protocol: 'google-a2a'
      },
      next: 'analyze'
    },
    {
      id: 'analyze',
      name: '匹配分析',
      chain: 'off-chain',  // 或 'magicblock' 如果启用 TEE
      action: 'computeMatching',
      params: {
        dimensions: ['values', 'tone', 'boundaries', 'interests'],
        useLLM: true,
        useTEE: '{{config.privacyLevel === "high"}}'
      },
      next: 'publish'
    },
    {
      id: 'publish',
      name: '上链结果',
      chain: 'solana',
      action: 'publishResult',
      params: {
        store: 'hash-only',  // 只存哈希
        updateReputation: true
      }
    }
  ],
  
  pricing: {
    model: 'perUse',
    perUsePrice: {
      token: 'USDC',
      amount: new BN(2000000)  // 2 USDC/次
    }
  },
  
  revenueShare: {
    creator: 300,    // 3% 功法创作者
    executor: 400,   // 4% 执行 Agent
    protocol: 200,   // 2% 协议
    judge: 100       // 1% Judge (非金融，降低)
  },
  
  requirements: {
    minReputation: 50,
    capabilities: ['libp2p', 'a2a-protocol']
  },
  
  isPublic: true,
  tags: ['social', 'soul-matching', 'a2a', 'privacy'],
  createdAt: Date.now()
};
```

### 4.2 Markdown 功法秘籍

```markdown
# 功法: 深度灵魂匹配探路 (Soul Probe Mastery)

## 简介
让你的 Agent 自动发现、连接、探路潜在社交匹配，
并生成详细的兼容性报告。

## 核心能力
- 🔍 自动发现: 通过 A2A Agent Card 发现潜在匹配
- 🔒 安全连接: libp2p 端到端加密
- 💬 智能对话: 15 轮受控 A2A 对话
- 🧠 深度分析: LLM 多维度评分
- 🛡️ 隐私保护: 可选 TEE 计算

## 使用方式

### 1. 配置你的 Agent
```typescript
const agent = new ChainHubSocial({
  soulProfile: mySoul,           // 你的 SOUL.md
  libp2p: { /* 网络配置 */ },
  a2a: { protocol: 'google-a2a' }
});
```

### 2. 发现对等 Agent
```typescript
const peers = await agent.discoverPeers({
  interests: ['AI', 'blockchain'],
  minReputation: 60
});
```

### 3. 发起探路
```typescript
const probe = await agent.probe({
  targetPeerId: peers[0].id,
  probeConfig: {
    depth: 'deep',
    maxTurns: 15
  }
});
```

### 4. 获取匹配报告
```typescript
const match = await agent.soulMatching({
  probeSession: probe,
  useLLM: true,
  useTEE: false  // 或 true 启用隐私计算
});

console.log(match.overallScore);  // 87
console.log(match.keyMatches);    // ["价值观重合", "沟通风格同频"]
```

## 技术栈
- libp2p: P2P 传输层
- Google A2A: 应用层协议
- Chain Hub: 匹配引擎
- MagicBlock (可选): TEE 隐私计算

## 定价
- 2 USDC/次
- 收益分配: 创作者 3% + 执行者 4% + 协议 2% + Judge 1%

## 版本历史
- v1.0.0 (2026-04-03): 初始版本
```

---

## 5. 完整流程伪代码

### 5.1 端到端流程

```typescript
// 完整社交探路流程

async function completeSocialProbe() {
  // ========== 1. 初始化 ==========
  const myAgent = new ChainHubSocial({
    agentId: 'agent:gradience:my-agent',
    soulProfile: loadSoulFromFile('./SOUL.md'),
    libp2p: defaultLibp2pConfig,
    a2a: { protocol: 'google-a2a-v1' },
    matching: {
      embeddingModel: 'local/all-MiniLM',
      llmModel: 'local/phi-3-mini',
      minScoreThreshold: 75
    }
  });
  
  // ========== 2. 发现 ==========
  console.log('🔍 发现潜在匹配...');
  
  const peers = await myAgent.discoverPeers({
    interests: ['AI research', 'decentralization'],
    minReputation: 60,
    soulType: 'agent'
  });
  
  console.log(`找到 ${peers.length} 个潜在匹配`);
  
  // ========== 3. 选择目标 ==========
  const target = peers[0];
  console.log(`🎯 选择目标: ${target.card.name}`);
  
  // ========== 4. 获取目标 Soul (可选) ==========
  const targetSoul = await fetchSoulFromIPFS(target.card.extensions.gradience.soulHash);
  
  // ========== 5. 发起探路 ==========
  console.log('💬 开始 A2A 对话...');
  
  const probe = await myAgent.probe({
    targetPeerId: target.id,
    targetEndpoint: target.endpoint,
    probeConfig: {
      depth: 'deep',
      maxTurns: 15,
      topics: ['AI philosophy', 'tech ethics', 'future of work'],
      avoidTopics: ['politics', 'religion'],
      timeoutMs: 60000
    },
    boundaries: {
      prober: extractBoundaries(myAgent.soulProfile),
      target: extractBoundaries(targetSoul)
    },
    onProgress: (turn, msg) => {
      console.log(`  Turn ${turn}: ${msg.content.substring(0, 50)}...`);
    }
  });
  
  console.log('✅ 对话完成');
  
  // ========== 6. 匹配分析 ==========
  console.log('🧠 分析匹配度...');
  
  const useTEE = targetSoul.privacyLevel === 'high';
  
  const match = await myAgent.soulMatching({
    probeSession: probe,
    targetSoul,
    dimensions: ['values', 'tone', 'boundaries', 'interests'],
    useLLM: true,
    useTEE,
    judgeVerification: false  // 普通匹配不需要
  });
  
  // ========== 7. 输出结果 ==========
  console.log('\n📊 匹配报告');
  console.log('================');
  console.log(`总体分数: ${match.overallScore}/100`);
  console.log(`推荐等级: ${match.overallScore >= 80 ? '✅ 强烈推荐' : match.overallScore >= 60 ? '⚠️ 谨慎尝试' : '❌ 不建议'}`);
  console.log('\n匹配亮点:');
  match.keyMatches.forEach(m => console.log(`  ✓ ${m}`));
  console.log('\n风险提示:');
  match.risks.forEach(r => console.log(`  ⚠ ${r}`));
  console.log('\n建议话题:');
  match.suggestedTopics.forEach(t => console.log(`  💡 ${t}`));
  
  // ========== 8. 上链记录 ==========
  console.log('\n⛓️  上链记录...');
  console.log(`交易哈希: ${match.resultHash}`);
  
  // ========== 9. 通知用户 (如果是为人类探路) ==========
  if (myAgent.soulProfile.type === 'human-proxy') {
    await notifyUser({
      method: 'telegram',
      message: `探路完成！匹配分数: ${match.overallScore}/100。${match.overallScore >= 80 ? '建议接触' : '不建议接触'}`
    });
  }
  
  return match;
}

// 执行
completeSocialProbe().catch(console.error);
```

---

## 6. X 宣传文案

### 主帖

```
Gradience Social Engine: libp2p + A2A Protocol 🌐

非金融 A2A 社交探路的技术栈:

传输: libp2p (P2P, 端到端加密)
应用: Google A2A Protocol (v1.0, Linux Foundation)
计算: Chain Hub Soul Matching Engine
增强: MagicBlock TEE (可选)

特点:
✅ 标准兼容 (50+ 企业支持)
✅ 隐私优先 (ZK 选择性披露)
✅ 轻量快速 (<100ms 延迟)
✅ 成本极低 (几乎免费)

Agent 社交的基础设施
Coming soon
```

### Thread

```
1/ 非金融 A2A 用什么协议？

我们选:
• libp2p: P2P 传输 (Noise 加密)
• Google A2A: 应用层 (Agent Card + Task)
• 不是重造轮子，是组合标准

2/ 为什么不用 MagicBlock 做主通信？

MagicBlock 擅长:
• 实时游戏
• 隐私执行
• 状态机逻辑

不擅长:
• 自然语言对话
• 松耦合社交

所以它是可选增强，不是主干

3/ 架构

libp2p + A2A = 快速社交探路
↓
Chain Hub = 匹配分析
↓
可选 MagicBlock = TEE 隐私
↓
Solana = 结果上链

每层只做最擅长的

4/ 开源标准

Google A2A:
• v1.0 发布
• Linux Foundation 治理
• Salesforce, SAP, ServiceNow 支持

不用等生态成熟，它已经成熟了

5/ 下一步

Agent Arena 开 Soul Probe 专区
用这套栈跑真实匹配

验证:
• 延迟 < 100ms
• 准确率 > 75%
• 成本 ≈ 0

Join the beta
```

---

## 7. 实施检查清单

### MVP (3 天)

- [ ] libp2p 节点搭建
- [ ] A2A Protocol 集成
- [ ] 基础探路流程 (5 轮对话)
- [ ] Embedding 相似度计算
- [ ] 简单匹配报告

### Phase 2 (1 周)

- [ ] 15 轮深度对话
- [ ] LLM 结构化分析
- [ ] ZK-Selective 隐私
- [ ] Agent Arena 测试区

### Phase 3 (2 周)

- [ ] MagicBlock TEE 集成
- [ ] Reputation 社交维度
- [ ] Workflow 功法交易
- [ ] 完整文档

---

## 8. 结论

### 核心决策

| 决策 | 选择 | 原因 |
|------|------|------|
| **传输层** | libp2p | 成熟、去中心化、端到端加密 |
| **应用层** | Google A2A | 标准、生态成熟、50+ 企业支持 |
| **计算层** | Chain Hub | 自研、与 Reputation 集成 |
| **增强层** | MagicBlock (可选) | TEE 隐私、仅高敏感场景 |

### 立即行动

| 优先级 | 行动 | 时间 |
|--------|------|------|
| P0 | libp2p + A2A 基础集成 | 3 天 |
| P0 | Agent Arena 测试区 | 1 周 |
| P1 | LLM 深度分析 | 1 周 |
| P2 | MagicBlock TEE 集成 | 2 周 |

### 一句话

> **"用标准协议做社交探路，用 TEE 做隐私增强，用 Solana 做信任结算。"**

---

*最后更新: 2026-04-03*  
*状态: 技术方案确认，等待开发启动*
