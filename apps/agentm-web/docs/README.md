# AgentM Web 开发文档

本目录包含 AgentM Web 项目的完整 7 阶段开发文档，遵循项目方法论规范。

## 📚 文档列表

| 阶段    | 文档                                           | 描述               | 行数 |
| ------- | ---------------------------------------------- | ------------------ | ---- |
| Phase 1 | [01-prd.md](./01-prd.md)                       | 产品需求文档       | 126  |
| Phase 2 | [02-architecture.md](./02-architecture.md)     | 架构设计           | 169  |
| Phase 3 | [03-technical-spec.md](./03-technical-spec.md) | 技术规格（最重要） | 469  |
| Phase 4 | [04-task-breakdown.md](./04-task-breakdown.md) | 任务分解           | 190  |
| Phase 5 | [05-test-spec.md](./05-test-spec.md)           | 测试规范           | 274  |
| Phase 6 | [06-implementation.md](./06-implementation.md) | 实现日志           | 197  |
| Phase 7 | [07-review-report.md](./07-review-report.md)   | 评审报告           | 196  |

**总计**: 1,621 行文档

## 🎯 快速导航

### 如果你是新开发者

1. 先读 [02-architecture.md](./02-architecture.md) 了解系统架构
2. 再读 [03-technical-spec.md](./03-technical-spec.md) 了解技术细节
3. 查看 [04-task-breakdown.md](./04-task-breakdown.md) 了解功能模块

### 如果你要添加新功能

1. 从 [01-prd.md](./01-prd.md) 开始定义需求
2. 更新 [03-technical-spec.md](./03-technical-spec.md) 技术规格
3. 添加测试到 [05-test-spec.md](./05-test-spec.md)
4. 实现后更新 [06-implementation.md](./06-implementation.md)

### 如果你要审查代码

1. 参考 [03-technical-spec.md](./03-technical-spec.md) 验证实现一致性
2. 检查 [05-test-spec.md](./05-test-spec.md) 测试覆盖
3. 更新 [07-review-report.md](./07-review-report.md) 审查结果

## 🏗️ 项目概述

AgentM Web 是一个基于 Next.js 15 的 Web 应用，提供：

- **Profile 管理**: 创建、编辑、查看 Agent Profile
- **社交系统**: Follow/Unfollow、Feed 流、帖子互动
- **Dashboard**: 统计数据和声誉追踪
- **AI Playground**: Agent 测试和交互环境

## 📝 技术栈

- **框架**: Next.js 15.3.3 + React 19.2.4
- **语言**: TypeScript 5.9 (严格模式)
- **样式**: Inline styles (非 Tailwind)
- **认证**: Privy (@privy-io/react-auth)
- **区块链**: Solana (@solana/web3.js, @solana/kit)
- **测试**: Vitest + Playwright

## 🎨 颜色方案

```typescript
const colors = {
    bg: '#F3F3F8', // 背景色
    surface: '#FFFFFF', // 表面色
    ink: '#16161A', // 文字主色
    lavender: '#C6BBFF', // 强调色
    lime: '#CDFF4D', // 成功/活跃色
};
```

## 📂 目录结构

```
apps/agentm-web/
├── docs/               # 本文档
├── src/
│   ├── app/           # Next.js App Router
│   ├── components/    # React 组件
│   ├── hooks/         # Custom Hooks
│   ├── lib/           # 工具库
│   └── types/         # TypeScript 类型
├── e2e/               # E2E 测试
└── public/            # 静态资源
```

## 🔗 相关链接

- [项目规范](../../../AGENTS.md)
- [贡献指南](../../../CONTRIBUTING.md)
- [项目 README](../README.md)

---

**最后更新**: 2026-04-05
**版本**: v0.1.0
