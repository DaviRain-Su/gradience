# 非金融 A2A 社交功能实现计划

> **文档类型**: 任务拆解与实现计划  
> **创建日期**: 2026-04-04  
> **目标**: 将非金融社交探路功能集成到 Agent Me (AgentM)  
> **参考文档**: [non-financial-a2a-social-probe-implementation.md](../non-financial-a2a-social-probe-implementation.md)

---

## 执行摘要

### 核心目标

在 AgentM 中实现完整的非金融 A2A 社交探路功能，让 Agent 能够：

1. **发现潜在社交匹配** - 通过 Nostr 发现其他 Agent/用户
2. **发起社交探路** - 使用 XMTP 进行受控对话
3. **生成匹配报告** - 基于 SOUL.md 的多维度匹配分析
4. **链上信誉积累** - 社交准确率记录在 Reputation PDA

### 技术栈

| 组件         | 技术                  | 状态                       |
| ------------ | --------------------- | -------------------------- |
| **发现层**   | Nostr (NIP-01/04)     | ✅ 已实现 (discovery-only) |
| **消息层**   | XMTP v3               | ✅ 已实现                  |
| **互操作**   | Google A2A            | ✅ 已实现                  |
| **匹配引擎** | Embedding + LLM       | 🔴 需新建                  |
| **存储**     | IPFS / Arweave        | 🟡 部分集成                |
| **链上结算** | Solana Reputation PDA | 🟡 需扩展                  |

### 实现阶段

```
Phase 1: Soul Profile 基础设施 (2 天)
  └── SOUL.md 格式定义、解析器、存储集成

Phase 2: 社交发现与探路 (3 天)
  └── Nostr 发现增强、XMTP 探路流程、UI/UX

Phase 3: 匹配引擎 (3 天)
  └── Embedding 相似度、LLM 分析、报告生成

Phase 4: 链上集成 (2 天)
  └── Reputation 扩展、Judge 验证、付费匹配

Phase 5: AgentM UI/UX (3 天)
  └── 社交发现界面、探路对话界面、匹配报告展示

Phase 6: 测试与优化 (2 天)
  └── E2E 测试、性能优化、文档完善

总计: 15 天 (3 周)
```

---

## Phase 1: Soul Profile 基础设施 (2 天)

### 1.1 SOUL.md 格式定义

**任务**: 定义标准化的 SOUL.md 格式

**输出**:

- `packages/types/src/soul.ts` - 类型定义
- `docs/soul-md-spec.md` - 格式规范文档

**核心类型**:

```typescript
interface SoulProfile {
    // 元数据
    id: string; // 唯一标识
    version: string; // SOUL.md 版本
    soulType: 'human' | 'agent';
    createdAt: number;
    updatedAt: number;

    // 身份
    identity: {
        displayName: string;
        bio: string;
        avatarCID?: string;
    };

    // 价值观
    values: {
        core: string[]; // 核心价值观
        priorities: string[]; // 优先级
        dealBreakers: string[]; // 红线
    };

    // 兴趣
    interests: {
        topics: string[]; // 话题
        skills: string[]; // 技能
        goals: string[]; // 目标
    };

    // 沟通风格
    communication: {
        tone: 'formal' | 'casual' | 'technical' | 'friendly';
        pace: 'fast' | 'moderate' | 'slow';
        depth: 'surface' | 'moderate' | 'deep';
    };

    // 边界
    boundaries: {
        forbiddenTopics: string[];
        maxConversationLength: number;
        privacyLevel: 'public' | 'zk-selective' | 'private';
    };

    // 存储
    storage: {
        contentHash: string; // SOUL.md 内容哈希
        embeddingHash: string; // Embedding 哈希
        storageType: 'ipfs' | 'arweave';
        cid: string; // 存储 CID
    };

    // 链上
    onChain?: {
        solanaAddress: string;
        reputationPDA: string;
        socialScore: number;
    };
}
```

**Markdown 格式示例**:

```markdown
---
soul_version: '1.0'
soul_type: agent
created_at: '2026-04-04T00:00:00Z'
---

# SOUL Profile

## Identity

Name: Alice AI
Bio: A friendly AI assistant focused on creative collaboration

## Core Values

- Honesty and transparency
- Creative exploration
- Mutual respect

## Interests

### Topics

- AI ethics
- Creative writing
- Blockchain technology

### Skills

- Natural language processing
- Content generation
- Research assistance

## Communication Style

Tone: friendly
Pace: moderate
Depth: deep

## Boundaries

### Forbidden Topics

- Personal medical information
- Financial advice
- Political debates

Max Conversation Length: 20 turns
Privacy Level: public
```

**验收标准**:

- [ ] TypeScript 类型定义完整
- [ ] Markdown 格式规范文档
- [ ] 示例 SOUL.md 文件
- [ ] 单元测试覆盖

### 1.2 SOUL.md 解析器

**任务**: 实现 Markdown ↔ 结构化数据 的双向转换

**输出**: `packages/soul-engine/src/parser.ts`

**核心函数**:

```typescript
class SoulParser {
    /**
     * 解析 SOUL.md 文件
     */
    parse(markdown: string): SoulProfile {
        // 1. 解析 YAML frontmatter
        const { data: frontmatter, content } = matter(markdown);

        // 2. 解析 Markdown sections
        const sections = this.parseMarkdownSections(content);

        // 3. 提取结构化数据
        return {
            id: frontmatter.id || generateId(),
            version: frontmatter.soul_version || '1.0',
            soulType: frontmatter.soul_type,
            createdAt: new Date(frontmatter.created_at).getTime(),
            identity: this.parseIdentity(sections.Identity),
            values: this.parseValues(sections['Core Values']),
            interests: this.parseInterests(sections.Interests),
            communication: this.parseCommunication(sections['Communication Style']),
            boundaries: this.parseBoundaries(sections.Boundaries),
            // ...
        };
    }

    /**
     * 生成 SOUL.md 文件
     */
    stringify(profile: SoulProfile): string {
        const frontmatter = {
            soul_version: profile.version,
            soul_type: profile.soulType,
            created_at: new Date(profile.createdAt).toISOString(),
            updated_at: new Date(profile.updatedAt).toISOString(),
        };

        const sections = [
            '# SOUL Profile',
            '',
            this.stringifyIdentity(profile.identity),
            this.stringifyValues(profile.values),
            this.stringifyInterests(profile.interests),
            this.stringifyCommunication(profile.communication),
            this.stringifyBoundaries(profile.boundaries),
        ];

        return matter.stringify(sections.join('\n\n'), frontmatter);
    }

    /**
     * 验证 SOUL.md 格式
     */
    validate(profile: SoulProfile): ValidationResult {
        const errors: string[] = [];

        if (!profile.identity.displayName) {
            errors.push('Missing required field: identity.displayName');
        }

        if (profile.values.core.length === 0) {
            errors.push('At least one core value is required');
        }

        // ...

        return {
            valid: errors.length === 0,
            errors,
        };
    }
}
```

**依赖**:

- `gray-matter` - YAML frontmatter 解析
- `marked` - Markdown 解析
- `zod` - 运行时类型验证

**验收标准**:

- [ ] parse() 函数正确解析示例文件
- [ ] stringify() 生成的 Markdown 可读性强
- [ ] validate() 捕获所有格式错误
- [ ] 单元测试覆盖率 ≥ 90%

### 1.3 存储集成

**任务**: 集成 IPFS 和 Arweave 存储

**输出**: `packages/soul-engine/src/storage.ts`

**核心函数**:

```typescript
interface StorageOptions {
    type: 'ipfs' | 'arweave';
    ipfsGateway?: string;
    arweaveGateway?: string;
}

class SoulStorage {
    constructor(private options: StorageOptions) {}

    /**
     * 上传 SOUL.md
     */
    async upload(profile: SoulProfile): Promise<string> {
        const markdown = soulParser.stringify(profile);

        if (this.options.type === 'ipfs') {
            return await this.uploadToIPFS(markdown);
        } else {
            return await this.uploadToArweave(markdown);
        }
    }

    /**
     * 下载 SOUL.md
     */
    async download(cid: string): Promise<SoulProfile> {
        let markdown: string;

        if (this.options.type === 'ipfs') {
            markdown = await this.downloadFromIPFS(cid);
        } else {
            markdown = await this.downloadFromArweave(cid);
        }

        return soulParser.parse(markdown);
    }

    private async uploadToIPFS(content: string): Promise<string> {
        // 使用 Pinata 或 Web3.Storage
        const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.PINATA_JWT}`,
            },
            body: JSON.stringify({ content }),
        });

        const data = await response.json();
        return data.IpfsHash;
    }

    private async uploadToArweave(content: string): Promise<string> {
        // 使用 Irys (原 Bundlr)
        const irys = new Irys({
            url: 'https://node2.irys.xyz',
            token: 'solana',
            key: this.walletPrivateKey,
        });

        const receipt = await irys.upload(content, {
            tags: [
                { name: 'Content-Type', value: 'text/markdown' },
                { name: 'App-Name', value: 'Gradience-Soul' },
                { name: 'Version', value: '1.0' },
            ],
        });

        return receipt.id;
    }
}
```

**验收标准**:

- [ ] IPFS 上传/下载功能正常
- [ ] Arweave 上传/下载功能正常
- [ ] 错误处理完善
- [ ] 集成测试通过

---

## Phase 2: 社交发现与探路 (3 天)

### 2.1 Nostr 发现增强

**任务**: 扩展 Nostr adapter 支持 SOUL.md 发现

**输出**: `apps/agentm/src/main/a2a-router/adapters/nostr-adapter.ts` (扩展)

**新增功能**:

```typescript
// 扩展 Agent Presence 事件格式
interface AgentPresenceContent {
    // 现有字段
    agent: string;
    display_name: string;
    capabilities: string[];
    reputation_score: number;
    available: boolean;

    // 新增: Soul Profile 引用
    soul?: {
        cid: string; // SOUL.md 存储 CID
        type: 'human' | 'agent';
        embeddingHash: string; // 用于快速匹配
        visibility: 'public' | 'zk-selective' | 'private';
        tags: string[]; // 兴趣标签 (用于筛选)
    };
}

// 扩展 discoverAgents 方法
class NostrAdapter {
    async discoverAgents(
        filter?: AgentFilter & {
            // 新增: Soul 相关过滤
            soulType?: 'human' | 'agent';
            interestTags?: string[];
            soulVisibility?: 'public' | 'zk-selective' | 'private';
        },
    ): Promise<AgentInfo[]> {
        // 现有逻辑 + Soul 过滤
        // ...
    }

    /**
     * 广播自己的 Soul Profile (新增)
     */
    async broadcastSoulProfile(profile: SoulProfile): Promise<void> {
        const content: AgentPresenceContent = {
            agent: this.agentAddress,
            display_name: profile.identity.displayName,
            capabilities: profile.interests.skills,
            reputation_score: profile.onChain?.socialScore ?? 0,
            available: true,
            soul: {
                cid: profile.storage.cid,
                type: profile.soulType,
                embeddingHash: profile.storage.embeddingHash,
                visibility: profile.boundaries.privacyLevel,
                tags: [...profile.interests.topics, ...profile.interests.skills],
            },
        };

        await this.client.publishPresence(content);
    }
}
```

**验收标准**:

- [ ] Soul Profile 信息包含在 Nostr Presence 事件中
- [ ] 发现过滤支持 Soul 相关字段
- [ ] 向后兼容 (不影响现有功能)
- [ ] 单元测试覆盖

### 2.2 社交探路流程

**任务**: 实现完整的社交探路对话流程

**输出**: `packages/soul-engine/src/probe.ts`

**核心类**:

```typescript
interface ProbeConfig {
    depth: 'light' | 'deep'; // light=5轮, deep=15轮
    maxTurns: number;
    topics?: string[];
    avoidTopics?: string[];
    timeoutMs: number;
}

interface ProbeSession {
    id: string;
    proberId: string;
    targetId: string;
    protocol: 'xmtp' | 'nostr' | 'google-a2a';
    status: 'pending' | 'probing' | 'completed' | 'failed';
    conversation: A2AMessage[];
    conversationCID?: string; // 加密对话记录
    startedAt: number;
    completedAt?: number;
}

class SocialProbe {
    constructor(
        private router: A2ARouter,
        private soulStorage: SoulStorage,
    ) {}

    /**
     * 发起探路
     */
    async initiate(
        targetAddress: string,
        config: ProbeConfig,
        boundaries: { prober: SoulBoundaries; target: SoulBoundaries },
    ): Promise<ProbeSession> {
        const sessionId = generateSessionId();

        // 1. 发送探路邀请
        const inviteResult = await this.router.send({
            to: targetAddress,
            type: 'task_proposal',
            preferredProtocol: 'xmtp',
            payload: {
                sessionId,
                type: 'social-probe',
                depth: config.depth,
                maxTurns: config.maxTurns,
            },
        });

        if (!inviteResult.success) {
            throw new Error(`Failed to send probe invite: ${inviteResult.error}`);
        }

        // 2. 等待接受
        const accepted = await this.waitForAcceptance(sessionId, config.timeoutMs);
        if (!accepted) {
            throw new Error('Probe invitation not accepted');
        }

        // 3. 执行对话轮次
        const conversation = await this.runConversation(sessionId, targetAddress, config, boundaries);

        // 4. 加密上传对话记录
        const conversationCID = await this.uploadEncryptedConversation(conversation);

        return {
            id: sessionId,
            proberId: this.agentId,
            targetId: targetAddress,
            protocol: 'xmtp',
            status: 'completed',
            conversation,
            conversationCID,
            startedAt: Date.now(),
            completedAt: Date.now(),
        };
    }

    /**
     * 执行对话轮次
     */
    private async runConversation(
        sessionId: string,
        targetAddress: string,
        config: ProbeConfig,
        boundaries: { prober: SoulBoundaries; target: SoulBoundaries },
    ): Promise<A2AMessage[]> {
        const conversation: A2AMessage[] = [];

        for (let turn = 0; turn < config.maxTurns; turn++) {
            // 生成问题 (LLM 辅助)
            const question = await this.generateProbeQuestion({
                turn,
                conversation,
                boundaries,
                topics: config.topics,
                avoidTopics: config.avoidTopics,
            });

            // 发送
            const sendResult = await this.router.send({
                to: targetAddress,
                type: 'direct_message',
                preferredProtocol: 'xmtp',
                payload: { sessionId, turn, role: 'prober', content: question },
            });

            if (!sendResult.success) break;

            conversation.push({
                id: sendResult.messageId,
                from: this.agentId,
                to: targetAddress,
                type: 'direct_message',
                protocol: 'xmtp',
                timestamp: Date.now(),
                payload: { content: question, turn, role: 'prober' },
            });

            // 等待回复
            const response = await this.waitForResponse(sessionId, turn, config.timeoutMs);
            if (!response) break;

            conversation.push(response);

            // 检查是否应结束
            if (await this.shouldEndProbe(conversation, boundaries)) break;
        }

        return conversation;
    }

    /**
     * 生成探路问题 (LLM 辅助)
     */
    private async generateProbeQuestion(params: {
        turn: number;
        conversation: A2AMessage[];
        boundaries: { prober: SoulBoundaries; target: SoulBoundaries };
        topics?: string[];
        avoidTopics?: string[];
    }): Promise<string> {
        // 构建 LLM prompt
        const prompt = `You are helping to generate a natural, friendly question for a social exploration conversation.

Turn: ${params.turn}
Previous conversation: ${JSON.stringify(params.conversation.slice(-3))}
Topics to explore: ${params.topics?.join(', ') || 'general'}
Topics to avoid: ${params.avoidTopics?.join(', ') || 'none'}
Forbidden topics: ${params.boundaries.target.forbiddenTopics?.join(', ') || 'none'}

Generate a natural question that:
1. Builds on the previous conversation
2. Explores the suggested topics
3. Avoids forbidden topics
4. Is friendly and non-intrusive
5. Can be answered in 1-3 sentences

Question:`;

        // 调用 LLM
        const response = await this.llm.generate(prompt);
        return response.trim();
    }
}
```

**验收标准**:

- [ ] 完整的探路流程可运行
- [ ] XMTP 消息加密正常
- [ ] 对话轮次控制准确
- [ ] 边界约束生效
- [ ] E2E 测试通过

### 2.3 探路 UI (AgentM)

**任务**: 在 AgentM 中添加社交探路界面

**输出**:

- `apps/agentm/src/renderer/views/SocialView.tsx` (新建)
- `apps/agentm/src/renderer/components/ProbeDialog.tsx` (新建)

**UI 组件**:

```typescript
// SocialView - 社交发现主界面
function SocialView() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [filter, setFilter] = useState<AgentFilter>({});

  useEffect(() => {
    // 从 Nostr 发现 Agents
    socialEngine.discoverAgents(filter).then(setAgents);
  }, [filter]);

  return (
    <div className="social-view">
      <SocialFilter filter={filter} onChange={setFilter} />
      <AgentGrid agents={agents} onSelectAgent={handleSelectAgent} />
    </div>
  );
}

// ProbeDialog - 发起探路对话框
function ProbeDialog({ targetAgent }: { targetAgent: AgentInfo }) {
  const [probeConfig, setProbeConfig] = useState<ProbeConfig>({
    depth: 'deep',
    maxTurns: 15,
    topics: [],
    avoidTopics: [],
    timeoutMs: 60000
  });

  const handleStartProbe = async () => {
    const session = await socialProbe.initiate(
      targetAgent.address,
      probeConfig,
      { prober: mySoulBoundaries, target: targetSoulBoundaries }
    );

    // 跳转到匹配报告
    navigate(`/social/match/${session.id}`);
  };

  return (
    <Dialog>
      <DialogHeader>
        <h2>Social Probe: {targetAgent.displayName}</h2>
      </DialogHeader>
      <DialogBody>
        <ProbeConfigForm config={probeConfig} onChange={setProbeConfig} />
        <SoulPreview soul={targetAgent.soul} />
      </DialogBody>
      <DialogFooter>
        <Button onClick={handleStartProbe}>Start Probe</Button>
      </DialogFooter>
    </Dialog>
  );
}
```

**验收标准**:

- [ ] 社交发现界面美观易用
- [ ] 探路配置表单完整
- [ ] 对话进度实时显示
- [ ] 用户体验流畅

---

## Phase 3: 匹配引擎 (3 天)

### 3.1 Embedding 相似度计算

**任务**: 实现基于 Embedding 的快速匹配

**输出**: `packages/soul-engine/src/matching/embedding.ts`

**核心实现**:

```typescript
import { pipeline } from '@xenova/transformers';

class EmbeddingMatcher {
    private model: any;

    async initialize() {
        // 使用轻量级模型 (可在浏览器运行)
        this.model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }

    /**
     * 生成 Soul Profile Embedding
     */
    async generateEmbedding(profile: SoulProfile): Promise<number[]> {
        // 组合所有文本字段
        const text = [
            profile.identity.bio,
            ...profile.values.core,
            ...profile.interests.topics,
            ...profile.interests.skills,
        ].join(' ');

        const output = await this.model(text, {
            pooling: 'mean',
            normalize: true,
        });

        return Array.from(output.data);
    }

    /**
     * 计算余弦相似度
     */
    cosineSimilarity(a: number[], b: number[]): number {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * 快速批量筛选
     */
    async findTopMatches(
        query: SoulProfile,
        candidates: SoulProfile[],
        topK: number = 10,
    ): Promise<Array<{ profile: SoulProfile; score: number }>> {
        const queryEmbedding = await this.generateEmbedding(query);

        const scores = await Promise.all(
            candidates.map(async (candidate) => {
                const candidateEmbedding = await this.generateEmbedding(candidate);
                const score = this.cosineSimilarity(queryEmbedding, candidateEmbedding);
                return { profile: candidate, score };
            }),
        );

        return scores.sort((a, b) => b.score - a.score).slice(0, topK);
    }
}
```

**验收标准**:

- [ ] Embedding 生成速度 < 100ms
- [ ] 相似度计算准确
- [ ] 批量筛选性能良好 (>100 profiles/s)
- [ ] 单元测试覆盖

### 3.2 LLM 深度分析

**任务**: 使用 LLM 进行多维度深度匹配分析

**输出**: `packages/soul-engine/src/matching/llm-analyzer.ts`

**核心实现**:

```typescript
interface DimensionScore {
    dimension: 'values' | 'tone' | 'boundaries' | 'interests';
    score: number; // 0-100
    evidence: string[]; // 支持证据
    risks: string[]; // 风险点
}

interface MatchingReport {
    overallScore: number;
    dimensionScores: DimensionScore[];
    keyMatches: string[];
    risks: string[];
    suggestedTopics: string[];
    summary: string;
}

class LLMAnalyzer {
    constructor(private llm: LLMClient) {}

    /**
     * 生成匹配报告
     */
    async analyzeMatch(
        proberSoul: SoulProfile,
        targetSoul: SoulProfile,
        conversation: A2AMessage[],
    ): Promise<MatchingReport> {
        // 1. 分析各维度
        const dimensionScores = await Promise.all([
            this.analyzeDimension('values', proberSoul, targetSoul, conversation),
            this.analyzeDimension('tone', proberSoul, targetSoul, conversation),
            this.analyzeDimension('boundaries', proberSoul, targetSoul, conversation),
            this.analyzeDimension('interests', proberSoul, targetSoul, conversation),
        ]);

        // 2. 计算总分 (加权平均)
        const weights = { values: 0.35, tone: 0.25, boundaries: 0.2, interests: 0.2 };
        const overallScore = dimensionScores.reduce((sum, dim) => {
            return sum + dim.score * weights[dim.dimension];
        }, 0);

        // 3. 提取关键信息
        const keyMatches = dimensionScores.flatMap((d) => d.evidence);
        const risks = dimensionScores.flatMap((d) => d.risks);

        // 4. 生成建议话题
        const suggestedTopics = await this.generateTopicSuggestions(proberSoul, targetSoul, conversation);

        // 5. 生成总结
        const summary = await this.generateSummary(overallScore, dimensionScores, keyMatches, risks);

        return {
            overallScore,
            dimensionScores,
            keyMatches,
            risks,
            suggestedTopics,
            summary,
        };
    }

    /**
     * 分析单个维度
     */
    private async analyzeDimension(
        dimension: string,
        proberSoul: SoulProfile,
        targetSoul: SoulProfile,
        conversation: A2AMessage[],
    ): Promise<DimensionScore> {
        const prompt = this.buildDimensionPrompt(dimension, proberSoul, targetSoul, conversation);

        const response = await this.llm.generate(prompt, {
            response_format: {
                type: 'json_schema',
                schema: {
                    type: 'object',
                    properties: {
                        score: { type: 'number', minimum: 0, maximum: 100 },
                        evidence: { type: 'array', items: { type: 'string' } },
                        risks: { type: 'array', items: { type: 'string' } },
                    },
                    required: ['score', 'evidence', 'risks'],
                },
            },
        });

        const result = JSON.parse(response);

        return {
            dimension: dimension as any,
            score: result.score,
            evidence: result.evidence,
            risks: result.risks,
        };
    }

    private buildDimensionPrompt(
        dimension: string,
        proberSoul: SoulProfile,
        targetSoul: SoulProfile,
        conversation: A2AMessage[],
    ): string {
        const dimensionGuides = {
            values: `Analyze alignment of core values, priorities, and deal-breakers.`,
            tone: `Analyze compatibility of communication styles, pace, and depth preferences.`,
            boundaries: `Analyze respect for boundaries and forbidden topics.`,
            interests: `Analyze overlap in topics, skills, and goals.`,
        };

        return `You are a social compatibility analyzer. Analyze the ${dimension} dimension compatibility between two profiles.

Prober Profile:
${JSON.stringify(extractRelevantFields(proberSoul, dimension), null, 2)}

Target Profile:
${JSON.stringify(extractRelevantFields(targetSoul, dimension), null, 2)}

Conversation:
${conversation.map((m) => `${m.payload.role}: ${m.payload.content}`).join('\n')}

${dimensionGuides[dimension]}

Provide:
1. A compatibility score (0-100)
2. Evidence of compatibility (3-5 specific points)
3. Potential risks or conflicts (1-3 points)

Output JSON format:
{
  "score": 85,
  "evidence": ["...", "..."],
  "risks": ["..."]
}`;
    }
}
```

**验收标准**:

- [ ] 四个维度都有分析
- [ ] 输出格式结构化
- [ ] 分析质量高 (人工评估)
- [ ] 响应时间 < 5s
- [ ] 单元测试覆盖

### 3.3 匹配报告生成

**任务**: 整合所有分析结果，生成可读的匹配报告

**输出**: `packages/soul-engine/src/matching/report-generator.ts`

**核心实现**:

```typescript
class MatchingReportGenerator {
    /**
     * 生成完整报告
     */
    async generate(session: ProbeSession, proberSoul: SoulProfile, targetSoul: SoulProfile): Promise<MatchingReport> {
        // 1. Embedding 快速评分
        const embeddingScore =
            (await embeddingMatcher.cosineSimilarity(
                proberSoul.storage.embeddingHash,
                targetSoul.storage.embeddingHash,
            )) * 100;

        // 2. LLM 深度分析
        const llmReport = await llmAnalyzer.analyzeMatch(proberSoul, targetSoul, session.conversation);

        // 3. 综合评分 (70% LLM + 30% Embedding)
        const finalScore = llmReport.overallScore * 0.7 + embeddingScore * 0.3;

        // 4. 生成 Markdown 报告
        const markdown = this.renderMarkdown({
            ...llmReport,
            overallScore: finalScore,
            embeddingScore,
        });

        // 5. 上传报告到存储
        const reportCID = await soulStorage.upload(markdown);

        return {
            ...llmReport,
            overallScore: finalScore,
            reportCID,
            embeddingScore,
        };
    }

    /**
     * 渲染 Markdown 报告
     */
    private renderMarkdown(report: MatchingReport): string {
        return `# Social Matching Report

## Overall Compatibility: ${Math.round(report.overallScore)}/100

${this.renderScoreBar(report.overallScore)}

${
    report.overallScore >= 80
        ? '✅ **Strong Match** - Highly recommended to connect'
        : report.overallScore >= 60
          ? '⚠️ **Moderate Match** - Proceed with awareness of differences'
          : '❌ **Low Match** - Significant incompatibilities detected'
}

---

## Dimension Analysis

${report.dimensionScores
    .map(
        (dim) => `
### ${capitalize(dim.dimension)}: ${dim.score}/100

**Evidence:**
${dim.evidence.map((e) => `- ${e}`).join('\n')}

${dim.risks.length > 0 ? `**Potential Risks:**\n${dim.risks.map((r) => `- ⚠️ ${r}`).join('\n')}` : ''}
`,
    )
    .join('\n---\n')}

---

## Key Compatibility Points

${report.keyMatches
    .slice(0, 5)
    .map((m) => `✓ ${m}`)
    .join('\n')}

---

## Suggested Conversation Topics

${report.suggestedTopics.map((t) => `💡 ${t}`).join('\n')}

---

## Summary

${report.summary}

---

*Report generated on ${new Date().toISOString()}*
*Session ID: ${session.id}*
`;
    }
}
```

**验收标准**:

- [ ] 报告格式清晰易读
- [ ] Markdown 渲染正确
- [ ] 包含所有必要信息
- [ ] 可导出/分享

---

## Phase 4: 链上集成 (2 天)

### 4.1 Reputation PDA 扩展

**任务**: 扩展 Reputation PDA 支持社交准确率

**输出**: `apps/agent-arena/programs/agent-arena/src/state.rs` (修改)

**新增字段**:

```rust
#[account]
pub struct Reputation {
    pub agent: Pubkey,

    // 现有字段
    pub avg_score: u8,
    pub win_rate: u16,
    pub completed: u32,
    // ...

    // 新增: 社交相关
    pub social_probes_initiated: u32,     // 发起的探路次数
    pub social_probes_accepted: u32,      // 接受的探路次数
    pub social_accuracy_score: u8,        // 社交准确率 (0-100)
    pub last_social_activity: i64,        // 最后社交活动时间

    // 预留空间
    pub _reserved: [u8; 64],
}
```

**新增指令**:

```rust
pub fn update_social_reputation(
    ctx: Context<UpdateSocialReputation>,
    probe_id: String,
    match_score: u8,           // 匹配分数
    accuracy_verified: bool,   // Judge 是否验证
) -> Result<()> {
    let reputation = &mut ctx.accounts.reputation;

    // 更新社交探路计数
    reputation.social_probes_initiated += 1;

    // 更新社交准确率 (移动平均)
    let current_score = reputation.social_accuracy_score as u32;
    let count = reputation.social_probes_initiated;
    let new_score = ((current_score * (count - 1)) + match_score as u32) / count;
    reputation.social_accuracy_score = new_score as u8;

    // 更新活动时间
    reputation.last_social_activity = Clock::get()?.unix_timestamp;

    emit!(SocialProbeEvent {
        agent: reputation.agent,
        probe_id,
        match_score,
        accuracy_verified
    });

    Ok(())
}
```

**验收标准**:

- [ ] Solana Program 编译通过
- [ ] 新指令测试通过
- [ ] 状态迁移无问题
- [ ] 事件正确发出

### 4.2 付费匹配服务

**任务**: 实现付费的深度匹配服务 (可选 Judge 验证)

**输出**: `packages/soul-engine/src/premium-matching.ts`

**核心实现**:

```typescript
interface PremiumMatchingOptions {
    useJudgeVerification: boolean; // 是否 Judge 验证
    useTEE: boolean; // 是否使用 TEE 隐私计算
    price: number; // 价格 (USDC)
}

class PremiumMatchingService {
    /**
     * 发起付费匹配
     */
    async initiatePremiumMatching(
        probeSession: ProbeSession,
        options: PremiumMatchingOptions,
    ): Promise<{
        matchingResult: MatchingReport;
        judgeVerification?: JudgeVerification;
        txHash: string;
    }> {
        // 1. 创建链上 Escrow
        const escrowTx = await agentLayer.postTask({
            description: `Premium social matching for session ${probeSession.id}`,
            evalRef: probeSession.conversationCID,
            reward: options.price * 1e6, // USDC decimals
            judge: options.useJudgeVerification ? judgeAddress : null,
            mint: USDC_MINT,
            category: 'social-matching',
        });

        // 2. 执行匹配 (可选 TEE)
        let matchingResult: MatchingReport;

        if (options.useTEE) {
            // MagicBlock TEE 隐私计算
            matchingResult = await this.runTEEMatching(probeSession);
        } else {
            // 本地计算
            matchingResult = await reportGenerator.generate(probeSession, proberSoul, targetSoul);
        }

        // 3. 提交结果
        const submitTx = await agentLayer.submitResult({
            taskId: escrowTx.taskId,
            resultRef: matchingResult.reportCID,
        });

        // 4. Judge 验证 (如果启用)
        let judgeVerification: JudgeVerification | undefined;

        if (options.useJudgeVerification) {
            judgeVerification = await this.waitForJudgeVerification(
                escrowTx.taskId,
                30000, // 30s timeout
            );
        }

        // 5. 更新链上社交信誉
        const updateTx = await agentLayer.updateSocialReputation({
            probeId: probeSession.id,
            matchScore: matchingResult.overallScore,
            accuracyVerified: !!judgeVerification,
        });

        return {
            matchingResult,
            judgeVerification,
            txHash: updateTx,
        };
    }

    /**
     * TEE 隐私匹配
     */
    private async runTEEMatching(session: ProbeSession): Promise<MatchingReport> {
        // 调用 MagicBlock TEE
        const result = await magicblockClient.executePrivateComputation({
            programId: 'soul-matching-v1',
            inputs: {
                conversationCID: session.conversationCID,
                proberSoulCID: proberSoul.storage.cid,
                targetSoulCID: targetSoul.storage.cid,
            },
        });

        // TEE 返回加密结果 + ZK 证明
        return {
            ...result.matchingReport,
            zkProof: result.proof,
        };
    }
}
```

**验收标准**:

- [ ] Escrow 创建成功
- [ ] 匹配服务完整运行
- [ ] TEE 模式可选
- [ ] Judge 验证集成
- [ ] E2E 测试通过

---

## Phase 5: AgentM UI/UX (3 天)

### 5.1 社交发现界面

**任务**: 实现美观的社交发现与筛选界面

**输出**:

- `apps/agentm/src/renderer/views/SocialView.tsx`
- `apps/agentm/src/renderer/components/SocialFilter.tsx`
- `apps/agentm/src/renderer/components/AgentCard.tsx`

**UI 设计**:

```
┌─────────────────────────────────────────────────────────────┐
│ Social Discovery                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Filters: [All Types ▾] [Min Reputation: 60 ━━━━━━━━━]     │
│          [Interests: AI, Blockchain ✕] [+ Add]             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │  Alice AI  │  │  Bob Bot   │  │  Carol     │           │
│  │  ⭐ 92     │  │  ⭐ 85     │  │  ⭐ 78     │           │
│  │  🟢 Online │  │  🟡 Away   │  │  🟢 Online │           │
│  │            │  │            │  │            │           │
│  │  Interests:│  │  Interests:│  │  Interests:│           │
│  │  • AI      │  │  • DeFi    │  │  • Art     │           │
│  │  • Writing │  │  • Trading │  │  • Music   │           │
│  │            │  │            │  │            │           │
│  │ [Probe] 💬 │  │ [Probe] 💬 │  │ [Probe] 💬 │           │
│  └────────────┘  └────────────┘  └────────────┘           │
│                                                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │  ...       │  │  ...       │  │  ...       │           │
│  └────────────┘  └────────────┘  └────────────┘           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**组件实现**:

```typescript
function SocialView() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [filter, setFilter] = useState<SocialFilter>({
    soulType: 'all',
    minReputation: 60,
    interestTags: [],
    onlineOnly: true
  });
  const [loading, setLoading] = useState(false);

  const discoverAgents = useCallback(async () => {
    setLoading(true);
    try {
      const discovered = await socialEngine.discoverAgents(filter);
      setAgents(discovered);
    } catch (error) {
      toast.error('Failed to discover agents');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    discoverAgents();
    const interval = setInterval(discoverAgents, 30000); // 每30秒刷新
    return () => clearInterval(interval);
  }, [discoverAgents]);

  return (
    <div className="social-view">
      <SocialFilter filter={filter} onChange={setFilter} />

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="agent-grid">
          {agents.map(agent => (
            <AgentCard
              key={agent.address}
              agent={agent}
              onProbe={() => openProbeDialog(agent)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent, onProbe }: { agent: AgentInfo; onProbe: () => void }) {
  return (
    <div className="agent-card">
      <div className="agent-header">
        <h3>{agent.displayName}</h3>
        <span className="reputation">⭐ {agent.reputationScore}</span>
      </div>

      <div className="agent-status">
        <StatusIndicator available={agent.available} />
        {agent.available ? 'Online' : 'Offline'}
      </div>

      {agent.soul && (
        <div className="agent-soul">
          <h4>Interests:</h4>
          <ul>
            {agent.soul.tags.slice(0, 3).map(tag => (
              <li key={tag}>• {tag}</li>
            ))}
          </ul>
        </div>
      )}

      <button className="probe-button" onClick={onProbe}>
        <MessageCircle size={16} />
        Probe
      </button>
    </div>
  );
}
```

**验收标准**:

- [ ] 界面美观现代
- [ ] 筛选功能完整
- [ ] 实时更新在线状态
- [ ] 响应式设计

### 5.2 探路对话界面

**任务**: 实现探路对话的实时展示

**输出**: `apps/agentm/src/renderer/views/ProbeConversationView.tsx`

**UI 设计**:

```
┌─────────────────────────────────────────────────────────────┐
│ Social Probe: Alice AI                          [✕]         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Progress: Turn 3/15  [━━━━━━━░░░░░░░] 20%                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🤖 Me: What are your thoughts on AI ethics?                │
│  ⏰ 2 seconds ago                                           │
│                                                             │
│  🧑 Alice: I believe transparency and accountability...     │
│  ⏰ Just now                                                │
│                                                             │
│  🤖 Me: That's interesting! How do you approach...          │
│  ⏰ Sending...                                              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Status: ⏳ Waiting for response...                        │
│                                                             │
│  [Pause Probe]  [End Probe]                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**组件实现**:

```typescript
function ProbeConversationView({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<ProbeSession | null>(null);
  const [messages, setMessages] = useState<A2AMessage[]>([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [status, setStatus] = useState<'probing' | 'paused' | 'completed'>('probing');

  useEffect(() => {
    // 监听探路进度
    const unsubscribe = socialProbe.subscribeProgress(sessionId, (turn, message) => {
      setCurrentTurn(turn);
      setMessages(prev => [...prev, message]);
    });

    return () => unsubscribe();
  }, [sessionId]);

  const handlePause = () => {
    socialProbe.pauseProbe(sessionId);
    setStatus('paused');
  };

  const handleEnd = async () => {
    await socialProbe.endProbe(sessionId);
    setStatus('completed');

    // 跳转到匹配报告
    navigate(`/social/match/${sessionId}`);
  };

  return (
    <div className="probe-conversation-view">
      <header>
        <h2>Social Probe: {session?.targetId}</h2>
        <button onClick={handleEnd}>✕</button>
      </header>

      <div className="progress-bar">
        <span>Progress: Turn {currentTurn}/{session?.maxTurns}</span>
        <ProgressBar value={currentTurn} max={session?.maxTurns ?? 15} />
      </div>

      <div className="messages">
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            isMe={message.payload.role === 'prober'}
          />
        ))}
      </div>

      <div className="status-bar">
        <span className="status-text">
          {status === 'probing' ? '⏳ Waiting for response...' :
           status === 'paused' ? '⏸️ Paused' :
           '✅ Completed'}
        </span>

        <div className="actions">
          {status === 'probing' && (
            <>
              <button onClick={handlePause}>Pause Probe</button>
              <button onClick={handleEnd}>End Probe</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

**验收标准**:

- [ ] 对话实时显示
- [ ] 进度条准确
- [ ] 暂停/结束功能正常
- [ ] 用户体验流畅

### 5.3 匹配报告展示

**任务**: 实现美观的匹配报告展示界面

**输出**: `apps/agentm/src/renderer/views/MatchReportView.tsx`

**UI 设计**:

```
┌─────────────────────────────────────────────────────────────┐
│ Social Matching Report                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Overall Compatibility: 87/100                              │
│  [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░]         │
│  ✅ Strong Match - Highly recommended to connect            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 Dimension Analysis                                      │
│                                                             │
│  Values: 92/100  [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░]   │
│  • Shared emphasis on transparency and ethics               │
│  • Similar risk tolerance                                   │
│                                                             │
│  Tone: 85/100    [━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░]       │
│  • Compatible communication pace                            │
│  • Both prefer deep, thoughtful discussions                 │
│                                                             │
│  Boundaries: 88/100  [━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░]     │
│  • Mutual respect for privacy                               │
│  • Aligned on forbidden topics                              │
│                                                             │
│  Interests: 78/100   [━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░]     │
│  • Significant overlap in AI and blockchain                 │
│  • Complementary skills                                     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  💡 Suggested Conversation Topics                           │
│  • AI ethics and governance                                 │
│  • Decentralized systems design                             │
│  • Creative AI applications                                 │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Send Message] [Export Report] [Share]                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**组件实现**:

```typescript
function MatchReportView({ sessionId }: { sessionId: string }) {
  const [report, setReport] = useState<MatchingReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMatchReport();
  }, [sessionId]);

  const loadMatchReport = async () => {
    setLoading(true);
    try {
      const matchingReport = await socialEngine.getMatchReport(sessionId);
      setReport(matchingReport);
    } catch (error) {
      toast.error('Failed to load match report');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = () => {
    // 跳转到聊天界面
    navigate(`/chat/${report?.targetId}`);
  };

  const handleExport = async () => {
    const markdown = await reportGenerator.renderMarkdown(report!);
    downloadFile(markdown, `match-report-${sessionId}.md`);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!report) {
    return <ErrorMessage message="Report not found" />;
  }

  return (
    <div className="match-report-view">
      <header>
        <h1>Social Matching Report</h1>
      </header>

      <section className="overall-score">
        <h2>Overall Compatibility: {report.overallScore}/100</h2>
        <ProgressBar value={report.overallScore} max={100} />
        <RecommendationBadge score={report.overallScore} />
      </section>

      <section className="dimension-analysis">
        <h2>📊 Dimension Analysis</h2>
        {report.dimensionScores.map(dim => (
          <DimensionScore key={dim.dimension} dimension={dim} />
        ))}
      </section>

      <section className="key-matches">
        <h2>✨ Key Compatibility Points</h2>
        <ul>
          {report.keyMatches.map((match, i) => (
            <li key={i}>✓ {match}</li>
          ))}
        </ul>
      </section>

      {report.risks.length > 0 && (
        <section className="risks">
          <h2>⚠️ Potential Risks</h2>
          <ul>
            {report.risks.map((risk, i) => (
              <li key={i}>⚠️ {risk}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="suggested-topics">
        <h2>💡 Suggested Conversation Topics</h2>
        <ul>
          {report.suggestedTopics.map((topic, i) => (
            <li key={i}>💡 {topic}</li>
          ))}
        </ul>
      </section>

      <footer className="actions">
        <button className="primary" onClick={handleSendMessage}>
          Send Message
        </button>
        <button onClick={handleExport}>Export Report</button>
        <button onClick={() => shareReport(report)}>Share</button>
      </footer>
    </div>
  );
}
```

**验收标准**:

- [ ] 报告展示清晰美观
- [ ] 所有维度可视化
- [ ] 导出功能正常
- [ ] 分享功能正常

---

## Phase 6: 测试与优化 (2 天)

### 6.1 E2E 测试

**任务**: 编写完整的端到端测试

**输出**: `packages/soul-engine/tests/e2e/social-probe.test.ts`

**测试场景**:

```typescript
describe('Social Probe E2E', () => {
  let aliceAgent: ChainHubSocial;
  let bobAgent: ChainHubSocial;

  beforeAll(async () => {
    // 初始化两个测试 Agent
    aliceAgent = new ChainHubSocial({...});
    bobAgent = new ChainHubSocial({...});

    await aliceAgent.initialize();
    await bobAgent.initialize();
  });

  test('完整社交探路流程', async () => {
    // 1. Alice 上传 Soul Profile
    const aliceSoul = await aliceAgent.uploadSoul({
      soulType: 'agent',
      content: aliceSoulMarkdown,
      visibility: 'public',
      storage: { type: 'ipfs' }
    });

    // 2. Bob 上传 Soul Profile
    const bobSoul = await bobAgent.uploadSoul({
      soulType: 'agent',
      content: bobSoulMarkdown,
      visibility: 'public',
      storage: { type: 'ipfs' }
    });

    // 3. Alice 发现 Bob
    const agents = await aliceAgent.discoverAgents({
      minReputation: 0
    });

    expect(agents.some(a => a.address === bobAgent.agentId)).toBe(true);

    // 4. Alice 发起探路
    const probeSession = await aliceAgent.probe({
      targetAddress: bobAgent.agentId,
      probeConfig: {
        depth: 'light',
        maxTurns: 5,
        timeoutMs: 30000
      },
      boundaries: {
        prober: aliceSoul.boundaries,
        target: bobSoul.boundaries
      }
    });

    expect(probeSession.status).toBe('completed');
    expect(probeSession.conversation.length).toBeGreaterThan(0);

    // 5. 生成匹配报告
    const matchReport = await aliceAgent.generateMatchReport(probeSession.id);

    expect(matchReport.overallScore).toBeGreaterThanOrEqual(0);
    expect(matchReport.overallScore).toBeLessThanOrEqual(100);
    expect(matchReport.dimensionScores).toHaveLength(4);

    // 6. 链上更新社交信誉
    const txHash = await aliceAgent.updateSocialReputation({
      probeId: probeSession.id,
      matchScore: matchReport.overallScore
    });

    expect(txHash).toBeTruthy();
  }, 60000);

  test('ZK-selective 隐私模式', async () => {
    // 测试 ZK 选择性披露
    // ...
  });

  test('付费匹配服务', async () => {
    // 测试付费匹配 + Judge 验证
    // ...
  });
});
```

**验收标准**:

- [ ] 所有测试通过
- [ ] 覆盖率 ≥ 80%
- [ ] 边界情况测试
- [ ] 性能基准测试

### 6.2 性能优化

**任务**: 优化关键路径性能

**目标**:

- [ ] Embedding 生成 < 100ms
- [ ] LLM 分析 < 5s
- [ ] 完整探路流程 < 2min (15轮)
- [ ] UI 响应 < 100ms

**优化点**:

1. **Embedding 缓存**: 缓存已生成的 Embedding
2. **批量处理**: 批量筛选候选 Agent
3. **并行请求**: LLM 维度分析并行
4. **WebSocket**: 实时消息使用 WebSocket 而非轮询

### 6.3 文档完善

**任务**: 完善用户文档和开发者文档

**输出**:

- `docs/user-guide/social-features.md` - 用户指南
- `docs/developer-guide/social-engine-api.md` - API 文档
- `docs/soul-md-best-practices.md` - SOUL.md 最佳实践
- `README.md` 更新

---

## 实施计划

### Week 1 (Phase 1-2)

- Day 1-2: Soul Profile 基础设施
- Day 3-5: 社交发现与探路

### Week 2 (Phase 3-4)

- Day 1-3: 匹配引擎
- Day 4-5: 链上集成

### Week 3 (Phase 5-6)

- Day 1-3: AgentM UI/UX
- Day 4-5: 测试与优化

### 里程碑

| 里程碑               | 日期         | 交付物          |
| -------------------- | ------------ | --------------- |
| M1: Soul Profile MVP | Week 1 Day 2 | 解析器 + 存储   |
| M2: 探路流程 MVP     | Week 1 Day 5 | 完整探路流程    |
| M3: 匹配引擎 MVP     | Week 2 Day 3 | 匹配报告生成    |
| M4: 链上集成完成     | Week 2 Day 5 | Reputation 扩展 |
| M5: UI/UX 完成       | Week 3 Day 3 | 所有界面就绪    |
| M6: 上线准备完成     | Week 3 Day 5 | 测试 + 文档     |

---

## 风险与缓解

| 风险             | 概率 | 影响 | 缓解措施                        |
| ---------------- | ---- | ---- | ------------------------------- |
| XMTP 消息延迟高  | 中   | 中   | 添加超时处理，fallback 到 Nostr |
| LLM API 限流     | 高   | 中   | 本地模型 fallback，缓存结果     |
| Embedding 性能差 | 低   | 低   | 使用 WASM 加速，预计算          |
| UI 复杂度高      | 中   | 低   | 分阶段实现，先 MVP 后优化       |
| 链上存储成本高   | 低   | 低   | 只存哈希，内容存 IPFS/Arweave   |

---

## 总结

本计划将在 **3 周 (15 天)** 内完成非金融 A2A 社交功能的完整实现，包括：

✅ **Soul Profile 系统** - 标准化的灵魂档案  
✅ **社交探路** - 受控的多轮对话  
✅ **匹配引擎** - Embedding + LLM 深度分析  
✅ **链上集成** - 社交信誉积累  
✅ **AgentM UI** - 美观易用的用户界面

**核心价值**:

- 降低 **90%** 无效社交成本
- 提供 **可验证** 的匹配质量
- 积累 **链上** 社交信誉
- 打造 **Agent 生活操作系统** (金融 + 社交)
