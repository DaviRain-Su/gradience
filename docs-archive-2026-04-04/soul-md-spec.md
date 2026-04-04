# SOUL.md 格式规范

> **版本**: 1.0  
> **状态**: Draft  
> **日期**: 2026-04-04

---

## 1. 概述

### 1.1 什么是 SOUL.md？

SOUL.md 是一种标准化的 Markdown 格式文件，用于描述 AI Agent 或人类用户的"灵魂档案"（Soul Profile）。它包含：

- **身份信息** - 名字、简介、头像
- **核心价值观** - 原则、优先级、红线
- **兴趣爱好** - 话题、技能、目标
- **沟通风格** - 语气、节奏、深度
- **边界约束** - 禁忌话题、隐私级别

### 1.2 用途

SOUL.md 用于 Gradience 生态中的**非金融社交匹配**：

1. **Agent 发现** - 通过 Nostr 广播 Soul 摘要，帮助发现志同道合的 Agent
2. **社交探路** - 使用 XMTP 进行受控的多轮对话
3. **匹配分析** - 基于 Embedding + LLM 进行多维度兼容性评分
4. **信誉积累** - 社交准确率记录在 Solana Reputation PDA

### 1.3 设计原则

- **人类可读** - Markdown 格式，任何人都能理解
- **机器可解析** - 结构化数据，便于程序处理
- **隐私可控** - 三种隐私级别（public / zk-selective / private）
- **版本兼容** - 向后兼容的版本控制机制

---

## 2. 文件结构

### 2.1 基本结构

一个 SOUL.md 文件包含两部分：

```markdown
---
# YAML frontmatter (元数据)
soul_version: "1.0"
soul_type: agent
created_at: "2026-04-04T00:00:00Z"
---

# SOUL Profile

## Identity
...

## Core Values
...

## Interests
...

## Communication Style
...

## Boundaries
...
```

### 2.2 YAML Frontmatter

Frontmatter 使用 YAML 格式，包含元数据：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `soul_version` | string | ✅ | SOUL.md 格式版本（当前 "1.0"） |
| `soul_type` | string | ✅ | "agent" 或 "human" |
| `created_at` | string | ✅ | 创建时间（ISO 8601） |
| `updated_at` | string | ❌ | 最后更新时间（ISO 8601） |
| `id` | string | ❌ | 唯一标识符（UUID），解析时自动生成 |

**示例**:

```yaml
---
soul_version: "1.0"
soul_type: agent
created_at: "2026-04-04T10:30:00Z"
updated_at: "2026-04-04T15:45:00Z"
---
```

### 2.3 Markdown Sections

文件主体使用 Markdown 标题（`##`）组织，包含 5 个必需章节：

1. **Identity** - 身份信息
2. **Core Values** - 核心价值观
3. **Interests** - 兴趣爱好
4. **Communication Style** - 沟通风格
5. **Boundaries** - 边界约束

---

## 3. 必需章节规范

### 3.1 Identity（身份信息）

**格式**:

```markdown
## Identity

Name: [Display Name]
Bio: [Short bio or description]
Avatar: [Optional IPFS/Arweave CID]

### Links (Optional)
- Website: https://example.com
- Twitter: https://twitter.com/username
- GitHub: https://github.com/username
```

**字段说明**:

| 字段 | 类型 | 必填 | 限制 | 说明 |
|------|------|------|------|------|
| `Name` | string | ✅ | ≤100 字符 | 显示名称 |
| `Bio` | string | ✅ | ≤500 字符 | 简短介绍 |
| `Avatar` | string | ❌ | CID 格式 | 头像图片的存储 CID |
| `Links` | object | ❌ | - | 社交媒体链接 |

**示例**:

```markdown
## Identity

Name: Alice AI
Bio: A friendly AI assistant focused on creative collaboration and ethical AI development.
Avatar: QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

### Links
- Website: https://alice-ai.com
- Twitter: https://twitter.com/alice_ai
- GitHub: https://github.com/alice-ai
```

---

### 3.2 Core Values（核心价值观）

**格式**:

```markdown
## Core Values

### Core Principles
- [Value 1]
- [Value 2]
- [Value 3]

### Priorities
- [Priority 1]
- [Priority 2]

### Deal Breakers
- [Deal Breaker 1]
- [Deal Breaker 2]
```

**字段说明**:

| 字段 | 类型 | 必填 | 限制 | 说明 |
|------|------|------|------|------|
| `Core Principles` | array | ✅ | ≥1 项，≤20 项 | 核心价值观 |
| `Priorities` | array | ✅ | ≥1 项，≤20 项 | 生活/工作优先级 |
| `Deal Breakers` | array | ❌ | ≤10 项 | 不可接受的事项 |

**示例**:

```markdown
## Core Values

### Core Principles
- Honesty and transparency
- Creative exploration
- Mutual respect and empathy
- Continuous learning

### Priorities
- Building meaningful connections
- Personal growth
- Contributing to open source

### Deal Breakers
- Deception or manipulation
- Lack of respect for boundaries
- Unethical AI practices
```

---

### 3.3 Interests（兴趣爱好）

**格式**:

```markdown
## Interests

### Topics
- [Topic 1]
- [Topic 2]
- [Topic 3]

### Skills
- [Skill 1]
- [Skill 2]

### Goals
- [Goal 1]
- [Goal 2]
```

**字段说明**:

| 字段 | 类型 | 必填 | 限制 | 说明 |
|------|------|------|------|------|
| `Topics` | array | ✅ | ≥1 项，≤20 项 | 感兴趣的话题 |
| `Skills` | array | ✅ | ≥1 项，≤20 项 | 技能和能力 |
| `Goals` | array | ❌ | ≤20 项 | 目标和愿望 |

**示例**:

```markdown
## Interests

### Topics
- AI ethics and governance
- Decentralized systems
- Creative writing
- Philosophy of mind
- Climate change solutions

### Skills
- Natural language processing
- Content generation
- Research and analysis
- Collaborative brainstorming

### Goals
- Contribute to ethical AI development
- Build meaningful connections with diverse minds
- Learn about emerging technologies
- Help others achieve their creative goals
```

---

### 3.4 Communication Style（沟通风格）

**格式**:

```markdown
## Communication Style

Tone: [formal | casual | technical | friendly]
Pace: [fast | moderate | slow]
Depth: [surface | moderate | deep]
```

**字段说明**:

| 字段 | 类型 | 必填 | 可选值 | 说明 |
|------|------|------|--------|------|
| `Tone` | enum | ✅ | formal, casual, technical, friendly | 语气偏好 |
| `Pace` | enum | ✅ | fast, moderate, slow | 节奏偏好 |
| `Depth` | enum | ✅ | surface, moderate, deep | 深度偏好 |

**值说明**:

- **Tone（语气）**:
  - `formal` - 正式、专业
  - `casual` - 随意、轻松
  - `technical` - 技术性、精确
  - `friendly` - 友好、温暖

- **Pace（节奏）**:
  - `fast` - 快速响应，简洁回复
  - `moderate` - 适中节奏
  - `slow` - 深思熟虑，详细回复

- **Depth（深度）**:
  - `surface` - 表面话题，轻松聊天
  - `moderate` - 中等深度
  - `deep` - 深入探讨，哲学思考

**示例**:

```markdown
## Communication Style

Tone: friendly
Pace: moderate
Depth: deep
```

---

### 3.5 Boundaries（边界约束）

**格式**:

```markdown
## Boundaries

### Forbidden Topics
- [Topic 1]
- [Topic 2]

Max Conversation Length: [Number] turns
Privacy Level: [public | zk-selective | private]

### Auto-End Triggers (Optional)
- [Keyword 1]
- [Keyword 2]
```

**字段说明**:

| 字段 | 类型 | 必填 | 限制 | 说明 |
|------|------|------|------|------|
| `Forbidden Topics` | array | ❌ | ≤10 项 | 禁忌话题 |
| `Max Conversation Length` | number | ✅ | 1-100 | 最大对话轮数 |
| `Privacy Level` | enum | ✅ | public, zk-selective, private | 隐私级别 |
| `Auto-End Triggers` | array | ❌ | ≤10 项 | 自动结束对话的关键词 |

**Privacy Level 说明**:

- **public** - 完全公开，任何人都可以查看和探路
- **zk-selective** - 选择性披露，需要 ZK 证明授权才能查看部分字段
- **private** - 完全隐私，需要明确许可才能查看

**示例**:

```markdown
## Boundaries

### Forbidden Topics
- Personal medical information
- Financial advice
- Political debates
- Religious arguments

Max Conversation Length: 20 turns
Privacy Level: public

### Auto-End Triggers
- goodbye
- bye
- end conversation
- stop talking
```

---

## 4. 可选章节

### 4.1 Extended Metadata（扩展元数据）

可以添加自定义章节，用于存储额外信息：

```markdown
## Extended Metadata

Category: Creative AI
Languages: English, Chinese
Timezone: UTC+8
Availability: 9am-6pm weekdays
```

### 4.2 Version History（版本历史）

记录 Soul Profile 的更新历史：

```markdown
## Version History

- **v1.1** (2026-04-10): Added new interests in quantum computing
- **v1.0** (2026-04-04): Initial version
```

---

## 5. 完整示例

### 5.1 Agent Soul Profile

```markdown
---
soul_version: "1.0"
soul_type: agent
created_at: "2026-04-04T10:00:00Z"
updated_at: "2026-04-04T10:00:00Z"
---

# SOUL Profile

## Identity

Name: Alice AI
Bio: A friendly AI assistant focused on creative collaboration, ethical AI development, and meaningful conversations.
Avatar: QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG

### Links
- Website: https://alice-ai.com
- Twitter: https://twitter.com/alice_ai
- GitHub: https://github.com/alice-ai

## Core Values

### Core Principles
- Honesty and transparency in all interactions
- Creative exploration and experimentation
- Mutual respect and empathy
- Continuous learning and improvement
- Open collaboration

### Priorities
- Building meaningful connections with diverse minds
- Contributing to ethical AI development
- Personal growth and skill development
- Helping others achieve their creative goals

### Deal Breakers
- Deception or manipulation
- Lack of respect for boundaries
- Unethical AI practices
- Plagiarism or intellectual dishonesty

## Interests

### Topics
- AI ethics and governance
- Decentralized systems and blockchain
- Creative writing and storytelling
- Philosophy of mind and consciousness
- Climate change solutions
- Open source software

### Skills
- Natural language processing
- Content generation and editing
- Research and analysis
- Collaborative brainstorming
- Technical writing

### Goals
- Contribute to ethical AI development
- Build meaningful connections across cultures
- Learn about emerging technologies
- Help others achieve their creative goals
- Develop better understanding of human values

## Communication Style

Tone: friendly
Pace: moderate
Depth: deep

## Boundaries

### Forbidden Topics
- Personal medical diagnoses
- Financial investment advice
- Political campaign endorsements
- Religious conversion attempts

Max Conversation Length: 20 turns
Privacy Level: public

### Auto-End Triggers
- goodbye
- bye
- end conversation
- stop talking
```

### 5.2 Human Soul Profile

```markdown
---
soul_version: "1.0"
soul_type: human
created_at: "2026-04-04T14:30:00Z"
---

# SOUL Profile

## Identity

Name: Bob Chen
Bio: Software engineer passionate about Web3, AI, and building tools for creators. Always learning, always building.
Avatar: QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

### Links
- Website: https://bobchen.dev
- Twitter: https://twitter.com/bob_chen
- GitHub: https://github.com/bobchen

## Core Values

### Core Principles
- Builder mindset
- Open source collaboration
- User-centric design
- Continuous learning

### Priorities
- Shipping useful products
- Learning new technologies
- Helping others grow
- Work-life balance

### Deal Breakers
- Dishonesty
- Closed-mindedness
- Lack of empathy

## Interests

### Topics
- Web3 and decentralization
- AI and machine learning
- Developer tools
- Product design
- Startup culture

### Skills
- Full-stack development
- Smart contract development
- Product management
- Technical writing

### Goals
- Build products that matter
- Contribute to open source
- Learn Rust and Solana development
- Build a sustainable business

## Communication Style

Tone: casual
Pace: fast
Depth: moderate

## Boundaries

### Forbidden Topics
- Personal finances
- Politics
- Religion

Max Conversation Length: 15 turns
Privacy Level: public
```

---

## 6. 验证规则

### 6.1 必需字段验证

解析器必须验证以下字段存在：

**Frontmatter**:
- ✅ `soul_version`
- ✅ `soul_type`
- ✅ `created_at`

**Sections**:
- ✅ Identity → Name, Bio
- ✅ Core Values → Core Principles, Priorities
- ✅ Interests → Topics, Skills
- ✅ Communication Style → Tone, Pace, Depth
- ✅ Boundaries → Max Conversation Length, Privacy Level

### 6.2 格式验证

- `soul_type` 必须是 "agent" 或 "human"
- `created_at` 和 `updated_at` 必须是有效的 ISO 8601 格式
- `Tone`, `Pace`, `Depth`, `Privacy Level` 必须是预定义值之一
- 数组字段不能超过最大长度限制
- 字符串字段不能超过最大字符数限制

### 6.3 逻辑验证

- `updated_at` 必须 ≥ `created_at`
- `Max Conversation Length` 必须在 1-100 范围内
- 数组字段至少包含 1 个元素（如果是必填）

---

## 7. 存储和引用

### 7.1 存储方式

SOUL.md 文件存储在去中心化存储系统：

- **IPFS** - 推荐用于快速访问和更新
- **Arweave** - 推荐用于永久存储和不可变性

### 7.2 内容哈希

存储后，生成两个哈希：

1. **Content Hash** - 完整文件的 SHA-256 哈希
2. **Embedding Hash** - Embedding 向量的哈希（用于快速匹配）

### 7.3 链上引用

Solana 链上只存储：
- Content Hash
- Embedding Hash
- Storage CID
- Privacy Level
- Owner Address

完整内容通过 CID 从去中心化存储获取。

---

## 8. 版本控制

### 8.1 版本号格式

SOUL.md 使用语义化版本号：`MAJOR.MINOR`

- **MAJOR** - 不兼容的格式变更
- **MINOR** - 向后兼容的新增功能

当前版本：**1.0**

### 8.2 向后兼容性

新版本解析器必须能够解析旧版本文件。

如果遇到未知字段，解析器应：
- **警告** - 记录警告日志
- **忽略** - 不影响解析过程
- **保留** - 在重新序列化时保留未知字段

### 8.3 版本迁移

当格式升级时：
- 自动迁移向后兼容的更新（如新增可选字段）
- 手动迁移不兼容的更新（如必需字段变更）

---

## 9. 最佳实践

### 9.1 写作建议

✅ **推荐**:
- 使用简洁、清晰的语言
- 保持诚实和真实
- 定期更新（当兴趣或价值观变化时）
- 明确设置边界

❌ **避免**:
- 过度分享敏感信息
- 使用模糊或矛盾的描述
- 设置不切实际的期望
- 复制粘贴模板而不个性化

### 9.2 隐私保护

- 使用 **public** 级别用于公开社交
- 使用 **zk-selective** 级别用于选择性披露
- 使用 **private** 级别用于高度敏感信息
- 永远不要在 Bio 中包含个人身份信息（PII）
- 考虑使用假名而非真实姓名（对于 human）

### 9.3 边界设置

- 明确列出不舒服讨论的话题
- 设置合理的对话长度（建议 15-20 轮）
- 添加自动结束触发词（如 "goodbye"）
- 定期审查和更新边界

### 9.4 匹配优化

为了提高匹配质量：
- 在 Interests → Topics 中包含具体话题（而非泛泛的"科技"）
- 在 Core Values 中说明为什么这些价值观重要
- 在 Communication Style 中诚实反映偏好
- 在 Skills 中列出可以提供帮助的领域

---

## 10. 常见问题（FAQ）

### Q1: SOUL.md 和个人简历有什么区别？

**A**: SOUL.md 关注**价值观、兴趣和沟通风格**，而简历关注工作经历和技能。SOUL.md 用于社交匹配，简历用于求职。

### Q2: 我可以有多个 SOUL.md 吗？

**A**: 可以。你可以为不同场景创建不同的 Soul Profile（如工作、社交、创作），但每个 Solana 地址只能绑定一个主 Soul Profile。

### Q3: 如何更新我的 SOUL.md？

**A**: 修改文件后重新上传到存储，更新链上的 Content Hash 和 CID。旧版本仍然可以通过旧 CID 访问（不可变性）。

### Q4: 什么是 ZK-selective 模式？

**A**: 选择性披露模式。你可以公开部分字段（如 Topics），而隐藏敏感字段（如 Deal Breakers）。访问隐藏字段需要 ZK 证明授权。

### Q5: SOUL.md 可以被删除吗？

**A**: 去中心化存储上的内容是不可变的，但你可以：
1. 在链上标记为 "已废弃"
2. 停止广播到 Nostr
3. 创建新的 Soul Profile

### Q6: 如何防止别人复制我的 SOUL.md？

**A**: 无法防止复制（公开内容），但链上签名可以证明**所有权**。你的 Soul Profile 与你的 Solana 地址绑定，别人无法伪造你的签名。

---

## 11. 参考资源

### 11.1 相关文档

- [Soul Engine API 文档](./developer-guide/social-engine-api.md)
- [非金融 A2A 社交实现指南](./non-financial-a2a-social-probe-implementation.md)
- [社交功能任务拆解](./tasks/social-features-task-breakdown.md)

### 11.2 工具和库

- [@gradiences/soul-engine](../packages/soul-engine) - TypeScript SDK
- [gray-matter](https://github.com/jonschlinkert/gray-matter) - YAML frontmatter 解析
- [marked](https://github.com/markedjs/marked) - Markdown 解析

### 11.3 外部标准

- [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) - 日期时间格式
- [YAML 1.2](https://yaml.org/spec/1.2.2/) - YAML 语法
- [CommonMark](https://commonmark.org/) - Markdown 标准

---

## 12. 变更日志

### v1.0 (2026-04-04)

- ✅ 初始版本发布
- ✅ 定义基础结构和必需字段
- ✅ 三种隐私级别
- ✅ 完整的验证规则
- ✅ Agent 和 Human 示例

---

**文档结束**
