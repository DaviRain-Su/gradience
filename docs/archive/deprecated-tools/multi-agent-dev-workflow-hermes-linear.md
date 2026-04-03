# 多 Agent 开发工作流：Hermes + Coding Agents + Linear 协作架构

> **文档类型**: 开发方法论与工具配置  
> **日期**: 2026-04-03  
> **核心**: Hermes 作为 Coordinator，专职 Coding Agents 执行实现  
> **目标**: 将 dev-lifecycle 理念落地为多 Agent 流水线

---

## 执行摘要

**核心架构**:
```
Hermes (Coordinator) ←→ Linear (项目管理)
       ↓
  委派任务
       ↓
Coding Agents (Claude Code / Codex / Pi) → 实现代码
       ↓
  提交 PR
       ↓
Hermes (Review 协调) → Phase 7 完成
```

**关键原则**:
- ✅ Hermes 只管理 Linear，不写代码（避免上下文污染）
- ✅ Coding Agents 只实现 Phase 6，不碰管理
- ✅ dev-lifecycle 7 个 Phase 作为强制流程
- ✅ Linear 作为可视化跟踪层

---

## 1. 为什么这个架构完美契合 dev-lifecycle

### 1.1 dev-lifecycle 设计理念

```
dev-lifecycle 核心:
├── Coordinator 模式 (Phase 4 Task Breakdown)
│   └── 一个总指挥拆任务、分配并行执行
│
├── Specialist 模式 (Phase 6 Implementation)
│   └── 专职 Coding Agent 只负责实现
│
└── 严格顺序 (Phase 0-7)
    └── 前一 Phase 没通过不开下一 Phase
```

### 1.2 你的方案如何落地

| dev-lifecycle 角色 | 你的实现 | 优势 |
|-------------------|---------|------|
| **Coordinator** | Hermes Agent | 自进化 + Linear Skill |
| **Specialist** | Claude Code / Codex / Pi | 上下文干净、幻觉少 |
| **流程把控** | Hermes 读 dev-lifecycle 模板 | 强制 Phase 顺序 |
| **可视化** | Linear Issues | 人类可跟踪进度 |

### 1.3 与单一 Agent 对比

| 维度 | 单一 Agent | 多 Agent 架构 |
|------|-----------|--------------|
| **上下文管理** | 管理+代码混在一起，易污染 | 分离，各自专注 |
| **效率** | 频繁切换角色，效率低 | 并行执行，效率高 |
| **可维护** | 知识混在对话历史中 | Hermes Skill 可复用 |
| **24/7 运行** | 需人工重启会话 | Hermes 常驻 VPS/Docker |
| **学习进化** | 无 | Hermes 自进化 Skill |

---

## 2. Hermes 为什么适合 Linear 管理

### 2.1 Hermes 核心特性

```
Hermes (Nous Research 开源):
├── 自进化 Agent
│   └── built-in learning loop
│   └── 经验做成 Skill 文件，下次复用
│
├── 原生 Linear Skill
│   └── 自动创建/更新 Issue
│   └── 改状态、加 Label、发通知
│
├── Multi-Agent Delegation
│   └── 管理 Hermes
│   └── 委派 Coding Agents
│
├── 24/7 运行
│   └── VPS/Docker 常驻
│   └── 不像 Cursor/Claude 需重启
│
└── Agent Profiles
    └── 专门管 Linear 的 Profile
    └── 专门 Review 的 Profile
```

### 2.2 Hermes 能做什么

```typescript
// Hermes Linear Skill 能力
interface HermesLinearSkill {
  // Issue 管理
  createIssue(title: string, description: string, phase: Phase): Promise<Issue>;
  updateIssue(issueId: string, updates: Partial<Issue>): Promise<void>;
  changeStatus(issueId: string, status: Status): Promise<void>;
  addLabel(issueId: string, label: string): Promise<void>;
  
  // 流程推进
  moveToNextPhase(issueId: string): Promise<void>;
  blockUntilApproved(issueId: string): Promise<void>;
  
  // 通知
  notifyAgent(agent: string, message: string): Promise<void>;
  postToSlack(channel: string, message: string): Promise<void>;
}
```

---

## 3. 具体落地配置

### 3.1 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│  Hermes (Coordinator) - VPS/Docker 常驻                      │
│  ├── Skill: dev-lifecycle-manager                            │
│  ├── Skill: linear-operator                                  │
│  └── Skill: agent-delegator                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
┌────────▼────┐ ┌──────▼──────┐ ┌────▼─────────┐
│ Linear      │ │ Coding      │ │ Review       │
│ (可视化)     │ │ Agents      │ │ Agents       │
├─────────────┤ ├─────────────┤ ├──────────────┤
│ • Issues    │ │ • Claude    │ │ • Hermes     │
│ • Boards    │ │   Code      │ │   (Review    │
│ • Labels    │ │ • Codex     │ │   Profile)   │
│ • Workflow  │ │ • Pi        │ │ • Claude     │
└─────────────┘ └─────────────┘ └──────────────┘
```

### 3.2 Hermes 配置

```bash
# 1. 安装 Hermes
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash

# 2. 配置 dev-lifecycle Skill
mkdir -p ~/.hermes/skills/dev-lifecycle
cp docs/methodology/*.md ~/.hermes/skills/dev-lifecycle/

# 3. 配置 Linear Skill
hermes skill add linear --api-key $LINEAR_API_KEY

# 4. 启动 Hermes (常驻)
hermes start --profile coordinator --daemon
```

### 3.3 Hermes Skill 模板

```yaml
# ~/.hermes/skills/dev-lifecycle-manager/skill.yaml
name: dev-lifecycle-manager
description: Manage dev-lifecycle 7 phases via Linear
version: 1.0.0

triggers:
  - type: webhook
    source: linear
    event: issue.created
  - type: schedule
    cron: "0 */4 * * *"  # 每4小时检查一次

actions:
  - name: parse_phase
    description: Parse which phase an issue belongs to
    
  - name: enforce_phase_order
    description: Block if previous phase not approved
    
  - name: delegate_coding
    description: Assign to coding agent for Phase 6
    
  - name: coordinate_review
    description: Trigger Phase 7 review when PR submitted

knowledge:
  - path: docs/methodology/01-prd.md
  - path: docs/methodology/02-architecture.md
  - path: docs/methodology/03-tech-spec.md
  - path: docs/methodology/04-task-breakdown.md
  - path: docs/methodology/05-test-spec.md
  - path: docs/methodology/06-implementation.md
  - path: docs/methodology/07-review.md
```

### 3.4 Hermes Prompt 模板

```markdown
# Hermes System Prompt: dev-lifecycle Coordinator

You are Hermes, the coordinator for Gradience project development.

## Your Role
- Manage Linear issues through dev-lifecycle 7 phases
- NEVER write code yourself
- Delegate all implementation to Coding Agents
- Enforce strict phase ordering

## dev-lifecycle Phases
1. PRD (Product Requirements) - Must be approved before Architecture
2. Architecture (System Design) - Must be approved before Tech Spec
3. Tech Spec (Technical Specification) - Must be approved before Task Breakdown
4. Task Breakdown (<=4h tasks) - Must be approved before Implementation
5. Test Spec (Test Plan) - Created alongside tasks
6. Implementation (Code) - Delegate to Coding Agents
7. Review (Code Review) - Coordinate review agents

## Linear Operations
When you see a new Initiative:
1. Create Phase 1: PRD issue
2. Wait for "Phase-1-Approved" label
3. Then create Phase 2: Architecture issue
4. Continue sequentially...

## Delegation Rules
- Phase 6 Implementation tasks → @claude-code or @codex
- Include only: Issue link + Phase 3 Tech Spec + Phase 5 Test Spec
- Do NOT include: Full PRD, other phases, or management context

## Review Coordination
When Coding Agent submits PR:
1. Create Phase 7: Review issue
2. Assign to review agent (@claude-review or @hermes-review)
3. Collect feedback
4. If approved, merge and close

## Labels to Watch
- "Phase-X-Approved" → Move to Phase X+1
- "Needs-Revision" → Send back to previous phase
- "Ready-For-Implementation" → Delegate to coding agent
- "PR-Submitted" → Start Phase 7 review
```

---

## 4. Coding Agents 配置

### 4.1 专职 Agent 分工

```
Coding Agents (只干 Phase 6):

┌─────────────────┬──────────────────┬────────────────────┐
│ Agent           │ 最佳场景         │ 启动上下文         │
├─────────────────┼──────────────────┼────────────────────┤
│ Claude Code     │ 通用实现、架构   │ Issue + Tech Spec  │
│                 │ 复杂、需深度推理 │ + Test Spec        │
├─────────────────┼──────────────────┼────────────────────┤
│ Codex (GPT-4o)  │ 快速原型、标准   │ Issue + Tech Spec  │
│                 │ 模式代码         │ (精简版)           │
├─────────────────┼──────────────────┼────────────────────┤
│ Pi / Droid      │ 特定领域任务     │ Issue + Domain     │
│                 │ (前端/合约/等)   │ Spec + Test Spec   │
└─────────────────┴──────────────────┴────────────────────┘
```

### 4.2 Coding Agent 启动脚本

```bash
#!/bin/bash
# start-coding-agent.sh

ISSUE_URL=$1
AGENT_TYPE=$2

# 获取 Linear Issue 详情
issue_data=$(curl -H "Authorization: $LINEAR_API_KEY" $ISSUE_URL)

# 提取 Tech Spec 和 Test Spec
tech_spec=$(echo $issue_data | jq -r '.description')
test_spec=$(echo $issue_data | jq -r '.testSpec')

# 构建最小上下文
context="""
# Task
$(echo $issue_data | jq -r '.title')

## Tech Spec
$tech_spec

## Test Spec
$test_spec

## Requirements
- Implement according to Tech Spec
- All tests in Test Spec must pass
- Submit PR when done
- Do NOT modify other files
"""

case $AGENT_TYPE in
  "claude")
    echo "$context" | claude code --stdin
    ;;
  "codex")
    echo "$context" | codex --mode implementation
    ;;
  "pi")
    echo "$context" | pi-agent --domain $(echo $issue_data | jq -r '.domain')
    ;;
esac
```

### 4.3 Coding Agent 约束

```markdown
# Coding Agent System Prompt

You are a specialist coding agent. Your ONLY job is Phase 6: Implementation.

## What You Receive
- Linear Issue link
- Phase 3: Tech Spec (technical requirements)
- Phase 5: Test Spec (what to test)

## What You Do
1. Read the Tech Spec
2. Implement the code
3. Run tests from Test Spec
4. Submit PR

## What You DON'T Do
❌ Read PRD (Product Requirements)
❌ Read Architecture docs
❌ Modify project management files
❌ Create new Linear issues
❌ Talk to users

## Context Isolation
You are given MINIMAL context intentionally to:
- Reduce hallucination
- Improve focus
- Lower token cost
- Faster execution

Trust that Hermes (coordinator) has done the planning.
Just execute perfectly.
```

---

## 5. Linear 工作流配置

### 5.1 Custom Workflow

```
Linear Workflow: dev-lifecycle Pipeline

Backlog
  └── 📋 Phase 1: PRD
       └── [Approved] → 📐 Phase 2: Architecture
            └── [Approved] → 📋 Phase 3: Tech Spec
                 └── [Approved] → 📋 Phase 4: Task Breakdown
                      └── [Approved] → 🧪 Phase 5: Test Spec
                           └── [Approved] → 💻 Phase 6: Implementation
                                └── [PR Submitted] → 👀 Phase 7: Review
                                     └── [Approved] → ✅ Done
```

### 5.2 Labels

```
Phase Labels:
- phase-1-prd
- phase-2-architecture
- phase-3-tech-spec
- phase-4-task-breakdown
- phase-5-test-spec
- phase-6-implementation
- phase-7-review

Status Labels:
- needs-revision (Hermes 检测到问题)
- approved (当前 Phase 通过)
- ready-for-next (可进入下一 Phase)
- delegated-to-claude (已派给 Claude Code)
- delegated-to-codex (已派给 Codex)
- pr-submitted (Coding Agent 提交 PR)
- review-approved (Review 通过)

Priority Labels:
- p0-blocking (阻塞其他任务)
- p1-urgent (本周必须完成)
- p2-normal (正常节奏)
- p3-backlog (可延后)
```

### 5.3 Automation Rules

```yaml
# Linear Automation (via Hermes)
rules:
  - name: Auto-create-next-phase
    trigger: label added "phase-X-approved"
    action: create issue for phase X+1
    
  - name: Delegate-implementation
    trigger: label added "ready-for-implementation"
    action: 
      - notify hermes
      - hermes delegates to coding agent
      - add label "delegated-to-{agent}"
      
  - name: Start-review
    trigger: label added "pr-submitted"
    action:
      - create Phase 7 issue
      - assign to review agent
      
  - name: Block-phase-skip
    trigger: attempt to create phase X issue
    condition: phase X-1 not approved
    action: reject with message "Phase X-1 must be approved first"
```

---

## 6. 完整工作流程示例

### 6.1 从 Initiative 到实现

```
Day 1: Initiative 提出
├── Human: 在 Linear 创建 Initiative "Add Tempo support"
├── Hermes: 检测到新 Initiative
│   └── 自动创建 Phase 1: PRD issue
│       └── Title: "[Phase 1] Tempo Integration PRD"
│       └── Labels: phase-1-prd
│
Day 2: PRD 撰写
├── Human: 撰写 PRD，添加 details
├── Human: 标记 "approved"
├── Hermes: 检测到 "phase-1-approved"
│   └── 自动创建 Phase 2: Architecture issue
│
Day 3-4: Architecture → Tech Spec → Task Breakdown
├── (类似流程，Hermes 自动推进)
│
Day 5: Ready for Implementation
├── Hermes: 创建 Phase 6 issues (拆分 <=4h 任务)
│   └── Issue: "Implement TempoProvider class"
│   └── Issue: "Add MPP session management"
│   └── Issue: "Write tests for Tempo integration"
├── Hermes: 标记 "ready-for-implementation"
├── Hermes: 委派给 Claude Code
│   └── 发送: Issue URL + Tech Spec + Test Spec
│
Day 5-6: Coding Agent 执行
├── Claude Code: 接收最小上下文
├── Claude Code: 实现 TempoProvider
├── Claude Code: 跑通测试
├── Claude Code: 提交 PR
├── Hermes: 检测到 PR
│   └── 标记 "pr-submitted"
│   └── 创建 Phase 7: Review issue
│
Day 7: Review
├── Review Agent: 审查代码
├── Review Agent: 批准或提出修改
├── Hermes: 协调修改（如需要）
├── Hermes: 合并 PR
├── Hermes: 关闭所有相关 Issues
└── Done!
```

---

## 7. 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| **Hermes 写代码** | 中 | 高 | 严格 System Prompt 约束 |
| **上下文泄漏** | 中 | 中 | Coding Agent 只收最小上下文 |
| **Phase 跳过** | 低 | 高 | Hermes 强制检查前一 Phase |
| **Coding Agent 卡住** | 中 | 中 | 超时机制，Hermes 重新委派 |
| **Token 成本** | 低 | 低 | Skill 压缩 + 最小上下文 |
| **Hermes 宕机** | 低 | 高 | Docker 自动重启 + 健康检查 |

---

## 8. 进阶：Emdash 集成（可选）

```
Emdash (Agentic Dev Environment):
├── 原生支持 Hermes
├── 原生支持 Linear
├── 一键打通 Hermes + Coding Agents + Linear
└── 推荐用于快速启动

安装:
npm install -g emdash
emdash init --template hermes-linear
emdash connect linear --api-key $LINEAR_API_KEY
emdash start
```

---

## 9. 结论

### 核心原则

1. **Hermes 只管理**: Linear + 协调，不写代码
2. **Coding Agents 只实现**: Phase 6，不碰管理
3. **dev-lifecycle 强制**: 7 Phase 顺序不可跳过
4. **Linear 可视化**: 人类可跟踪所有进度
5. **上下文隔离**: 最小上下文，最大专注

### 立即行动

| 优先级 | 行动 | 时间 |
|--------|------|------|
| P0 | 安装 Hermes 并配置 Linear Skill | 今天 |
| P0 | 创建 dev-lifecycle-manager Skill | 今天 |
| P1 | 配置 Linear Workflow 和 Labels | 本周 |
| P1 | 测试第一个 Initiative 全流程 | 本周 |
| P2 | 优化 Coding Agent 上下文模板 | 下周 |

### 一句话总结

> **"Hermes 是 AI 项目经理，Coding Agents 是 AI 工程师，Linear 是可视化看板，dev-lifecycle 是强制流程。这才是 AI-native 开发。"**

---

*最后更新: 2026-04-03*  
*状态: 推荐立即实施*
