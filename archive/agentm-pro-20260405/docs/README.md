# AgentM Pro - 开发文档

基于 [7 阶段开发方法论](../../docs/methodology/README.md) 的完整开发文档。

## 文档导航

| 阶段    | 文档                                           | 状态     | 说明     |
| ------- | ---------------------------------------------- | -------- | -------- |
| Phase 1 | [01-prd.md](./01-prd.md)                       | ✅ Draft | 需求定义 |
| Phase 2 | [02-architecture.md](./02-architecture.md)     | ✅ Draft | 架构设计 |
| Phase 3 | [03-technical-spec.md](./03-technical-spec.md) | ✅ Draft | 技术规格 |
| Phase 4 | [04-task-breakdown.md](./04-task-breakdown.md) | ✅ Draft | 任务拆解 |
| Phase 5 | [05-test-spec.md](./05-test-spec.md)           | ✅ Draft | 测试规格 |
| Phase 6 | [06-implementation.md](./06-implementation.md) | ✅ Draft | 实现指南 |
| Phase 7 | [07-review-deploy.md](./07-review-deploy.md)   | ✅ Draft | 审查部署 |

## 快速开始

### 给 Code Agent 的指令

```
你是 AgentM Pro 的开发工程师。

项目背景:
- AgentM Pro 是面向开发者的 Agent 管理平台
- 基于 Gradience Protocol 构建
- 使用 React + TypeScript + Tailwind CSS

开发规范:
1. 严格遵循 7 阶段开发方法论
2. 先读技术规格 (03-technical-spec.md)，再写代码
3. 每个功能必须有对应的单元测试
4. 代码必须符合 Technical Spec 的定义

当前阶段:
- Sprint 1: Foundation (Week 1)
- 任务: S1-1 到 S1-5

参考:
- 技术规格: apps/agentm-pro/docs/03-technical-spec.md
- 任务拆解: apps/agentm-pro/docs/04-task-breakdown.md
- 测试规格: apps/agentm-pro/docs/05-test-spec.md
```

### 开发流程

```
1. 阅读 Phase 3 技术规格
2. 查看 Phase 4 当前 Sprint 任务
3. 编写 Phase 5 测试骨架
4. 实现功能 (Phase 6)
5. 自测并提交
6. 进入下一个任务
```

## 参考资源

- [Gradience Protocol 官网](https://gradiences.xyz)
- [AgentM Web (用户端)](https://agentm.gradiences.xyz)
- [AgentM Pro (当前 placeholder)](https://pro.gradiences.xyz)
- [SDK 文档](../../apps/agent-arena/clients/typescript/README.md)

## 相关经验

- [网站部署经验](../../docs/experience-reports/2026-04-03-website-deployment.md)
- [AgentM Web Bug 记录](../../docs/experience-reports/2026-04-03-agentm-web-white-screen.md)

---

_最后更新: 2026-04-03_
