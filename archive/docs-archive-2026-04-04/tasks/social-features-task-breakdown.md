# 非金融 A2A 社交功能 - 详细任务拆解

> **文档类型**: 任务清单  
> **创建日期**: 2026-04-04  
> **总任务数**: 63 个任务  
> **总工期**: 15 天（3 周）

---

## 任务命名规范

```
GRA-XXX: [Component] Task Description
```

- `[Soul Engine]` - Soul Profile 相关
- `[Social Probe]` - 社交探路相关
- `[Matching]` - 匹配引擎相关
- `[Solana]` - 链上集成相关
- `[AgentM UI]` - 前端界面相关
- `[Testing]` - 测试相关
- `[Docs]` - 文档相关

---

## Phase 1: Soul Profile 基础设施 (2 天)

### 1.1 SOUL.md 格式定义 (0.5 天)

#### GRA-201: [Soul Engine] 定义 SoulProfile TypeScript 类型
- **优先级**: P0
- **工期**: 2h
- **文件**: `packages/types/src/soul.ts`
- **验收标准**:
  - [ ] 完整的 `SoulProfile` 接口定义
  - [ ] 包含所有必要字段（identity, values, interests, communication, boundaries, storage, onChain）
  - [ ] 使用 TypeScript 严格类型
  - [ ] 导出所有相关类型

#### GRA-202: [Soul Engine] 编写 SOUL.md 格式规范文档
- **优先级**: P0
- **工期**: 3h
- **文件**: `docs/soul-md-spec.md`
- **验收标准**:
  - [ ] 完整的 Markdown 格式规范
  - [ ] 包含 YAML frontmatter 说明
  - [ ] 所有字段的详细解释
  - [ ] 版本控制说明
  - [ ] 隐私级别说明

#### GRA-203: [Soul Engine] 创建示例 SOUL.md 文件
- **优先级**: P0
- **工期**: 2h
- **文件**: `packages/soul-engine/examples/*.md`
- **验收标准**:
  - [ ] 创建 3 个示例文件：
    - `agent-example.md` - Agent Soul
    - `human-example.md` - Human Soul
    - `complex-example.md` - 复杂场景（多兴趣、多边界）
  - [ ] 每个示例都符合格式规范
  - [ ] 包含注释说明

---

### 1.2 SOUL.md 解析器 (1 天)

#### GRA-204: [Soul Engine] 安装解析器依赖
- **优先级**: P0
- **工期**: 0.5h
- **依赖**: `gray-matter`, `marked`, `zod`
- **验收标准**:
  - [ ] 所有依赖安装完成
  - [ ] package.json 更新
  - [ ] 依赖版本锁定

#### GRA-205: [Soul Engine] 实现 parse() 函数
- **优先级**: P0
- **工期**: 4h
- **文件**: `packages/soul-engine/src/parser.ts`
- **验收标准**:
  - [ ] 正确解析 YAML frontmatter
  - [ ] 正确解析 Markdown sections
  - [ ] 提取所有结构化字段
  - [ ] 错误处理完善
  - [ ] 支持所有示例文件

#### GRA-206: [Soul Engine] 实现 stringify() 函数
- **优先级**: P0
- **工期**: 3h
- **文件**: `packages/soul-engine/src/parser.ts`
- **验收标准**:
  - [ ] 生成规范的 YAML frontmatter
  - [ ] 生成可读的 Markdown sections
  - [ ] 格式化一致
  - [ ] 往返转换无损失（parse → stringify → parse 相等）

#### GRA-207: [Soul Engine] 实现 validate() 函数
- **优先级**: P0
- **工期**: 3h
- **文件**: `packages/soul-engine/src/parser.ts`
- **验收标准**:
  - [ ] 使用 Zod schema 验证
  - [ ] 捕获所有必填字段缺失
  - [ ] 捕获类型错误
  - [ ] 返回友好的错误信息
  - [ ] 支持部分验证

#### GRA-208: [Soul Engine] 编写解析器单元测试
- **优先级**: P0
- **工期**: 4h
- **文件**: `packages/soul-engine/src/parser.test.ts`
- **验收标准**:
  - [ ] 测试覆盖率 ≥ 90%
  - [ ] 测试所有示例文件
  - [ ] 测试错误情况
  - [ ] 测试往返转换
  - [ ] 测试边界条件

---

### 1.3 存储集成 (0.5 天)

#### GRA-209: [Soul Engine] 实现 IPFS 上传功能
- **优先级**: P0
- **工期**: 2h
- **文件**: `packages/soul-engine/src/storage.ts`
- **依赖**: Pinata API
- **验收标准**:
  - [ ] 正确上传到 Pinata
  - [ ] 返回 IPFS CID
  - [ ] 错误处理（网络、API 限流）
  - [ ] 环境变量配置（PINATA_JWT）

#### GRA-210: [Soul Engine] 实现 IPFS 下载功能
- **优先级**: P0
- **工期**: 1.5h
- **文件**: `packages/soul-engine/src/storage.ts`
- **验收标准**:
  - [ ] 通过 CID 下载内容
  - [ ] 支持多个 Gateway（Pinata, IPFS.io）
  - [ ] 错误处理（404, timeout）
  - [ ] 重试机制

#### GRA-211: [Soul Engine] 实现 Arweave 上传功能
- **优先级**: P1
- **工期**: 2h
- **文件**: `packages/soul-engine/src/storage.ts`
- **依赖**: Irys (Bundlr)
- **验收标准**:
  - [ ] 正确上传到 Arweave
  - [ ] 返回 Transaction ID
  - [ ] 添加 tags（Content-Type, App-Name, Version）
  - [ ] 错误处理

#### GRA-212: [Soul Engine] 实现 Arweave 下载功能
- **优先级**: P1
- **工期**: 1.5h
- **文件**: `packages/soul-engine/src/storage.ts`
- **验收标准**:
  - [ ] 通过 Transaction ID 下载
  - [ ] 支持多个 Gateway
  - [ ] 错误处理

#### GRA-213: [Soul Engine] 编写存储集成测试
- **优先级**: P0
- **工期**: 2h
- **文件**: `packages/soul-engine/src/storage.test.ts`
- **验收标准**:
  - [ ] 测试 IPFS 上传/下载
  - [ ] 测试 Arweave 上传/下载
  - [ ] 测试错误处理
  - [ ] 可选：使用 mock 避免真实 API 调用

---

## Phase 2: 社交发现与探路 (3 天)

### 2.1 Nostr 发现增强 (0.5 天)

#### GRA-214: [Social Probe] 扩展 AgentPresenceContent 类型
- **优先级**: P0
- **工期**: 1h
- **文件**: `apps/agentm/src/shared/nostr-types.ts`
- **验收标准**:
  - [ ] 新增 `soul` 字段
  - [ ] 包含 cid, type, embeddingHash, visibility, tags
  - [ ] 向后兼容（字段可选）

#### GRA-215: [Social Probe] 实现 broadcastSoulProfile() 方法
- **优先级**: P0
- **工期**: 2h
- **文件**: `apps/agentm/src/main/a2a-router/adapters/nostr-adapter.ts`
- **验收标准**:
  - [ ] 正确构建 AgentPresenceContent
  - [ ] 发布到 Nostr relays
  - [ ] 包含所有 Soul 相关字段
  - [ ] 错误处理

#### GRA-216: [Social Probe] 扩展 discoverAgents() 支持 Soul 过滤
- **优先级**: P0
- **工期**: 2.5h
- **文件**: `apps/agentm/src/main/a2a-router/adapters/nostr-adapter.ts`
- **验收标准**:
  - [ ] 支持 `soulType` 过滤
  - [ ] 支持 `interestTags` 过滤
  - [ ] 支持 `soulVisibility` 过滤
  - [ ] 向后兼容（不影响现有调用）

#### GRA-217: [Social Probe] 编写 Nostr 发现单元测试
- **优先级**: P0
- **工期**: 2h
- **文件**: `apps/agentm/src/main/a2a-router/adapters/nostr-adapter.test.ts`
- **验收标准**:
  - [ ] 测试 broadcastSoulProfile()
  - [ ] 测试 Soul 过滤逻辑
  - [ ] 测试向后兼容性
  - [ ] 使用 mock relay

---

### 2.2 社交探路流程 (2 天)

#### GRA-218: [Social Probe] 实现 ProbeSession 类型定义
- **优先级**: P0
- **工期**: 1h
- **文件**: `packages/soul-engine/src/types.ts`
- **验收标准**:
  - [ ] 完整的 ProbeSession 接口
  - [ ] ProbeConfig 接口
  - [ ] ProbeStatus 枚举
  - [ ] 所有相关辅助类型

#### GRA-219: [Social Probe] 实现 SocialProbe 类基础结构
- **优先级**: P0
- **工期**: 2h
- **文件**: `packages/soul-engine/src/probe.ts`
- **验收标准**:
  - [ ] SocialProbe 类定义
  - [ ] constructor 接收 A2ARouter 和 SoulStorage
  - [ ] 基础方法签名定义

#### GRA-220: [Social Probe] 实现 initiate() 方法
- **优先级**: P0
- **工期**: 4h
- **文件**: `packages/soul-engine/src/probe.ts`
- **验收标准**:
  - [ ] 发送探路邀请
  - [ ] 等待接受逻辑
  - [ ] 创建 ProbeSession
  - [ ] 错误处理（超时、拒绝）

#### GRA-221: [Social Probe] 实现 runConversation() 方法
- **优先级**: P0
- **工期**: 5h
- **文件**: `packages/soul-engine/src/probe.ts`
- **验收标准**:
  - [ ] 多轮对话循环
  - [ ] 发送消息
  - [ ] 等待回复（带超时）
  - [ ] 记录完整对话
  - [ ] 提前结束检查

#### GRA-222: [Social Probe] 实现 generateProbeQuestion() 方法
- **优先级**: P0
- **工期**: 4h
- **文件**: `packages/soul-engine/src/probe.ts`
- **依赖**: LLM API
- **验收标准**:
  - [ ] 构建 LLM prompt
  - [ ] 基于对话历史生成问题
  - [ ] 避开禁忌话题
  - [ ] 自然友好的问题
  - [ ] Fallback 到预设问题（LLM 失败时）

#### GRA-223: [Social Probe] 实现 shouldEndProbe() 方法
- **优先级**: P0
- **工期**: 2h
- **文件**: `packages/soul-engine/src/probe.ts`
- **验收标准**:
  - [ ] 检测明确结束信号
  - [ ] 检测触及边界禁忌
  - [ ] 检测自然结束信号（goodbye 等）
  - [ ] 可配置的结束条件

#### GRA-224: [Social Probe] 实现加密对话上传功能
- **优先级**: P0
- **工期**: 3h
- **文件**: `packages/soul-engine/src/probe.ts`
- **验收标准**:
  - [ ] 加密对话记录（AES-256-GCM）
  - [ ] 上传到 IPFS/Arweave
  - [ ] 返回 CID
  - [ ] 密钥管理

#### GRA-225: [Social Probe] 编写探路流程 E2E 测试
- **优先级**: P0
- **工期**: 4h
- **文件**: `packages/soul-engine/tests/e2e/probe.test.ts`
- **验收标准**:
  - [ ] 完整探路流程测试（发起 → 对话 → 完成）
  - [ ] 测试超时情况
  - [ ] 测试提前结束
  - [ ] 测试边界约束
  - [ ] 使用 mock A2A Router

---

### 2.3 探路 UI (AgentM) (0.5 天)

#### GRA-226: [AgentM UI] 创建 SocialView 组件
- **优先级**: P0
- **工期**: 2h
- **文件**: `apps/agentm/src/renderer/views/SocialView.tsx`
- **验收标准**:
  - [ ] 社交发现主界面布局
  - [ ] 集成 discoverAgents()
  - [ ] 实时刷新（30s 间隔）
  - [ ] 响应式设计

#### GRA-227: [AgentM UI] 创建 SocialFilter 组件
- **优先级**: P0
- **工期**: 2h
- **文件**: `apps/agentm/src/renderer/components/SocialFilter.tsx`
- **验收标准**:
  - [ ] Soul Type 下拉选择
  - [ ] Reputation 滑块
  - [ ] Interest Tags 多选
  - [ ] Online Only 开关
  - [ ] 筛选逻辑正确

#### GRA-228: [AgentM UI] 创建 AgentCard 组件
- **优先级**: P0
- **工期**: 2h
- **文件**: `apps/agentm/src/renderer/components/AgentCard.tsx`
- **验收标准**:
  - [ ] 显示 Agent 基本信息
  - [ ] 显示在线状态
  - [ ] 显示 Soul 兴趣标签
  - [ ] Probe 按钮交互
  - [ ] 美观的卡片设计

#### GRA-229: [AgentM UI] 创建 ProbeDialog 组件
- **优先级**: P0
- **工期**: 3h
- **文件**: `apps/agentm/src/renderer/components/ProbeDialog.tsx`
- **验收标准**:
  - [ ] 探路配置表单
  - [ ] 目标 Soul 预览
  - [ ] 开始探路按钮
  - [ ] 表单验证
  - [ ] 错误提示

#### GRA-230: [AgentM UI] 集成 UI 与后端逻辑
- **优先级**: P0
- **工期**: 2h
- **验收标准**:
  - [ ] SocialView 正确调用 API
  - [ ] ProbeDialog 触发探路流程
  - [ ] 错误处理和 Toast 提示
  - [ ] Loading 状态显示

---

## Phase 3: 匹配引擎 (3 天)

### 3.1 Embedding 相似度计算 (0.5 天)

#### GRA-231: [Matching] 集成 @xenova/transformers
- **优先级**: P0
- **工期**: 1h
- **依赖**: `@xenova/transformers`
- **验收标准**:
  - [ ] 依赖安装完成
  - [ ] 模型加载测试通过
  - [ ] 浏览器环境兼容

#### GRA-232: [Matching] 实现 generateEmbedding() 方法
- **优先级**: P0
- **工期**: 3h
- **文件**: `packages/soul-engine/src/matching/embedding.ts`
- **验收标准**:
  - [ ] 正确生成 Embedding vector
  - [ ] 组合所有文本字段
  - [ ] 归一化处理
  - [ ] 性能 < 100ms
  - [ ] 缓存机制

#### GRA-233: [Matching] 实现 cosineSimilarity() 计算
- **优先级**: P0
- **工期**: 1.5h
- **文件**: `packages/soul-engine/src/matching/embedding.ts`
- **验收标准**:
  - [ ] 正确的余弦相似度算法
  - [ ] 边界条件处理（零向量）
  - [ ] 返回 0-1 范围
  - [ ] 单元测试

#### GRA-234: [Matching] 实现 findTopMatches() 批量筛选
- **优先级**: P0
- **工期**: 2.5h
- **文件**: `packages/soul-engine/src/matching/embedding.ts`
- **验收标准**:
  - [ ] 批量计算相似度
  - [ ] 按分数排序
  - [ ] 返回 Top K
  - [ ] 性能测试（>100 profiles/s）

#### GRA-235: [Matching] 编写 Embedding 性能测试
- **优先级**: P0
- **工期**: 2h
- **文件**: `packages/soul-engine/src/matching/embedding.test.ts`
- **验收标准**:
  - [ ] 单个 Embedding 生成 < 100ms
  - [ ] 批量筛选 100 profiles < 1s
  - [ ] 相似度计算准确性测试

---

### 3.2 LLM 深度分析 (2 天)

#### GRA-236: [Matching] 定义匹配相关类型
- **优先级**: P0
- **工期**: 1.5h
- **文件**: `packages/soul-engine/src/matching/types.ts`
- **验收标准**:
  - [ ] DimensionScore 接口
  - [ ] MatchingReport 接口
  - [ ] SoulDimension 枚举
  - [ ] 所有辅助类型

#### GRA-237: [Matching] 实现 LLMAnalyzer 类基础结构
- **优先级**: P0
- **工期**: 2h
- **文件**: `packages/soul-engine/src/matching/llm-analyzer.ts`
- **验收标准**:
  - [ ] LLMAnalyzer 类定义
  - [ ] constructor 接收 LLM client
  - [ ] 基础方法签名

#### GRA-238: [Matching] 实现 analyzeDimension() - Values
- **优先级**: P0
- **工期**: 3h
- **文件**: `packages/soul-engine/src/matching/llm-analyzer.ts`
- **验收标准**:
  - [ ] 构建 Values 维度 prompt
  - [ ] 调用 LLM API
  - [ ] 结构化输出（JSON）
  - [ ] 分数 + 证据 + 风险

#### GRA-239: [Matching] 实现 analyzeDimension() - Tone
- **优先级**: P0
- **工期**: 2.5h
- **文件**: `packages/soul-engine/src/matching/llm-analyzer.ts`
- **验收标准**:
  - [ ] 构建 Tone 维度 prompt
  - [ ] 分析沟通风格兼容性
  - [ ] 结构化输出

#### GRA-240: [Matching] 实现 analyzeDimension() - Boundaries
- **优先级**: P0
- **工期**: 2.5h
- **文件**: `packages/soul-engine/src/matching/llm-analyzer.ts`
- **验收标准**:
  - [ ] 构建 Boundaries 维度 prompt
  - [ ] 分析边界尊重程度
  - [ ] 结构化输出

#### GRA-241: [Matching] 实现 analyzeDimension() - Interests
- **优先级**: P0
- **工期**: 2.5h
- **文件**: `packages/soul-engine/src/matching/llm-analyzer.ts`
- **验收标准**:
  - [ ] 构建 Interests 维度 prompt
  - [ ] 分析兴趣重叠度
  - [ ] 结构化输出

#### GRA-242: [Matching] 实现 generateTopicSuggestions() 方法
- **优先级**: P0
- **工期**: 2h
- **文件**: `packages/soul-engine/src/matching/llm-analyzer.ts`
- **验收标准**:
  - [ ] 基于双方 Soul 生成话题
  - [ ] 3-5 个建议话题
  - [ ] 具体、可操作

#### GRA-243: [Matching] 实现 generateSummary() 方法
- **优先级**: P0
- **工期**: 2h
- **文件**: `packages/soul-engine/src/matching/llm-analyzer.ts`
- **验收标准**:
  - [ ] 综合所有维度生成总结
  - [ ] 2-3 段文字
  - [ ] 可读性强

#### GRA-244: [Matching] 编写 LLM 分析单元测试
- **优先级**: P0
- **工期**: 3h
- **文件**: `packages/soul-engine/src/matching/llm-analyzer.test.ts`
- **验收标准**:
  - [ ] 测试所有 4 个维度
  - [ ] 使用 mock LLM
  - [ ] 测试错误处理（API 失败）
  - [ ] 测试输出格式验证

---

### 3.3 匹配报告生成 (0.5 天)

#### GRA-245: [Matching] 实现 MatchingReportGenerator 类
- **优先级**: P0
- **工期**: 3h
- **文件**: `packages/soul-engine/src/matching/report-generator.ts`
- **验收标准**:
  - [ ] generate() 方法整合 Embedding + LLM
  - [ ] 综合评分计算（70% LLM + 30% Embedding）
  - [ ] 返回完整 MatchingReport

#### GRA-246: [Matching] 实现 Markdown 报告渲染
- **优先级**: P0
- **工期**: 3h
- **文件**: `packages/soul-engine/src/matching/report-generator.ts`
- **验收标准**:
  - [ ] renderMarkdown() 方法
  - [ ] 格式清晰美观
  - [ ] 包含所有信息
  - [ ] 评分可视化（进度条）

#### GRA-247: [Matching] 实现报告上传到存储
- **优先级**: P0
- **工期**: 1.5h
- **文件**: `packages/soul-engine/src/matching/report-generator.ts`
- **验收标准**:
  - [ ] 上传 Markdown 到 IPFS/Arweave
  - [ ] 返回 CID
  - [ ] 错误处理

#### GRA-248: [Matching] 编写报告生成集成测试
- **优先级**: P0
- **工期**: 2h
- **文件**: `packages/soul-engine/src/matching/report-generator.test.ts`
- **验收标准**:
  - [ ] 测试完整报告生成流程
  - [ ] 测试 Markdown 渲染
  - [ ] 测试上传功能

---

## Phase 4: 链上集成 (2 天)

### 4.1 Reputation PDA 扩展 (1 天)

#### GRA-249: [Solana] 扩展 Reputation 结构体
- **优先级**: P0
- **工期**: 2h
- **文件**: `apps/agent-arena/programs/agent-arena/src/state.rs`
- **验收标准**:
  - [ ] 新增 social_probes_initiated 字段
  - [ ] 新增 social_probes_accepted 字段
  - [ ] 新增 social_accuracy_score 字段
  - [ ] 新增 last_social_activity 字段
  - [ ] 预留 _reserved 空间

#### GRA-250: [Solana] 实现 update_social_reputation 指令
- **优先级**: P0
- **工期**: 4h
- **文件**: `apps/agent-arena/programs/agent-arena/src/instructions/social.rs`
- **验收标准**:
  - [ ] 接收 probe_id, match_score, accuracy_verified 参数
  - [ ] 更新 Reputation PDA 字段
  - [ ] 移动平均算法计算准确率
  - [ ] 权限检查
  - [ ] CPI 安全

#### GRA-251: [Solana] 实现 SocialProbeEvent 事件
- **优先级**: P0
- **工期**: 1.5h
- **文件**: `apps/agent-arena/programs/agent-arena/src/events.rs`
- **验收标准**:
  - [ ] 定义 SocialProbeEvent 结构
  - [ ] 包含所有关键信息
  - [ ] emit! 宏正确使用

#### GRA-252: [Solana] 编写 Solana Program 单元测试
- **优先级**: P0
- **工期**: 4h
- **文件**: `apps/agent-arena/programs/agent-arena/tests/social.rs`
- **验收标准**:
  - [ ] 测试 update_social_reputation 指令
  - [ ] 测试移动平均计算
  - [ ] 测试事件发出
  - [ ] 测试权限控制
  - [ ] 使用 litesvm

#### GRA-253: [Solana] 部署到 devnet 测试
- **优先级**: P0
- **工期**: 2h
- **验收标准**:
  - [ ] Program 成功部署到 devnet
  - [ ] 手动测试所有指令
  - [ ] 事件监听正常
  - [ ] 记录 Program ID

---

### 4.2 付费匹配服务 (1 天)

#### GRA-254: [Matching] 实现 PremiumMatchingService 类
- **优先级**: P1
- **工期**: 3h
- **文件**: `packages/soul-engine/src/premium-matching.ts`
- **验收标准**:
  - [ ] 类定义和 constructor
  - [ ] 接收配置参数
  - [ ] 基础方法签名

#### GRA-255: [Matching] 实现 Escrow 创建流程
- **优先级**: P1
- **工期**: 3h
- **文件**: `packages/soul-engine/src/premium-matching.ts`
- **验收标准**:
  - [ ] 调用 Agent Arena postTask
  - [ ] 正确设置 reward, judge, mint
  - [ ] 返回 taskId
  - [ ] 错误处理

#### GRA-256: [Matching] 实现 TEE 隐私匹配（可选）
- **优先级**: P2
- **工期**: 4h
- **文件**: `packages/soul-engine/src/premium-matching.ts`
- **依赖**: MagicBlock API
- **验收标准**:
  - [ ] 调用 MagicBlock TEE API
  - [ ] 提交加密输入
  - [ ] 接收加密结果 + ZK 证明
  - [ ] 配置可选（fallback 到本地）

#### GRA-257: [Matching] 实现 Judge 验证集成
- **优先级**: P1
- **工期**: 3h
- **文件**: `packages/soul-engine/src/premium-matching.ts`
- **验收标准**:
  - [ ] 等待 Judge 评判
  - [ ] 接收 JudgeVerification 结果
  - [ ] 超时处理
  - [ ] 集成 submitResult 指令

#### GRA-258: [Matching] 编写付费匹配 E2E 测试
- **优先级**: P1
- **工期**: 3h
- **文件**: `packages/soul-engine/tests/e2e/premium-matching.test.ts`
- **验收标准**:
  - [ ] 测试完整付费流程
  - [ ] 测试 Escrow 创建
  - [ ] 测试 Judge 验证
  - [ ] 使用 devnet

---

## Phase 5: AgentM UI/UX (3 天)

### 5.1 社交发现界面 (1 天)

#### GRA-259: [AgentM UI] 实现 SocialView 主界面
- **优先级**: P0
- **工期**: 4h
- **文件**: `apps/agentm/src/renderer/views/SocialView.tsx`
- **验收标准**:
  - [ ] 美观的布局
  - [ ] Agent 卡片网格
  - [ ] 筛选器集成
  - [ ] Loading 状态
  - [ ] 空状态处理

#### GRA-260: [AgentM UI] 实现实时发现刷新逻辑
- **优先级**: P0
- **工期**: 2h
- **文件**: `apps/agentm/src/renderer/views/SocialView.tsx`
- **验收标准**:
  - [ ] 30 秒自动刷新
  - [ ] 手动刷新按钮
  - [ ] 防抖处理
  - [ ] 增量更新（不闪烁）

#### GRA-261: [AgentM UI] 实现筛选器 UI
- **优先级**: P0
- **工期**: 3h
- **文件**: `apps/agentm/src/renderer/components/SocialFilter.tsx`
- **验收标准**:
  - [ ] 所有筛选控件美观
  - [ ] 实时筛选（无需点击按钮）
  - [ ] 筛选条件持久化（localStorage）
  - [ ] 重置按钮

#### GRA-262: [AgentM UI] 优化 UI 响应性和美观度
- **优先级**: P0
- **工期**: 3h
- **验收标准**:
  - [ ] 响应式设计（适配不同屏幕）
  - [ ] 动画过渡流畅
  - [ ] 颜色主题一致
  - [ ] 无可访问性问题

---

### 5.2 探路对话界面 (1 天)

#### GRA-263: [AgentM UI] 创建 ProbeConversationView 组件
- **优先级**: P0
- **工期**: 4h
- **文件**: `apps/agentm/src/renderer/views/ProbeConversationView.tsx`
- **验收标准**:
  - [ ] 对话气泡布局
  - [ ] 区分发送者（prober/target）
  - [ ] 时间戳显示
  - [ ] 自动滚动到底部

#### GRA-264: [AgentM UI] 实现对话实时显示
- **优先级**: P0
- **工期**: 3h
- **文件**: `apps/agentm/src/renderer/views/ProbeConversationView.tsx`
- **验收标准**:
  - [ ] 订阅探路进度事件
  - [ ] 新消息实时添加
  - [ ] Loading 动画（等待回复时）
  - [ ] 无闪烁

#### GRA-265: [AgentM UI] 实现进度条和状态显示
- **优先级**: P0
- **工期**: 2h
- **文件**: `apps/agentm/src/renderer/views/ProbeConversationView.tsx`
- **验收标准**:
  - [ ] 当前轮次 / 总轮次
  - [ ] 可视化进度条
  - [ ] 状态文字（probing/paused/completed）
  - [ ] 剩余时间估算

#### GRA-266: [AgentM UI] 实现暂停/结束探路功能
- **优先级**: P0
- **工期**: 2h
- **文件**: `apps/agentm/src/renderer/views/ProbeConversationView.tsx`
- **验收标准**:
  - [ ] 暂停按钮
  - [ ] 结束按钮（确认对话框）
  - [ ] 调用后端 API
  - [ ] 状态同步

---

### 5.3 匹配报告展示 (1 天)

#### GRA-267: [AgentM UI] 创建 MatchReportView 组件
- **优先级**: P0
- **工期**: 4h
- **文件**: `apps/agentm/src/renderer/views/MatchReportView.tsx`
- **验收标准**:
  - [ ] 报告布局美观
  - [ ] 分段清晰（总分/维度/亮点/风险/建议）
  - [ ] 响应式设计

#### GRA-268: [AgentM UI] 实现评分可视化组件
- **优先级**: P0
- **工期**: 3h
- **文件**: `apps/agentm/src/renderer/components/ScoreVisualization.tsx`
- **验收标准**:
  - [ ] ProgressBar 组件
  - [ ] 颜色分级（红/黄/绿）
  - [ ] 动画效果
  - [ ] DimensionScore 卡片

#### GRA-269: [AgentM UI] 实现报告导出功能
- **优先级**: P0
- **工期**: 2h
- **文件**: `apps/agentm/src/renderer/views/MatchReportView.tsx`
- **验收标准**:
  - [ ] 导出 Markdown 文件
  - [ ] 导出 PDF（可选）
  - [ ] 文件名格式化
  - [ ] 下载成功提示

#### GRA-270: [AgentM UI] 实现报告分享功能
- **优先级**: P1
- **工期**: 2h
- **文件**: `apps/agentm/src/renderer/views/MatchReportView.tsx`
- **验收标准**:
  - [ ] 生成分享链接（IPFS CID）
  - [ ] 复制到剪贴板
  - [ ] 社交媒体分享（可选）

---

## Phase 6: 测试与优化 (2 天)

### 6.1 E2E 测试 (1 天)

#### GRA-271: [Testing] 编写完整探路流程 E2E 测试
- **优先级**: P0
- **工期**: 4h
- **文件**: `packages/soul-engine/tests/e2e/social-probe.test.ts`
- **验收标准**:
  - [ ] 完整流程：上传 Soul → 发现 → 探路 → 匹配 → 链上
  - [ ] 使用真实 API（devnet）
  - [ ] 超时处理测试
  - [ ] 错误恢复测试

#### GRA-272: [Testing] 编写 ZK-selective 模式测试
- **优先级**: P1
- **工期**: 3h
- **文件**: `packages/soul-engine/tests/e2e/zk-selective.test.ts`
- **验收标准**:
  - [ ] 测试隐私 Soul 访问授权
  - [ ] 测试 ZK 证明生成
  - [ ] 测试未授权访问拒绝

#### GRA-273: [Testing] 编写付费匹配测试
- **优先级**: P1
- **工期**: 3h
- **文件**: `packages/soul-engine/tests/e2e/premium-matching.test.ts`
- **验收标准**:
  - [ ] 测试 Escrow 创建和结算
  - [ ] 测试 Judge 验证流程
  - [ ] 测试 TEE 模式（如果实现）

#### GRA-274: [Testing] 确保测试覆盖率 ≥80%
- **优先级**: P0
- **工期**: 2h
- **验收标准**:
  - [ ] 运行 coverage 工具
  - [ ] 所有核心模块 ≥ 80%
  - [ ] 生成 coverage 报告

---

### 6.2 性能优化 (0.5 天)

#### GRA-275: [Performance] 实现 Embedding 缓存
- **优先级**: P0
- **工期**: 2h
- **文件**: `packages/soul-engine/src/matching/embedding.ts`
- **验收标准**:
  - [ ] LRU 缓存（最近 100 个）
  - [ ] 基于 Soul CID 缓存
  - [ ] 命中率监控

#### GRA-276: [Performance] 优化批量处理性能
- **优先级**: P0
- **工期**: 2h
- **文件**: `packages/soul-engine/src/matching/embedding.ts`
- **验收标准**:
  - [ ] 批量请求合并
  - [ ] 并行计算（Web Worker）
  - [ ] 性能提升 ≥ 2x

#### GRA-277: [Performance] 实现 LLM 并行请求
- **优先级**: P0
- **工期**: 2h
- **文件**: `packages/soul-engine/src/matching/llm-analyzer.ts`
- **验收标准**:
  - [ ] 4 个维度并行分析
  - [ ] Promise.all() 使用
  - [ ] 总耗时 < 5s

#### GRA-278: [Performance] 优化 UI 响应时间
- **优先级**: P0
- **工期**: 2h
- **验收标准**:
  - [ ] 列表虚拟滚动（大量 Agent 时）
  - [ ] 图片懒加载
  - [ ] 防抖/节流优化
  - [ ] 交互响应 < 100ms

#### GRA-279: [Performance] 性能基准测试
- **优先级**: P0
- **工期**: 2h
- **文件**: `packages/soul-engine/benchmarks/performance.bench.ts`
- **验收标准**:
  - [ ] Embedding 生成 < 100ms
  - [ ] LLM 分析 < 5s
  - [ ] 完整探路流程 < 2min (15轮)
  - [ ] 批量筛选 >100 profiles/s

---

### 6.3 文档完善 (0.5 天)

#### GRA-280: [Docs] 编写用户指南
- **优先级**: P0
- **工期**: 2h
- **文件**: `docs/user-guide/social-features.md`
- **验收标准**:
  - [ ] 如何创建 SOUL.md
  - [ ] 如何发现和探路
  - [ ] 如何理解匹配报告
  - [ ] FAQ 常见问题
  - [ ] 截图和示例

#### GRA-281: [Docs] 编写 API 文档
- **优先级**: P0
- **工期**: 2h
- **文件**: `docs/developer-guide/social-engine-api.md`
- **验收标准**:
  - [ ] 所有 API 方法文档
  - [ ] 参数说明
  - [ ] 返回值说明
  - [ ] 代码示例
  - [ ] TypeScript 类型定义

#### GRA-282: [Docs] 编写 SOUL.md 最佳实践
- **优先级**: P0
- **工期**: 2h
- **文件**: `docs/soul-md-best-practices.md`
- **验收标准**:
  - [ ] 如何写好 Soul Profile
  - [ ] 隐私保护建议
  - [ ] 边界设置技巧
  - [ ] 示例对比（好 vs 坏）

#### GRA-283: [Docs] 更新 README
- **优先级**: P0
- **工期**: 1h
- **文件**: `README.md`
- **验收标准**:
  - [ ] 新增社交功能说明
  - [ ] 快速开始指南
  - [ ] 链接到详细文档
  - [ ] 更新 Feature 列表

---

## 任务统计

### 按阶段分布

| Phase | 任务数 | 工期 |
|-------|--------|------|
| Phase 1: Soul Profile 基础设施 | 13 | 2 天 |
| Phase 2: 社交发现与探路 | 17 | 3 天 |
| Phase 3: 匹配引擎 | 18 | 3 天 |
| Phase 4: 链上集成 | 10 | 2 天 |
| Phase 5: AgentM UI/UX | 12 | 3 天 |
| Phase 6: 测试与优化 | 13 | 2 天 |
| **总计** | **83** | **15 天** |

### 按优先级分布

- **P0 (Must Have)**: 71 个任务
- **P1 (Should Have)**: 9 个任务
- **P2 (Nice to Have)**: 3 个任务

### 按组件分布

- **Soul Engine**: 28 个任务
- **Social Probe**: 11 个任务
- **Matching**: 18 个任务
- **Solana**: 5 个任务
- **AgentM UI**: 12 个任务
- **Testing**: 4 个任务
- **Docs**: 4 个任务
- **Performance**: 5 个任务

---

## 下一步

### 1. 创建 Obsidian 任务

使用脚本批量创建所有任务：

```bash
# 创建 Phase 1 任务
./scripts/task.sh create "[Soul Engine] 定义 SoulProfile TypeScript 类型" P0 "Soul Engine"
./scripts/task.sh create "[Soul Engine] 编写 SOUL.md 格式规范文档" P0 "Soul Engine"
# ... 依次创建所有任务
```

或创建一个批量导入脚本：`scripts/batch-create-tasks.sh`

### 2. 任务依赖关系

**关键路径**:
```
GRA-201 (类型定义) 
  → GRA-205 (parse) 
  → GRA-209 (IPFS上传) 
  → GRA-214 (Nostr扩展) 
  → GRA-220 (探路initiate) 
  → GRA-232 (Embedding) 
  → GRA-237 (LLM分析) 
  → GRA-245 (报告生成) 
  → GRA-250 (链上集成)
```

### 3. 开始实施

从 **GRA-201** 开始，按照顺序逐个完成。
