# dev-lifecycle + Linear 搭配使用指南

> **文档类型**: 项目管理方法论  
> **日期**: 2026-04-03  
> **核心**: dev-lifecycle (流程规范) + Linear (执行跟踪) = 完美互补  
> **适用场景**: AI 辅助编码时代的项目管理

---

## 执行摘要

**核心洞察**: dev-lifecycle 解决"AI 写代码容易乱"的问题，Linear 解决"人如何高效执行和跟踪"的问题。

**搭配效果**: 1 + 1 > 2
- dev-lifecycle = **灵魂** (流程 rigor + 文档规范)
- Linear = **身体** (可视化跟踪 + 团队协作)

---

## 1. dev-lifecycle 核心特点

### 1.1 方法论定位

```
dev-lifecycle 档案:
├── 目标: AI 辅助编码时代的严格流程方法论
├── 核心原则: "Specification before Implementation"
├── 关键目标: 消灭 AI 幻觉导致的重工
└── 设计哲学: "Boil the Lake" (能做完的就全部做完)
```

### 1.2 核心原则

| 原则 | 说明 |
|------|------|
| **Search Before Building** | 三层知识检索 |
| **Processize before Productize** | 先定义流程再做产品 |
| **强制 TDD** | 测试驱动开发 |
| **≤4 小时任务拆分** | 防止任务过大 |
| **Coordinator 模式** | 并行执行任务 |

### 1.3 7 个阶段

```
Phase 0: Business Validation (可选)
    ↓
Phase 1: PRD (Product Requirements)
    ↓
Phase 2: Architecture (System Design)
    ↓
Phase 3: Technical Spec (单源真相)
    ↓
Phase 4: Task Breakdown (≤4h 任务)
    ↓
Phase 5: Test Spec (测试先行)
    ↓
Phase 6: Implementation (编码实现)
    ↓
Phase 7: Review & Deploy (审查部署)
```

### 1.4 文档模板

```
docs/methodology/
├── 00-business-validation.md
├── 01-prd.md
├── 02-architecture.md
├── 03-tech-spec.md
├── 04-task-breakdown.md
├── 05-test-spec.md
├── 06-implementation.md
├── 07-review.md
└── APPENDIX-knowledge-management.md
```

---

## 2. Linear 核心特点

### 2.1 产品定位

```
Linear 档案:
├── 目标: 现代产品开发团队的项目管理工具
├── 核心: Issues + Projects + Cycles + Initiatives
├── 特点: 界面极快、Git 深度集成、AI 功能
└── 适用: 从小团队到企业级
```

### 2.2 核心功能

| 功能 | 说明 |
|------|------|
| **Issues** | 任务跟踪的核心单元 |
| **Projects** | 项目/特性级别的组织 |
| **Cycles** | Sprint 时间盒管理 |
| **Initiatives** | 战略级目标 |
| **Roadmaps** | 可视化规划 |
| **Templates** | 快速创建标准化 Issue |
| **Custom Fields** | 自定义字段扩展 |
| **Approvals** | 内置审批流程 |
| **Git 集成** | 自动关联 PR/Branch |

---

## 3. 为什么搭配后"更好"

### 3.1 效果对比表

| 方面 | 单独用 dev-lifecycle | + Linear 后提升 |
|------|---------------------|----------------|
| **阶段把控** | 纯 Markdown，手动检查 | Workflow 强制顺序 (Phase 1 Approved → 才能开 Phase 2) |
| **任务执行** | Phase 4 任务手动管理 | 子 Issue + 估时 + Cycles 时间盒，Coordinator 模式支持 |
| **模板使用** | 手动复制 docs/ 里的 .md | Issue Template 一键创建每个阶段模板 |
| **Review & 审批** | Phase 7 多专家 adversarial review | 内置 Approvals + Review 字段 + @ 通知 |
| **可视化 & 进度** | 只能看文件夹 | Projects / Roadmaps / Dashboard / Analytics |
| **AI Agent 协作** | Agent 读 repo 里的 docs/ | 文档链接 attach 到 Issue，Agent 通过 API 读取 |
| **知识沉淀** | APPENDIX-knowledge-management.md | Comments + 搜索 + 链接外部 docs，双保险 |
| **团队规模** | 适合 solo / 小团队 | 轻松扩展到 10 人以上团队 |

### 3.2 互补关系图

```
dev-lifecycle (灵魂)
├── 提供: 流程 rigor
├── 提供: 文档规范
├── 提供: 严格顺序
└── 缺失: 可视化跟踪、任务分配、团队协作

         ↓ 完美互补 ↓

Linear (身体)
├── 提供: 可视化看板
├── 提供: 任务分配
├── 提供: 进度仪表盘
└── 缺失: 流程 rigor、文档规范

= 1 + 1 > 2
```

### 3.3 一句话总结

> **"dev-lifecycle 给你'灵魂'，Linear 给你'身体'，两者结合后，你会得到一个在 AI 时代真正高效、可扩展、几乎零重工的开发流程。"**

---

## 4. 具体搭配使用方法

### 4.1 仓库层面（保持 dev-lifecycle 原汁原味）

```bash
# 1. 添加 dev-lifecycle 作为 git submodule
git submodule add https://codeberg.org/dev-lifecycle/methodology.git docs/methodology

# 2. 目录结构
project/
├── docs/
│   ├── methodology/          # dev-lifecycle (submodule)
│   │   ├── 01-prd.md
│   │   ├── 02-architecture.md
│   │   └── ...
│   └── project-specific/     # 项目特有文档
├── src/
└── ...

# 3. 所有 PRD/Arch/Spec 仍用 Markdown 模板
# 这是单源真相 (Single Source of Truth)
```

### 4.2 Linear 层面（做流程执行层）

#### 4.2.1 自定义 Workflow

```
Linear Workflow: dev-lifecycle Pipeline

Backlog
  └── 📋 Phase 1: PRD Draft
       └── [Approved] → 📋 Phase 2: Architecture Draft
            └── [Approved] → 📋 Phase 3: Tech Spec Draft
                 └── [Approved] → 📋 Phase 4: Task Breakdown
                      └── [Approved] → 🧪 Phase 5: Test Spec
                           └── [Approved] → 💻 Phase 6: Implementation
                                └── [PR Submitted] → 👀 Phase 7: In Review
                                     └── [Approved] → ✅ Deployed
```

#### 4.2.2 Issue Template 配置

```yaml
# Linear Issue Template: Phase 1 - PRD
name: "Phase 1: PRD"
description: Product Requirements Document
fields:
  - name: Title
    type: text
    required: true
    placeholder: "[Feature] Brief description"
    
  - name: Phase
    type: dropdown
    required: true
    options:
      - "Phase 1: PRD Draft"
      - "Phase 1: PRD Approved"
      
  - name: PRD Content
    type: textarea
    required: true
    placeholder: |
      ## Copy from docs/methodology/01-prd.md
      
      ### 1. Problem Statement
      
      ### 2. Target Users
      
      ### 3. Solution Overview
      
      ### 4. Success Metrics
      
  - name: Related Docs
    type: url
    placeholder: "Link to external PRD if any"
```

#### 4.2.3 Projects 组织

```
Linear Projects 结构:

📁 Gradience Protocol
├── 🎯 Initiative: Multi-chain Support
│   ├── 📋 Phase 1: PRD - Multi-chain Strategy
│   ├── 📋 Phase 2: Architecture - 5-chain Design
│   ├── 📋 Phase 3: Tech Spec - SDK Interface
│   ├── 📋 Phase 4: Task Breakdown
│   │   ├── Sub-task: Tempo Provider (4h)
│   │   ├── Sub-task: X Layer Provider (4h)
│   │   └── Sub-task: Sui Provider (4h)
│   ├── 🧪 Phase 5: Test Spec
│   ├── 💻 Phase 6: Implementation
│   └── 👀 Phase 7: Review
│
└── 🎯 Initiative: Privacy SDK
    ├── 📋 Phase 1: PRD - ZK KYC
    └── ...
```

#### 4.2.4 Cycles 配置

```
Cycles (Sprints):

Cycle 1 (Week 1-2):
├── Phase 4 Tasks:
│   ├── Tempo Provider 基础 (4h)
│   └── X Layer Provider 基础 (4h)
└── All tasks ≤ 4h

Cycle 2 (Week 3-4):
├── Phase 6 Tasks:
│   ├── Implement Tempo MPP (4h)
│   ├── Implement X Layer zero-gas (4h)
│   └── Write tests (4h)
```

#### 4.2.5 Custom Fields

```
Custom Fields 配置:

1. Phase (Dropdown)
   - Phase 0: Business Validation
   - Phase 1: PRD
   - Phase 2: Architecture
   - Phase 3: Tech Spec
   - Phase 4: Task Breakdown
   - Phase 5: Test Spec
   - Phase 6: Implementation
   - Phase 7: Review

2. Status (Dropdown)
   - Draft
   - In Review
   - Approved
   - Needs Revision

3. Estimated Hours (Number)
   - 约束: ≤ 4 hours
   - 用于 Phase 4 任务拆分

4. Related Doc (URL)
   - 链接到 docs/methodology/ 下的 Markdown

5. AI Agent (Dropdown)
   - claude-code
   - codex
   - hermes
   - pi
   - human
```

### 4.3 AI Agent 集成

```typescript
// AI Agent 读取上下文

interface AgentContext {
  // 1. 读 repo 里的方法论
  methodology: readFile('docs/methodology/README.md');
  
  // 2. 读当前 Linear Issue
  issue: fetchLinearIssue(issueId);
  
  // 3. 读 attach 的文档
  relatedDoc: fetchUrl(issue.relatedDocUrl);
}

// Agent 工作流
async function agentWorkflow(issueId: string) {
  const context = await gatherContext(issueId);
  
  // 根据 Phase 执行对应模板
  switch(context.issue.phase) {
    case 'Phase 1':
      return await generatePRD(context);
    case 'Phase 3':
      return await generateTechSpec(context);
    case 'Phase 6':
      return await implementCode(context);
    // ...
  }
}
```

---

## 5. 完整工作流程示例

### 5.1 从 Initiative 到部署

```
Day 1: 提出 Initiative
├── Human: 在 Linear 创建 Initiative "Add Tempo Support"
├── Linear: 自动生成 Phase 1 Issue
│   └── Template: "Phase 1: PRD - Tempo Integration"
│   └── Custom Fields: Phase=Phase 1, Status=Draft
│
Day 2-3: Phase 1 - PRD
├── AI Agent (Claude): 读 01-prd.md 模板
├── AI Agent: 生成 PRD 内容
├── Human: Review 并标记 "Approved"
├── Linear: 自动推进到 Phase 2
│
Day 4-5: Phase 2-3 - Arch & Tech Spec
├── 类似流程...
│
Day 6: Phase 4 - Task Breakdown
├── AI Agent (Hermes): 拆分 ≤4h 任务
├── Linear: 创建子 Issues
│   ├── "Implement TempoProvider class" (4h)
│   ├── "Add MPP session management" (4h)
│   └── "Write integration tests" (4h)
├── Linear: 分配到 Cycle 1
│
Day 7-10: Phase 6 - Implementation
├── AI Agent (Claude Code): 领取任务
├── AI Agent: 实现代码 → 提交 PR
├── Linear: 自动关联 PR
├── Linear: 状态变为 "PR Submitted"
│
Day 11: Phase 7 - Review
├── Linear: 自动创建 Review Issue
├── Reviewers: 审查代码
├── Linear: Approval 流程
├── Linear: 合并后状态变为 "Deployed"
│
Done! 🎉
```

---

## 6. 注意事项

### 6.1 适用场景

| 场景 | 推荐程度 | 原因 |
|------|---------|------|
| **Solo 开发者 + 极简** | ⭐⭐⭐ | 可能觉得 Linear 有点重，GitHub Issues + Markdown 也够 |
| **2+ 人协作** | ⭐⭐⭐⭐⭐ | Linear 价值非常明显 |
| **长期项目** | ⭐⭐⭐⭐⭐ | 知识库积累价值巨大 |
| **AI Agent 协作** | ⭐⭐⭐⭐⭐ | 流程 rigor 防止混乱 |

### 6.2 磨合期

```
磨合预期:
├── 第 1-2 个项目: 调整 Workflow 和 Template
├── 第 3 个项目: 基本定型
├── 第 4+ 个项目: 几乎零维护成本，全速运行
```

### 6.3 常见陷阱

| 陷阱 | 解决方案 |
|------|---------|
| Phase 跳过 | Linear Workflow 强制顺序 |
| 任务过大 | Custom Field 限制 ≤4h |
| 文档不同步 | Issue 中 attach Markdown 链接 |
| AI 幻觉 | 强制 TDD + Review 流程 |

---

## 7. 快速启动配置

### 7.1 一键导入

```bash
# 1. 克隆 dev-lifecycle
git clone https://codeberg.org/dev-lifecycle/methodology.git

# 2. 复制到项目
cp -r methodology docs/methodology

# 3. Linear 导入配置
# 使用 Linear API 批量创建 Templates 和 Workflow
```

### 7.2 Linear API 脚本

```typescript
// scripts/setup-linear.ts

import { LinearClient } from '@linear/sdk';

const linear = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

async function setupDevLifecycle() {
  // 创建 Workflow States
  const states = [
    { name: 'Phase 1: PRD Draft', color: '#FFD700' },
    { name: 'Phase 1: PRD Approved', color: '#32CD32' },
    { name: 'Phase 2: Arch Draft', color: '#FFD700' },
    // ... 其他 Phase
  ];
  
  for (const state of states) {
    await linear.workflowStateCreate({
      name: state.name,
      color: state.color,
      teamId: TEAM_ID
    });
  }
  
  // 创建 Issue Templates
  const templates = [
    { name: 'Phase 1: PRD', file: '01-prd.md' },
    { name: 'Phase 2: Architecture', file: '02-architecture.md' },
    // ... 其他 Phase
  ];
  
  for (const template of templates) {
    await linear.issueTemplateCreate({
      name: template.name,
      description: `Please follow ${template.file}`,
      teamId: TEAM_ID
    });
  }
  
  console.log('dev-lifecycle setup complete!');
}

setupDevLifecycle();
```

---

## 8. 结论

### 核心要点

1. **dev-lifecycle = 灵魂**: 流程 rigor + 文档规范
2. **Linear = 身体**: 可视化 + 团队协作
3. **搭配 = 完美**: 1 + 1 > 2

### 立即行动

| 优先级 | 行动 | 时间 |
|--------|------|------|
| P0 | 添加 dev-lifecycle 为 git submodule | 今天 |
| P0 | 配置 Linear Workflow (7 Phases) | 今天 |
| P1 | 创建 7 个 Issue Templates | 本周 |
| P1 | 测试第一个完整 Initiative | 本周 |
| P2 | 优化 Custom Fields | 下周 |

### 推荐程度

> **⭐⭐⭐⭐⭐ 强烈推荐搭配使用**

适合所有 2+ 人团队、AI Agent 协作、长期项目。

---

*最后更新: 2026-04-03*  
*方法论确认: ✅ dev-lifecycle + Linear = 最佳实践*
