# Gradience Development Lifecycle（开发生命周期）

> **本项目所有开发工作必须严格遵循此流程。**
> **无论使用什么工具（pi、Claude Code、Codex、Cursor、人工）均适用。**
> **不可跳过任何阶段。**

---

## 流程总览

```
Phase 1: PRD（需求定义）          → 定义「做什么」
Phase 2: Architecture（架构设计） → 定义「怎么组织」
Phase 3: Technical Spec（技术规格）→ 定义「每个字节怎么做」  ← 最关键
Phase 4: Task Breakdown（任务拆解）→ 拆成可执行的小任务
Phase 5: Test Spec（测试规格）     → TDD：先定义「什么是对的」
Phase 6: Implementation（实现）    → 写代码，让测试通过
Phase 7: Review & Deploy（审查）   → 确认质量，部署上线
```

每个阶段有**明确的输入、输出和验收标准**。当前阶段验收通过后，才能进入下一阶段。

---

## 强制规则

### 规则 1: 不可跳过阶段
即使某个阶段看似"显而易见"，也必须产出对应文档。文档是契约，不是形式。

### 规则 2: 技术规格是代码的契约
代码必须与技术规格（Phase 3）100% 一致。发现规格有问题时，**先修改规格文档，再修改代码**。不允许代码与规格不一致的状态存在。

### 规则 3: TDD 不可商量
测试先于实现。没有例外。Phase 5 的测试代码骨架必须在 Phase 6 写实现代码之前完成。

### 规则 4: 输入完整才能开始
每个阶段的输入是上一阶段的输出。输入不完整时，不得开始当前阶段。

### 规则 5: 模板必填项不可省略
模板中标记为「必填」的部分不可省略。「可选」部分根据项目规模决定。

---

## 各阶段详细模板

| Phase | 模板文件 | 说明 |
|-------|---------|------|
| 1 | [templates/01-prd.md](templates/01-prd.md) | 需求定义：问题、用户故事、范围、成功标准 |
| 2 | [templates/02-architecture.md](templates/02-architecture.md) | 架构设计：组件、数据流、依赖、状态 |
| 3 | [templates/03-technical-spec.md](templates/03-technical-spec.md) | 技术规格：数据结构、接口、错误码、状态机 |
| 4 | [templates/04-task-breakdown.md](templates/04-task-breakdown.md) | 任务拆解：≤4h 任务列表、依赖图、里程碑 |
| 5 | [templates/05-test-spec.md](templates/05-test-spec.md) | 测试规格：用例表、安全测试、代码骨架 |
| 6 | [templates/06-implementation.md](templates/06-implementation.md) | 实现检查清单：编码前/中/后检查、偏差记录 |
| 7 | [templates/07-review-deploy.md](templates/07-review-deploy.md) | 审查部署：安全审查、部署清单、版本记录 |

---

## 使用方法

### 开始新子项目

```bash
# 1. 创建子项目目录和 docs/
mkdir -p <project>/docs

# 2. 复制模板
cp docs/methodology/templates/01-prd.md <project>/docs/01-prd.md

# 3. 按顺序填写模板，完成一个阶段再进入下一个
```

### 文档存放规范

```
<project>/docs/
├── 01-prd.md                 ← Phase 1 需求定义
├── 02-architecture.md        ← Phase 2 架构设计
├── 03-technical-spec.md      ← Phase 3 技术规格
├── 04-task-breakdown.md      ← Phase 4 任务拆解
├── 05-test-spec.md           ← Phase 5 测试规格
├── 06-implementation-log.md  ← Phase 6 实现记录
└── 07-review-report.md       ← Phase 7 审查报告
```

### 已完成阶段的项目可以跳过前序文档

如果一个子项目的 Phase 1 和 Phase 2 已经在其他文档中完成（如白皮书、架构设计文档），可以在 `01-prd.md` 和 `02-architecture.md` 中引用那些文档，不需要重复编写。但 **Phase 3 起必须按模板新建**。

---

## 为什么这样做

```
架构文档说:  "用 Escrow + Judge + Reputation"
技术规格说:  "Task 账户 280 bytes, [8 discriminator][32 poster][32 judge]..."

→ 架构告诉你方向
→ 技术规格告诉你每一步怎么走
→ AI 拿着技术规格可以直接写出正确的代码
→ 没有技术规格，每个 AI（或开发者）都会自己做决定 → 不一致 → 返工
```

---

*规格即代码的蓝图。测试即代码的验收标准。两者都先于代码存在。*
