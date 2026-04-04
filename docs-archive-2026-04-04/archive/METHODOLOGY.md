# H-SDAL: Hermes-Coordinated Spec-Driven Agentic Lifecycle

> **方法论名称**: H-SDAL (Hermes-Coordinated Spec-Driven Agentic Lifecycle)  
> **全称**: Spec-First Hierarchical Multi-Agent Development Framework  
> **版本**: 1.0.0  
> **日期**: 2026-04-03  
> **适用**: AI Agent 时代的软件开发生命周期

---

## 1. 核心定义

### 1.1 一句话定义

这是一套**专为 2026 年 AI Agent 时代设计**的**规格先行（Spec-First）** + **分层多 Agent 协调（Hierarchical Orchestration）** + **自进化 Coordinator** 的软件开发生命周期方法论。

### 1.2 方法论定位

```
类型: Agentic Spec-Driven Hierarchical Development Methodology
归属: 2025-2026 年兴起的 Agentic Coding / Agentic SDLC 浪潮

核心组合:
├── Specification-Driven Development (SDD) — 规格驱动，取代 vibe coding
├── Hierarchical Multi-Agent Orchestration — Coordinator + Specialists 并行
└── Persistent Self-Improving Agent — Hermes 自进化 Skill 系统
```

---

## 2. 关键组成部分

### 2.1 基础框架: dev-lifecycle（7 阶段严格顺序）

```
Phase 0 (可选): Business Validation — 商业验证
    ↓
Phase 1: PRD — 产品需求文档
    ↓
Phase 2: Architecture — 架构设计
    ↓
Phase 3: Technical Spec — 技术规格（单源真相合同）
    ↓
Phase 4: Task Breakdown — 任务拆解（≤4 小时，支持 Coordinator 并行）
    ↓
Phase 5: Test Spec — 测试规格（强制 TDD）
    ↓
Phase 6: Implementation — 代码实现
    ↓
Phase 7: Review & Deploy — 多 Specialist 对抗性 Review + 部署
```

### 2.2 核心原则

| 原则 | 说明 |
|------|------|
| **Spec-First** | 规格定义合同，代码必须 100% 遵守 |
| **Boil the Lake** | 能做完的就全部做完 |
| **Search Before Building** | 三层知识检索 |
| **Processize before Productize** | 先定义流程再做产品 |
| **严格阶段验收** | 前一 Phase 不通过不开下一 Phase |
| **Markdown 模板驱动** | 所有文档标准化 |

### 2.3 三层角色架构

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: 大脑层 (Coordinator / Orchestrator)               │
│  ├── Hermes Agent (Nous Research 自进化开源 Agent)          │
│  ├── 持久化记忆 + 自学习循环 (自动提炼 Skill)                │
│  ├── 原生 Linear 操作 (Issue/状态/任务分配)                 │
│  ├── 全流程把控 + 任务委派 + 经验积累                        │
│  └── 角色: 你的"大脑"、项目经理、流程守护者                   │
│      ⚠️ 绝不自己写生产代码                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │ 委派任务
┌──────────────────────▼──────────────────────────────────────┐
│  Layer 2: 执行层 (Specialist Agents)                        │
│  ├── Claude Code / Cursor / Codex / Pi / Droid              │
│  ├── 只负责 Phase 6 Implementation                          │
│  ├── 干净的 Tech Spec + Test Spec → 专注写代码 + 跑测试       │
│  └── 角色: 干活的小弟、执行专员                              │
│      ⚠️ 保持上下文纯净，减少幻觉                            │
└──────────────────────┬──────────────────────────────────────┘
                       │ 更新进度
┌──────────────────────▼──────────────────────────────────────┐
│  Layer 3: 跟踪与协作层 (Tracking & Collaboration)           │
│  ├── Linear: Issue、Projects、Cycles、Workflow              │
│  ├── Approvals、可视化仪表盘                                 │
│  ├── dev-lifecycle Phase → Linear 状态/模板/Milestone       │
│  └── Hermes 自动操作，实现流程自动化                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 角色分工详解

### 3.1 你（人类）

```
角色: 老板
职责:
├── 高层决策
├── 给出高层次指令
├── 关键节点审批
└── 最终 Review

介入点:
├── Phase 0: 商业方向
├── Phase 1: PRD 审批
├── Phase 3: Tech Spec 审批
└── Phase 7: 最终 Review
```

### 3.2 Hermes（大脑 / Coordinator）

```
角色: 项目总指挥
核心能力:
├── 持久化记忆 (跨会话保留上下文)
├── 自学习循环 (任务后自动提炼 Skill)
├── Linear 原生操作 (API 集成)
└── Multi-Agent 委派 (安全委托子任务)

职责:
├── 读 dev-lifecycle 模板
├── 推进 7 个 Phase
├── 在 Linear 创建/更新 Issue
├── 拆任务 (≤4 小时)
├── 委派给 Coding Agents
├── 收集结果
├── 触发 Phase 7 Review
└── 每日/每周进度总结

约束:
├── ❌ 绝不写生产代码
├── ❌ 绝不污染 Coding Agents 上下文
└── ✅ 只协调、管理、委派
```

### 3.3 Coding Agents（小弟 / Specialists）

```
角色: 执行专员
类型:
├── Claude Code — 通用复杂实现
├── Cursor — IDE 集成开发
├── Codex — 快速原型
├── Pi — 特定领域任务
└── Droid — 移动端/特定平台

职责:
├── 只负责 Phase 6 Implementation
├── 写代码
├── 跑测试 (Phase 5 Test Spec)
├── 提交 PR
└── 报告结果

输入:
├── Linear Issue 链接
├── Phase 3: Tech Spec (技术规格)
└── Phase 5: Test Spec (测试规格)

约束:
├── ❌ 不读 PRD
├── ❌ 不读 Architecture
├── ❌ 不碰管理事务
└── ✅ 最小上下文，最大专注
```

---

## 4. 实际运行模式

### 4.1 完整工作流

```
你: "做个 XXX 功能" 或 "推进当前 Initiative 的 Phase 2"
    ↓
Hermes (大脑):
├── 读 dev-lifecycle 模板
├── 在 Linear 创建 Phase 1 Issue
├── 等待你审批
    ↓
你: 审批通过
    ↓
Hermes:
├── 创建 Phase 2 Issue
├── 推进到 Phase 3 (Tech Spec)
├── 拆分为 Phase 4 Tasks (≤4 小时)
├── 在 Linear 创建子 Issues
├── 委派给 Coding Agents
    ↓
Coding Agents (小弟):
├── 领取任务
├── Phase 6 实现
├── 跑测试
├── 提交 PR
    ↓
Hermes:
├── 检测到 PR
├── 创建 Phase 7 Review Issue
├── 协调 Review
    ↓
你: 最终审批
    ↓
Hermes: 合并、关闭 Issues、总结
    ↓
Done!
```

### 4.2 典型一天

```
早晨:
├── Hermes 发送日报: "昨日完成 X，今日计划 Y，需要你决策 Z"
├── 你: 回复 Z 的决策

白天:
├── Hermes 自动推进 Linear Issues
├── Coding Agents 并行干活
├── Hermes 监控进度

晚上:
├── Hermes 发送总结: "今日完成 X，明日计划 Y"
├── 你: 扫一眼，OK
```

---

## 5. 方法论优势

### 5.1 相比传统方法

| 对比 | H-SDAL | 传统方法 |
|------|--------|----------|
| **vs Agile/Scrum** | 更严谨 (强制 spec-first + TDD) | 流程较松散 |
| **vs 单 Agent (Cursor/Claude)** | 更可控、可扩展 | 上下文易污染 |
| **vs 通用 Multi-Agent (CrewAI)** | 更专注软件工程实践 | 通用性强但不够深入 |

### 5.2 核心价值

```
1. 极大降低 AI 幻觉与重工
   └── Spec-First + 严格阶段验收

2. Hermes 越用越聪明
   └── 复利效应: 每次任务后自动提炼 Skill

3. 适合规模化扩展
   └── solo → 小团队 → 中型团队

4. 知识自然沉淀
   └── 文档 + 工具 + Agent 角色高度闭环

5. 人类掌控关键决策
   └── 你当老板，Hermes 当 PM，Agents 当程序员
```

---

## 6. 快速启动指南

### 6.1 安装配置

```bash
# 1. 安装 Hermes
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash

# 2. 创建 Coordinator Profile
hermes profile create coordinator \
  --template dev-lifecycle-linear

# 3. 配置 System Prompt
cat > ~/.hermes/profiles/coordinator/prompt.txt << 'EOF'
你是 Coordinator，只负责：
- 规划
- Linear 操作
- 任务分配
- 流程把控

绝不自己写生产代码。
Coding 任务必须委托给 Coding Agents。
EOF

# 4. 配置 Linear Skill
hermes skill add linear --api-key $LINEAR_API_KEY

# 5. 添加 dev-lifecycle 模板
cp -r docs/methodology ~/.hermes/skills/dev-lifecycle

# 6. 启动	hermes start --profile coordinator --daemon
```

### 6.2 Linear 配置

```
Workflow States:
├── 📋 Phase 1: PRD Draft
├── ✅ Phase 1: PRD Approved
├── 📐 Phase 2: Arch Draft
├── ✅ Phase 2: Arch Approved
├── 📋 Phase 3: Tech Spec Draft
├── ✅ Phase 3: Tech Spec Approved
├── 📋 Phase 4: Task Breakdown
├── 🧪 Phase 5: Test Spec
├── 💻 Phase 6: Implementation
├── 👀 Phase 7: In Review
├── ✅ Phase 7: Approved
└── 🚀 Deployed

Issue Templates:
├── Phase 1: PRD
├── Phase 2: Architecture
├── Phase 3: Technical Spec
├── Phase 4: Task
├── Phase 5: Test Spec
├── Phase 6: Implementation
└── Phase 7: Review
```

---

## 7. Hermes Skill 积累

### 7.1 核心 Skills

```
~/.hermes/skills/
├── dev-lifecycle/
│   ├── 01-prd.md
│   ├── 02-architecture.md
│   ├── 03-tech-spec.md
│   ├── 04-task-breakdown.md
│   ├── 05-test-spec.md
│   ├── 06-implementation.md
│   └── 07-review.md
│
├── linear-management/
│   ├── create-phase-issue.md
│   ├── delegate-to-agent.md
│   └── progress-summary.md
│
└── project-specific/
    └── gradience-workflows.md
```

### 7.2 Skill 进化示例

```
第一次项目:
├── Hermes 学习 dev-lifecycle 流程
├── 可能有些磕磕绊绊
└── 自动提炼 Skill

第二次项目:
├── Hermes 复用 Skill
├── 流程更顺畅
└── 继续提炼

第 N 次项目:
├── Hermes 几乎零配置启动
├── 自动识别项目类型
└── 自适应调整流程
```

---

## 8. 成功指标

### 8.1 效率指标

| 指标 | 目标 |
|------|------|
| **AI 幻觉率** | < 5% |
| **重工率** | < 10% |
| **Phase 按时完成率** | > 80% |
| **你的日常介入时间** | < 1 小时 |

### 8.2 质量指标

| 指标 | 目标 |
|------|------|
| **Test Coverage** | > 80% |
| **Code Review 通过率** | > 90% |
| **生产 Bug 率** | < 2% |

---

## 9. 故障排除

### 9.1 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| Hermes 写代码了 | Prompt 约束不够 | 强化 System Prompt |
| Coding Agent 幻觉 | 上下文太大 | 减少输入文档 |
| Phase 跳过 | Workflow 配置问题 | 检查 Linear 状态流转 |
| 任务超时 | 估算不准 | 拆分为更小任务 |

### 9.2 升级路径

```
Level 1: 手动协调
├── 你直接操作 Linear
├── Hermes 辅助建议
└── 适合初期磨合

Level 2: 半自动
├── Hermes 自动推进 Phase
├── 你审批关键点
└── 当前目标

Level 3: 全自动
├── Hermes 全权处理常规任务
├── 你只处理异常
└── 长期目标
```

---

## 10. 参考资源

### 10.1 核心文档

- [dev-lifecycle](https://codeberg.org/dev-lifecycle/methodology) — 基础方法论
- [Hermes Agent](https://hermes-agent.nousresearch.com) — Coordinator 工具
- [Linear](https://linear.app) — 项目管理平台

### 10.2 相关文档 (Gradience 项目)

- `docs/multi-agent-dev-workflow-hermes-linear.md`
- `docs/dev-lifecycle-linear-integration-guide.md`

---

## 11. 总结

### 一句话

> **"你当老板，Hermes 当项目经理，Coding Agents 当程序员 —— 这就是 AI 原生开发。"**

### 核心公式

```
H-SDAL = 
    dev-lifecycle (流程) 
    + Hermes (协调) 
    + Linear (跟踪) 
    + Coding Agents (执行)
    = 最小幻觉 + 最低重工 + 可规模化 + 自我进化
```

---

*方法论版本: 1.0.0*  
*最后更新: 2026-04-03*  
*状态: 已验证，推荐立即采用*
