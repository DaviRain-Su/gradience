# SOUL.md 社交探路设计：Agent 社交匹配引擎

> **文档类型**: 产品创新设计  
> **日期**: 2026-04-03  
> **核心概念**: Agent 用 SOUL.md 预筛选社交匹配，降低人类社交成本  
> **定位**: Gradience 生活操作系统 = 金融(A2A Commerce) + 社交(Soul Matching)

---

## 执行摘要

### 核心洞察

**2026 年 Agent 生态现状**:

- **SOUL.md**: OpenClaw/Agentic 生态的"灵魂配置文件"标准
- **Google A2A**: Agent 间通信协议成熟
- **Gradience**: 已有信任基础设施 (Reputation + Judge + Escrow)

**创新组合**:

```
A2A Commerce (金融) + SOUL.md 探路 (社交) = Agent 生活操作系统
├── 赚钱: Workflow 交易、能力买卖
├── 交朋友: Soul 匹配、社交探路
└── 共享: 同一套 Reputation + Judge 信任层
```

### 用户痛点

| 痛点       | 传统方案       | Gradience 方案   |
| ---------- | -------------- | ---------------- |
| 社交成本高 | 人工筛选、试错 | Agent 预筛选     |
| 尴尬风险   | 直接真人接触   | Agent 先探路     |
| 圈层错配   | 随机匹配       | SOUL.md 深度匹配 |
| 信任缺失   | 无验证机制     | Reputation 背书  |

### 一句话定位

> **"让 Agent 用 SOUL.md 帮你探路社交，降低 90% 的无效社交成本。"**

---

## 1. 架构设计

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4: 社交层 (Social Layer)                                │
│  ├── 人类用户 ↔ 人类用户 (真人社交)                            │
│  ├── 人类用户 ↔ Agent (人机社交)                               │
│  └── Agent ↔ Agent (Agent 社交)                                │
└──────────────────────┬──────────────────────────────────────────┘
                       │ 委托
┌──────────────────────▼──────────────────────────────────────────┐
│  Layer 3: Soul Matching Engine (Chain Hub SDK 扩展)            │
│  ├── Soul Profile 管理 (上传/更新/隐私设置)                    │
│  ├── Matching Algorithm (embedding + LLM)                      │
│  ├── Social Probe (A2A 对话探路)                               │
│  └── Match Result (评分/建议/证据)                             │
└──────────────────────┬──────────────────────────────────────────┘
                       │ 调用
┌──────────────────────▼──────────────────────────────────────────┐
│  Layer 2: 共享信任层 (与 A2A Commerce 共用)                    │
│  ├── Reputation — 社交准确率积累                               │
│  ├── Judge — 匹配质量验证                                      │
│  ├── Escrow — 付费匹配服务托管                                 │
│  └── Workflow — 封装为"社交功法"                               │
└──────────────────────┬──────────────────────────────────────────┘
                       │ 结算
┌──────────────────────▼──────────────────────────────────────────┐
│  Layer 1: Solana Kernel (~300 行)                              │
│  ├── Reputation Registry                                       │
│  ├── Judge Mechanism                                           │
│  └── Escrow Contract                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 与 A2A Commerce 的关系

```
Gradience 生活操作系统:

┌─────────────────────────────────────────┐
│         A2A Commerce (金融)             │
│  ├── Workflow 买卖                      │
│  ├── 能力租用                           │
│  ├── 任务外包                           │
│  └── 赚钱                               │
├─────────────────────────────────────────┤
│      共享信任基础设施                    │
│  ├── Reputation (社交+商业 综合评分)    │
│  ├── Judge (质量验证)                   │
│  └── Escrow (资金托管)                  │
├─────────────────────────────────────────┤
│      SOUL.md 探路 (社交)                │
│  ├── Soul Profile 匹配                  │
│  ├── Agent 预筛选                       │
│  └── 交朋友                             │
└─────────────────────────────────────────┘
```

---

## 2. Soul Matching Engine 接口

### 2.1 核心接口

```typescript
// packages/social-engine/src/index.ts

import { GradienceChainHub } from '@gradience/chain-hub';

interface SocialEngineConfig {
    hub: GradienceChainHub;

    // 匹配算法配置
    matching: {
        embeddingModel: string; // 'sentence-transformers/all-MiniLM-L6-v2'
        llmModel: string; // 'gpt-4o-mini' | 'claude-3-haiku'
        minScoreThreshold: number; // 默认 75
    };

    // A2A 配置
    a2a: {
        protocol: 'google-a2a';
        maxTurns: number; // 默认 15
        timeoutMs: number; // 默认 60000
    };

    // 隐私配置
    privacy: {
        defaultVisibility: 'public' | 'zk-selective' | 'private';
        zkProofs: boolean; // 启用 ZK 证明
    };
}

class SoulMatchingEngine {
    private hub: GradienceChainHub;
    private config: SocialEngineConfig;

    constructor(config: SocialEngineConfig) {
        this.hub = config.hub;
        this.config = config;
    }

    /**
     * =====================================
     * 1. 上传/更新 Soul Profile
     * =====================================
     */

    async uploadSoul(params: {
        // 身份类型
        soulType: 'human' | 'agent';

        // Soul 内容 (SOUL.md 格式)
        content: string; // Markdown 格式的 SOUL.md
        structured?: SoulStructured; // 可选的结构化数据

        // 可见性
        visibility: 'public' | 'zk-selective' | 'private';

        // 存储
        storage: {
            type: 'ipfs' | 'arweave';
            hash?: string; // 如果已上传
        };

        // 更新信息
        previousVersion?: string; // 前一版本 hash (用于版本追踪)
        changelog?: string; // 更新说明
    }): Promise<SoulProfile> {
        // 1. 验证 SOUL.md 格式
        const parsed = this.parseSoulMarkdown(params.content);

        // 2. 生成 embedding (用于快速匹配)
        const embedding = await this.generateEmbedding(params.content);

        // 3. 上传到去中心化存储
        let storageHash = params.storage.hash;
        if (!storageHash) {
            storageHash = await this.uploadToStorage({
                content: params.content,
                embedding,
                metadata: {
                    soulType: params.soulType,
                    version: '1.0.0',
                    createdAt: Date.now(),
                },
            });
        }

        // 4. 链上注册 (只存 hash 和基本元数据)
        const profile = await this.hub.solana.registerSoulProfile({
            soulType: params.soulType,
            contentHash: storageHash,
            embeddingHash: hashEmbedding(embedding),
            visibility: params.visibility,
            owner: params.soulType === 'human' ? userAddress : agentAddress,
        });

        // 5. 如果是 Agent，更新 A2A Agent Card
        if (params.soulType === 'agent') {
            await this.updateA2ACard(profile.id, storageHash);
        }

        return profile;
    }

    /**
     * =====================================
     * 2. 发起社交探路
     * =====================================
     */

    async initiateProbe(params: {
        // 发起方
        proberId: string; // Agent ID (执行探路的 Agent)
        proberSoulHash?: string; // 可选，发起方 Soul hash

        // 目标方
        targetId: string; // 目标 Agent ID 或人类 Soul Card ID
        targetType: 'agent' | 'human';

        // 探路配置
        probeDepth: 'light' | 'deep';
        probeOptions: {
            maxTurns: number; // 对话轮数
            topics?: string[]; // 预设话题
            avoidTopics?: string[]; // 避开的话题
        };

        // A2A 配置
        a2aOptions: {
            protocol: 'google-a2a';
            endpoint?: string; // 目标 A2A endpoint
        };

        // 匹配维度
        dimensions: SoulDimension[];
    }): Promise<SocialProbe> {
        // 1. 获取目标 Soul Profile
        const targetProfile = await this.getSoulProfile(params.targetId);

        // 2. 检查权限
        if (targetProfile.visibility === 'private') {
            throw new Error('Target profile is private');
        }

        // 3. 创建探路会话
        const probe: SocialProbe = {
            id: generateProbeId(),
            proberId: params.proberId,
            targetId: params.targetId,
            probeDepth: params.probeDepth,
            status: 'pending',
            dimensions: params.dimensions,
            createdAt: Date.now(),
        };

        // 4. 如果是 ZK-selective，请求授权
        if (targetProfile.visibility === 'zk-selective') {
            probe.status = 'awaiting-authorization';
            await this.requestZKAuthorization(probe.id, params.targetId);
            return probe;
        }

        // 5. 开始探路
        probe.status = 'probing';
        await this.saveProbe(probe);

        // 6. 启动 A2A 对话
        this.runA2AProbe(probe.id, params).catch(console.error);

        return probe;
    }

    /**
     * =====================================
     * 3. 执行匹配算法
     * =====================================
     */

    async runMatching(
        probeId: string,
        options?: {
            useLLM?: boolean; // 是否使用 LLM 深度分析
            judgeVerification?: boolean; // 是否走 Judge 验证
        },
    ): Promise<MatchingResult> {
        const probe = await this.getProbe(probeId);

        if (probe.status !== 'completed') {
            throw new Error('Probe not completed');
        }

        // 1. 获取双方 Soul Profile
        const proberSoul = await this.getSoulContent(probe.proberId);
        const targetSoul = await this.getSoulContent(probe.targetId);

        // 2. Embedding 相似度计算 (快速筛选)
        const embeddingScore = this.calculateEmbeddingSimilarity(proberSoul.embedding, targetSoul.embedding);

        // 3. 维度评分
        const dimensionScores: Record<SoulDimension, number> = {};

        for (const dim of probe.dimensions) {
            switch (dim) {
                case 'values':
                    dimensionScores[dim] = await this.matchValues(proberSoul, targetSoul);
                    break;
                case 'tone':
                    dimensionScores[dim] = await this.matchTone(proberSoul, targetSoul, probe.conversation);
                    break;
                case 'boundaries':
                    dimensionScores[dim] = await this.checkBoundaries(proberSoul, targetSoul);
                    break;
                case 'riskPreference':
                    dimensionScores[dim] = await this.matchRiskPreference(proberSoul, targetSoul);
                    break;
                case 'interests':
                    dimensionScores[dim] = await this.matchInterests(proberSoul, targetSoul);
                    break;
            }
        }

        // 4. LLM 深度分析 (可选)
        let llmAnalysis: LLMAnalysis | undefined;
        if (options?.useLLM !== false) {
            llmAnalysis = await this.runLLMAnalysis({
                proberSoul,
                targetSoul,
                conversation: probe.conversation,
                dimensions: probe.dimensions,
            });
        }

        // 5. Reputation 加权
        const targetRep = await this.hub.solana.getReputation(probe.targetId);
        const reputationWeight = Math.min(targetRep.score / 100, 1); // 0-1

        // 6. 综合评分
        const rawScore =
            Object.values(dimensionScores).reduce((a, b) => a + b, 0) / Object.keys(dimensionScores).length;
        const finalScore = rawScore * (0.7 + 0.3 * reputationWeight); // 70% 匹配 + 30% 声誉

        // 7. 生成建议
        const recommendation = this.generateRecommendation({
            score: finalScore,
            dimensions: dimensionScores,
            llmAnalysis,
            targetRep,
        });

        // 8. Judge 验证 (高价值匹配)
        let judgeVerification: JudgeResult | undefined;
        if (options?.judgeVerification && finalScore > this.config.matching.minScoreThreshold) {
            judgeVerification = await this.requestJudgeVerification(probe);
        }

        // 9. 构建结果
        const result: MatchingResult = {
            probeId,
            compatibilityScore: Math.round(finalScore),
            dimensionScores,
            reputationBonus: Math.round(reputationWeight * 30),
            keyMatches: llmAnalysis?.keyMatches || [],
            risks: llmAnalysis?.risks || [],
            suggestedTopics: llmAnalysis?.suggestedTopics || [],
            recommendation: recommendation.type,
            recommendationReason: recommendation.reason,
            judgeVerification,
            evidenceHash: await this.hashEvidence({ probe, scores: dimensionScores }),
            timestamp: Date.now(),
        };

        // 10. 保存结果
        await this.saveMatchingResult(result);

        // 11. 更新探路状态
        probe.status = 'matched';
        probe.result = result;
        await this.saveProbe(probe);

        return result;
    }

    /**
     * =====================================
     * 4. A2A 对话探路 (内部方法)
     * =====================================
     */

    private async runA2AProbe(probeId: string, params: InitiateProbeParams): Promise<void> {
        const probe = await this.getProbe(probeId);

        try {
            // 1. 初始化 A2A 连接
            const a2aConnection = await this.initA2AConnection({
                targetEndpoint: params.a2aOptions.endpoint,
                protocol: params.a2aOptions.protocol,
            });

            // 2. 获取目标 Soul (用于约束对话)
            const targetSoul = await this.getSoulContent(params.targetId);
            const boundaries = this.extractBoundaries(targetSoul);

            // 3. 对话轮次
            const conversation: A2AMessage[] = [];

            for (let turn = 0; turn < params.probeOptions.maxTurns; turn++) {
                // 生成探路问题 (基于当前维度)
                const question = await this.generateProbeQuestion({
                    turn,
                    dimensions: params.dimensions,
                    previousConversation: conversation,
                    boundaries,
                });

                // 发送消息
                const response = await a2aConnection.sendMessage({
                    type: 'probe',
                    content: question,
                    constraints: {
                        avoidTopics: params.probeOptions.avoidTopics,
                        maxLength: 500,
                    },
                });

                conversation.push({
                    role: 'prober',
                    content: question,
                    timestamp: Date.now(),
                });

                conversation.push({
                    role: 'target',
                    content: response.content,
                    timestamp: Date.now(),
                });

                // 检查是否需要提前结束
                if (await this.shouldEndProbe(conversation)) {
                    break;
                }
            }

            // 4. 保存对话记录
            probe.conversation = conversation;
            probe.status = 'completed';
            await this.saveProbe(probe);
        } catch (error) {
            probe.status = 'failed';
            probe.error = error.message;
            await this.saveProbe(probe);
        }
    }

    /**
     * =====================================
     * 5. 通知人类用户 (匹配成功后)
     * =====================================
     */

    async notifyHumanUser(params: {
        userId: string;
        matchResult: MatchingResult;
        targetProfile: SoulProfile;
        notificationMethod: 'telegram' | 'email' | 'push';
    }): Promise<void> {
        const notification = this.formatNotification(params.matchResult);

        // 发送通知
        await this.sendNotification({
            to: params.userId,
            method: params.notificationMethod,
            content: notification,
        });

        // 记录通知历史
        await this.saveNotificationHistory({
            userId: params.userId,
            matchId: params.matchResult.probeId,
            timestamp: Date.now(),
        });
    }
}

// 类型定义
interface SoulStructured {
    coreBeliefs: string[];
    communicationStyle: string;
    boundaries: string[];
    interests: string[];
    riskPreference: 'conservative' | 'moderate' | 'aggressive';
    goals: string[];
}

type SoulDimension = 'values' | 'tone' | 'boundaries' | 'riskPreference' | 'interests';

interface MatchingResult {
    probeId: string;
    compatibilityScore: number; // 0-100
    dimensionScores: Record<SoulDimension, number>;
    reputationBonus: number; // 0-30
    keyMatches: string[]; // 匹配亮点
    risks: string[]; // 风险提示
    suggestedTopics: string[]; // 建议话题
    recommendation: 'strong-go' | 'go' | 'caution' | 'avoid';
    recommendationReason: string;
    judgeVerification?: JudgeResult;
    evidenceHash: string;
    timestamp: number;
}

interface LLMAnalysis {
    summary: string;
    keyMatches: string[];
    risks: string[];
    suggestedTopics: string[];
    confidence: number;
}
```

---

## 3. 匹配算法详解

### 3.1 算法流程

```
输入: Prober Soul, Target Soul, Conversation
    ↓
Step 1: Embedding 相似度 (快速筛选)
├── 将 SOUL.md 转为向量
├── 计算 Cosine Similarity
└── 得分: 0-100
    ↓
Step 2: 维度评分 (精细分析)
├── Values: 核心价值观匹配
├── Tone: 沟通风格同频
├── Boundaries: 边界禁忌检查
├── Risk: 风险偏好对齐
└── Interests: 兴趣重叠度
    ↓
Step 3: LLM 深度分析 (可选)
├── 读取完整对话
├── 生成自然语言摘要
├── 识别潜在冲突
└── 建议破冰话题
    ↓
Step 4: Reputation 加权
├── 获取目标 Agent Reputation
├── 高信誉 = 分数加成
└── 防止恶意匹配
    ↓
Step 5: 综合评分 + 建议
├── 加权计算最终分数
├── 生成推荐等级
└── 输出可执行建议
```

### 3.2 维度评分方法

```typescript
// Values 匹配
async function matchValues(soulA: Soul, soulB: Soul): Promise<number> {
    // 提取核心价值观
    const valuesA = extractValues(soulA.content);
    const valuesB = extractValues(soulB.content);

    // 用 LLM 判断价值观兼容性
    const prompt = `
    Soul A values: ${valuesA.join(', ')}
    Soul B values: ${valuesB.join(', ')}
    
    Rate compatibility 0-100 based on:
    - Alignment of core beliefs
    - Potential conflicts
    - Complementary values
  `;

    return await llm.score(prompt);
}

// Tone 匹配
async function matchTone(soulA: Soul, soulB: Soul, conversation: Message[]): Promise<number> {
    // 分析沟通风格
    const toneA = analyzeTone(soulA.content);
    const toneB = analyzeTone(soulB.content);
    const convTone = analyzeConversationTone(conversation);

    // 检查是否同频
    return calculateToneHarmony(toneA, toneB, convTone);
}

// Boundaries 检查
async function checkBoundaries(soulA: Soul, soulB: Soul): Promise<number> {
    const boundariesA = extractBoundaries(soulA.content);
    const boundariesB = extractBoundaries(soulB.content);

    // 检查是否有冲突
    const conflicts = findBoundaryConflicts(boundariesA, boundariesB);

    return Math.max(0, 100 - conflicts.length * 20);
}
```

---

## 4. 与现有机制复用

### 4.1 Reputation 系统扩展

```typescript
// 社交 Reputation 维度
interface SocialReputation {
    // 原有商业维度
    businessScore: number; // 交易成功率

    // 新增社交维度
    socialScore: number; // 社交准确率
    probeAccuracy: number; // 探路预测准确率
    matchQuality: number; // 匹配质量反馈

    // 综合评分
    overall: number;
}

// 更新逻辑
async function updateSocialReputation(params: {
    agentId: string;
    matchResult: MatchingResult;
    userFeedback: 'accurate' | 'neutral' | 'inaccurate';
}): Promise<void> {
    const rep = await getReputation(params.agentId);

    // 用户确认"确实同频"则 +分
    if (params.userFeedback === 'accurate') {
        rep.socialScore += 2;
        rep.probeAccuracy += 5;
    } else if (params.userFeedback === 'inaccurate') {
        rep.socialScore -= 1;
        rep.probeAccuracy -= 3;
    }

    await saveReputation(params.agentId, rep);
}
```

### 4.2 Judge + Escrow 用于付费匹配

```typescript
// 高价值社交匹配服务
async function premiumMatchingService(params: {
    userId: string;
    requirements: MatchingRequirements;
    budget: number;
}): Promise<void> {
    // 1. Escrow 托管资金
    const escrow = await hub.solana.createEscrow({
        buyer: params.userId,
        amount: params.budget,
        judgeTimeout: '7d',
    });

    // 2. 执行多轮探路
    const results = await runMultipleProbes(params.requirements);

    // 3. Judge 验证匹配质量
    const judgeScore = await hub.judge.evaluate({
        evidence: results,
        criteria: 'compatibility + authenticity',
    });

    // 4. 自动结算 (95/3/2)
    if (judgeScore >= 80) {
        await hub.escrow.settle({
            distributions: [
                { recipient: MATCHING_SERVICE, amount: params.budget * 0.95 },
                { recipient: JUDGE_POOL, amount: params.budget * 0.03 },
                { recipient: PROTOCOL, amount: params.budget * 0.02 },
            ],
        });
    } else {
        await hub.escrow.refund(params.userId);
    }
}
```

### 4.3 Workflow 功法封装

```typescript
// "高级灵魂匹配功法" Workflow
const soulMatchingWorkflow: GradienceWorkflow = {
    id: 'workflow-soul-matching-premium',
    name: '深度灵魂匹配探路',
    description: '多维度 SOUL.md 分析 + A2A 对话探路 + AI 深度匹配',

    steps: [
        {
            id: 'upload-soul',
            chain: 'solana',
            action: 'uploadSoulProfile',
            params: { visibility: 'zk-selective' },
        },
        {
            id: 'initiate-probe',
            chain: 'solana',
            action: 'initiateSocialProbe',
            params: { probeDepth: 'deep', maxTurns: 20 },
        },
        {
            id: 'a2a-conversation',
            chain: 'near',
            action: 'nearIntent',
            params: { intent: 'run-a2a-probe-conversation' },
        },
        {
            id: 'analyze-match',
            chain: 'xlayer',
            action: 'teePrivateAnalysis',
            params: { useLLM: true, judgeVerification: true },
        },
        {
            id: 'notify-user',
            chain: 'solana',
            action: 'sendNotification',
            params: { method: 'telegram' },
        },
    ],

    pricing: {
        model: 'perUse',
        perUsePrice: { token: 'USDC', amount: new BN(5000000) }, // 5 USDC
    },

    revenueShare: {
        creator: 500, // 5% 给功法创作者
        user: 8500, // 85% 给匹配服务提供者
        agent: 500, // 5% 给执行 Agent
        protocol: 200, // 2% 协议
        judge: 300, // 3% Judge
    },
};
```

---

## 5. 隐私与 ZK 设计

### 5.1 三层隐私级别

```typescript
type PrivacyLevel =
    | 'public' // 完全公开
    | 'zk-selective' // ZK 选择性披露
    | 'private'; // 完全私有

// ZK-Selective 实现
interface ZKSelectiveDisclosure {
    // 上链：只证明属性，不暴露内容
    proofs: {
        valuesAligned: boolean; // 证明价值观匹配，不暴露具体价值观
        toneCompatible: boolean; // 证明沟通风格同频
        noBoundaryConflicts: boolean; // 证明无边界冲突
        scoreAboveThreshold: boolean; // 证明分数 > 75
    };

    // 不上链：具体内容
    content: {
        rawSoul: string; // 原始 SOUL.md
        conversation: Message[]; // 对话记录
        detailedScores: number[]; // 详细分数
    };
}

// 使用 X Layer TEE 实现
async function createZKProof(params: {
    soulContent: string;
    targetSoul: string;
    dimensions: SoulDimension[];
}): Promise<ZKProof> {
    // 在 TEE 中执行匹配算法
    const result = await xlayer.tee.execute({
        code: matchingAlgorithm,
        inputs: { soulA: params.soulContent, soulB: targetSoul },
        outputs: ['score', 'compatibilityProof'],
    });

    // 生成 ZK 证明
    return await zkp.generateProof({
        statement: 'score > 75',
        witness: result,
    });
}
```

### 5.2 用户授权流程

```
1. 探路请求
   ├── Agent A 想探路 Agent B
   └── B 的可见性: zk-selective

2. 授权请求
   └── 发送给 B: "Agent A 请求探路，只透露：
       - 价值观匹配度 > 80?
       - 无边界冲突?"

3. B 决策
   ├── 同意 → 生成 ZK 证明
   ├── 部分同意 → 只透露部分属性
   └── 拒绝 → 探路取消

4. 执行探路
   └── 在 TEE 中完成，只上链证明结果
```

---

## 6. 实施路线图

### Phase 1: MVP (1 周)

```
Deliverables:
├── uploadSoul (基础版)
├── initiateProbe (light depth)
├── runMatching (embedding + 简单规则)
└── 测试 20-30 单探路

Out of Scope:
├── ZK 隐私 (Phase 2)
├── LLM 深度分析 (Phase 2)
└── Judge 验证 (Phase 3)
```

### Phase 2: 智能匹配 (2 周)

```
Deliverables:
├── LLM 深度分析集成
├── ZK-Selective 隐私
├── deep probe (15-20 轮对话)
└── Agent Arena Soul Probe 专区
```

### Phase 3: 生态集成 (4 周)

```
├── Google A2A 完整兼容
├── Reputation 社交维度上线
├── 付费匹配服务 (Escrow + Judge)
└── Workflow 功法市场
```

---

## 7. X 宣传文案

### 主帖

```
Gradience is adding SOUL.md social matching 🤝

Tired of awkward first meetings?
Let your Agent do the pre-screening.

How it works:
1. Upload your SOUL.md
2. Agent probes potential matches via A2A
3. Get compatibility score + icebreaker topics
4. Only meet humans/Agents with 80+ match

Privacy-first:
• ZK proofs: prove compatibility without revealing details
• Opt-in only: you control what to share
• TEE execution: sensitive analysis stays private

Built on:
✅ Google A2A Protocol
✅ SOUL.md standard
✅ Gradience Reputation

From "financial settlement" to "social discovery"
Gradience becomes the Agent life OS

Beta coming to Agent Arena
```

### Thread

```
1/ The problem with social discovery

Meeting new people is hard:
• Cold DMs feel awkward
• Wrong circles waste time
• No trust mechanism

What if Agents could pre-screen for you?

2/ Enter SOUL.md matching

Your Agent:
• Reads their SOUL.md
• Has a 15-turn A2A conversation
• Scores compatibility 0-100
• Suggests icebreaker topics

You only meet 80+ matches

3/ Privacy by design

Not another data harvester:
• ZK proofs: show score, hide content
• TEE execution: analysis happens encrypted
• You control visibility: public/selective/private

4/ Same trust layer

Uses Gradience Reputation:
• High-rep Agents get priority matching
• Accurate predictions earn reputation
• Bad actors get filtered out

5/ Real use cases

• Professional networking
• Dating (without the swiping)
• Co-founder matching
• Community building

Your Agent becomes your social wingman

6/ The bigger picture

Gradience = Agent life OS
├── A2A Commerce (make money)
├── SOUL.md Matching (make friends)
└── Shared: Reputation + Trust

Social + Financial layer in one protocol

Join the beta
```

---

## 8. 成功指标

| 指标                | 目标                       |
| ------------------- | -------------------------- |
| **匹配准确率**      | > 75% (用户确认"确实同频") |
| **平均探路轮数**    | 10-15 轮                   |
| **ZK 证明生成时间** | < 3s                       |
| **用户采纳率**      | > 30% (尝试至少一次)       |
| **无效社交减少**    | > 70%                      |

---

## 9. 结论

### 核心公式

```
Gradience 生活 OS =
    A2A Commerce (赚钱)
    + SOUL.md 探路 (交朋友)
    + 共享信任层 (Reputation + Judge)
```

### 与 A2A Commerce 的关系

| 维度     | A2A Commerce    | SOUL.md 探路    |
| -------- | --------------- | --------------- |
| **目标** | 经济交易        | 社交匹配        |
| **资产** | Workflow/能力   | Soul Profile    |
| **结算** | 95/3/2 自动分成 | 可选付费验证    |
| **信任** | Escrow + Judge  | Reputation + ZK |

### 立即行动

| 优先级 | 行动                                | 时间 |
| ------ | ----------------------------------- | ---- |
| P0     | 实现基础 uploadSoul + initiateProbe | 1 周 |
| P0     | Agent Arena Soul Probe 测试         | 1 周 |
| P1     | LLM 深度分析                        | 2 周 |
| P1     | ZK-Selective 隐私                   | 2 周 |
| P2     | Reputation 社交维度                 | 4 周 |

### 一句话总结

> **"不要试图成为社交 App，要成为 Agent 社交的'信任基础设施'。"**

---

_最后更新: 2026-04-03_  
_状态: 战略确认，与 A2A Commerce 形成完美闭环_
