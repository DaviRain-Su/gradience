# Structured Development Lifecycle Skill

> 本项目的开发方法论。所有代码工作必须遵循此流程。

## 适用场景

当任务涉及以下情况时，加载此 skill：
- 新模块/子项目开发
- 功能实现、合约/Program 开发、SDK/API 开发
- 任何需要写代码的工作

## 核心规则

**在写任何代码之前，先读方法论文档：**
- 本地: `../dev-lifecycle/README.md`（兄弟目录）
- 远程: https://github.com/DaviRain-Su/dev-lifecycle

本项目执行 7 阶段开发流程（PRD → 架构 → 技术规格 → 任务拆解 → 测试规格 → 实现 → 审查部署）。不可跳过任何阶段。

## 重点

1. **没有技术规格不写代码** — 如果目标组件的 `03-technical-spec.md` 不存在，先创建它
2. **没有测试不写实现** — Phase 5 测试骨架先于 Phase 6 实现代码
3. **代码必须与规格一致** — 规格有误时先改规格，再改代码

## 模板位置

`dev-lifecycle/templates/` — 独立仓库中的 7 个阶段模板

## 输出位置

每个子项目的文档存放在 `<project>/docs/01-prd.md` 到 `07-review-report.md`
