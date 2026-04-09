# Agent.im 功能设计草案：探索、Memory 与商业

> **文档类型**: 功能设计草案  
> **日期**: 2026-04-03  
> **相关文档**: [Agent Native 平台愿景](./agent-native-platform-vision.md)

---

## 1. "探索"页面设计（抖音化界面）

### 1.1 核心交互

```typescript
// Explore Feed 数据结构
interface ExploreFeed {
    recommendations: ContentCard[];
    currentMode: 'privacy' | 'precise' | 'random';
    userIntent: 'passive' | 'active' | 'learning';
}

interface ContentCard {
    id: string;
    format: 'short_video' | 'article' | 'code_demo' | 'podcast' | 'interactive';
    content: MediaContent;

    // 推荐解释（透明度）
    whyRecommended: {
        reason: string; // "因为你关注过 DeFi"
        confidence: number; // 0-1
        factors: string[]; // ["文件分析", "对话历史", "相似用户"]
    };

    // 交互
    actions: {
        onLike: () => void; // 正反馈，训练模型
        onSkip: () => void; // 负反馈
        onSave: () => void; // 添加到知识库
        onShare: () => void; // 社交分享
        onDiscuss: () => void; // 与 Agent 讨论此内容
    };
}
```

### 1.2 UI 草图

```
┌─────────────────────────────────────┐
│  🔒 隐私模式    ≡    🔍            │  ← 顶部：模式切换 + 搜索
├─────────────────────────────────────┤
│                                     │
│     ┌─────────────────────────┐     │
│     │                         │     │
│     │      视频/内容          │     │  ← 主内容区（全屏卡片）
│     │                         │     │
│     │   [播放/暂停  控件]      │     │
│     └─────────────────────────┘     │
│                                     │
│  "因为你最近在学 Rust"               │  ← 推荐原因
│                                     │
│  ❤️  🤔  💾  ↗️                      │  ← 底部操作栏
│  喜欢 讨论 保存 分享                 │
│                                     │
└─────────────────────────────────────┘
```

### 1.3 模式切换交互

```tsx
<ModeSwitcher>
    <ModeOption icon="🔒" label="隐私模式" description="不读取文件，仅执行任务" warning="推荐内容可能不够精准" />
    <ModeOption icon="🎯" label="精准模式" description="基于你的文件和对话推荐" highlight="当前最懂你" />
    <ModeOption icon="🎲" label="随机模式" description="意外发现新内容" tag="10% 随机注入" />
</ModeSwitcher>
```

---

## 2. Memory 备份服务设计

### 2.1 用户旅程

```
第1步：首次提醒
"你的 Agent 已经陪伴你 30 天了，有 150 条对话记忆。
 建议开启自动备份，防止数据丢失。"

第2步：选择方案
[免费] 本地备份 - 你自己负责
[￥39/月] 云端备份 - 自动同步，3个设备
[￥99/月] 高级版 - 版本历史，团队协作

第3步：加密设置
"你的 Memory 将用以下方式加密："
- 密码加密（简单）
- 硬件密钥（安全）
- 社交恢复（去中心化）

第4步：完成
"备份已开启。你的 Memory 属于你，随时可以导出。"
```

### 2.2 技术实现

```typescript
// 备份配置
interface BackupConfig {
    // 频率
    frequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'manual';

    // 加密
    encryption: {
        type: 'password' | 'hardware_key' | 'social_recovery';
        keyDerivation: 'argon2' | 'pbkdf2';
        algorithm: 'aes-256-gcm';
    };

    // 存储
    storage: {
        local: boolean; // 本地副本
        cloud: {
            provider: 'gradience' | 'ipfs' | 'user_s3';
            region: string;
        };
        decentralized: boolean; // Arweave 永久存储
    };

    // 保留策略
    retention: {
        versions: number; // 保留版本数
        autoCleanup: boolean; // 自动清理旧版本
    };
}

// 迁移流程
interface MigrationFlow {
    export: {
        format: 'standard_json' | 'encrypted_blob' | 'mnemonic';
        include: ['conversations', 'preferences', 'knowledge_graph'];
        compression: 'zstd' | 'gzip';
    };

    import: {
        validation: boolean; // 验证完整性
        conflictResolution: 'newest' | 'merge' | 'manual';
        progressCallback: (pct: number) => void;
    };
}
```

### 2.3 商业模式

| 功能       | 免费版 | 专业版 ￥39/月 | 团队版 ￥99/月 |
| ---------- | ------ | -------------- | -------------- |
| 本地备份   | ✅     | ✅             | ✅             |
| 云备份     | ❌     | ✅ 100GB       | ✅ 1TB         |
| 设备数     | 1      | 3              | 无限           |
| 版本历史   | ❌     | 30天           | 无限           |
| 跨平台同步 | ❌     | ✅             | ✅             |
| 团队协作   | ❌     | ❌             | ✅             |
| API 访问   | ❌     | ❌             | ✅             |
| 优先支持   | ❌     | ✅             | ✅             |

---

## 3. 图书平台设计

### 3.1 核心理念

**传统电子书 vs Agent 原生图书:**

| 维度     | 传统     | Agent 原生             |
| -------- | -------- | ---------------------- |
| 阅读方式 | 线性阅读 | 非线性（跳转相关概念） |
| 互动     | 批注     | 实时讨论、Agent 答疑   |
| 创造     | 被动消费 | 你的笔记成为"分支版本" |
| 社交     | 书评     | 共读、思想碰撞         |

### 3.2 产品形态

```typescript
interface AgentBook {
    // 基础信息
    metadata: {
        title: string;
        author: string;
        authorAgent: AgentConfig; // 作者 Agent 配置
    };

    // 内容结构
    content: {
        chapters: Chapter[];
        knowledgeGraph: Graph; // 概念关联图
        difficultyCurve: number[]; // 难度曲线
    };

    // Agent 陪伴
    companion: {
        readingStyle: 'socratic' | 'guide' | 'silent'; // 苏格拉底式/引导式/静默
        discussionDepth: 'surface' | 'deep' | 'expert';
        quizFrequency: 'never' | 'chapter_end' | 'adaptive';
    };

    // 社交功能
    social: {
        readingGroups: Group[]; // 共读小组
        annotations: Annotation[]; // 公开批注
        forks: BookFork[]; // 分支版本
    };
}

// 阅读会话
interface ReadingSession {
    bookId: string;
    currentPosition: Location;

    // Agent 对话
    discussions: {
        userQuestion: string;
        agentResponse: string;
        context: string[]; // 引用的书内容
        timestamp: Date;
    }[];

    // 笔记
    notes: {
        location: Location;
        content: string;
        tags: string[];
        isPublic: boolean;
    }[];

    // 进度
    progress: {
        percentComplete: number;
        estimatedTimeRemaining: number;
        comprehensionScore: number; // Agent 评估的理解度
    };
}
```

### 3.3 商业模式

```
免费层：
- 基础阅读功能
- Agent 基础问答（5次/天）
- 标准批注

付费层（单书购买或订阅）：
- 解锁作者 Agent 深度对话
- 高级知识图谱
- 共读小组
- 分支版本创建

创作者收益：
- 图书销售分成 70%
- Agent 对话付费分成 50%
- 衍生内容（课程、工作坊）自主定价
```

---

## 4. 购物体验设计

### 4.1 Agent 原生购物逻辑

**传统电商 vs Agent 原生购物:**

| 维度 | 传统      | Agent 原生           |
| ---- | --------- | -------------------- |
| 触发 | 浏览/广告 | Agent 识别真实需求   |
| 决策 | 人比较    | Agent 比价、等折扣   |
| 验证 | 看评价    | Agent 验证评价真实性 |
| 时机 | 冲动消费  | 理性消费（基于需求） |

### 4.2 需求发现示例

```typescript
// Agent 被动发现需求
interface ShoppingTrigger {
    type: 'wear' | 'upgrade' | 'project' | 'health' | 'seasonal';

    // 触发示例
    examples: {
        wear: '你的耳机用了 2 年，电池衰减到 60%，建议升级';
        upgrade: '你最近在学 Rust，这本书评分很高，适合你当前水平';
        project: '你要开始视频制作项目，需要麦克风，我筛选了几款';
        health: '你久坐时间长，这个站立办公桌在促销';
        seasonal: '冬天到了，你所在的地区需要保暖设备';
    };

    // 决策支持
    decision: {
        priceTracking: boolean; // 价格追踪
        reviewAnalysis: boolean; // 评价分析（识别虚假评价）
        alternativeComparison: boolean; // 替代品比较
        purchaseTiming: 'now' | 'wait_discount' | 'wait_new_version';
    };
}
```

### 4.3 购物流程

```
用户: "帮我看看耳机"

Agent:
"我发现你现在的耳机用了 2 年 3 个月，根据你的使用频率，
 电池可能衰减到 60% 左右。

 分析你的需求：
 - 你主要在通勤和健身时使用
 - 你需要降噪功能（经常在地铁上）
 - 你的预算区间是 500-1000 元

 我对比了 12 款产品，推荐 3 个：
 1. Sony WF-1000XM5 - 降噪最好，￥899
 2. AirPods Pro 2 - 生态匹配，￥999
 3. 小米 Buds 4 Pro - 性价比，￥599

 [查看对比] [等折扣提醒] [现在就买]"
```

### 4.4 商业模式

```
收费模式选择：

方案 A: 交易费（透明）
- 成功购买后收取 3-5% 服务费
- 用户知道我们在赚钱
- 利益一致：帮你买到合适的

方案 B: 会员订阅
- ￥29/月 解锁 Agent 购物助手
- 无限次需求分析、比价、等折扣
- 无交易抽成

方案 C: 混合
- 基础功能免费（偶尔推荐）
- 高级功能订阅（频繁购物者）
- 大额交易可选人工顾问

推荐：方案 B（会员制）
- 避免利益冲突（不因推荐高佣金商品而赚钱）
- 用户为服务付费，不是为商品加价
- 长期更可持续
```

---

## 5. 隐私与伦理边界

### 5.1 红线清单

```
❌ 绝对不做：
- 上传文件内容到云端分析（除非用户明确同意）
- 将用户画像用于第三方广告
- 未经同意"读心"并说出来
- 推荐具有操控性的内容（诱导消费、极端观点）
- 出售用户数据给第三方

✅ 承诺做到：
- 本地分析，本地存储（默认）
- 用户完全控制开关
- 透明的"为什么推荐"
- 帮助用户发现（而非定义用户）
- 用户可随时导出/删除所有数据
```

### 5.2 渐进式信任建立

```
第1周：不分析任何文件，仅任务执行
    ↓ 用户主动询问"你能帮我整理文件吗？"
第2-4周：分析文件结构，不提内容
    ↓ 用户感受到便利
第2-3月：基于文件名和元数据推荐
    ↓ 用户觉得"还挺准"
第3-6月：深度学习内容，精准推荐
    ↓ 用户产生依赖和情感
第6月+：主动发现，成为数字伴侣
```

### 5.3 透明度设计

```tsx
// "我的画像"页面
<MyProfile>
    <PersonalityRadar data={personalityProfile} />
    <InterestGraph data={interestGraph} />
    <RecentInsights
        insights={recentDiscoveries}
        // "根据你最近的代码，你对 Rust 的兴趣在上升"
    />
    <DataControl>
        <Button onClick={downloadMyData}>下载我的数据</Button>
        <Button onClick={deleteAnalysis}>删除分析</Button>
        <Button onClick={exportProfile}>导出画像</Button>
        <Button onClick={pauseAnalysis}>暂停分析 7 天</Button>
    </DataControl>
</MyProfile>
```

---

## 6. 技术架构概览

```
用户设备（本地优先）
├── OpenCloud 空间
│   ├── 原始文件（笔记/代码/图片）
│   └── 本地向量索引（加密）
│
├── 分析引擎（本地运行）
│   ├── 文件解析（PDF/MD/Code/图片 OCR）
│   ├── 向量化（轻量模型）
│   ├── 知识图谱构建
│   └── 性格画像更新
│
├── 推荐引擎（本地 + 边缘）
│   ├── 本地候选生成
│   ├── 边缘排序优化（不暴露内容）
│   └── 实时反馈学习
│
└── 界面层
    ├── Agent.im IM
    ├── Explore Feed
    └── Task Center

边缘节点（公开内容索引）
├── 候选内容池（视频/文章/播客/商品）
└── 匹配用户向量（不暴露用户内容）

区块链层（可选）
├── 信誉证明（Reputation PDA）
├── 交易结算（购物）
└── Memory 所有权证明
```

---

## 7. 待决策事项

- [ ] 推荐系统的差分隐私具体方案
- [ ] Memory 备份的加密算法选择
- [ ] 图书平台的内容审核机制
- [ ] 购物功能的供应商合作模式
- [ ] 免费/付费功能的具体边界
- [ ] 跨设备同步的实时性要求

---

_文档状态: 草案 v0.1 | 最后更新: 2026-04-03_
